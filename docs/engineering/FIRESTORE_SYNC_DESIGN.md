# Firestore Sync Design

**Status as of 2026-11-06:** Firestore security rules and emulator tests exist. IndexedDB event+outbox persistence, monotonic sequencing, deterministic local projection replay, and first journal-first profile/plan mutation paths are implemented. The Firestore client, sync worker, remote acknowledgement, and cross-device data flow are not implemented. No live rules deployment has been verified.

## 1. Non-negotiable invariants

1. **Local-first:** memorization and review must work without network access. User actions must not wait for Firestore.
2. **Account isolation:** every local queue, remote document, cursor, and listener is scoped to the exact Firebase UID.
3. **No blind overwrite:** a cloud snapshot must never replace local unsynced progress.
4. **Idempotency:** replaying the same mutation after a timeout/reload must not count it twice.
5. **Append-only activity:** sessions, revision attempts, tests, and weak-verse mistakes are events, not mutable counters.
6. **Record-level sync:** do not place all plans, portions, and history in one Firestore document.
7. **No Quran text sync:** Quran text and metadata are static verified app assets, not user progress.
8. **No production migration without backup and approval.**

## 2. Current implementation state

### Already present

- Firebase Auth initialization and verified-user gating.
- UID-scoped localStorage for authenticated users; guest storage remains separate.
- A one-time decision for legacy local data ownership.
- Centralized weak-verse persistence through StorageService.
- Firestore rules at `firestore.rules`, emulator configuration at `firebase.json`, and CI tests in `scripts/firestoreRules.test.ts`.
- Rules currently require a verified authenticated user, enforce `request.auth.uid == uid`, allowlist subcollections, validate a generic schema-versioned envelope, deny physical deletes, and default-deny unknown paths.

### Not present / not verified

- No Firestore instance exported by `src/lib/firebase.ts`.
- No application `getFirestore`, `onSnapshot`, cloud repository, sync engine, or Firestore outbox drain/acknowledgement path.
- No cloud migration or remote merge path.
- Firestore rules have not been confirmed deployed to the production Firebase project.

### Current rules limitation

The existing rules validate a generic envelope but do not yet validate the complete payload shape for each collection, enforce all collection-specific size limits, or make event collections create-only. They are a tested foundation, not production-complete sync authorization.

## 3. Why not enable Firestore's persistent web cache by default

Firestore's web SDK uses memory cache by default. Persistent web cache is optional, but Firebase documents that its cache is **not automatically cleared between sessions** and that multiple writes to the same document use last-write-wins. That is risky for a browser where the user can sign out of one account and sign in to another.

For the first implementation, use Firestore's default memory cache and keep offline durability in WIRD's own UID-scoped local store + outbox. This gives us explicit control over account switching, retries, and conflict resolution. Revisit persistent cache only if we can prove account-safe cache isolation and clearing.

