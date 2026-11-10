# WIRD Sync Engineering Continuity Checkpoint

Last updated: 2026-11-10 (follow-up review of weak-verse, session, and remote projection paths)

This document preserves the current cloud-sync engineering state and the next safe investigation steps. Update it whenever sync behavior, release status, or known risks change.

## Repository and release baseline

- Repository: `xm8eslam-stack/WIRD-APP`
- Production branch: `main`
- Production deployment is driven by GitHub `main` -> Vercel.
- Work on feature branches and use pull requests. Do not commit directly to `main`.
- Do not change production secrets/settings, Firebase rules, or Firestore schema without explicit user approval.
- Never expose secret values in logs, notes, prompts, or reports.
- Distinguish automated CI, merge, Vercel deployment readiness, and real live-device verification.

## Confirmed sync release state

- PR #197 merged: grouped `syncMeta` keep-local operations are handled atomically in IndexedDB; unsupported tombstones and unsupported operations fail closed.
- PR #198 merged and deployed to Production.
  - PR: https://github.com/xm8eslam-stack/WIRD-APP/pull/198
  - Tested PR head: `0709b25663b0b52d151bff8de7508823dad89eee`
  - Merge commit / main head at release: `c6befabbacbb5f7ad6351e9dca6c604408713285`
  - Vercel deployment: `dpl_DcQBhZU4QVrtZm1qoV8CwUryez9J`
  - Deployment state: `READY`
  - Production alias: `wird-app.vercel.app`
- PR #198 CI passed automated tests, TypeScript, Firestore Security Rules Emulator, production build, smoke test, and desktop/mobile browser smoke tests.
- PR #198 tests snapshot semantics:
  - `documentId === "snapshot"`: authoritative full replacement for backward compatibility.
  - Per-result document IDs: merge by immutable result ID; reject duplicate IDs with conflicting content; newest-first; capped at 50.
  - Recovery projection matching uses the same merge helper.
- The user manually tested account sync across two devices and confirmed it works. Treat this as a successful user-reported live test.
- Production has the revisioned sync and remote projection flags enabled. Do not toggle them without explicit approval.
- `ISLAMICAPI_API_KEY` is configured in Vercel; never read or disclose its value.

## Sync architecture and safety invariants

- Local data is persisted through IndexedDB/local storage and journal/outbox projection paths.
- `syncMeta` stores one transaction document per mutation ID. Transaction payload is version 1 and contains ordered operations.
- Grouped journal transactions support 1..8 operations, one operation per collection, and currently only `upsert`.
- `applyJournalTransaction` applies affected local projections atomically with rollback across affected local storage keys.
- Important implementation detail: grouped transaction projection currently calls `applyJournalProjection(operation.collection, operation.payload)` without forwarding `operation.documentId`. The current affected operations use full snapshot IDs, but this prevents future document-scoped behavior from being inferred from the operation metadata.
- Tombstones are not generally supported end-to-end:
  - Local outbox creation path rejects tombstones.
  - Inbox projection blocks tombstones and retains the event rather than advancing past it.
  - Firestore rules reject tombstone writes and physical document deletion.
  - Do not enable tombstones or infer deletion semantics without a per-collection design and tests.
- A full snapshot replacement can overwrite another device's independently changed records. A naive union can resurrect deleted records. A naive sum can double-count replayed data.

## Collection review status

| Collection | Current projection semantics | Status / safe next step |
|---|---|---|
| `profile` | Single main profile projection | Review callsites and conflict policy before changes. |
| `plans` | Full snapshot replacement | Review identity, concurrent edits, and deletion semantics. |
| `enginePlans` | Full snapshot replacement | Review identity, concurrent edits, and deletion semantics. |
| `portions` | Full snapshot replacement | Review identity, concurrent edits, and deletion semantics. |
| `weakVerses` | Full list replacement | Confirmed: first failure creates ID `weak-{surah}-{ayah}-{mutationId}`; later failures update the same record by coordinate and retain its ID. Independent first failures on two devices can therefore create different IDs for the same verse. Resolution filters the local list by ID and persists a full snapshot. Do not union by ID, add counters, or merge by coordinate until deletion and concurrent-failure semantics are designed. |
| `tests` | Snapshot replacement for legacy snapshot ID; immutable per-result ID merge otherwise | PR #198 fix is deployed. |
| `activityEvents` | Full replacement of daily aggregate logs | `DailyLog` is one aggregate per date, not immutable session events. Session completion does carry a stable mutation ID and a `session.completed` domain-event payload, but its local projection still writes the full daily aggregate snapshot. Investigate whether a separate event-derived projection can be added without breaking legacy summaries. Do not sum aggregates. |
| `ruqyahProgress` | Full snapshot replacement, with a dedicated V2 counter merge path under constrained conditions | Keep its existing dedicated merge rules separate from other collections. |
| `syncMeta` | Independent transaction documents keyed by mutation ID | Preserves grouped operations and optional domain-event payloads; remote projector validates and applies child projections atomically. Preserve ordering, idempotent application, and local transaction atomicity. |

