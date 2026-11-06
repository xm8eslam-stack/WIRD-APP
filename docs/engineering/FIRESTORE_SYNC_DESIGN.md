# Firestore Sync Design

**Current status after PR #52 (2026-11-06):** The UID-scoped IndexedDB journal, atomic event+outbox persistence, monotonic sequencing, deterministic local projection replay, grouped local projection rollback, and journal-first mutation paths for profile/plans, page progress, manual portions, tests, weak-verse failure/resolution, revision ratings, session completion + matching smart-plan task, and backup import/reset are implemented. The Firestore client, sync worker, remote acknowledgement, immutable remote event model, and cross-device data flow are not implemented. No live rules deployment has been verified. Vercel rate limiting is not a merge blocker by owner instruction, but production deployment remains unconfirmed.

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
- UID-scoped IndexedDB append-only event journal, outbox delivery state, acknowledgements, device metadata, monotonic sequence allocation, and contiguous projection cursor.
- Atomic IndexedDB event+outbox append and deterministic replay into validated local projections before authenticated app state initializes.
- Cross-tab serialization of journal enqueue/replay through Web Locks; stale snapshots are blocked when replay recovers earlier events.
- Journal-first authenticated profile settings/theme, preset-plan snapshots, and engine-plan snapshots (PR #37).
- Journal-first canonical page-status snapshots in Progress Analytics (PR #40).
- Journal-first manual canonical portion additions (PR #41).
- Journal-first test-result snapshots with stable result IDs, idempotent retry, and conflicting-ID rejection (PR #42).
- Versioned grouped transaction envelope and rollback-verified multi-archive local projection primitive; affected storage keys are snapshotted and restored as a group (PR #43).
- Journal-first weak-verse failure recording: canonical weak portion + weak-verse counter are grouped under one event/outbox pair, with stable mutation identity and durable preflight reads (PR #44).
- Journal-first weak-verse resolution with durable read preflight, stable retry identity, and idempotent repeated resolution (PR #45).
- Journal-first session completion groups canonical memorization progress, activity/profile streak, and the matching smart-plan task in one event (PRs #50/#51).
- Journal-ordered backup import and factory reset replay older pending events first and commit grouped snapshots with recovery tests (PR #52).
- The active Revision Center rating path already prepares and commits portion + optional weak-verse + activity/profile projections as one journal transaction.
- Firestore rules at `firestore.rules`, emulator configuration at `firebase.json`, and CI tests in `scripts/firestoreRules.test.ts`.
- Rules currently require a verified authenticated user, enforce `request.auth.uid == uid`, allowlist subcollections, validate a generic schema-versioned envelope, deny physical deletes, and default-deny unknown paths.

### Not present / not verified

- Test results and weak-verse state are currently represented by journaled full-snapshot projections. This is not yet the final immutable remote event model required by the invariants below; daily logs and weak-verse counters must be derived from immutable events before cloud sync.
- No Firestore instance exported by `src/lib/firebase.ts`.
- No application `getFirestore`, `onSnapshot`, cloud repository, sync engine, or Firestore outbox drain/acknowledgement path.
- No cloud migration or remote merge path.
- Firestore rules have not been confirmed deployed to the production Firebase project.
- Real two-device/two-account/offline synchronization has not been implemented or tested.

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


## 13. Implementation status — 2026-11-06 (PR #45)

### Completed local journal foundation and mutation slices

- PR #30: UID-scoped IndexedDB event journal and atomic event+outbox transaction.
- PR #31: non-destructive, idempotent migration from the legacy localStorage outbox.
- PR #32: asynchronous IndexedDB outbox facade.
- PR #34: monotonic per-UID event sequencing and contiguous projection cursor.
- PR #36: deterministic UID-scoped local projection replay before authenticated app initialization.
- PR #37: journal-first profile settings/theme, preset plans, and engine-plan snapshots.
- PR #40: journal-first canonical page-status snapshots.
- PR #41: journal-first manual canonical portion additions.
- PR #42: journal-first test-result snapshots with stable IDs and idempotent retries.
- PR #43: grouped transaction envelope, one event+outbox pair for multiple local projections, and rollback/read-back verification.
- PR #44: grouped journal-first weak-verse failure recording across canonical portions and weak-verse counter snapshots.
- PR #45: journal-first weak-verse resolution; idempotent and isolated from canonical portion rating/schedule.

Exact-head PR and push Quality Gates passed for PRs #43, #44, and #45. Post-merge main Quality Gates passed after PR #43 (run `42258433095`) and PR #44 (run `42261020224`). Post-merge main run `42262136009` for PR #45 **passed** on the exact main SHA.

### Remaining local mutation work

- Journal-first revision ratings, grouping canonical portions, optional weak-verse changes, activity logs, and profile streak into one event.
- Journal-first memorization/session completion and related activity/profile/plan changes.
- Journal backup import/reset with pending-event ordering, crash recovery, and quota handling.
- Audit every remaining domain mutation path and confirm that no stale snapshot can be appended behind an unreplayed event.
- Add failure injection for durable-read failure, partial child projection failure, rollback-verification failure, quota exhaustion, blocked IndexedDB, and reload recovery across each mutation type.

### Event-model work required before cloud sync

- Current test-result and weak-verse flows journal full-snapshot local projections. The journal itself is append-only, but this does not yet satisfy the intended immutable remote event model.
- Define immutable event records for sessions, revision attempts, tests, and weak-verse mistakes; derive daily logs, counters, and dashboard metrics locally.
- Specify deterministic remote conflict handling, tombstones, bounded pull/push, acknowledgements, retry/backoff, and server-side idempotency.
- Expand Firestore rules from generic-envelope validation to collection-specific schemas, size limits, create-only event rules, and validated tombstones.

### Next implementation sequence

1. Finish the remaining local mutation audit and recovery failure-injection tests.
2. Add immutable domain events and deterministic aggregate derivation for activity, revision, tests, and weak-verse mistakes.
3. Finalize the per-record Firestore document model and deterministic conflict policy.
4. Implement the Firestore adapter/worker, remote acknowledgements, retries/backoff, tombstones, collection-specific rules, and two-device/offline tests behind an inactive feature gate.
5. Deploy production rules and activate cloud writes only after backup/migration review, explicit approval, and the full release gate passes.

Do not describe this IndexedDB foundation as completed cloud sync. Keep the current local-only behavior available until the complete release gate in Section 12 passes.