Reference: [Firebase — Access data offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## 4. Proposed architecture

```text
UI / domain services
        |
        v
UID-scoped local repository  <---->  local event ledger
        |                                  |
        |                                  v
        |                            durable outbox
        |                                  |
        v                                  v
localStorage (existing)              Sync coordinator
                                           |
                                           v
                                  Firestore adapter
                                           |
                                           v
                              users/{uid}/{collection}/{id}
```

- Domain services continue to read/write locally.
- A journaled local mutation creates a stable mutation ID and commits its immutable event plus outbox delivery record atomically in IndexedDB.
- The future sync coordinator will send bounded batches when online and when the signed-in UID is ready.
- A mutation is acknowledged only after the remote write is confirmed.
- Remote changes are merged into local state through pure merge functions.
- Sign-out/account switch stops listeners and leaves each UID's outbox untouched.

The sync service must not import React components. The Firestore adapter must not own Quran/domain rules. Merge logic must be pure and unit-testable without Firebase.

## 5. Proposed document model

All documents live below `users/{uid}`. Every collection has an explicit schema version and bounded payload.

| Subcollection | Document ID | Data semantics |
|---|---|---|
| `profile` | `main` | User preferences and profile fields; auth email comes from Firebase Auth, not duplicated as an authority |
| `plans` | stable plan ID | One preset plan per document |
| `enginePlans` | stable engine-plan ID | One generated plan per document; schedule tasks merge by stable task/day ID |
| `portions` | canonical portion ID | Current memorization/revision state for one canonical range |
| `weakVerses` | immutable event ID | One weak-verse/mistake event; aggregate counts are derived locally |
| `tests` | stable test-result ID | Immutable test attempt |
| `activityEvents` | immutable event ID | Memorization session, review completion, and other activity events |
| `syncMeta` | `state` | Schema version and per-collection pull cursors |

A portion document may carry its current projection plus a bounded history of uniquely identified review events. If history grows beyond a safe document size, history is moved to its own immutable event documents.

## 6. Mutation and outbox envelope

Each local mutation should contain:

- `mutationId`: UUID, globally unique per event/mutation.
- `uid`: implicit from the active local storage scope; never trust a UID supplied by a UI form.
- `collection` and `documentId`: strict allowlist.
- `operation`: `upsert` or `tombstone`.
- `schemaVersion`.
- `clientUpdatedAtMs`: diagnostics/order hint only; not the authoritative server order.
- `deviceId`: random per-install ID.
- `payload`: collection-specific validated object.
- `queuedAtMs` and retry metadata.

The event journal and outbox are persisted in UID-scoped IndexedDB. For authenticated profile/plan snapshots, enqueue and replay are serialized under a per-UID Web Lock; the event/outbox pair commits atomically before local projection. If enqueue fails, no localStorage fallback is performed. Guests and browsers without IndexedDB retain local-only persistence. Queue size and payload sizes are bounded; overflow produces a visible backup/sync warning, never silent deletion.

## 7. Conflict policy

### Immutable event collections

- `activityEvents`, `tests`, and `weakVerses` are create-only.
- Document ID is the event's stable UUID.
- A retry with the same ID is treated as already applied, not a second event.
- Events are never physically deleted by clients.

### Memorization portions

- Merge history by unique event ID.
- Preserve the most conservative status when simultaneous histories conflict; a failed/difficult review must not be overwritten by a stale success.
- Preserve the earliest next-due date when in doubt, so an unresolved review cannot be postponed silently.
- Preserve the latest reviewed timestamp, max mistake count, and all unique history events.
- Recompute derived metrics from the merged unique ayah/event set; never sum overlapping portions blindly.

### Plans

- Use stable plan IDs and transaction-based state updates.
- Merge independent schedule days/tasks by stable IDs.
- A completed task must not revert to pending because a stale device snapshot arrived.
- For truly conflicting edits to the same plan metadata, use a server-ordered version and surface a conflict when automatic merge is not safe.

### Daily logs and streaks

Do not sync the current aggregate `DailyLog` as a last-write-wins document. Two devices can each add activity to the same date and overwrite the other's increments. Sync immutable activity events and derive daily totals and streaks from the merged event ledger.

### Weak-verse counters

Do not sync an incrementing `mistakesCount` as a last-write-wins counter. Sync one immutable event per mistake and derive the count per Surah/ayah. This makes duplicate retries and concurrent devices safe.

## 8. Incremental sync and bounded writes

- Use server timestamps for remote ordering; client clocks are not authoritative.
- Store a cursor per collection, with a stable document-ID tie-breaker.
- Pull only records newer than the saved cursor; page through large result sets.
- Push only dirty outbox records in bounded batches well below Firestore's 500-write transaction/batch ceiling.
- State-document updates use transactions that read the remote version and apply the deterministic merge.
- Event writes use stable document IDs and create-only semantics.
- Do not mark rejected or failed mutations as acknowledged.
- Keep tombstones until all supported devices have had a chance to observe them; do not use an unsafe short time-based pruning window.

The incremental cursor/dirty-push pattern is inspired by the public Ummah Library sync ADRs, but WIRD will use Firestore's authenticated per-user documents and its own tested merge contracts rather than copying their AGPL-3.0 implementation.

## 9. Security-rule requirements before production

- Verified Firebase user and exact UID ownership.
- Collection allowlist and document-ID validation.
- Per-collection payload keys/types/ranges and maximum sizes.
- Event collections: create only; no update/delete.
- State collections: create/update only through valid envelope and merge version.
- Tombstones only for allowed state collections; physical delete denied.
- `syncMeta` writable only by the same UID and with bounded cursor fields.
- Default deny for every other path.
- Emulator tests for both allowed and denied cases, including cross-user access and malformed/oversized payloads.

The current rules satisfy the ownership/allowlist/generic-envelope foundation, but still need the collection-specific restrictions above.

## 10. Migration sequence

1. Export a local backup and capture a local data snapshot.
2. Fetch remote documents for the signed-in UID.
3. If remote is empty, seed it from local state through bounded idempotent mutations.
4. If both local and remote have data, merge by stable IDs and event semantics; never replace local arrays wholesale.
5. Verify counts and hashes after the merge.
6. Preserve the local snapshot until the user has confirmed sync on a second device.
7. Keep a rollback path: disable sync and continue using local data without deleting cloud documents.

## 11. Required tests

- Unit tests for event ID idempotency, outbox atomicity, merge functions, and cursor pagination.
- Firestore emulator rules tests for every collection and every forbidden operation.
- Two-client integration tests: concurrent new portions, same-portion reviews, weak-verse failures, same-day activity, plan task completion.
- Offline tests: create event offline, close/reopen, reconnect, replay, and verify exactly one remote event.
- Account-switch tests: account A's local/outbox/cache never appears under account B.
- Migration tests: local-only, cloud-only, both populated, partial upload, retry after failure.
- Quran integrity tests remain separate and must continue to pass unchanged.

## 12. Release gate

Cloud sync is not complete until the two-device emulator suite passes, production rules are reviewed and deployed with approval, and a real two-device test verifies offline replay and account isolation. A green frontend build or a Vercel deployment alone does not satisfy this gate.


## 13. Implementation status — 2026-11-06

The following foundation has been implemented and merged:

- PR #30: UID-scoped IndexedDB stores for append-only events, outbox delivery state, acknowledgements, and device metadata. Each event/outbox pair commits in one IndexedDB read/write transaction.
- PR #31: atomic and idempotent migration from the v1 localStorage outbox. The old localStorage value remains a recovery copy because older tabs may still write it; changed snapshots are merged by stable mutation fingerprints.
- PR #32: the `LocalSyncOutbox` facade now exposes asynchronous IndexedDB enqueue, ready-list, acknowledgement, retry, and snapshot operations.
- Automated coverage includes cross-tab duplicate enqueue, transaction abort atomicity, acknowledgement, retry scheduling, UID isolation, migration conflicts, incremental stale-tab migration, and database reopen recovery.

**Not implemented yet:**

- Production mutation paths do not yet invoke the legacy `LocalSyncOutbox` facade. PR #37 adds direct journal-first writes for authenticated profile settings/theme, preset plans, and engine-plan snapshots. Session activity/profile streak, canonical portions/revision, weak verses, tests, backup import/reset, and other mutation paths are not yet journal-first.
- PR #36 adds deterministic UID-scoped journal-to-localStorage projection replay before authenticated app state initializes, with sequence-ordered cursor advancement after verified projection.
- No Firestore repository, listener, sync worker, cloud outbox drain, or server acknowledgement flow is active.
- Firestore rules have emulator coverage, but production deployment and two-device/offline integration remain unverified.

### Next implementation sequence

1. Define per-UID monotonic event sequencing and a durable projection cursor.
2. Implement idempotent journal-to-local projection replay before connecting UI mutations. Advance the cursor only after the local projection is verified; a crash between projection and cursor update must safely replay the same event.
3. Extend journal-first mutation adapters from profile/plans to canonical portions/revision, then design grouped atomic event+projection semantics for weak-verse, tests, and activity/session actions. Daily logs and weak-verse counters must remain derived from immutable events.
4. Implement Firestore draining, server acknowledgements, tombstones, retry/backoff, and collection-specific security rules.
5. Pass two-account/two-device/offline/online tests before enabling cloud sync for users.

Do not describe the IndexedDB foundation as completed cloud sync. Keep the current local-only behavior available until the complete release gate in Section 12 passes.


### PR #34 update — monotonic sequencing and projection cursor

PR #34 has implemented the first item in the sequence above:

- IndexedDB schema v2 stores a unique `(uid, sequence)` index.
- v1 event history is deterministically backfilled during upgrade.
- New event sequence allocation is transactionally coupled to the event/outbox append.
- `listEventsAfter`, `getProjectionCursor`, and contiguous-only `markProjected` are available.

The projection cursor is currently only a storage primitive. No event-to-localStorage projector is wired into `AuthGate` yet, and no domain mutation call sites are writing journal events. Do not advance the cursor until the corresponding local projection has been successfully written and verified.


### PR #36 update — deterministic local projection replay

- PR #36 merged as `9b76227b9498b23fa79fb39264d4b4be98fa16e4`.
- Added a UID-scoped deterministic replay coordinator that runs before authenticated App state reads localStorage.
- Legacy events marked as already projected are skipped; new journal-first events are applied through validated StorageService projection handlers, verified, then advance the contiguous cursor.
- Replay is protected by Web Locks across tabs; the local-only browser fallback remains available when IndexedDB is unavailable.

### PR #37 update — first journal-first domain writes

- PR #37 merged as `60d475d1f4f06ea4a852751e1548297d9c7dc6de`.
- Profile settings/theme, preset-plan snapshots, and engine-plan snapshots now commit an IndexedDB event/outbox pair before local projection. Snapshot enqueue and replay share one per-UID lock, and pre-existing events are replayed before a new snapshot can be appended.
- If replay recovers an older event that changes local state, the current stale caller snapshot is blocked; the UI refreshes from the recovered local projection before the user retries.
- Guest and no-IndexedDB paths remain local-only; an IndexedDB enqueue failure does not silently fall back to localStorage.

**Remaining implementation boundary:** `recordSessionCompletionDetailed` still updates activity logs/profile streak locally, and the canonical portion/revision, weak-verse, test-result, backup import/reset, and multi-archive session flows are not yet journal-first. No Firestore sync worker, listener, cloud acknowledgement, production rules deployment, or two-device sync is active.
