# WIRD Engineering Roadmap

**Updated:** 2026-11-06  
**Source of truth:** `main` — Google AI Studio is connected to this branch.  
**Current audited HEAD:** `00543fd826f4e03ae14cf9eacd5dd018e6e9af34`

## Operating rules

1. Work only from the latest `main`; do not merge an old divergent feature branch wholesale.
2. Before each milestone, record the current commit and preserve a recoverable checkpoint.
3. Keep each milestone small enough to review. Commit it to `main` only after code review, automated tests, TypeScript, production build, and the relevant emulator/integration tests pass.
4. Do not run destructive migrations or deploy production Firestore rules without explicit approval.
5. Preserve all local progress. Cloud data must never replace local progress merely because it is newer by a client clock.
6. Never generate or modify Quran text. Static Quran text remains sourced from the verified bundled dataset.
7. A green Vercel check proves a build/deployment check for that commit; it does not prove Firebase rules were deployed or cloud sync works.

## Baseline and repository findings

- At the start of this work, `main` contained 97 tracked files.
- `main` is the only branch to receive final work. `feat/phase5-premium-ui-ux` was 115 commits ahead and 48 behind at inspection time; it contains useful isolated fixes, but is too divergent for a wholesale merge.
- Account-scoped local storage already exists: authenticated data is keyed by Firebase UID, guest data remains separate, and legacy data has an explicit one-time ownership decision.
- Firebase Authentication is initialized in `src/lib/firebase.ts`; the application did not yet initialize Firestore or contain a cloud sync engine/outbox.
- `firestore.rules`, `firebase.json`, and emulator security-rule tests exist. Rules are **not confirmed deployed** to the live Firebase project.
- The user reports that `https://wird-app.vercel.app/#/dashboard` is live. The Vercel check for the current audited commit is green.

## Milestones

### M0 — Baseline audit and safe working process
**Status: completed for initial baseline.**

- Captured the initial `main` SHA and repository tree.
- Reviewed auth gating, UID-scoped storage, backup/restore, retention, daily planning, Quran page mapping, PWA, serverless API, Firestore rules, and the existing test workflow.
- Identified the absence of a Firestore client/sync implementation and stale engineering documentation.
- Selected relevant patterns from Ummah Library's public sync ADRs for review only; no AGPL code was copied.

### M1 — Memorization/revision correctness
**Status: implemented and CI-verified.**

- Separate review sessions from new memorization sessions.
- A review session records reviewed pages and does not create new memorization progress.
- The session completion UI displays review-specific labels and actual saved streak data.
- Added regression tests for review/memorization isolation.

### M2 — Local persistence and progress accuracy
**Status: implemented and CI-verified; continue auditing call sites.**

- Session activity + streak update reports failure and rolls back the activity log if the profile write fails.
- A failed localStorage write no longer leaks through the in-memory fallback as if it had been saved.
- Save methods return explicit success/failure; important UI paths surface failures.
- Backup import UI checks the explicit result flag and reports read/import failures accurately.
- Failed backup imports verify the previous localStorage/memory snapshot was restored; failure to restore is reported distinctly.
- Weak-verse reads now validate the archive and throw a recovery-safe error on malformed/corrupt data instead of returning `[]`; saves validate bounded fields. This prevents a later mistake update from overwriting a damaged archive.
- Weak-verse writes validate Surah/ayah coordinates against canonical Quran metadata. The revision center degrades safely if the weak-verse archive is damaged, and revision rating now restores its portion/archive snapshot when dependent writes fail.
- Retention mutations fail visibly if canonical progress cannot be persisted.
- Overlapping memorization portions count each ayah once in the retention score; the weakest overlapping status wins.
- Review page counts use canonical Mushaf page/ayah mappings rather than an estimate.

### M3 — Daily task selection and plan correctness
**Status: implemented and CI-verified.**

- Additional regression fix: resume the exact persisted in-progress passage rather than clipping it to the daily target and leaving a parent range that repeats the same ayah. End coordinates are clamped to the canonical Surah verse count. Verified by CI run `42169589580`.

