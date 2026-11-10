# WIRD Sync Engineering Continuity Checkpoint

Last updated: 2026-11-10

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
- Important implementation detail to verify/fix: grouped transaction projection currently calls `applyJournalProjection(operation.collection, operation.payload)` without forwarding `operation.documentId`. Do not assume per-document projection semantics are active for grouped operations.
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
| `weakVerses` | Full list replacement | Investigate stable identity and update/delete semantics; do not sum counters or merge notes blindly. |
| `tests` | Snapshot replacement for legacy snapshot ID; immutable per-result ID merge otherwise | PR #198 fix is deployed. |
| `activityEvents` | Full replacement of daily aggregate logs | `DailyLog` is one aggregate per date, not immutable session events. Correct cross-device merge needs event IDs or another idempotent model. Do not sum aggregates. |
| `ruqyahProgress` | Full snapshot replacement | Review progress identity and conflict semantics before changing. |
| `syncMeta` | Independent transaction documents keyed by mutation ID | Preserve ordering, idempotent application, and atomic local projection. |

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

Validation checks coordinate validity and duplicate verse coordinates in backup payload validation. Each record has a verse coordinate, but the intended stable ID generation and update/delete callsites still need inspection. Do not assume `id` is deterministic or that counters are additive.

### Activity logs

`DailyLog` fields:
- `date`
- `memorizedAyahsCount`
- `reviewedPagesCount`
- `minutesSpent`
- `completedTasks[]`

Validation requires unique dates, non-negative counts, and minutes no greater than 1440. This is a daily aggregate, not an append-only event stream. Summing two devices' snapshots can double-count the same session; selecting one snapshot can lose the other device's work.

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
- `src/services/journaledSnapshotService.ts`
  - Snapshot persistence helpers exist for profile, plans, engine plans, portions, ruqyah progress, and test results.
  - Test result documents use immutable `test.id`.
  - Grouped transactions are persisted in `syncMeta` using mutation ID as document ID.
  - No dedicated `persistWeakVersesSnapshot` or `persistActivityEventsSnapshot` helper was found in the previous review.
- `src/types/quran.ts` defines `WeakVerseItem` and `DailyLog` as above.

## Immediate investigation plan

1. Inspect all weak-verse mutation callsites and ID generation:
   - add/update/remove operations;
   - whether the ID is deterministic from surah/ayah or random;
   - whether records can be removed and how removal is persisted;
   - whether text/notes/counter changes are whole-record updates or separate events.
2. Inspect weak-verse journal persistence and `matchesJournalProjection`.
3. Inspect daily-log writers, especially session completion and grouped transactions:
   - determine whether multiple devices can write the same date;
   - identify whether any existing stable session/mutation IDs can be reused without schema migration;
   - preserve legacy `DailyLog` readers and backups.
4. Add narrow tests before changing behavior:
   - replay idempotency;
   - same-verse updates from two devices;
   - conflicting notes/content;
   - deletion does not resurrect;
   - grouped transaction atomicity and document-ID forwarding;
   - same logical activity session replayed twice does not double-count.
5. Implement only semantics proven by the callsites and data model. If correct activity merging requires a schema migration or new event model, document the design and leave the current projection unchanged until separately approved.
6. Run relevant targeted tests, full CI, TypeScript, rules emulator, production build, and browser smoke tests on the exact PR head SHA. Recheck the SHA before merge.
7. After merge, verify Vercel deployment and report separately whether live device verification was performed.

## Non-negotiable safety rules

- Never use blind numeric addition for replayable snapshots.
- Never use union-only merging when deletions are possible.
- Never silently resolve conflicting user notes or verse text by timestamp alone.
- Never bypass a blocked tombstone by advancing the inbox cursor.
- Never change Firestore rules/schema or production sync flags without explicit approval.
- Preserve old backup compatibility and local-first access.
- If a collection cannot be merged without data loss, fail closed and document the limitation rather than silently overwriting or inventing a merge.