## Data shapes confirmed so far

### Weak verses

`WeakVerseItem` fields:
- `id`
- `surahNumber`
- `ayahNumber`
- `surahName`
- `text`
- `mistakeCount`
- `lastFailedDate`
- optional `notes`

Validation checks coordinate validity and duplicate verse coordinates in backup payload validation. The recording builder creates a mutation-scoped ID for a newly seen verse, then locates subsequent updates by Surah/Ayah coordinate and increments the local counter. The resolution builder filters by record ID and returns a replacement snapshot. Because tombstones are unsupported, a resolved record may be reintroduced by another device's older full snapshot. The event types `weak_verse.failed` and `weak_verse.resolved` exist in the domain-event schema, but the reviewed builder only returns snapshot operations; verify actual UI callsites before assuming those event types are emitted.

### Activity logs

`DailyLog` fields:
- `date`
- `memorizedAyahsCount`
- `reviewedPagesCount`
- `minutesSpent`
- `completedTasks[]`

Validation requires unique dates, non-negative counts, and minutes no greater than 1440. This is a daily aggregate, not an append-only event stream. Session completion builds an updated aggregate for the day and groups it with profile and sometimes portion/engine-plan snapshots under a stable mutation ID. Replaying the same journal mutation is idempotent at the journal layer, but two distinct session mutations from separate devices still compete as full snapshots. Summing two device snapshots can double-count retries or duplicate logical sessions; selecting one snapshot can lose the other device's work.

## Known implementation paths

- `src/services/storageService.ts`
  - `applyJournalProjection` dispatches collection projections.
  - `weakVerses` currently calls `saveWeakVerses(payload.records)`, replacing the whole list.
  - `activityEvents` currently calls `saveLogs(payload.records)`, replacing the whole list.
  - `tests` uses the PR #198 merge helper except for authoritative legacy snapshot documents.
  - `applyJournalTransaction` currently does not pass each operation's document ID into `applyJournalProjection`.
  - `saveWeakVerses` validates then replaces the full list.
  - `saveLogs` validates unique dates then replaces the full list.
  - `matchesJournalProjection` has exact projection matching for activity logs; inspect weak-verse matching too.
- `src/services/weakVerseRecording.ts`
  - `buildWeakVerseFailureTransaction` builds full snapshots for `portions` and `weakVerses`; newly added IDs include the mutation ID.
  - Existing failures find the verse by coordinate and increment `mistakeCount`; notes are replaced only when a non-empty note is supplied.
  - `buildWeakVerseResolutionSnapshot` filters a record ID from the full current list.
  - A legacy synchronous path is explicitly deprecated for authenticated UI.
- `src/services/sessionPersistence.ts`
  - `persistJournaledSessionCompletion` uses a stable retry mutation ID (or creates one), emits a `session.completed` domain event, and writes `activityEvents/snapshot` plus `profile/main` in the same grouped transaction, optionally including portion and engine-plan snapshots.
  - Its activity projection is still the full daily `DailyLog[]` snapshot built by `StorageService.buildSessionCompletionSnapshot`.
- `src/services/domainEvents.ts`
  - Defines `session.completed`, `weak_verse.failed`, and `weak_verse.resolved` event types and validation.
- `src/services/remoteInboxProjector.ts`
  - Generic remote conflict gate blocks pending local mutations, base-revision mismatches, and tombstones; it preserves conflicts and does not advance the projection cursor past an unresolved event.
  - A special V2 Ruqyah counter merge exists; there is no equivalent weak-verse or daily-activity merge in the reviewed path.
- `src/services/journaledSnapshotService.ts`
  - Snapshot persistence helpers exist for profile, plans, engine plans, portions, ruqyah progress, and test results.
  - Test result documents use immutable `test.id`.
  - Grouped transactions are persisted in `syncMeta` using mutation ID as document ID.
  - No dedicated `persistWeakVersesSnapshot` or `persistActivityEventsSnapshot` helper was found in the previous review.
- `src/types/quran.ts` defines `WeakVerseItem` and `DailyLog` as above.

## Immediate investigation plan