- Dashboard selects only due/overdue engine-plan tasks, never a future task.
- Preset plans remain within their explicit ayah/Surah scope.
- Page/Juz plans are not silently widened to whole Surahs when no exact ayah resolver exists.
- The next uncovered range is selected instead of repeatedly starting at the first ayah.
- Review selections open in review mode.
- In-progress passages resume at their exact stored coordinates instead of clipping to a daily target and repeating the same start ayah.
- Whole-page status changes are prepared as one canonical update and persisted with a single write.
- Completing a memorization task updates the matching engine-plan task without marking other pending revision tasks complete.

### M4 — Local event ledger and durable outbox
**Status: partially prepared; event ledger integration remains the highest-priority next engineering milestone.**

Before Firestore writes are enabled:

- Introduce stable UUID mutation/event IDs (outbox/device identity primitive is already implemented and tested).
- Convert session completion and review activity from one mutable per-day aggregate into append-only events; derive daily logs from the event ledger.
- Represent weak-verse mistakes as immutable events or another concurrency-safe structure rather than a cross-device incrementing counter.
- Ensure each local domain mutation and its outbox record are committed together, or rolled back together.
- Add retry-safe, bounded outbox storage scoped by Firebase UID (foundation exists; wire it to domain writes).
- Add tests for duplicate mutation IDs, crash/reload, quota errors, queue overflow, and account switching.

### M5 — Firestore adapter and conflict-safe merge
**Status: not started.**

- Add Firestore initialization with memory cache only initially; do not enable persistent Firestore cache by default on shared browsers.
- Implement per-user, per-record documents; never sync all user data as one large document.
- Use immutable event documents for session/revision/test/weak-verse events.
- Use transactions for mutable state documents and deterministic merge functions.
- Add tombstones for deletion; prohibit physical deletes from clients.
- Use server timestamps and per-collection incremental cursors; bound push/pull batches.
- Do not acknowledge an outbox mutation until the remote write is confirmed.
- Keep local progress readable and writable while offline.

### M6 — Rules hardening and emulator integration
**Status: partially complete.**

Already present:
- UID ownership and verified-email requirement.
- Allowlisted user subcollections.
- Generic sync envelope validation.
- Physical deletes denied; tombstones are the intended deletion model.
- Firestore emulator security-rule tests in CI.

Still required before live rollout:
- Collection-specific payload schemas and size limits.
- Immutable create-only event collections.
- Validate document IDs and tombstone shapes.
- Integration tests for two devices, concurrent writes, retries, stale snapshots, duplicate events, account isolation, and offline replay.
- Verify that every client operation is covered by a positive and negative rules test.

### M7 — Controlled rollout
**Status: not started.**

1. Export a local backup before migration.
2. Deploy reviewed Firestore rules to the intended Firebase project only after approval.
3. Enable sync behind a feature flag for the signed-in account.
4. Test on two devices with the same account and a second account on the same browser/device.
5. Test offline work, reload, reconnect, duplicate retry, conflicting edits, and restore.
6. Only then enable sync by default. Keep local export/restore available permanently.

## Required acceptance tests for cloud sync

- A session saved offline survives tab close/reopen and syncs once online.
- Retrying the same mutation never double-counts ayahs, minutes, streaks, or weak-verse mistakes.
- Two devices adding different portions preserve both.
- Two devices reviewing the same portion preserve both review-history events.
- A failed review on one device cannot be erased by a stale successful snapshot from another device.
- A future plan task never becomes due early.
- Switching from account A to account B never displays A's local or cloud data.
- A stale remote snapshot never overwrites newer local unsynced data.
- Deletions propagate as tombstones and cannot resurrect deleted records.
- Quran text is never part of the user-progress sync payload.

## Current next action

Continue the file-by-file audit, then implement M4's append-only local event ledger and atomic domain/outbox integration with unit tests. The outbox foundation exists, but no cloud sync is active. Do not begin production Firestore writes until M4 and the merge tests pass.