1. Inspect actual weak-verse UI callsites and confirm whether domain events are emitted for failure and resolution. Check whether the caller persists the returned snapshots as grouped `syncMeta` transactions or standalone snapshots.
2. Inspect `matchesJournalProjection` for weak verses and grouped transaction replay, including the document-ID forwarding omission.
3. Inspect all daily-log writers and the exact behavior of `StorageService.buildSessionCompletionSnapshot`; confirm whether completed task strings contain stable IDs or only labels.
4. Design weak-verse reconciliation with explicit semantics for:
   - two devices independently recording the same previously unseen verse;
   - two devices updating the same existing record;
   - notes/text conflicts;
   - resolve/delete on one device while a stale failure remains on another;
   - replay and duplicate mutation IDs.
5. Design activity reconciliation around immutable session IDs or a bounded event ledger. Preserve legacy `DailyLog` backups and summaries; do not derive sums from two aggregate snapshots.
6. Add narrow tests before changing behavior:
   - replay idempotency;
   - same-verse updates from two devices;
   - conflicting notes/content;
   - deletion does not resurrect;
   - grouped transaction atomicity and document-ID forwarding;
   - same logical activity session replayed twice does not double-count.
7. Implement only semantics proven by the callsites and data model. If correct activity merging requires a schema migration or new event model, document the design and leave the current projection unchanged until separately approved.
8. Run relevant targeted tests, full CI, TypeScript, rules emulator, production build, and browser smoke tests on the exact PR head SHA. Recheck the SHA before merge.
9. After merge, verify Vercel deployment and report separately whether live device verification was performed.

## Non-negotiable safety rules

- Never use blind numeric addition for replayable snapshots.
- Never use union-only merging when deletions are possible.
- Never silently resolve conflicting user notes or verse text by timestamp alone.
- Never bypass a blocked tombstone by advancing the inbox cursor.
- Never change Firestore rules/schema or production sync flags without explicit approval.
- Preserve old backup compatibility and local-first access.
- If a collection cannot be merged without data loss, fail closed and document the limitation rather than silently overwriting or inventing a merge.



## Latest checkpoint update — after PR #200 merge

- PR #200 is merged to `main` at `5a866f22c254fd35b9c487f7d69546e6b691a9d3`. Its exact head `7ed3af44291cf439b89625e30722750a9366e3e8` passed the full GitHub Quality Gate. Grouped child `documentId` is now forwarded for apply and recovery; test snapshot vs per-result merge semantics remain distinct.
- No Vercel deployment record exists for that merge SHA because the PR's Vercel status was blocked by the Free-plan `build-rate-limit`. Do not claim this fix has reached Production.
- PR #201 is open for the next verified issue: revision-rating profile projection uses document ID `profile`, while other profile writers use `main`. This splits one logical profile across separate revision/conflict streams. The fix changes it to `main` and adds a regression assertion; exact-head CI is pending.
- Weak-verse and daily activity remain full-snapshot projections and are not safe to union or add. Tombstones remain fail-closed.



## Latest production verification — after PR #201

- PR #201 merged as `12468243db7707c19a1bf75823ca1dc6e09f9ad8`; exact PR head `fa6ef0ab821ea3ca9cea8ae59fd3197f75400fcf` passed GitHub Quality Gate run `42777475075`.
- Production deployment `dpl_d4u8eFLiZoxAwnd6UW5tQk8GPTKt` reached `READY` on `wird-app.vercel.app`, with exact source SHA `12468243db7707c19a1bf75823ca1dc6e09f9ad8`.
- The deployed tree contains both PR #200 (grouped child document-ID forwarding and recovery semantics) and PR #201 (canonical `profile/main` identity for revision-rating updates).
- The earlier Vercel PR check rate-limit did not prevent the subsequent main deployment; the verified Production deployment above supersedes those preview-check failures.
- The last user-reported two-device test occurred before these two latest fixes. A fresh physical-device round trip after this deployment remains unverified.
- No Firestore production rules/schema, secrets, or sync flags were changed.



## Latest continuation — snapshot compare-and-set protection

- PR #203 adds compare-and-set base fingerprints for weak-verse and daily-activity snapshots to prevent grouped transactions from silently replacing a divergent archive on another device.
- A mismatch fails closed and leaves the remote inbox cursor blocked with local evidence archived. Legacy events can bootstrap empty archives or replay identical state only. Explicit verified use-remote conflict resolution retains its override path.
- No automatic addition/union or tombstone behavior is introduced; Firestore rules/schema remain unchanged. Exact-head CI is pending.
- PR #202 for adjustable memorization display and whole-session verse view merged to main as `f30f45299fca27a22a3b536aaa49c01d96a75553`; exact-head CI passed. Production deployment remains unverified.
