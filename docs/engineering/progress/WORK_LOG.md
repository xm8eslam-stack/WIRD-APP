## 2026-11-12 01:31 +02:00 — Exact-head runner diagnosis and preview verification

- Rechecked PR #363 head `acdfeef4e4baf99251e4768bbbc808fabab4f130` and run `43120106137` / job `130858118105`. GitHub reports completed failure after about two seconds, `steps=null`; log download returns `BlobNotFound`; one annotation is counted but not retrievable. This is unresolved job/runner evidence, not a test-level failure or a pass.
- Vercel deployment `dpl_CcBtjR4TRcqJd9pNwSZTvkgS2LHA` is READY on the exact PR head `acdfeef4e4baf99251e4768bbbc808fabab4f130`; current main Production remains READY on `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. Preview is not Production and no live browser smoke was run.
- Updated PR #363 description to the exact checked head, run, Preview deployment, and HOLD decision.
- The changed-file relative-link check covered all 28 PR files and found 0 broken relative Markdown links; repository listing confirmed 43 Markdown files under `docs/`.
- This checkpoint update creates another PR head. Re-fetch that new head and checks before any merge decision; no rerun was forced because the preceding workflow repeatedly failed before steps and exposed no actionable test failure.
- No runtime code, Production settings, Firebase Rules/data, secrets, sync flags, manual deployment, or Google AI Studio sync changed.

---
## 2026-11-12 01:23 +02:00 — PR #363 exact-head review and documentation consistency

- Re-fetched main as `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY on that exact SHA. No live browser smoke or authenticated A↔B sync test was performed.
- Re-fetched PR #363: OPEN / DRAFT / mergeable=true; base main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; exact head `484fc70e9b4fbcb7f938be944122b931bfcdd3ee`; 28 documentation-only files (1,871 additions, 8 deletions). Exact-head run `43118098080`, job `130851207499`, completed failure in about two seconds with `steps=null`; log download returned `BlobNotFound`. One annotation was reported but could not be retrieved. This is unresolved workflow/job-start evidence, not a diagnosed test failure and not a pass. Vercel Preview Comments succeeded and the PR timeline showed a Ready Preview; no Production deployment or live smoke is inferred.
- Reviewed the complete changed-file list and per-file patches for the 28 PR files, plus the current canonical continuation, roadmap, checkpoint, catalog, owner actions, handoff, offline contract, Seerah §§16–17, and UX §§6–7. This was a targeted documentation consistency review, not a line-by-line audit of all 43 Markdown files.
- Found current documentation inconsistencies: the UX page/tool map still described Seerah as short lessons/quizzes; README had two conflicting introductory status lines; roadmap repeated its disclaimer; offline plan had a duplicate separator; offline storage test contract did not explicitly test sync/account isolation. Corrected these in this follow-up.
- PR #358 run `43030195498`: 159 Playwright passed, 1 desktop revision-flow failure, 2 skipped; unit tests, Firestore Emulator, TypeScript, build passed. The expected add-portion button was absent because guest navigation had not reached the revision route.
- PR #359 run `43029617572`: 158 Playwright passed, 2 desktop/mobile revision-flow failures, 2 skipped; other configured suites, Emulator, TypeScript, and build passed. Both are old overlapping manifest proposals; #362 fixes the guest-entry helper, but neither old head has been re-run after that fix. No combined offline downloader/manifest implementation was made.
- Confirmed by GitHub compare that main descends from PR #361 (`2c9aa972...`), #362 (`cfe9458...`), and #354 (`8c49f716...`). #354 proxy hardening does not prove the original Ruqyah 500 is fixed.
- PR #364 remains Draft; its run `43117641418` failed before steps/logs (`BlobNotFound`), Preview succeeded. PR #2 is diverged 115 ahead / 469 behind; no wholesale merge.
- No runtime code, Quran corpus, Firebase Rules/data, Production settings, secrets, sync flags, manual deployment, or Google AI Studio sync was changed or claimed.

### Next
1. Re-fetch PR #363's new head after this documentation commit; keep Draft/HOLD until every required exact-head Quality Gate step runs and passes.
2. Do not merge #358/#359 separately; build a single implementation on current main only when cross-store recovery and browser tests can be run safely.
3. Continue Ruqyah 500/index diagnosis and sync cutover work with read-only evidence; leave owner-only Production actions pending.
4. For Seerah, inspect reusable reader/router/storage components before a placeholder-only UI prototype; no unverified historical text or API ingestion.

---
## 2026-11-12 — Final documentation QA and Advisor security extraction

- Current main remains `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Vercel Production is READY on the exact same SHA. Main Quality Gate run `43079260528` failed before steps; logs unavailable (`BlobNotFound`).
- PR #363 was reconciled with main in merge commit `bd383b2733af8dd95ce519d8867a256ef1cf8628`; GitHub reports mergeable=true. The last checked head `d79805b44b26f4ea73e77ffac21503255983b9c1` received run `43117295374`, job `130848449010`, which failed before steps; logs unavailable (`BlobNotFound`). This is unresolved workflow evidence, not a test-level failure. Vercel Preview Comments passed; Vercel deployment remained pending.
- Full relative-link validation across all 28 changed documentation files initially found two broken links in `docs/engineering/progress/CURRENT_STATUS.md`; both were corrected to `../../CONTINUE_HERE.md` and `../../DEVELOPMENT_ROADMAP.md`. The second scan returned zero broken relative links.
- The catalog now covers all 43 Markdown files under `docs/`, including itself and the Google AI Studio handoff. Seerah direction is explicitly continuous book reading (parts → chapters → scenes), with optional aids only.
- PR #364 extracts only bounded Advisor chat history, server-side history validation, numeric metric bounds, and prompt safety from old PR #2. Current head `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`; run `43117641418`, job `130849645262`, failed before steps; logs unavailable (`BlobNotFound`). Vercel Preview deployment succeeded. No test-level result is available; keep Draft.
- PR #2 remains too divergent for wholesale merge (115 ahead / 469 behind). Existing Vercel rewrites already route nested `/api/advisor/*` paths to `/api/advisor`; no redundant chat alias was added.
- Read-only Vercel inventory still shows both Production sync flags `true`; no environment settings, secrets, Firebase Rules/data, sync behavior, or production deployment were changed. Owner decision remains outstanding.
- PR #358/#359 remain unmerged and overlapping; #362's guest-entry helper fix is merged. Unified offline storage is still design-only.

### Next
1. Re-fetch PR #363's new head after this docs update; wait for full exact-head Quality Gate and Vercel result. Keep Draft until all required gates pass.
2. Inspect PR #364's exact-head gate after a runner with recorded steps is available; do not merge based on Vercel Preview alone.
3. Build one offline audio store from the contract, with cross-job file sharing and recovery/quota/orphan/conflict tests.
4. Continue Ruqyah 500 root-cause verification, sync cutover review, and claim-level Seerah research without production changes.

---
## 2026-11-12 — PR #363 current-main reconciliation and link QA

- Merged current main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` into the documentation branch without rewriting its history. Reconciliation commit: `bd383b2733af8dd95ce519d8867a256ef1cf8628`; GitHub now reports PR #363 `mergeable=true`, base SHA current main, 28 documentation-only files.
- The reconciled head initially showed `Vercel Preview Comments` success and Vercel deployment pending; no GitHub Quality Gate check was visible at that observation. The prior failure run `43057118522` belongs to the obsolete pre-reconciliation head.
- Full changed-doc relative-link QA found two broken links in `docs/engineering/progress/CURRENT_STATUS.md`; correcting `../../../CONTINUE_HERE.md` and `../../../DEVELOPMENT_ROADMAP.md` to `../../...` before the final exact-head gate.
- No runtime code, Quran corpus, Firebase/Firestore data or rules, production settings, secrets, or sync flags changed.

---
## 2026-11-12 — Live repository audit and PR reconciliation

- Re-fetched GitHub/Vercel state. Current main is `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY on that exact SHA.
- Main Quality Gate run `43079260528` ended with job `130727161970` failed and `steps: null`; log retrieval returned `BlobNotFound`. This is unresolved job-start/runner evidence, not a test-level failure or pass.
- PR #363 observed head `7e1f3e4b28a6825c06aebf54e6eb4f63a9a651c6` was based on `2c9aa972...`, with `mergeable_state=dirty`. Exact-head run `43057118522` failed before steps; logs unavailable. Vercel status failed because of the daily deployment rate limit. The branch is being reconciled with current main; keep Draft/HOLD until the final exact-head gate passes.
- PR #361/#362/#354 are merged and current main descends from their merge commits. PR #358/#359 remain Draft and unmerged; both observed Playwright failures waited for a revision-page button that was never reached because the guest-entry helper had not navigated. #362 fixes the helper; the storage implementations still overlap and must be replaced by one unified implementation.
- Read-only Vercel inventory confirmed both Production sync flags are `true`. No environment values, secrets, Firebase Rules/data, sync flags, or deployment settings were changed. Owner decision to disable the two flags remains outstanding.
- Reviewed old PR #2 (115 ahead / 469 behind; 37 files). Do not merge it wholesale. The unique Advisor chat route/history validation/prompt-injection protections are candidates for a separate narrow PR; much of its session/retention logic already exists in a newer form on main, and its design-token/mobile-dock work is coupled to divergent UI markup.
- Checked the PR #363 documentation tree's relative links in the entry docs; the initial reviewed subset had no broken relative links. Re-run full changed-file link validation after the main reconciliation.
- Seerah plan's older lesson-oriented wording now needs explicit supersession by §§16–17 and UX §§6–7: continuous book reading is the product, optional aids only.
- No runtime application code, Quran corpus, Firestore data/rules, production settings, or Google AI Studio sync changed in this documentation checkpoint.

### Next
1. Finish the documentation merge/reconciliation on latest main and run the exact-head Quality Gate.
2. Port only the unique Advisor chat security/route changes from PR #2 into a separate branch.
3. Implement the unified offline-audio storage contract only after reviewing the latest main APIs.
4. Continue Ruqyah root-cause verification, sync cutover work, and Seerah claim-level research without production changes.

---
## 2026-11-11 — PR #356 CI result and latest documentation run

- PR #356 sync documentation Quality Gate run `43029328133` completed successfully on its exact PR head. The PR remains open; reconcile its older main/Production checkpoint text before merge.
- PR #358 Quality Gate run `43028986222` passed. Its IndexedDB jobs/items implementation remains open/unmerged pending review against #359.
- PR #359 Quality Gate run `43029617572` remained in progress at this observation.
- PR #360 latest head: `2ad93b0225a6ab22877b99a8f95128cf8963d091`; latest Quality Gate run `43030765045` was pending at last observation. The preceding run `43030365657` was cancelled after the branch was updated.
- No application runtime code or production settings changed.

---

## 2026-11-11 — PR #358 exact-head CI result

- PR #358 Quality Gate run `43028986222` completed successfully on the observed PR head.
- The PR remains open and unmerged. CI success does not decide whether its jobs/items schema or PR #359's metadata-only schema should be the canonical manifest.
- PR #359 run `43029617572`, PR #356 run `43029328133`, and the updated PR #360 run `43030365657` were still pending/in progress at this observation.
- Next: compare the complete #358/#359 APIs and storage lifecycle; choose one coherent IndexedDB + Cache Storage contract before merging or implementing download UI.

---

## 2026-11-11 — Documentation hub and continuation refresh

- Repository: `xm8eslam-stack/WIRD-APP`; latest main SHA observed: `8dd21522430cc014db4eb5da8437f89c42f190f9` after PR #353 merge.
- Documentation work is tracked in PR #360, branch `docs/wird-documentation-hub-roadmap-20261111`.
- Added `docs/README.md`, `docs/DOCUMENTATION_CATALOG.md`, `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_ROADMAP.md`, and `docs/OWNER_ACTIONS.md`.
- Refreshed the checkpoint, Google AI Studio handoff, historical-file routing notices, AGENTS.md, GEMINI.md, and offline-audio planning notes.
- Catalogued the 36 documentation paths in the main tree and checked relative links in the 10 main documentation entry files; no broken relative links were found.
- Latest documentation branch commit at this log entry: `d2fe780a8b66b80fcb6745109fa2fcbffcab53f8` (subsequent log/plan additions are in the same PR branch).
- Quality Gate run `43030122376` for the updated documentation PR head was pending/in progress at last observation. Do not report it as passed until completed.
- PR #358's Quality Gate run `43028986222` completed successfully; PR #359 run `43029617572` and PR #356 run `43029328133` were still running at last observation.
- PR #358 and #359 overlap in IndexedDB manifest responsibilities. This was documented as a design conflict; neither was merged in this review.
- No runtime code, Quran data, Firebase/Firestore, production data, secrets, environment variables, or deployment settings changed.

### Next
- Observe exact-head CI for #360/#359/#356.
- Resolve the offline-audio store contract before merging either overlapping manifest implementation.
- Reconcile #356's sync documentation with the current centralized checkpoint.
- Keep production source SHA and Google AI Studio synchronization unverified until directly confirmed.

---

# WIRD — Engineering Work Log

## 2026-11-06 — Repository resumption and engineering checkpoint

### Repository state verified
- Repository: `xm8eslam-stack/WIRD-APP`.
- Canonical branch: `main`.
- Latest observed main commit: `d9737e0e16ea1f87b9811621dce42d8f6d4e8450` (documentation checkpoint).
- Latest code commit referenced by the audit: `f342b4bc7e02a48f88b90646098eea178901c8ea`.
- PR #1 was previously merged; do not repeat.
- Branch inventory: main, phase4 feature branch, divergent phase5 UI branch, divergent audit remediation branch.
- Divergence: phase5 branch 115 ahead / 104 behind; work audit branch 92 ahead / 228 behind. No wholesale merges recommended.

### Prior CI evidence
- Run `42180258989` documented successful for `f342b4b`: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, server smoke test.
- Vercel status lookup for `d9737e0` reported rate-limit failure. This is not a confirmed code build failure; production deployment is not confirmed.
- No code tests were executed during this documentation-only resumption.

### Engineering findings
- Local archive hardening now protects multiple corrupt archives and permits validated legacy portion recovery.
- UID-scoped outbox primitive exists but is not integrated into domain mutation paths.
- Daily activity and weak-verse state remain aggregate projections and are unsafe for concurrent cross-device increments.
- Multi-key localStorage writes are rollback-aware for ordinary failures but not crash-atomic.
- Firestore rules are a tested generic-envelope foundation, not production-ready collection-specific authorization.
- Potential outbox issue to verify: after acknowledgement, only mutation IDs remain; a reused ID with different content may be silently treated as already acknowledged.
- No Firestore client/sync coordinator or real two-device sync exists.

### External technical research (review only; no code copied)
1. Dexie.js — https://github.com/dexie/Dexie.js — Apache-2.0; current inspected package metadata 4.4.7. Its documented read/write transactions abort and roll back on errors; transaction lifetime restrictions require avoiding unrelated awaited async APIs inside a transaction.
2. idb — https://github.com/jakearchibald/idb — ISC; current inspected package metadata 8.0.4. Small promise wrapper around native IndexedDB; preserves native transaction semantics and requires more application-level schema/transaction design.
3. RxDB — https://github.com/pubkey/rxdb — package metadata declares Apache-2.0; current inspected package metadata 17.6.0. Rich local-first replication, batching, checkpoints, and conflict handlers, but broader database/replication abstraction than needed for the first WIRD milestone.
4. Design decision: do not add any dependency or copy implementation yet. Evaluate Dexie as the leading transactional IndexedDB candidate, compare against native IndexedDB/idb, and retain RxDB as an architectural reference rather than adopting its full replication stack.

### Files inspected
- `docs/DEVELOPMENT_CHECKPOINT.md`
- `docs/engineering/WORK_SESSION_CHECKPOINT.md`
- `docs/engineering/IMPLEMENTATION_ROADMAP.md`
- `docs/engineering/OPEN_SOURCE_RESEARCH.md`
- `docs/engineering/FIRESTORE_SYNC_DESIGN.md`
- `docs/engineering/SECURITY_AUDIT.md`
- `package.json`
- `src/services/storageService.ts`
- `src/services/localSyncOutbox.ts`
- `src/services/sessionPersistence.ts`
- `src/services/retentionService.ts`
- `src/services/secureId.ts`
- `src/tests/runAllTests.ts`
- `src/tests/storageReliability.test.ts`
- `firestore.rules`
- `.github/workflows/ci.yml`

### Files changed
- Added the engineering progress checkpoint documents in this directory on a dedicated documentation branch.
- No application source code, dependencies, Firebase configuration, or production settings changed.

### Review results
- First review: confirmed canonical branch, latest commit history, CI evidence, branch divergence, and known architecture boundaries.
- Independent review: confirmed no evidence that cloud sync is live; Vercel status is rate-limit-related; branch divergence prohibits wholesale merges; no new code verification claimed.
- Code test status: NOT RUN for this documentation-only change.
- Documentation review: pending final readback and integration CI.

### Next step
Finish targeted outbox audit and design M4 event ledger/transaction boundary before implementing Firestore.


## 2026-11-06 — Targeted M4 outbox audit

- Inspected `src/services/localSyncOutbox.ts` and `src/services/localSyncOutbox.test.ts` on `main`.
- Confirmed: while a mutation is pending, reusing the ID with changed collection/document/operation/payload throws as intended.
- Confirmed defect: after acknowledgement, the state stores only the mutation ID in `acknowledgedIds`; `enqueue()` returns `already_acknowledged` solely by ID, without checking whether the new mutation content matches. Reusing an acknowledged ID with different content can therefore silently suppress a distinct update.
- Coverage gap: the current acknowledged-ID test verifies only replay with identical content. It does not test changed payload, changed document ID, changed collection, or changed operation after acknowledgement.
- Additional validation review: `readState()` checks basic shape but does not explicitly reject duplicate pending mutation IDs, duplicate acknowledged IDs, or overlap between pending and acknowledged sets. Review whether these should be rejected as corrupt state before event-ledger integration.
- Session completion currently updates a mutable per-day aggregate via `StorageService.recordSessionCompletion`; revision rating updates portion state, optional weak-verse aggregate, then activity aggregate with rollback. These are the concrete mutation boundaries M4 must wrap with a recoverable event journal.
- No source code changed and no tests were run for this static audit. The defect is logically established from the current implementation and test coverage; a regression test must reproduce it before the fix is accepted.
- PR #3 remains documentation-only and open; no CI success has been verified for its head SHA.

### Next exact action
Add an async-safe/transaction-safe idempotency design that preserves enough acknowledged mutation identity to reject changed-content reuse, handles old v1 acknowledgements without data loss, validates pending/acknowledged uniqueness, and has regression tests for each case. Then continue the event-journal transaction design.


## 2026-11-06 — Phase 1 record-level validation audit correction

- Inspected `storageService.ts` and backup validation flow.
- `readJsonArrayArchive<T>()` validates JSON parse and array root only; it does not validate every element against the domain schema.
- `savePlans()`, `saveEnginePlans()`, and `saveRevisionItems()` check only array shape and archive-root writability, not each record's fields/ranges.
- `saveTest()` checks archive root but does not validate the incoming test result object before inserting it.
- `validateBackupPayload()` checks that several collection fields are arrays; the inspected validator performs deep per-record validation for canonical unified portions and profile, but the same complete record-level validation is not present for all plan/revision/test/log/weak-verse records. This leaves malformed nested backup records able to pass the initial array checks and be written.
- Correction to milestone status: Phase 1 is **IN PROGRESS**, not complete. Phase 2 remains **IN PROGRESS** pending full mutation-path validation. The roadmap and resume instructions were updated accordingly.
- Required next work: define shared strict validators for every persisted record type; apply them to read/write/import/export boundaries; preserve invalid original archives; add malformed-record, boundary, legacy-compatibility, and backup no-partial-write tests.
- No application code changed and no code tests were run during this static audit.


## 2026-11-06 — Domain mutation call-site map

Inspected App.tsx, MemorizationSessionView.tsx, RevisionCenterView.tsx, MemorizationTestsView.tsx, SettingsView.tsx, weakVerseRecording.ts, retentionService.ts, and storageService.ts.

- Session completion: UI delegates to App.handleCompleteSession -> persistSessionCompletion; after the canonical portion + daily activity operation, an engine-plan task update is saved separately. No outbox enqueue exists.
- Direct review activity: App.handleRecordRevisionComplete calls StorageService.recordSessionCompletion directly; this is a second aggregate activity path.
- Revision rating: RevisionCenterView calls RetentionService.recordRevisionPerformance; it updates portion history, optionally weak-verse aggregate, then daily activity aggregate with rollback on ordinary write failure. No immutable event or outbox record is written.
- Weak verse failure: RevisionCenterView/App call recordWeakVerseFailure; it writes a one-ayah weak portion and then increments the weak-verse archive, restoring the previous portion list if the weak archive write fails. No outbox record is written.
- Manual portion changes and weak-verse resolution: RetentionService.addPortion / resolveWeakVerse write canonical portions or weak-verse aggregate directly; no outbox.
- Tests: MemorizationTestsView delegates to App.handleSaveTestResult -> StorageService.saveTest. The save boundary does not validate the full TestResult record at runtime.
- Plans: App handlers call savePlans/saveEnginePlans. These validate only the top-level array/archive shape, not each nested plan/task.
- Profile/settings: theme/profile writes use saveProfile; the profile validator exists. Backup import writes multiple archives after a validator that does not yet validate every record in every array.
- Demo seed/reset are multi-key operations and need explicit scope/guard review; they must not be treated as ordinary event-producing user progress.

### Validation library research

Reviewed Zod 4.6.7 (MIT), Valibot (MIT; official docs specify TypeScript 5.0.2+), and Ajv 8.20.0 (MIT). No package was added. Prototype Zod and Valibot on the same record schemas before selecting a dependency; use strict unknown-key rejection and preserve legacy formats deliberately.

### Next exact action
Complete Phase 1 record-level validators and backup import/export consistency first. Then continue Phase 2 mutation/range validation and outbox idempotency before event-ledger integration.


## 2026-11-06 — Engineering checkpoint integrated into main

- PR #3 (documentation-only) was squash-merged successfully into main.
- Merge commit: `82efeacd9118406d850336fa3c862fd5016bed14`.
- PR head CI run `42184381262` completed successfully: automated tests, dependency audit, Firestore Emulator tests, TypeScript validation, production build, and production server smoke test all passed.
- The combined status for the merge commit still reports Vercel `failure` with a build-rate-limit target. This is a deployment quota issue; it does not negate the passing GitHub Actions quality gate. Production deployment for this merge commit remains unconfirmed.
- The six progress files now exist on main under `docs/engineering/progress/`.
- No application source, dependencies, Firestore rules, secrets, production data, or deployment configuration changed.
- Next priority remains Phase 1 record-level validation; do not start cloud sync. Static audit found array-root-only validation in plans, engine plans, revision items, and test results, and incomplete deep backup validation. M4 outbox integration follows after Phase 1/2 gates.


## 2026-11-06 — Phase 1 record-validation milestone (PR #4)

- PR #4 merged into main as squash commit `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- Changed application files: `src/services/storageService.ts`, `src/services/retentionService.ts`; regression coverage updated in `src/tests/backupValidation.test.ts` and `src/tests/firebaseAuth.test.ts`.
- Added runtime per-record validation for memorization plans, engine-generated plans and nested schedule tasks, revision items, test results, weak-verse records, daily logs, legacy/canonical portion records, and profile data at backup boundaries.
- Safe array reads now reject malformed elements without changing the original archive; write paths refuse to overwrite malformed archives.
- Backup import validates nested records before writes and rejects inconsistent v4 legacy/canonical projections. Export refuses malformed archives, incomplete legacy migrations, divergent projections, duplicate daily log dates, and incomplete canonical archives rather than producing a partial backup.
- Legacy v1–v3 portions/revision records retain only the documented fields normalized by the existing migration; raw legacy arrays are validated before migration/recovery. Invalid source archives remain untouched.
- Shared the strict weak-verse validator between storage and retention services.
- External library review: Zod 4 (MIT), Valibot (MIT), Ajv 8 (MIT). No dependency added; custom domain validators were selected for this milestone to avoid new runtime dependency and preserve explicit legacy behavior.
- CI run `42186678874` on PR head `2e04d7a` passed: automated tests, dependency audit, Firestore Security Rules Emulator, TypeScript validation, production build (including Quran chunk validation), and production server smoke test.
- The combined status on merge commit `647eff6` reports Vercel failure at the free build/deployment rate limit. This is not a GitHub Actions code-test failure; production deployment remains unconfirmed.
- This is a verified record-validation substage, not completion of all Phase 1. Remaining audit includes `sessionPersistence.ts`, `sessionCompletion.ts`, the local outbox boundary, and every remaining domain mutation call site.
- Next confirmed findings: `getSessionCompletionMetrics()` still clamps negative/fractional counters to zero; reject invalid input before any write. The outbox still accepts an acknowledged mutation ID with changed content as `already_acknowledged`; fix after the remaining local data audit.


## 2026-11-06 — Session and Quran-range validation milestone (PR #5)

- PR #5 merged into main as `fd480526dd3eac728f60b3554e83309354903ad8`.
- Replaced silent `Math.floor` / `Math.max(0, ...)` coercion in `getSessionCompletionMetrics()` with strict safe-integer validation and explicit Quran-domain bounds: memorized ayahs 0–6236 and reviewed pages 0–604.
- `persistSessionCompletion()` now validates mode, counters, duration (0–1440 minutes), task name, and the full surah/ayah range before any portion mutation. Invalid input returns a failure result without changing portions or activity logs.
- `RetentionService.addPortion()` and `recordMemorizationCompletion()` now enforce canonical surah/ayah bounds at the service boundary.
- `recordRevisionPerformance()` now validates rating, duration, notes length, and weak-ayah details/range before changing portion status, review history, or weak-verse records.
- Added regression tests for negative/fractional/unsafe/out-of-range counters, invalid session duration/task names/mode/ranges, invalid revision ratings, weak ayahs outside the reviewed portion, and no-mutation guarantees.
- CI run `42187380137` passed all steps: automated suites, dependency audit, Firestore Security Rules Emulator, TypeScript, production build, and server startup smoke test.
- Vercel check on application-code merge commit `fd48052` later completed successfully. The subsequent documentation-only checkpoint commit `e1f244c` hit the known free build-rate limit; the code merge's deployment check itself is successful.
- Phase 2 is partially advanced, not complete. Phase 1 remains open because `localSyncOutbox.ts` and the remaining storage/session boundaries still require audit.
- Next priority: audit outbox state integrity and fix the confirmed acknowledged-ID/content mismatch, pending/acknowledged uniqueness and disjointness, and retry overflow. Then continue the remaining revision/mutation-path audit.


## 2026-11-06 — Local outbox integrity milestone (PR #6)

- PR #6 merged into main as `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`.
- Changed files: `src/services/localSyncOutbox.ts` and `src/services/localSyncOutbox.test.ts`.
- Added compact deterministic content fingerprints for acknowledged mutation IDs. Same logical content (including object-key order changes) remains idempotent; changed payload, collection, or document reuse is rejected.
- Existing v1 acknowledged IDs without fingerprints remain reserved but are not assumed to match a new payload; this avoids silently accepting a changed operation after upgrade.
- State validation now enforces unique pending IDs, unique acknowledged IDs, disjoint pending/acknowledged sets, pending-device identity consistency, and valid fingerprint references.
- Retry attempt overflow, retry timestamp overflow, invalid batch sizes, empty IDs, and invalid UTF-8 ID bounds are rejected before mutation.
- Outbox writes now restore the previous raw value if read-back verification fails.
- CI run `42187959928` passed: **277 automated tests**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and server startup smoke test.
- Vercel status on merge commit `aacc7ae` reports the known free build-rate-limit failure; this is separate from the passing GitHub Actions quality gate. Production deployment for this merge is not confirmed.
- Research reviewed Dexie transaction semantics and RxDB replication/conflict patterns. No new dependency or external code was copied; the existing storage adapter remains in place. The outbox is still localStorage-backed and is not cross-tab transactional; do not activate remote sync until the planned transactional IndexedDB event/outbox design is implemented and tested.
- Phase 1 remains open for the final `unifiedPortionService.ts` merge/deduplication audit and complete persistence-boundary review. Phase 3 remains unstarted; no cloud sync writes are enabled.


## 2026-11-06 — Duplicate session/outbox branch reconciled (PR #7)

- A continuation branch, `fix/phase2-session-counter-validation`, was created from an earlier main revision while PR #5 (session/range validation) and PR #6 (outbox integrity) were being integrated into the canonical branch.
- The branch diverged from current main (17 commits ahead / 14 behind at comparison time). Its changes overlapped the already merged session and outbox fixes.
- Reviewed current main implementation and verified it contains the stronger final versions: PR #5 validates session counters, duration, task names, Quran coordinates, revision ratings, weak-ayah range, and pre-write failure paths; PR #6 uses deterministic acknowledged fingerprints, preserves legacy acknowledged IDs safely, validates pending/acknowledged uniqueness and device identity, rejects retry/batch overflow, and restores prior raw outbox state on read-back failure.
- PR #7 was closed without merge as superseded. No code from the stale branch was merged or written to main.
- Its branch-specific CI run on earlier commit `3d6e7ed` passed the full quality gate; the later extra tests were not required for main because the canonical PR #6 implementation already covers these invariants with its own verified test suite (CI run `42187959928`: 277 automated tests, 10 Firestore emulator tests, audit, TypeScript, build, smoke test).
- Updated CURRENT_STATUS, MASTER_ROADMAP, and RESUME_HERE to remove stale outbox defect statements and return the next task to the remaining `unifiedPortionService.ts` merge/dedup/conflict audit.
- No production sync activation, Firestore rule deployment, destructive migration, or data change occurred.

### Next exact action
Audit `src/services/unifiedPortionService.ts` and its tests on current `main`: range validation, canonical IDs, overlapping portion handling, merge metadata, duplicate history IDs, conflict-audit growth, aggregate counters, and rollback behavior. Compare at least three relevant external designs before implementation; preserve all legacy data and test malformed/overlapping inputs.


## 2026-11-06 — Phase 1 completed: portion merge and review-history integrity (PR #9)

- PR #9 merged to `main` as `f8e0cef696b6b74f2f9872cf69a9d3ad6bcc731c`.
- Changed files: `src/services/unifiedPortionService.ts`, `src/tests/phase3CoreRemediation.test.ts`.
- Fixed a confirmed history-loss bug: two distinct review attempts with different stable IDs are preserved even when date, rating, before/after intervals, and notes are identical. Deduplication now uses stable event IDs only.
- Same-ID/same-content retries deduplicate; same-ID/different-content conflicts receive deterministic alternate IDs with collision handling.
- Existing conflict-audit entries from duplicate legacy portion records are merged rather than discarded. New audit entries are deduplicated and capped; history and audit overflow fails closed without mutating source arrays.
- Portion status and memorization strength now merge conservatively; a weaker status cannot retain a contradictory stronger label.
- Added strict source-record validation for legacy portions/revisions, Quran integer ranges, nested review history, dates, scheduling metrics, timestamps, conflict audit, and bounded archive sizes.
- Hardened range/statistics helpers against invalid coordinates including Infinity (which could otherwise create unbounded loops); validated local calendar dates, SM-2 grade inputs, plan scopes, revision queue limits, and daily memorization targets.
- Preserved established behavior confirmed by tests: valid Surah targets are deduplicated, invalid target values are filtered without widening the explicit scope, and an in-progress passage is clipped only to its Surah's real verse boundary.
- Regression tests cover identical-content distinct review attempts, stable IDs, same-ID deduplication, audit preservation, strength consistency, fractional Quran coordinates, malformed dates, malformed migration roots, invalid SM-2 grade, invalid queue limits, and infinite range rejection.
- External research reviewed Automerge (MIT), RxDB (Apache-2.0), and Yjs (MIT) conflict/CRDT designs. No third-party code or dependency was copied. Decision: retain explicit Quran-aware merge semantics rather than generic LWW/CRDT behavior.
- CI run `42190653101` passed: automated tests, 10 Firestore Security Rules Emulator tests, TypeScript, production build, and server startup smoke test.
- PR #7 was closed without merge because its session/outbox changes were already present more completely on main through PR #5 and PR #6; its stale branch was not merged.
- Vercel deployment for PR #9 failed only due the free daily deployment limit (`api-deployments-free-per-day`). Production deployment of merge commit `f8e0cef` is not confirmed.
- No production data migration, Firestore rules deployment, or cloud sync activation occurred.

### Phase 1 decision

Phase 1 local archive/backup/portion merge integrity is now **COMPLETED** on main. Phase 2 remains in progress for review scheduling, duplicate operation behavior, and dashboard statistics. The localStorage outbox remains disconnected from cloud writes because cross-tab atomicity requires a transactional IndexedDB event+outbox journal.

### Next exact action

Audit the remaining Phase 2 mutation paths in `RetentionService`: `updatePortionStatus`, `recordMemorizationCompletion`, `recordRevisionPerformance`, weak-verse recording/resolution, daily revision queue selection, and dashboard statistics. Test duplicate operations, review-history append semantics, aggregate correctness, and rollback across multi-key writes.


## 2026-11-06 — Phase 2 continuation checkpoint (branch not yet merged)

- Resumed from `fix/phase2-retention-mutation-audit`; comparison against canonical `main` showed the branch was 16 commits ahead and 0 behind at the start of this continuation. Later commits in this session advanced the branch; re-run compare to obtain the current count and SHA.
- Audited the active Phase 2 changes in `RetentionService`, the revision center UI, and their regression tests.
- Hardened manual portion status updates: reject unknown IDs/invalid status values and keep status/strength labels consistent.
- Re-adding an existing canonical Quran range now merges with the existing record rather than resetting review history, repetition counters, or weaker progress. Surah labels are sourced from canonical metadata.
- Weak-verse arrays now reject duplicate IDs and duplicate Surah/Ayah coordinates; direct writes validate coordinates and inputs; resolving a missing/already-resolved ID is idempotent.
- Backup validation rejects duplicate weak-verse IDs/coordinates.
- Revision modal blocks rapid duplicate submissions while a save is in flight and clears stale notes/weak-ayah input when switching or closing.
- Added tests for duplicate portion adds, unknown status IDs, weak-verse duplicate archives, direct invalid coordinates, idempotent resolution, and backup duplicate rejection.
- Review correction: memorization completion must not append a `RevisionLogEntry`, because that ledger and `totalReviewsCompleted` represent reviews. Removed that misclassification and changed the regression test to assert that memorization leaves review history and review totals unchanged while retaining memorization counters/status.
- Corrected two test fixtures whose ayah ranges exceeded Surah Al-Mulk's 30 verses (now use valid ranges).
- External research reviewed Microsoft Event Sourcing guidance (idempotent handlers under at-least-once delivery), a TypeScript event-sourcing reference implementation (idempotency keys), and Ummah Library's Quran-reader architecture. Ummah Library is AGPL-3.0; no code or dependency copied. Research is architecture-only.
- No local test command or CI run has yet been confirmed for this branch. The only observed combined status on the current main/known earlier branch commit is Vercel's free build-rate-limit failure; GitHub Actions status for the current branch head is still pending a PR run.
- No Phase 2 code has been merged to `main`; no production migration, Firestore rules deployment, or cloud sync activation occurred.

### Next exact action

Create a draft PR to `main`, inspect the full diff, wait for GitHub Actions, fix any failures, then conduct a separate review before merging. Continue the daily queue/statistics/rollback audit; do not mark Phase 2 complete prematurely.


## 2026-11-06 — Phase 2 mutation-integrity slice merged (PR #10)

- PR #10, `Phase 2 — Retention mutation integrity and duplicate-operation safeguards`, was squash-merged to canonical `main`.
- Merge commit: `e69871897c2561e7aa75c6e31f9005169ed08c23`. PR head before merge: `958067b1b1e3c64513b1732c947e81c18a830a52`.
- GitHub Actions Quality Gate #681, run `42194241711`, passed: **304 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and server startup smoke test.
- Independent second-pass review found and fixed: a duplicate JSX disabled prop; noncanonical placeholder text fallbacks for weak-verse records; an invalid duplicate-range test fixture; and a TypeScript widened inference in the status mapper.
- The first CI run exposed an existing retention test that added the exact same seeded demo range and expected its previous mistakes counter to be overwritten. The fixture was changed to a non-seeded canonical range; the intended data-preserving duplicate behavior remains enforced by the new dedicated regression test.
- A further semantic correction removed both first-time and repeat memorization completions from the revision-history ledger. Memorization counters and daily activity still update; review history and totalReviewsCompleted now count review events rather than memorization sessions.
- Vercel reports the known Free-plan daily deployment limit (`api-deployments-free-per-day`). This is separate from the passing GitHub Actions quality gate; production deployment of the merge commit is **not confirmed**.
- No destructive migration, production Firestore rules deployment, live cloud sync activation, or production data mutation occurred.
- Phase 2 remains IN PROGRESS: continue daily queue, weekly overview, dashboard aggregate, and multi-key rollback audits. The localStorage outbox remains disconnected from cloud writes pending a transactional IndexedDB event+outbox journal.


## 2026-11-06 — Phase 2 queue and dashboard audit (in progress)

- Started branch `fix/phase2-queue-metrics-audit` from the verified main documentation checkpoint `0de185af757cfecead14beb98a465cf088200fff`.
- External research: `ts-fsrs` is an actively maintained MIT TypeScript scheduler; current v6 requires Node >=24 and introduces breaking API changes / FSRS-7. WIRD already targets Node >=24.12, but no algorithm migration or dependency addition was made because replacing SM-2 would require a deliberate history/schedule migration. `fsrs.js` itself recommends transition to `ts-fsrs` because it is less actively maintained. Anki's manual recommends not rescheduling existing due dates by default when switching algorithms because it can create a large immediate review backlog. FSRS Helper's load-balancing, flattening, and postponement features were reviewed as queue UX references only. No external code copied.
- Refactored the queue comparator into shared deterministic ordering for daily and weekly revision surfaces (status severity, oldest due date, ease factor, canonical ID tie-break).
- Removed an unused `gracePeriodDays` property from queue options; it had been validated but never affected queue selection. The SM-2 grace period used by the scheduling calculation remains unchanged.
- Legacy initial-memorization history entries are identified by their historical `init-` ID prefix and excluded from the review-history view/count while remaining untouched in stored portion history.
- Review history now counts each stable event ID once across portion records, preventing duplicated projections from inflating totals.
- Average ease factor now excludes `not_memorized` portions, which are not yet in the reviewable population.
- Failed review writes now require actual weak-ayah text at the service boundary; placeholder text such as “Ayah N” can no longer be persisted.
- Added regression tests for legacy history preservation, duplicate review IDs, average-ease denominator, weekly priority ordering, daily queue cap/backlog counts, impossible calendar dates, and missing weak-ayah text.
- Current branch head before docs checkpoint: `c2d5ab906bc66443f63bdc049595d0504e303937`. Tests/CI are pending; no PR opened yet and no changes merged to main.


## 2026-11-06 — Phase 2 queue and dashboard metrics slice merged (PR #11)

- PR #11, `Phase 2 — Revision queue ordering and dashboard metric integrity`, was squash-merged to canonical `main`.
- Merge commit: `84aac72c9d3489f93d200e331c35760eb754462e`. PR head before merge: `1c7e57e6beeed1327900acc38c5642298ba37aad`.
- GitHub Actions WIRD Quality Gate #708 / run `42195579600` passed: **312 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and server startup smoke test.
- Independent review confirmed the full-collection queue validation remains in place before due filtering; a dedicated regression test verifies invalid future-due and not-memorized ease values are rejected.
- Shared deterministic priority ordering now drives daily and weekly revision surfaces. The unused queue-only gracePeriodDays option was removed; SM-2's scheduling grace period remains unchanged.
- Legacy initial-memorization records with historical `init-` IDs are excluded from review presentation/counts without modifying the original portion history. Duplicate event IDs are counted once. Average ease excludes portions that are not yet memorized.
- Failed-review weak-ayah details now require a non-empty text value before any write; placeholder verse text is not persisted.
- No algorithm migration, schedule rescheduling, production migration, Firestore rules deployment, or cloud sync activation occurred.
- Vercel's status still reports the Free-plan daily deployment limit; production deployment is not confirmed. GitHub Actions code quality gates passed.
- Phase 2 remains IN PROGRESS. Next work is failure-injection for multi-key review/weak-verse/activity rollback and recovery-state correctness.


## 2026-11-06 — Phase 2 multi-key rollback failure injection merged (PR #12)

- PR #12 `test(storage): inject multi-key rollback failures` was squash-merged to `main`.
- Merge SHA: `1ffd6c23363d636a6b395620e7f9c7cd15828827`; tested PR head: `522bbc549074217af8e3d434538078cc5a8204bc`.
- GitHub Actions WIRD Quality Gate #741 / run `42216315142` passed: **315 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and production server startup smoke test.
- New tests prove: (1) a weak-verse archive quota failure restores the changed review portion and prevents activity recording; (2) a subsequent rollback write failure produces an explicit recovery-required/backup warning; (3) profile quota failure after successful portion, weak-verse, and activity writes restores all four archives to their original raw values.
- Independent review strengthened the third test to assert that weak-verse and activity writes actually succeeded before injecting the later profile failure.
- PR #12 was test-only; no application runtime code, schema, user data, algorithm, or migration changed.
- External references reviewed: MDN IndexedDB transaction guide, W3C IndexedDB 3.0 atomic commit/abort semantics, Dexie transaction documentation, and OWASP browser-storage testing guidance. No source code or dependencies copied.
- Vercel passed for the PR head before merge; post-merge deployment status on the merge SHA was pending at the last check. Do not claim production deployment.
- Phase 2 remains IN PROGRESS. Next: inject silent-write/read-back mismatch and audit each multi-key mutation path for complete rollback/recovery behavior.


## 2026-11-06 — Phase 2 durable write/readback verification merged (PR #13)

- PR #13 `fix(storage): verify durable writes and readback` was squash-merged to `main`.
- Merge SHA: `346b725ae76a177372375f5045e7816eb09a0d1c`; tested PR head: `d6753835d70a71b7f3a5f15a7f3512d9f92bf843`.
- GitHub Actions WIRD Quality Gate #759 / run `42217300654` passed: **317 automated assertions / 0 failures**, **10 Firestore Security Rules Emulator tests**, dependency audit, TypeScript, production build, and production server startup smoke test.
- The storage adapter now snapshots the previous durable value, verifies exact `getItem()` readback after `setItem()`, attempts and verifies restoration after a mismatch or thrown write, and updates the memory fallback only after durable verification.
- Durable removal now checks readback; the public `removeRawItem()` returns a boolean so callers can observe removal failure.
- Tests cover silent no-op writes, corrupted/mismatched writes, silent no-op removal, and weak-verse failure rollback when the counter write silently does not persist.
- Independent review checked UID-scoped key handling, rollback of previous raw bytes, memory fallback behavior, and existing quota-error semantics. Initial CI failure was isolated to the test fixture's key comparison; fixture now matches UID-scoped keys, and the complete quality gate passed.
- External research reviewed MDN Web Storage API / `Storage.setItem()`, WHATWG HTML Web Storage semantics, and OWASP browser-storage testing guidance. No source code or dependencies copied.
- Vercel failed with `build-rate-limit` on the PR head; production deployment is not confirmed.
- No data migration, destructive operation, Quran text change, SM-2 schedule change, Firestore rules deployment, or cloud sync activation occurred.
- Phase 2 remains IN PROGRESS. Next: audit the remaining multi-key mutation paths for missing durable verification, rollback gaps, and recovery-state reporting.


## 2026-11-06 — Quran reader and Tafsir repair (PR #49)

- Created isolated branch `fix/quran-reader-tafsir-navigation-20261106` from main SHA `4fa6a1acffb0723c89bb963b237e67e6f4b7173f`; main was not modified.
- Mounted the existing `api/tafsir.ts` handler in Express before Vite middleware, fixing the missing development-server route that allowed Vite to return JavaScript module source to a JSON client.
- Added development and production smoke coverage for the Tafsir route's JSON response.
- Added direct Surah-to-Mushaf entry actions, initial-page support, and a generated-index resolver for exact first-ayah page navigation.
- Added a 114-Surah page-start regression test.
- Exact code-head SHA `8f213b3a912657b0d1e36f7c851085b742629e2c`: PR Quality Gate run `42267248254` and push Quality Gate run `42267243769` both passed. Automated tests, Firestore emulator, TypeScript, build, and both server-mode smoke checks passed.
- Vercel failed due to its Free-plan daily deployment cap (`api-deployments-free-per-day`); production deployment is unconfirmed. PR #49 remains draft/open and unmerged.
- Next: re-check final branch head and checks after this checkpoint update; wait for deployment quota recovery and verify the actual deployed route before merging.


## 2026-11-06 — PRs #49–#52: reader repair and local mutation recovery

- PR #49 merged as `15979e4a009ef0aa5b4981cbcbb4f2124f25dfc3`: fixed Tafsir API routing in the custom Express server and direct Surah-to-Mushaf navigation. Exact-head Quality Gate run `42267849373` passed. Vercel rate limiting was explicitly accepted as a non-blocker for merging; production deployment remains unverified.
- PR #50 merged as `dacba8298db954392f7fbcbbf10af9f18ecc31dc`: active session completion now uses journal-first grouped persistence for canonical portion progress, activity, and profile streak. Exact-head Quality Gate run `42276148126` passed.
- PR #51 merged as `99c466b9de6ae977979f8989443fba5b94017a30`: the matching smart-plan task status is included in the same session transaction. Exact-head Quality Gate run `42276561011` passed; post-merge main run `42276748346` passed.
- PR #52 merged as `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`: backup import and factory reset now use ordered journal transactions; older pending events are replayed before import/reset, and async tests cover recovery ordering and invalid imports. Exact-head Quality Gate run `42277464313` passed. Post-merge main run `42277666291` completed successfully on exact SHA `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`.
- Vercel status continues to fail with `build-rate-limit`; owner explicitly instructed that this must not block adding tested changes to `main`. This is not evidence of a live deployment.
- The Revision Center active rating path was audited and already uses grouped journal persistence. Two unused App-level direct-write handlers were found and removed in the current checkpoint branch.
- Cloud sync remains unimplemented: no Firestore client, sync worker, remote acknowledgements, tombstones, or two-device/offline sync tests.


## 2026-11-06 — PR #53 and typed domain-event envelope

- PR #53 merged as `87c4ec4456c69e35e1d62a368c97a5992d0309ac`: removed unused App-level direct local-write handlers and refreshed current status, roadmap, release checklist, and continuation files. Exact-head Quality Gate `42278253060` and post-merge main run `42278457062` passed.
- Main then advanced to `dee0e7a926700092e3d4b3e5fd63e74565428de0` with a direct Tafsir multi-source/book-ID commit. No Actions run was found for that exact commit at the time of this checkpoint; PR #54 is based on this latest main SHA and its Quality Gate will test the combined tree.
- PR #54 branch `feat/domain-event-envelope-phase3-20261106-fresh` introduces a typed domain-event envelope for session completion, revision ratings, test completion, and weak-verse failure/resolution. Event identity is tied to mutation identity; semantic payloads are validated before enqueue; retry timestamps are stable.
- This envelope remains local IndexedDB journal metadata only. No Firestore client, remote event collection, sync worker, or cloud sync activation is included.
- Exact-head CI and second review for PR #54 are pending.


## 2026-11-06 — PR #54 merged; local mutation audit PR #55

- PR #54 merged to `main` as `6cc1d20e63257387044334da45e38bc204961c09`. It adds versioned typed domain-event envelopes for session completion, revision ratings, test completion, and weak-verse failure/resolution; validates identity and semantic payload before journal enqueue; and preserves retry identity/timestamps.
- Exact-head Quality Gate run `42280361752` and post-merge main run `42280564932` both passed. The run included 386 automated assertions, 10 Firestore emulator rule tests, TypeScript, production build, and production server smoke test.
- Main advanced to `033b8abda6bbf4f5c58d9b20d835f3268230abb6` with Quran Library tabs/Juz navigation; the next branch was recreated from this exact SHA to preserve the owner's direct change.
- PR #55 branch `fix/local-mutation-audit-demo-journal-fresh-20261106`: removes the development demo loader's direct multi-archive writes and routes profile/plans/engine-plan/canonical portions/weak verses/activity through one journaled grouped transaction for authenticated users and one rollback-safe local transaction for guests.
- PR #55 adds tests for authenticated journal persistence, guest local-only behavior, and a simulated `QuotaExceededError` during a multi-archive projection. Existing coverage also verifies IndexedDB enqueue failure does not fall back to local-only writes, durable read failures block enqueue, and failed child projections roll back without advancing the cursor.
- The first PR #55 CI run exposed old tests that called the removed demo methods; the test fixtures were migrated to test-only seeding. Latest exact head: `25a04513b26aff04f0cfffa93c0d36d5b170d1b9`; Quality Gate run `42281736462` pending.
- Quran text and canonical Mushaf data were not modified by PR #54 or PR #55.

- Follow-up coverage added: simulate an application interruption after the journal/outbox commit but before local projection, reopen the same IndexedDB database with a fresh journal instance, and verify startup replay applies the event once without acknowledging remote delivery.


## 2026-11-06 — PR #55 merged and post-merge verified

- PR #55 merged to `main` as `c4de1ea12549a9c8a51f818e3b855d1da1d45f96`.
- Exact-head Quality Gate runs `42281993489` and `42281999065` passed; post-merge main run `42282206155` passed.
- The development-only demo loader now writes profile, plans, engine plan, canonical portions, weak verses, and activity as one grouped journal transaction for authenticated users; guest mode uses one rollback-safe local transaction. The old direct-write methods were removed.
- Added QuotaExceededError injection coverage proving all earlier projections roll back and the journal cursor does not advance. Added simulated restart coverage proving a pending journal event is replayed after reopening IndexedDB exactly once without acknowledging remote delivery.
- Updated test-only demo fixture seeding; no production direct demo writer remains. The PR did not modify Quran text or canonical Mushaf metadata.
- Remaining local audit targets: legacy outbox migration/reset, device-local reading/audio preferences, and any remaining unreviewed multi-key mutation callers.


## 2026-11-06 — PR #57 merged; PR #58 account-scope guard

- PR #57 merged as `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`. Exact-head runs `42283803166` and `42283813448` passed; post-merge main run `42284039747` passed.
- Profile reads now calculate a display streak without writing the profile archive. Canonical portion reads now prepare a recovery view without writing either canonical or legacy bytes.
- AuthGate now replays older committed events first, then commits legacy portions/revision migration through one journaled transaction before mounting the app. Guest migration remains local-only and rollback-safe.
- Validated recovery from corrupt schema-v2 data is represented by an explicit journal projection flag; corrupt canonical bytes are not replaced until the validated legacy snapshot is journal-committed.
- PR #58 adds account-scope guards to journaled persistence and AuthGate migration to prevent a stale startup task from projecting one account's migration into another account after an auth/scope change.


## 2026-11-07 — Remote projection recovery and initial multi-device verification

- PR #73 merged: `cc887a6bfa07aec880f495221e64dd36edb14ca8`; durable projection intent and recovery finalization.
- Post-merge main CI run `42350476806` passed.
- PR #77 merged: `716cf301bff9a8c7777ee3931dba6366a01afe3b`; independent Firestore Emulator clients + separate IndexedDB/localStorage prove bidirectional profile projection. Exact-head CI: 450/450 automated assertions, 26/26 rules, TypeScript, production build, startup smoke, dependency audit passed.
- PR #78 merged: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; two offline devices mutate same profile from base revision 0; accepted write wins, stale write returns `REMOTE_REVISION_CONFLICT`, losing local mutation and remote inbox are preserved, projection returns `blocked_pending_local` and cursor stays at 0. Exact-head CI: 450/450 automated assertions, 27/27 rules, TypeScript, production build, startup smoke, dependency audit passed.
- An initial PR #78 test attempt failed because the test called a nonexistent `listPending` API; corrected to use `listReady` and re-ran the full exact-head CI successfully. The earlier failed SHA was not merged.
- Current main at checkpoint: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; post-merge main workflow was queued; recheck it before considering main verification complete.
- Known blockers: tombstones remain intentionally blocked; no durable conflict record/user resolution UX; profile-only two-device coverage; no Playwright browser contexts/long-offline stress; production rules deployment and Vercel deployment not verified (`build-rate-limit`).
- No production data, secrets, Firebase rules deployment, environment variables, or Vercel settings changed.


## 2026-11-07 — Durable conflict archive

- Ported the useful conflict archive changes from stale PR #76 onto latest main in PR #81 rather than merging a diverged branch.
- Added IndexedDB schema v8 `projectionConflicts` store, UID-scoped indexes, a 100-record cap, resolved-only pruning, original-snapshot preservation, and remote-event retention.
- Added projector archival for blocked decisions/finalization failures, coordinator summaries, Settings diagnostics, and regression tests.
- Initial exact-head CI failed because the Firestore integration helper lacked the new snapshot/archive dependencies. Updated the helper and asserted the offline conflict is archived. Final exact-head SHA `415cbe33389a6108d08f9d5785818e8e12458fee` passed: 459 automated assertions, 27/27 rules, TypeScript, build, dependency audit, startup smoke.
- PR #81 merged as `059e902194811be71ab4dea9da8609a96967214e`; post-merge main run `42351965332` passed.
- Closed stale PR #76 and superseded PR #59; neither was merged. PR #59's old `domain-mutation.v2` serverTimestamp envelope did not match the current revisioned schema and was intentionally not ported.
- Vercel still reports `build-rate-limit`; no live deployment verification.


## 2026-11-07 — Atomic conflict reconciliation (PR #85)

- Reviewed PR #82's improved conflict archive implementation and ported it onto the current main via PR #85 rather than merging a stale-base branch.
- Added inbox/event fingerprint and identity checks to conflict archive writes, orphan prevention, 500 KB snapshot cap, and atomic conflict resolution within `finalizeRemoteProjection` / `markRemoteProjected` cursor transactions.
- Added recovery coverage for first-snapshot preservation, already-applied event reconciliation, late archive attempts, and oversized snapshot rejection. Exact PR head `b6af08b2d9461a1d3d7cc019404692d779500248`: 462 assertions passed, Rules 27/27, TypeScript/build/dependency audit/startup smoke passed.
- PR #85 merged as `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`; post-merge main run `42352594819` passed.
- Closed PR #82 and duplicate port PR #86 as superseded. PR #85 is authoritative.
- Vercel still reports `build-rate-limit`; no live production deployment.

## 2026-11-07 — Continued repository verification and safe merges

### Repository state
- Re-fetched current main after the PR #85 checkpoint. Current main at the end of this session segment: e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- Main Quality Gate after PR #62: run 42354256341, success on 8535802d3609c854b1c91742135c84894e5e074f.
- Main Quality Gate after PR #89: run 42354517460, in progress at checkpoint time; exact-SHA result still required.

### Merged work
- PR #62: plan lifecycle preservation; exact-head run 42342109962 passed; merge SHA 8535802d3609c854b1c91742135c84894e5e074f; post-merge main run 42354256341 passed.
- PR #89: reapplied reviewed Quran audio repeat fix on current main; exact-head runs 42354410219 and 42354399498 passed; merge SHA e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- PR #63 was closed as superseded after PR #89 merged. Its stale/diverged branch was not merged.

### Ruqyah sync audit
- PR #88 is merged; progress persistence is UID-scoped local storage, not cloud sync.
- Inspected feat/ruqyah-cloud-sync-20261107. At observed head ec15084e9a1f20013476af5df83144f45456a595, exact-head run 42354431882 failed: 491 tests passed and 3 failed because the branch calls a nonexistent StorageService.saveRuqyahProgressSnapshot.
- The branch's observed changes add a Ruqyah allowlist entry and shared schema, but do not establish complete end-to-end mutation enqueue, storage projection, revisioned mutation validation, or a safe concurrent counter merge. Do not merge until these are implemented and tested.
- Ruqyah progress is a mutable aggregate counter. A safe sync design must preserve increments made independently on different devices; consider per-device monotonic counters or immutable increment events and deterministic aggregation. Snapshot last-write-wins is not acceptable.

### Remaining critical work
- User-facing conflict resolution is absent. RemoteProjectionConflict is an evidence archive, not a user decision. reconciled only means projection/cursor finalization succeeded.
- Tombstones remain blocked in remoteInboxProjector; no collection-specific delete projection or safe retention/compaction.
- Two-device tests are limited to profile round-trip and one offline same-document conflict.
- Cross-tab/browser, account lifecycle, all-collection coverage, production Firestore rules deployment, and production deployment/live smoke remain unverified.
- Vercel failure is the daily deployment rate limit, not a successful deployment. No production settings or secrets were changed.

## 2026-11-07 — Ruqyah sync, storage integrity, and accessibility follow-up

### Merged
- PR #91 merged at a618036b995ff45749748e90e2a4d3ec1037c838. Exact-head run 42355023151 passed. Adds journal-first UID-scoped Ruqyah progress sync, revisioned remote writes, sequential two-device projection, and backup v5 support.
- PR #92 merged at bd6fc3a79267ee7136746fed17c58a6ceac8b58c. Exact-head run 42355486226 passed. Protects unversioned canonical portions, blocks direct writes while migration is pending, validates duplicate IDs/ranges, and normalizes legacy history IDs.
- PR #93 merged at f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Exact-head run 42355488786 passed 500 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build, and server startup smoke.
- Current main run 42355600523 passed on f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3.

### Active follow-up
- PR #94 adds ruqyahProgress to the coordinator legacy remote-state scan and tests a concurrent-offline stale revision. It asserts local Outbox, remote Inbox, local snapshot, remote event, conflict archive, and projection cursor are preserved. Exact-head CI must pass before merge.
- The current Ruqyah counter snapshot model does not calculate an additive merge of two concurrent increments. The test documents safe blocking/preservation only; manual merge remains unimplemented.

### Remaining critical blockers
- Manual conflict-resolution UI and idempotent keep-local/use-remote/merge state machine.
- Deterministic additive merge for Ruqyah counts or an explicit user-driven resolution that has sufficient base/delta evidence.
- Collection-specific tombstone projection and deletion retention.
- Cross-tab browser concurrency, comprehensive two-device multi-collection coverage, and account lifecycle isolation.
- Production Firestore rules deployment, production environment verification, exact-SHA deployment, and live post-deploy smoke.
- Vercel build-rate-limit is not a successful production deployment. No production secrets, rules, or flags changed.

### Subsequent checkpoint update — PR #95 merged

- PR #95 merged at 52e62d6b21057cf0d796cc3b137f4087cbe2e983. Its exact-head Quality Gate passed on c2e9478f6053ddc95aaa5058d7a5ab074255d58b; the merge adds post-success Ruqyah progress notifications for direct backup import and full reset, with rollback-safe notification timing.
- Main Quality Gate run 42355938085 was in progress on 52e62d6b21057cf0d796cc3b137f4087cbe2e983 when this note was added; verify its final conclusion before the next release decision.
- PR #94 was created against the previous main SHA f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Its changes are disjoint from PR #95, but re-check mergeability and exact-head CI after main advanced.
- PR #96 documents the global stop condition: do not set remote-sync flags until manual conflict resolution, additive counter merge, tombstones, cross-tab coordination, account isolation, and live verification all pass.

## 2026-11-07 — API proxy and guarded rules deployment workflow

- PR #97 merged at 217f7136244d4d7afd02a9c52be86f520c1baefa. Exact-head runs 42356248195 and 42356243586 passed. Added server-only IslamicAPI proxy, topic block allowlist, disabled-by-default topic endpoints, and bounded streaming response reads.
- PR #98 merged at 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. Exact-head run 42356412901 passed 509 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke. Added a manual-only rules deployment workflow; it has not been dispatched.
- PR #100 is open to add a pre-deploy Firestore Emulator test to that workflow. Do not dispatch before the preflight is merged and explicit approval is given.
- Main run 42356505550 passed on 8089579d020a6a4831cdc9ba4f25f8672f30cc3d.
- Vercel status on current main is build-rate-limit failure; a previous SHA had Vercel success but the latest main deployment is not verified. No production alias/live smoke is claimed.
- Outstanding: user-facing conflict resolution, additive Ruqyah counter merge, tombstone projection, cross-tab concurrency, account lifecycle isolation, full collection coverage, Playwright E2E, production rules deployment, exact-SHA production deploy/live smoke.

## 2026-11-07 — Follow-up merges and current release blockers

- PR #104 merged at `46ed9e5976b2f22f2495a270edf8c2255e27962b`: Settings displays the archived local and remote conflict snapshots in a read-only, exact-UID-scoped inspector. Exact PR Quality Gate passed on `7c730c0e57830c90a820467669d755babb441ec3`.
- PR #106 merged at `14390679530f5a523a77997d882f12160c3ad1c9`: reverse B → A pass for all eight collection routes, revision 2 assertions, and contiguous ordered projection. Exact-head CI runs `42357426174` and `42357436438` passed (510 unit assertions, 31 Firestore rules tests).
- PR #105 merged at `d71908b3e411bcd7d1db2b09318eb3c95564198e`: IslamicAPI Quran locator only, canonical WIRD Quran text, source allowlist, topic gate, and disabled unverified audio. Main run `42357565644` passed 509 unit assertions and 31 Firestore rules tests.
- PR #108 source-registry hardening remains under review. The initial global Set permits a content item to swap to another item's approved reference; require exact item-ID-to-source mapping. `g-4` has a generic non-authoritative source label and must be resolved before merge.
- Vercel deployment is still blocked by provider quota; no live production SHA is verified.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.


## 2026-11-07 — PR #111 and populated eight-collection sync verification
- Subsequent main work: PR #117 removed dormant unverified audio playback code (merge SHA `673ddfcb5af046f785e2da18abc73c4a1bba2339`; exact-head run `42359507976`, 518 assertions and 31 rules tests passed). PR #120 hardened signed Quran coordinates and provider IDs (merge SHA `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`; exact-head run `42359703038`, 520 assertions and 31 rules tests passed).
- PR #115's browser test branch failed only during Playwright browser installation because Ubuntu 26.04 is unsupported by Playwright 1.56.1; its test/config files were reapplied on current main in PR #122 using Ubuntu 24.04. PR #122 remains under exact-head CI; browser smoke is not yet claimed passed.
- PR #118 was closed as a duplicate of already-merged PR #117 after confirming the 360-line playback removal is already on main. PR #113's older Ruqyah checkpoint is being superseded by PR #121; its release checklist changes are being preserved there.


- PR #111 merged as `48cf9b236072cd3db2603a57cda5f67b30a778cd`. It restricts IslamicAPI to validated Quran locator coordinates; displayed Quran text and metadata resolve from WIRD's canonical corpus. Duplicate PR #112 was closed after all code/test files were confirmed identical to main and its only remaining difference was stale checklist wording.
- PR #114 merged as `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`; exact PR head `9ff200bc731ac99db0d662f76dad97b370d00c9b` passed both push and pull-request Quality Gate runs `42359408488` and `42359412200`.
- Exact-head evidence: 513 automated assertions passed, 31 Firestore Rules Emulator tests passed, dependency audit passed, TypeScript passed, production build passed, and production/development server startup smoke passed.
- PR #114 replaces empty fixtures for plans, enginePlans, portions, weakVerses, tests, and activityEvents with valid non-empty domain records. All eight collections now have populated fixtures. The Emulator test performs sequential A → B → A projection with distinct B-side edits and compares complete local projection records and remote payload fields, plus revision 1/2.
- This does not prove simultaneous concurrent merge for every collection, long-offline replay, real-browser cross-tab behavior, or Playwright/device E2E. It closes the empty-record serialization/round-trip gap documented under PR #101/#106.
- Current main SHA: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`. Post-merge Main Quality Gate run `42359547235` completed successfully on `8ac5d87d84077f209eaf49881dd1354ce10d3565`.
- Vercel status remains `build-rate-limit`; this is a provider deployment quota failure, not a successful deployment. No production Firebase rules deployment, live deployed SHA, live two-device verification, environment-variable change, secret change, or production sync activation is claimed.
- PR #2 remains a draft and is 115 commits ahead / 266 behind current main; do not merge it wholesale. Review and selectively reapply any still-useful changes only.
- Next priority: design and implement an idempotent user-directed conflict-resolution state machine with durable preservation and latest-revision revalidation; then tombstone semantics, additive Ruqyah counters, cross-tab/Playwright, and account lifecycle stress tests. Keep production sync gates disabled.


## 2026-11-07 — populated multi-record sync, Playwright, and conflict-evidence checkpoint

- Current main at checkpoint: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`.
- PR #122 merged as `beec50a623febdfa79f286f7c2b87d8234b2b150`; exact head `945c0f73e965d0111d46c53179465ee4c98fb83a` passed six Playwright app-shell checks (three desktop, three mobile Chromium/iPhone 13 viewport emulation). Post-merge main run `42360161749` passed.
- PR #125 merged as `ceebd11995bece572d40230ab084858be5a40cf2`; exact head `b24e0eb8221c23498878ee0a58727990ad9f2dfd` passed 521 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright checks. Post-merge main run `42360526021` passed.
- PR #126 merged as `802811d45a6d7e977d3b4082fd08ebf5e95151fa`; exact head `9886ca8a090cf07f04b51943fbc254a4b98ce221` passed 521 automated assertions and 31 Firestore Rules Emulator tests plus the remaining Quality Gate steps, including Playwright. Post-merge main run `42360725981` passed.
- PR #129 merged as `ab1a2cd04a1456a6430985ce6f6e72a1b137907d`; exact head `334a73a05bddc4d574cdf8c25a0299f329b22c49` passed 525 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright app-shell checks. Its post-merge main run was cancelled when the subsequent documentation-only PR #130 updated main; current main Quality Gate run `42361224358` is the relevant post-merge validation and was in progress at this checkpoint.
- PR #129 makes normal remote projection and the final IndexedDB cursor/revision transaction document-scoped. Same-document pending writes still block; unrelated test-result documents can progress independently. Grouped `syncMeta` transactions retain collection-wide guards.
- PR #126 adds durable pending local mutation evidence to Conflict Archive, including mutation IDs, fingerprints, base revisions, sequence numbers, and payloads. Repeated observations append by mutation ID; a fingerprint mismatch or combined snapshot size above 500 KB aborts without deleting inbox/outbox entries or advancing the cursor. Settings displays at most ten archived mutation payloads while retaining the full archive.
- This is not yet a user-directed conflict-resolution state machine: keep-local, use-remote, safe merge, and revision revalidation actions remain unimplemented. Tombstones, additive multi-device Ruqyah counters, full auth/sync browser journeys, real two-device verification, and production deployment remain release blockers.
- PR #127 added 10 Ruqyah locator-library browser checks (five desktop and five mobile); combined with six app-shell checks, the full Playwright suite has 16 tests; PR #130 refreshed the Ruqyah checkpoint and release checklist after CORS hardening and locator-library E2E. These browser checks do not replace live Firebase/device tests.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit` on reviewed main updates. No live deployed SHA, live two-device verification, Firebase production-rules deployment, secret/environment-variable change, or production sync activation is claimed.
- PR #2 remains a draft, 115 commits ahead / 276 behind current main. Do not merge it wholesale.
- Next: implement the conflict decision state machine with atomic archival/revalidation and crash recovery; then tombstones, additive Ruqyah counters, broader Playwright workflows, backup/restore stress, and account lifecycle tests.


### Follow-up verification after the checkpoint

- Documentation merge PR #132 produced main SHA `3eeb1eb2da419536a1e2fc9db6911961d3bfafcc`.
- Post-merge main Quality Gate run `42361756445` completed successfully.
- The full Playwright suite in that run executed 16 tests total: 6 app-shell checks (3 desktop + 3 mobile) and 10 Ruqyah locator-library checks (5 desktop + 5 mobile). The earlier phrase “16 Ruqyah locator-library checks” was inaccurate and has been corrected.

## 2026-11-08 — tafsir sessions, reading khatma, mushaf navigation, and hadith references

- Implemented current-ayah tafsir in the shared memorization/revision session view, with edition choice, loading/error/retry states, stale-request cancellation, and source attribution. Added optional Quran Foundation hadith references in sessions and reading tafsir; display is restricted to Arabic entries with an explicit Sahih grade and the source mapping is labeled as a reference, not exclusive tafsir.
- Added a local reading-khatma tracker with page-based manual completion, progress and prior completed-cycle counts. It uses its own storage key and does not mutate memorization/revision records. Added page-turn/swipe treatment to the existing Mushaf reader and an explicit read-page action, respecting reduced motion.
- Added a server-side Quran Foundation Hadith References proxy. It validates Quran coordinates and page bounds, holds credentials server-side, filters results, rate-limits, times out, and fails closed when QF credentials are absent. Live upstream integration remains unverified because no QF credentials were configured; no new API source was introduced for Quran text.
- Added `docs/UX_PRODUCT_ROADMAP_AR.md` with a full interface roadmap and staged integrity/accessibility work. Reviewed OSS patterns from Ummah Library and StPageFlip; no third-party code or dependency was copied/added.
- Quran corpus audit compared all 6,236 ayat and metadata across 114 surahs with the checked-in Tanzil Uthmani/Hafs reference: 6,236 exact matches, zero text/metadata mismatches. Fussilat 41:7 matches the reference exactly. Report and reference checksum are in `src/data/quranValidationReport.json`.
- Automated gates: `npm test` PASS (584 passed, 0 failed); `npm run lint` PASS; `npm run build` PASS (existing large-chunk warning remains). `git diff --check` PASS. Firestore Rules Emulator BLOCKED because Java is unavailable. Server smoke/local browser access BLOCKED by the environment's localhost connectivity; mobile visual accessibility was therefore NOT TESTED. Hadith upstream is NOT TESTED without credentials.
- No GitHub push/PR, merge to main, deployment, production secret/config change, or cloud sync activation was performed. Work remains on `feat/session-tafsir-khatma-reader` pending review and any future release authorization.

## 2026-11-08 — production API runtime hotfix follow-up

- PR #167 merged as `b857ad33321e0cc5a8f7071074f3566c3dc863a5` after exact-head Quality Gate run `42484878901` passed (automated suites, dependency audit, Firestore Rules Emulator, TypeScript, build, server smoke, and desktop/mobile Playwright). Preview `2197a4205d72b930593d9dbfcf52f77839455722` was READY and returned HTTP 200.
- Production deployment `dpl_GLAponkC83mDEerECAM6mGMEsYU6` is READY on alias `wird-app.vercel.app`, matches the merge SHA, and the home page returned HTTP 200.
- Read-only production probing found metadata-backed serverless endpoints returned `FUNCTION_INVOCATION_FAILED`. Native Node loading isolated extensionless TypeScript imports in the Quran metadata dependency. Corrected metadata/API imports to explicit `.ts` paths and made the metadata type-only import explicit. Added `smoke:api-imports` to verify native Node imports and invalid-input responses, and wired it into CI.
- Local after hotfix edits: `npm test` (584 passed), `npm run lint`, `npm run build`, and `npm run smoke:api-imports` passed. The API smoke exercises invalid inputs only and does not call external providers. The fix is not deployed yet; create a hotfix PR from current main, run exact-head CI, verify Vercel preview API responses, then merge only if green.
- No production credentials/settings or cloud sync configuration changed. Hadith live upstream still requires server-side Quran Foundation credentials and remains untested.


## 2026-11-11 15:52 +02:00 — Reconciliation of documentation and PR queue

- Re-fetched repository tree (310 entries; recursive tree not truncated), latest main SHA `8dd21522430cc014db4eb5da8437f89c42f190f9`, all open PRs, and exact-head check runs.
- PR #360 exact head `6e3c3c4be799c77a39dab539e3161c3d9f98958d`, run `43030878508`: automated tests, dependency audit, API import smoke, approved audio probes, Rules Emulator, TypeScript, build, and server smoke passed; Desktop/Mobile Playwright smoke failed. Vercel reported build-rate-limit.
- PR #362 exact head `e2079734a0d150c1046307611a2b28346fdcdb1d` passed Quality Gate; its guest-entry hydration helper fix is not merged. PR #361 exact head `3008c4788caba61930be008e3cb40dcf52cfd78f` passed Quality Gate and remains open.
- PRs #358, #359, and #356 have failed exact-head Quality Gates in Desktop/Mobile Playwright smoke and remain Draft. #358 and #359 are overlapping offline-audio storage models; do not merge both without one agreed contract.
- Updated `docs/CONTINUE_HERE.md` to be the live source of truth and aligned this roadmap/checkpoint/handoff to the observed status. Historical progress entries remain preserved, not silently rewritten.
- No runtime code, Quran data, Firestore rules/data, production secrets/settings, sync flags, or deployments changed. No PR was merged.
- Next: apply/merge the #362 test-helper fix through the approved branch workflow, rerun each affected exact-head Quality Gate, then continue review of offline audio manifest overlap and reconcile #356.


## 2026-11-11 15:58 +02:00 — Documentation reconciliation follow-up

- Updated the live continuation queue, roadmap, checkpoint, work log, Google AI Studio handoff, and agent instructions on PR #360.
- Added historical-status routing notices to older Firestore sync, Ruqyah, sync architecture/audit, and current-status snapshots; preserved the technical history and corrected relative links for the nested progress folder.
- Latest PR #360 head after documentation updates: `8873b135bcfd5a3a6d7bddf7f6081cc08015df5f`. No check-runs were visible at the time of the final refresh. Previous exact-head Playwright failure and rerun-with-no-steps failure remain unresolved; do not claim CI PASS.
- Recursive repository inventory contains 310 entries. Documentation tree has a central index/catalog and feature-specific plans; source code was not reorganized because runtime paths and imports should not be moved as part of a documentation-only cleanup.
- No merge, deployment, Firebase/Firestore mutation, production settings/secrets, sync-flag change, or user-data change.


## 2026-11-11 16:15 +02:00 — Reconcile docs branch with latest main

- PR #362 merged at `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd`; exact-head Quality Gate passed.
- PR #361 merged at `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`; EveryAyah is stream-only and legacy cached files are pruned; exact-head Quality Gate passed.
- The original #360 head had a failed check; its retry failed without job-step evidence. A replacement documentation branch was reconstructed from latest main, preserving the doc changes and main's updated offline-audio rights note.
- Run full exact-head Quality Gate on the replacement docs PR before merge. No Production settings, secrets, Firebase/Firestore data/rules, sync flags, or user data changed.


## 2026-11-11 16:18 +02:00 — PR #363 CI observation

- Replacement docs PR #363 is based on latest main `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
- Quality Gate run `43039009676` and rerun attempt 2 failed on the single job before any job steps were recorded; job logs are unavailable. Treat exact-head CI as unresolved, not as a test failure diagnosis or pass.
- PR #360 was closed as superseded; all 22 documentation changes are carried in #363.


## 2026-11-11 16:22 +02:00 — Offline audio storage architecture decision

- Reviewed #358 and #359 store implementations. #358 owns jobs and job-scoped items; #359 owns a unique reciter/ayah metadata manifest without job lifecycle. Their current database contracts overlap and should not ship side by side.
- Added `docs/offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md`: one IndexedDB model (`jobs`, canonical `files`, `jobItems` relation), Cache Storage for complete audio bytes only, explicit cross-store recovery, shared-file reuse, deletion, quota, and required tests.
- This is a design contract only; no downloader, cache adapter, IndexedDB runtime, or UI was implemented. #358/#359 remain unmerged pending a combined implementation and exact-head Quality Gate.


## 2026-11-11 16:26 +02:00 — Salvage sync cutover design from stale PR #356

- Compared PR #356 against current main. Its pure Quran audio range planner is already present on main from PR #355; the remaining changes are documentation additions, many containing stale main/Production status snapshots.
- Preserved the unique server-visible per-device legacy activity cutover protocol from `docs/sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md` in the current docs branch, explicitly marking embedded SHA/deployment statements historical.
- PR #356 can be closed as superseded after this unique design note is carried forward; do not merge its stale status snapshots wholesale.


## 2026-11-11 16:35 +02:00 — CI startup failures and PR coordination

- PR #363 latest head `5e33453bd076f32ebad9053f3e6d8bc4de8070fc`; runs `43039009676`, `43039794349`, and `43039853668` ended failed before the single job recorded any steps. Job logs return BlobNotFound. Exact-head CI is unresolved; no merge.
- PR #358 run `43030195498` and #359 run `43029617572` failed on their prior exact heads. Their descriptions now point to the single IndexedDB/Cache Storage contract and explicitly block merging either unchanged.
- PR #356 closed as superseded; planner already merged through #355. Salvaged its unique server-visible activity cutover protocol into the current sync design.
- Added the offline audio storage contract and indexed it from README/catalog/roadmap. It is a proposal, not an implemented downloader.
- No runtime/Production/Firebase/secrets/sync flag changes.


## 2026-11-11 16:40 +02:00 — Close stale documentation PRs

- Closed #299 (old master continuation snapshot) and duplicate UX page-map PRs #272/#273; their state notes were superseded by current main/docs hub.
- #2 remains open but very stale (last compare: 115 commits ahead / 467 behind main, 37 changed files); do not merge directly. Audit unique feature value only if that workstream becomes a priority.
- #358/#359 remain open drafts blocked by the unified offline audio storage contract.


## Latest exact-head CI observation — 2026-11-11 16:45 +02:00

- PR #363 head tested: `a8ba43209315acfabecdc4883e6c2f6823c8afed`.
- Quality Gate run `43040464893` ended failed on the only job before any step was recorded. Job logs are unavailable (`BlobNotFound`); there is no test-level failure diagnosis.
- Treat CI as BLOCKED/UNRESOLVED. Do not merge and do not weaken checks. Re-fetch the PR's current head and rerun only when GitHub Actions can provide a job with recorded steps/logs.
- The following documentation-only status commit changes the PR head; re-fetch it before any future gate or merge decision.

---


## 2026-11-11 — Seerah learning feature research and roadmap

- Added `docs/SEERAH_LEARNING_PLAN_AR.md` as the specialist plan for WIRD's proposed Seerah and Companions learning experience. It covers source/API research, editorial policy, interactive learning, quizzes, spaced review, data model, offline-first architecture, privacy/licensing gates, QA, and staged delivery.
- Product priority explicitly recorded: memorization/revision remains first; Seerah learning is the second core feature.
- Initial provider research:
  - SeerahBook exposes read-only people/events/places/relationships and source provenance; its developer page says the content is drawn from a specific Seerah lecture series and cited classical sources. It is a POC candidate, not an automatic publication source.
  - Dorar's Historical Encyclopedia API documents `GET /api/v1/history/search`, Arabic historical event search, bearer-token access, manual access review, and a request to review the consuming work before publication.
  - Islamic Network advertises free/open no-key APIs and caching, while People and Events are marked Early Access. Coverage, Arabic data, individual provenance, terms, and uptime still need verification.
  - Seerah Library and Sirah Atlas were reviewed as UX references, not approved content APIs.
- No provider has been selected. No external API was integrated; no runtime code, user progress, Firestore Rules/data, secrets, environment variables, production settings, or deployments changed.
- Documentation updates: unified roadmap, continuation queue, docs entry point, documentation catalog, and UX page/tool map now link to the Seerah plan.
- Validation: documentation content and links were reviewed by readback. Application tests were NOT RUN because this change is documentation-only. PR #363's previously observed CI state was BLOCKED/UNRESOLVED due to a job failing before recorded steps/logs; re-fetch the new exact PR head and gate.
- Next: complete the current docs PR gate first; then perform a limited, read-only API coverage/licensing POC and prepare a reviewed Arabic content sample before production implementation.


## 2026-11-11 — Seerah roadmap cross-link and handoff alignment

- Added the Seerah learning destination to `docs/UX_PAGE_AND_TOOL_MAP.md` as planned/not yet implemented, with its lesson, profile, timeline, map, quiz, mistake-review, progress, and offline surfaces.
- Added the Seerah direction to `docs/UX_PRODUCT_ROADMAP_AR.md` and the Google AI Studio handoff; updated the docs index and catalog.
- Refreshed `docs/CONTINUE_HERE.md` to avoid embedding a stale branch SHA. Always re-fetch PR #363's exact current head.
- Latest verification attempt: no PR-triggered workflow run was returned for the latest docs commit at the time of inspection. Combined status showed Vercel `failure` with the known `build-rate-limit` target. This is not a code-test result. PR #363 remains Draft; exact-head Quality Gate is still required.
- Documentation readback was performed for the new Seerah plan and updated roadmap/index files. Application tests remain NOT RUN because no application code changed.


## 2026-11-11 — API terms and offline rights review

- Expanded the Seerah plan after reviewing the official API terms pages.
- Dorar's API terms require visible attribution and a clickable source URL, prohibit bulk extraction/republication/sub-licensing, limit cache to 24–48 hours, require server-side token protection, set a published 60 requests/minute limit, and require a reviewable preview before publication. This rules it out as a sole source for permanent offline content bundles; consider it only for approved, limited live lookup/verification.
- SeerahBook's public developer page says no key/signup and IP-based limits, but its API reference did not render full endpoint/schema details during review; reuse, storage, offline, commercial rights, and numeric limits remain unresolved.
- Islamic Network labels People/Events Early Access and says services are free/open, but the reviewed terms page gives no detailed content license for reuse, redistribution, translation, or offline storage; do not infer those rights from price/access language.
- Decision remains: no API approved as a complete WIRD content corpus or offline bundle source. Continue only with limited read-only POC and rights clarification.


## 2026-11-11 — Seerah API OpenAPI schema review and CI retry

- Opened SeerahBook developer and About pages. REST is read-only, no key/signup, per-IP rate-limited, and supports people/events/tribes/places/sayings/actions/sources/search. About describes a single lecture-series basis with classical references, and labels approximate dates, disputed details, weak chains, and possible dramatized wording. Direct-quote policy added to reject reconstructed wording as verbatim quotation.
- Opened Islamic Network People and Events API pages and their OpenAPI JSON. People exposes language-keyed biography, birth/death years, kind, linked event/quote/story aggregates, and related-person edges; Arabic is not guaranteed on every field/record. Events exposes paginated event lists and Hijri calendar endpoints; its month/day is an annual observance date distinct from the optional historical year. Therefore Events is a calendar enrichment source, not a complete chronological Seerah syllabus.
- Islamic Network service pages call APIs free/open/no-key and request caching; People/Events remain Early Access. General terms are as-is/no warranty. A public community reply says services are free subject to each website's terms and rate limits, but does not resolve a specific permanent offline/republication license for People/Events data.
- Reopened Dorar history API docs and terms: manual approval and bearer token, server-side-only use, visible attribution and clickable source URL, no bulk download/republication, cache 24–48h, 60 requests/minute, and preview review before publication. Not a durable offline corpus source.
- Updated `SEERAH_LEARNING_PLAN_AR.md`, `DEVELOPMENT_ROADMAP.md`, `CONTINUE_HERE.md`, and `DEVELOPMENT_CHECKPOINT.md` with schema-level findings and a clear WIRD-owned reviewed content registry architecture.
- PR #363 exact head at start of check: `fc20a4f485f47f5ae7b94567bf521885a67ed284`; Quality Gate run `43051925917` job `130631077198` failed with zero recorded steps and no downloadable logs (BlobNotFound). Retried only failed job; retry job `130632989788` again failed with zero steps/no logs. No test-level cause is available; CI remains BLOCKED/UNRESOLVED.
- Vercel combined status failed on free deployment rate limit. PR timeline also contains a READY Preview deployment `DaCNAppQni39XbMag8PkLxGbNQ9k`; no Production/live smoke claim is made.
- No runtime changes, external API data fetch/ingestion, Firebase/Firestore changes, secrets, production flags, or deployment actions were performed.


## 2026-11-11 — PR #363 latest exact-head gate

- Latest PR #363 head at this check: `835881de9d6f9719e2afe3acd4bd737bd73d2cf1`.
- Quality Gate run `43052636315` failed; job `130633602897` has no recorded steps. No evidence that TypeScript, tests, or production build started.
- A retry on the previous run reproduced the same pre-step failure with no logs. Do not keep retrying absent a changed runner condition or usable diagnostic evidence.
- Combined Vercel status remains blocked by the free deployment rate limit. An earlier Preview READY event is not proof for this exact head or Production.
- PR remains OPEN / DRAFT; merge blocked pending inspectable passing exact-head CI.


## 2026-11-11 — Claim-level provenance gate for Seerah APIs

- Inspected Islamic Network People `PersonDetail` and Events `EventDetail` OpenAPI schemas. Person biography, birth/death, honorifics and relationships have no per-claim bibliography field in the published schema. EventDetail has a generic source string, not necessarily a traceable book/edition/page citation. QuoteRef has source text and URL but does not guarantee full bibliographic or hadith-grading metadata.
- Decision: Islamic Network People is currently a discovery/navigation registry only, not a publishable Seerah source by itself. Events is a calendar/event discovery source only; each date and event must be checked against a source. Every WIRD claim requires independent claim-level source metadata.
- SeerahBook's stated provenance is stronger, but every source must still be opened and checked; dramatized/reconstructed wording cannot be turned into verbatim quotations.
- Updated Seerah plan section 15 and unified roadmap with the stricter provenance gate. No API records were fetched or imported.


## 2026-11-11 — توجيه «حكاية السيرة»
تم تثبيت متطلب أن تكون السيرة كتابًا تفاعليًا متصلًا بأجزاء وفصول ومشاهد، لا دروسًا منفصلة. خطة المنتج التفصيلية في SEERAH_LEARNING_PLAN_AR.md §16. معيار القبول يتطلب قارئًا متصلًا، حفظ موضع القراءة، سردًا موثقًا claim-level، سياقًا زمنيًا ومكانيًا وشخصيات مترابطة، وتفاعلات/اختبارات اختيارية لا تقطع القراءة. لا حوار مختلق أو اقتباس غير محقق أو دمج روايات متعارضة. لم تتغير ملفات runtime أو إعدادات الإنتاج.

## 2026-11-11 — Seerah as a continuous narrative book
- Added the owner’s product clarification to the Seerah plan, development roadmap, continuation source of truth, and Google AI Studio handoff.
- Revised S1/S2 acceptance: the MVP must include a connected multi-scene narrative chapter in a continuous reader with saved position and claim-level sources. A lesson list or quiz interface alone does not satisfy acceptance.
- The proposed book structure, narrative/editorial constraints, reader modes, and optional embedded learning interactions are documented in SEERAH_LEARNING_PLAN_AR.md §16.
- CI recheck: run 43052961502 on earlier SHA b7ca97f6fa93c715d408adc88ba9b180c7800017 ended failure; job 130634757053 had no recorded steps/logs (steps=null). No PR-triggered run was returned for the latest docs commit 7a5e6a9bb17b47404e9e0d4153b7a594d8bfce95. Treat as unresolved runner evidence, not a diagnosed code/test failure. Do not merge until exact-head Quality Gate is verifiably green.
- No runtime, API ingestion, Firebase, production settings, secrets, sync flags, or deployment changes.

## 2026-11-11 — توحيد مصطلحات خطة السيرة
تمت مراجعة مواضع المصطلحات القديمة في خطة السيرة، وتعديل نموذج التقدم والاختبارات والبنية التقنية ومعايير التحقق لتكون مبنية على الأجزاء والفصول والمشاهد بدل افتراض «دروس» منفصلة. تظل وقفات الفهم والأسئلة أدوات اختيارية داخل رحلة القراءة، وليست بديلًا عن السرد.


## 2026-11-11 — توحيد تجربة قارئ «حكاية السيرة»

- راجعت `docs/UX_PRODUCT_ROADMAP_AR.md` واكتشفت تعارضًا قديمًا في §6: وصف السيرة كدروس قصيرة واختبارات بعد كل درس، رغم اعتماد اتجاه الكتاب السردي المتصل في خطة السيرة.
- استبدلت §6 بمواصفات «حكاية السيرة» ككتاب تفاعلي: صفحة دخول، أجزاء وفصول ومشاهد، قراءة متصلة افتراضيًا، وضع قراءة وتعلّم اختياري، فهرس، حفظ موضع، anchors مرتبطة بإصدار المحتوى، بطاقات سياق ومراجع لا تقطع السرد، وخريطة/خط زمني اختياريان.
- أضفت §7 لترتيب التنفيذ: UX وعقد المحتوى أولًا، ثم فحص قابلية إعادة استخدام مكونات المشروع، ثم نموذج واجهة ببيانات placeholder موسومة، ثم القارئ والتقدم والاختبارات؛ لا API ingestion ولا محتوى تاريخي غير معتمد.
- تحديث الملف تم على فرع الوثائق، commit: `5dc844478da20f0e49f00a5fe30b7c63391bd600`; blob الجديد لملف UX: `cc1731365c202e0e252a2666188ce2358bddf023`.
- PR #363 كان OPEN / DRAFT عند آخر قراءة، ورأسه قبل هذا التحديث `e87c837ec4fb2c1e738a826d53636a93f625e771`. أعد جلب الرأس وCI بعد هذا التغيير؛ لا دمج دون Quality Gate ناجح وقابل للفحص على exact head.
- لا runtime code أو API ingestion أو Firebase/Production أو secrets أو sync flags أو deployment changes في هذه الدفعة.


## 2026-11-12 — أول شريحة تنفيذية لقارئ «حكاية السيرة»

- فُحص main الحي عند `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`، ولم يكن يحتوي مكونات أو مسارًا للسيرة. أُنشئ فرع مستقل `feat/seerah-continuous-reader-shell-20261112` وPR #365 Draft.
- أضيفت واجهة قارئ RTL أولية وفهرس مشاهد والتنقل بين المشاهد والتحكم في حجم النص والتباعد ولوحة سياق اختيارية، مع مدخل بالقائمة ومسار `#/seerah`.
- أضيفت خدمة حفظ موضع القراءة على الجهاز فقط بمفتاح prototype مستقل، واختبارات التطبيع والحفظ والاستعادة والمسح والتعامل مع التخزين الفاشل.
- أضيف عقد typed لمحتوى السيرة يربط الادعاءات بالمصادر والمواضع، ويربط كتل السرد بالادعاءات، ويمنع النشر قبل اعتماد الفصل والمراجعات العلمية واللغوية واستمرارية السرد وإمكانية الوصول، ويرفض الاقتباس غير المتحقق والادعاءات غير المستخدمة.
- لا يوجد محتوى تاريخي فعلي أو API ingestion أو Firebase/Firestore أو مزامنة أو تغييرات إنتاجية. واجهة PR #365 موسومة بوضوح كنموذج لا يحتوي سردًا تاريخيًا منشورًا.
- آخر رأس PR #365 الذي بُني على Vercel: `5f0f5cb3fb7342dee9dcd5935849cb329bece986`. Preview deployment `dpl_ArPB9Pj4QGeCmUAzdYh1EKypAmus` = READY، وVite build اكتمل بنجاح. هذا لا يثبت اختبار الواجهة الحي أو اجتياز الاختبارات الكاملة.
- GitHub Quality Gate على SHA نفسه: run `43184272681`، job `131067466738` فشل قبل ظهور أي steps؛ `steps=null` و`logs_url=null`، واسترجاع السجلات أعاد `BlobNotFound`. لا يوجد دليل يحدد فشل test/typecheck/build؛ لا تُعلن CI pass ولا تُشخّصه كفشل اختبارات.
- PR #365 يظل OPEN / DRAFT / HOLD. لا merge حتى تتوفر Quality Gate ناجحة وقابلة للفحص على exact head. PR #363 للوثائق ما زال منفصلًا ولا يُفترض أنه مدمج في main.


## 2026-11-12 — Offline-first and future app readiness consolidated in canonical docs branch

- Adopted offline-first as a primary track alongside Quran, daily worship, Seerah, UX, and sync.
- Existing PWA/service worker, lazy-package preparation, local Quran/progress, bounded audio/Mushaf/tafsir/hadith caches are treated as a foundation, not certification.
- Added the Arabic app-readiness roadmap and route/capability matrix; extended the architecture and owner-action requirements.
- Added public static assets to the explicit offline package, six-second navigation fallback timeout, and clearer storage persistence capability reporting in the separate code PR.
- Auth/Firebase and live APIs remain network-dependent; local verified content remains authoritative; no generated religious fallback.
- EveryAyah remains stream-only; pinned audio requires rights review and stays device-local.
- PWA remains primary; native wrapper decision follows real offline web tests.
- PR #363 is the canonical docs branch; PR #366 is being reduced to code-only to avoid editing the same documentation files in parallel.
- No production settings, secrets, Firestore Rules/data, sync flags, or user data changed.


---

## 2026-11-12 13:40 +02:00 — Live PR audit and cross-branch file reconciliation

- Verified `refs/heads/main` directly: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Re-fetched exact PR metadata and file lists for #363/#365/#366/#367. All remain OPEN / DRAFT / mergeable.
- Exact-head CI runs: #363 `43203107824` (job `131131326627`), #365 `43186044298` (job `131073336535`), #366 `43202600366` (job `131129580249`), #367 `43200705034` (job `131123069674`). Each job completed failure with `steps=null` and `logs_url=null`; this is not a diagnosed test failure and not a pass.
- Vercel status: #365 and #367 Preview success; #363 and #366 blocked by Free build-rate limit. No new Production or live-device evidence.
- Found actual file overlap: #367 changes `docs/sync/ARCHITECTURE.md` and `docs/engineering/progress/WORK_LOG.md`, both also changed by #363. This contradicts the intended code-only separation. Canonical docs are assigned to #363; #367 must drop these two paths before code review.
- #366's local quota-aware LRU media cache remains separate from cloud plan entitlement. #367's 800 KB is a per-document interim envelope only. #365 remains a reader shell with no publishable historical text.
- No main/Production/rules/secrets/user data/feature flags changed. No PR merged or deployed.


---

## 2026-11-12 14:05 +02:00 — Seerah bookmark persistence and PR ownership cleanup

- On PR #365 branch `feat/seerah-continuous-reader-shell-20261112`, added local bookmark persistence keyed by book version, part, chapter, scene, and anchor. Added normalization, duplicate handling, version isolation, targeted removal, sidebar listing/navigation, and service tests. Latest head `16048985de1df2e17fb0c45afbafa8d16acd7933`.
- Exact-head run `43209263032` / job `131152309833` ended failure with no steps/logs; no code-level test result can be inferred. Vercel exact-head status is blocked by Free build-rate.
- PR #367 had two actual documentation overlaps with #363. Restored `docs/sync/ARCHITECTURE.md` and `docs/engineering/progress/WORK_LOG.md` to main versions on #367. Latest code-only head `fd417faaa96a11920ef3a8e4f1038f567c36a731`; exact-head run `43209066503` / job `131151602011` also had no steps/logs.
- Rechecked PR file lists: #363 and #367 now have zero overlapping changed paths.
- Reviewed Service Worker audio and Mushaf cache hit paths; both refresh insertion order before adaptive LRU trimming. No speculative change made.
- PR #363 docs branch received live status/checkpoint/owner-action updates; refetch its exact final head before relying on its checks.
- No merge/deploy/Production setting/rules/secret/user-data changes.


## 2026-11-12 14:35 +02:00 — Unified audio metadata foundation and Seerah bookmark e2e

- Opened Draft PR #368 from current main, combining #358 job lifecycle and #359 canonical file identity into `jobs/files/jobItems`. Added shared-file reference handling, pin protection, cache availability reconciliation, two-phase `deletionPending` cleanup, and stale cleanup race protection.
- Added fake-indexeddb coverage for job idempotency, shared references, pin/unpin, eviction, stale cache scan, quota rollback, terminal states, and reopen persistence; registered the suite in `runAllTests.ts`.
- #368 exact head `4e3a192ee766108ff580cebed32699a70fb7f5ab`, run `43210985755` / job `131158220859`: failed without steps/logs. No test-level conclusion. No Vercel Preview due Free build-rate.
- Marked #358 and #359 as superseded by #368; both remain Draft/unmerged for traceability. #368 is metadata only; downloader, Cache Storage adapter, service worker protocol, UI, and offline playback are future phases.
- PR #365 adds device-local versioned bookmarks, saved scene list, accessible storage error, and Playwright coverage for persistence after reload, removal, and scene navigation. Exact head `d0fc6753c32e231bcfe4396e0808963ed5c6978f`, run `43211160493` / job `131158819288`: failed without steps/logs.
- #363 remains the canonical docs branch. #367's two overlapping docs files were restored to main; no overlap remains between #363 and #367/#368.
- No main merge, deploy, Firestore Rules, production schema/data, credentials, flags, or user data changed.



## 2026-11-12 14:55 +02:00 — End-to-end plan storage architecture review

- Traced the live path from `StorageService.saveEnginePlans` through `persistEnginePlansSnapshot`, IndexedDB journal, local Outbox, coordinator, revisioned writer, Firestore state/event docs, and remote inbox/projector.
- Confirmed the 100-plan hard cap and full JSON localStorage archive remain on main. Main's journal engine-plan budget is 450,000 bytes; PR #367 proposes 800,000 bytes and shared alignment but does not remove the count cap or migrate local storage.
- Confirmed the Outbox has a 1,500,000-byte aggregate cap and stores full serialized state through StorageService. The writer stores the payload in both state and immutable event documents.
- Confirmed Firestore Rules currently authorize the existing top-level user collection/document layout only; a nested chunk path requires explicit rules and Emulator tests.
- Added detailed end-to-end design to `docs/sync/ARCHITECTURE.md`: local IndexedDB archive, lossless migration/hydration, atomic journal references, immutable Firestore chunks, manifest publication, receiver materialization, old-client capability negotiation, and delayed garbage collection.
- Explicitly deferred deleting the 100-plan cap or increasing constants again. Next coding slice is call-site/test inventory and local IndexedDB archive design.
- Added cache generation identity requirement to the Offline Audio contract: Cache Storage keys must be versioned per download generation to prevent stale cleanup from deleting a replacement file.



## 2026-11-12 — استكمال تدقيق المسارات المتوازية وتحديث الرؤوس الفعلية

### مرجع المستودع
- تم التحقق مباشرة من `refs/heads/main`: SHA الحالي ما زال `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. لا توجد تغييرات على main في هذه الجلسة.
- جميع طلبات السحب أدناه OPEN / DRAFT / mergeable، ولا يوجد دمج أو نشر أو تغيير إعدادات إنتاجية.

### رؤوس PR الفعلية وCI
| PR | Exact head | Quality Gate run / job | النتيجة المرصودة |
|---|---|---|---|
| #363 docs | `3c697f64f5a1f736ffc5533d98a574598b64c5c2` | `43211736907 / 131160797846` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #365 Seerah | `d0fc6753c32e231bcfe4396e0808963ed5c6978f` | `43211160493 / 131158819288` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #366 Offline/PWA | `b289bba34a93d730ca4fd06a08220d75067bf8c7` | `43202600366 / 131129580249` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #367 plan payload budget | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | `43209066503 / 131151602011` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #368 offline audio metadata | `58c9d0cee27e4dd999955d92362247862d76f4dd` | `43214640907 / 131170651663` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |

- هذه النتائج لا تثبت فشل الاختبارات/TypeScript/build، ولا تثبت نجاحها. تعامل معها كحالة runner/log observability غير محسومة، ولا تضعف Quality Gate ولا تعلن CI pass.
- Combined Vercel status على الرؤوس الخمسة = failure مع رابط `build-rate-limit`. لا يوجد Preview مطابق مثبت للرؤوس الحالية، ولا تحقق Production/live.

### تدقيق تداخل الملفات
- #363 يملك ملفات docs فقط.
- #365 يغيّر 11 ملفًا في مسار السيرة والراوتر والاختبارات؛ لا تداخل مع docs.
- #366 يغيّر 7 ملفات PWA/Offline؛ لا تداخل مع docs.
- #367 يغيّر 9 ملفات runtime/tests فقط بعد إعادة ملفات `docs/sync/ARCHITECTURE.md` و`docs/engineering/progress/WORK_LOG.md` إلى main؛ لا تداخل مع #363.
- #368 يغيّر 3 ملفات صوتيات/اختبارات فقط؛ لا تداخل مع docs.

### مراجعة #368 وإصلاح إضافي
- تمت مراجعة `offlineQuranAudioLibrary.ts` وملف الاختبارات على رأس PR.
- اكتُشفت فجوة تحقق: `setJobStatus` و`markItemDownloading` كانا يقبلان `NaN`/Infinity كطابع زمني، وقد يحفظان قيمة غير صالحة تفسد سجل المهمة.
- أضيف تحقق `Number.isSafeInteger(nowMs) && nowMs >= 0` قبل فتح المعاملة في الدالتين، واختبار regression يمرر `NaN` و`Infinity` ويتأكد من رفضهما وبقاء المهمة سليمة.
- أصبح رأس #368 `58c9d0cee27e4dd999955d92362247862d76f4dd`. Quality Gate run `43214640907` / job `131170651663` انتهى failure بلا steps/logs؛ لم يُثبت تشغيل الاختبار الجديد بعد.
- يظل #368 أساس metadata فقط: لا downloader ولا Cache Storage adapter ولا Service Worker protocol ولا UI ولا playback. كل الصوتيات المحفوظة محليًا تبقى خارج Firebase sync/backup.

### جرد تخزين الخطط على main
- تم تأكيد `src/services/storageService.ts` على main، 2265 سطرًا.
- داخل الخدمة: `getEnginePlans` عند السطر 1161، و`saveEnginePlans` عند 1165، وحد العدد 100 عند 1167، وكتابة JSON كاملة إلى مفتاح `ENGINE_PLANS` عند 1179.
- يوجد تحقق/ترحيل/إسقاط إضافي في نفس الخدمة عند الأسطر 946 و1503 و1540–1588 و1672–1674 و2000 و2089 و2133 و2177؛ يجب مراجعة هذه المسارات قبل نقل الأرشيف.
- `src/tests/storageReliability.test.ts` يحتوي فحصًا مباشرًا عامًا لـ get/save عند السطر 73، و`src/components/plans/PlanningEngineWizard.tsx` يستقبل قائمة الخطط ويستدعي `onUpdateEnginePlans` في عمليات الإضافة/الحذف/التحديث (الأسطر 194–243).
- بحث GitHub code-search لم يعرض نتائج قابلة للاستخدام، لذلك **لم يكتمل بعد جرد جميع المستهلكين** عبر المستودع. لا تعتبر هذه القائمة شاملة ولا تبدأ migration قبل إتمام inventory لكل call sites والاختبارات وbackup/import/export وsync projection.
- لا تغيّر حد 100 أو byte budgets. الخطوة التالية هي تصميم IndexedDB archive versioned مع migration lossless وhydration، مع إبقاء localStorage القديم حتى التحقق وإمكانية rollback.

### ما لم يتغير
- لا merge أو deploy أو Google AI Studio sync.
- لا Firestore Rules/schema/data، ولا production flags أو secrets أو sync activation.
- لا حذف بيانات أو تقليل حدود أو تغيير entitlements.

### الخطوة التالية الإلزامية
1. أكمل جرد call sites لـ `getEnginePlans/saveEnginePlans` وعمليات backup/restore/import/export والـ sync receiver/projection، مع مسارات الاستهلاك والاختبارات.
2. راجع migration/hydration lifecycle وتصميم rollback على مستوى IndexedDB قبل التنفيذ.
3. تابع #368 باختبارات generation/deletion/cache contract، ثم أضف downloader وCache Storage adapter في PR منفصل بعد مراجعة البروتوكول.
4. تابع #365 و#366 بشكل مستقل دون دمج؛ محتوى السيرة يبقى placeholder حتى الاعتماد العلمي، وOffline الحقيقي يحتاج اختبار جهاز/airplane mode.
5. لا دمج لأي PR قبل Quality Gate قابل للفحص وناجح على exact head، ومراجعة diff كاملة. لا تعاود rerun لنفس runner بلا دليل على تغير ظروفه.


## 2026-11-12 — تحديث بعد مراجعة #368 وجرد تخزين الخطط
- #368 latest head: `08851241bff289e04b13568188e0b2103a1d02e3`. أضيفت حواجز للطوابع الزمنية غير الصالحة في `setJobStatus/markItemDownloading`، والتحقق من علاقات job-item قبل حذف المهمة، مع اختبارات regression لـ NaN/Infinity والعلاقة الفاسدة. لا workflow run ظهر لهذا الرأس عند آخر استعلام؛ لا يوجد CI pass مثبت.
- #363 docs head عند آخر تحقق قبل هذا الإلحاق: `af510f58596c9fef3b930b7604ee3fbbb63e58ca`; run `43214783526` / job `131171122148` failure مع `steps=null` و`logs_url=null`. إعادة تحديث الوثائق ستنشئ رأسًا جديدًا؛ أعد جلبه قبل أي قرار.
- استُكمل جرد حدود خطة المحرك: `StorageService.saveEnginePlans` يكتب JSON كاملًا إلى localStorage ويحد العدد بـ100؛ `validateBackupPayload` يحد enginePlans بـ100؛ `sessionPersistence` يرفض snapshot فوق 100؛ `journaledSnapshotService.persistEnginePlansSnapshot` يمرر الكتابة إلى `StorageService.saveEnginePlans`؛ `backupPersistence.buildBackupImportOperations` ينشئ snapshot operation؛ و`StorageService.applyJournalProjection/matchesJournalProjection` يعيدان قراءة/كتابة نفس archive. `exportBackup/importBackup` يتعاملان مع نفس المفتاح مباشرة.
- في App: التهيئة الأولية وعمليات refresh وdaily-session selection وprogress refresh تقرأ `StorageService.getEnginePlans`؛ الحفظ المعتاد يمر عبر `persistEnginePlansSnapshot`، وإكمال الجلسة يمر عبر `persistJournaledSessionCompletion` مع enginePlans snapshot اختياري.
- التخزين السحابي: IndexedDB journal له حد 450,000 bytes على main، وlocal outbox حد إجمالي 1,500,000 bytes، وremote projection يستخدم `applyJournalProjection`. PR #367 يغيّر حد الوثيقة مؤقتًا فقط إلى 800,000 bytes؛ لا chunks/manifest ولا ترحيل local archive.
- ما زال inventory غير مكتمل لكل المستهلكين غير المباشرين/الشاشات ونسخ الاختبارات بسبب أن code search لم يعرض نتائج؛ لا تبدأ IndexedDB migration قبل إنهاء فحص كل مستهلك/backup/import/export/projection والتهيئة.
- لا تغيّر حد 100 أو budgets، ولا تفعل remote flags/Firestore Rules أو أي Production setting. الخطوة التالية: إكمال inventory ثم تصميم IndexedDB archive + lossless migration + startup hydration + rollback.


## 2026-11-12 — أحدث نتيجة بعد التحقق من رؤوس PR
- #363 docs head: `e805f5c30606b7ae77412c78f8bdf80fcba5923c`. لم يظهر PR-triggered workflow run لهذا الرأس عند آخر استعلام؛ Vercel ما زال محجوبًا بـ `build-rate-limit`. لا Preview/CI/Production pass مثبت.
- #368 head: `08851241bff289e04b13568188e0b2103a1d02e3`. أحدث Quality Gate run `43215055425` / job `131172059517` = failure مع `steps=null` و`logs_url=null`; لا يمكن معرفة هل بدأت الاختبارات أو البناء.
- #365/#366/#367 ما زالت على الرؤوس المسجلة في جدول التدقيق السابق، وQuality Gate لكل منها فشل قبل تسجيل الخطوات. جميع PRs تبقى OPEN / DRAFT / HOLD.
- لم يتغير main، ولا توجد عمليات دمج أو نشر أو تعديلات Production/Rules/secrets/flags.


## 2026-11-12 — final refresh before handoff
- #368 exact head `08851241bff289e04b13568188e0b2103a1d02e3`: latest Quality Gate run `43215055425` / job `131172059517` انتهى failure بعد نحو 4 ثوانٍ، مع `steps=[]` و`logs_url=null`، وسحب logs أعاد `BlobNotFound`. لم يبدأ أي step مسجل؛ لا test/build diagnosis ولا pass.
- #363 docs latest head قبل هذا التحديث كان `754b291c7b77c7521cc6676c5dcb2c9ab01c7fc8`; لا workflow run ظهر لهذا الرأس. هذا التحديث سيولد رأسًا جديدًا، ويجب إعادة جلبه قبل أي قرار.
- تمت مراجعة `.github/workflows/ci.yml`: Quality Gate مصمم لتشغيل npm tests، npm audit، Rules Emulator، lint، build، server smoke وPlaywright؛ لكن لا توجد أي steps مسجلة في الوظائف الفاشلة، لذلك لا نعرف أي مرحلة وصلت إليها. لا تغيّر workflow أو تضعف gate دون تشخيص من سجل قابل للقراءة.
- لم يحدث merge/deploy أو تعديل main أو Production أو Rules أو secrets أو flags.


## 2026-11-12 — استكمال جرد Engine Plans ومسارات الاستيراد/المزامنة

### مرجع الحالة
- main ما زال `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- PR #363 head ما زال `08f52548e0e5dbe235e06c9b51395893ff2e563a` عند بدء هذا التدقيق. بقية الرؤوس: #365 `d0fc6753c32e231bcfe4396e0808963ed5c6978f`; #366 `b289bba34a93d730ca4fd06a08220d75067bf8c7`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #368 `08851241bff289e04b13568188e0b2103a1d02e3`.
- جميع PRs OPEN / DRAFT. لا merge ولا نشر ولا تعديل إنتاجي.

### جرد الكود الذي تم التحقق منه على main
1. **مصدر التخزين:** `src/services/storageService.ts` (2265 سطرًا): مفتاح `wird_engine_plans`، القراءة عبر `getEnginePlans()` و`readJsonArrayArchive`، الكتابة عبر `saveEnginePlans()` بعد validation وحد 100، ثم `localStorage.setItem` عبر `setItem`.
2. **App consumers:** `src/App.tsx`: تهيئة state (سطر 111)، reload/refresh (225، 527، 673)، selection/completion paths (308–364)، وحفظ التعديلات عبر `persistEnginePlansSnapshot` (400). إكمال جلسة مع snapshot اختياري يمر عبر `persistJournaledSessionCompletion` (357–364).
3. **UI:** `MemorizationPlansView` يمرر `enginePlans` إلى `PlanningEngineWizard`. الـ Wizard لا يقرأ التخزين بنفسه؛ يحدّث القائمة عبر `onUpdateEnginePlans` عند إنشاء/حذف/تعديل الخطة (194–243).
4. **Journal service:** `journaledSnapshotService.persistEnginePlansSnapshot` يصدر عملية `enginePlans/snapshot` بحمولة `{ records: plans }`؛ ثم مسار journal-first يطبق projection محليًا. `sessionPersistence` يقبل `enginePlansSnapshot` اختياريًا ويرفضه إن لم يكن array أو تجاوز 100.
5. **Backup:** `validateBackupPayload` يفرض 100 على `enginePlans`; `buildBackupImportOperations` يحولها إلى journal operation `enginePlans/snapshot`; `importBackupFile/importBackupJournaled` هما المسار journal-first. `StorageService.exportBackup/importBackup` ما زالتا API legacy داخل StorageService وتتعاملان مباشرة مع المفتاح؛ direct import API يجب أن يظل ضمن جرد التوافق ولا يُحذف قبل إثبات كل callers.
6. **Reset:** `resetAllDataJournaled` ينشئ snapshot فارغًا لمجموعة enginePlans ضمن event واحد. يجب أن يظل هذا السلوك متوافقًا مع archive backend الجديد.
7. **Projection:** `applyJournalProjection('enginePlans')` يكتب عبر `saveEnginePlans`; `matchesJournalProjection` يقرأ مفتاح localStorage مباشرة في فرع enginePlans. `clearJournalProjection` وعمليات reset/restore ذات الصلة تتضمن مفتاح `ENGINE_PLANS` ضمن مفاتيح التصفير.
8. **Cloud sync:** `cloudSyncCoordinator` يسمح بمجموعة `enginePlans`; `revisionedRemoteMutation` يقبلها كـ collection مدعومة؛ `remoteInboxProjector` يدرجها في allowlist. `indexedDbSyncJournal` يطبق/يتحقق من projection عبر `StorageService.matchesJournalProjection/applyJournalProjection`، وله budget مخصص للـ enginePlans. `localSyncOutbox` يعرف collection نفسها وله حد إجمالي مستقل.
9. **Tests:** `storageReliability.test.ts` يغطي get/save؛ `backupValidation.test.ts` يغطي schema/validation/import؛ `journaledSnapshotService.test.ts` يغطي journaled session/enginePlans snapshots/projection؛ `backupPersistence.test.ts` يغطي الاستيراد journal-first؛ `sessionPersistence.test.ts` يغطي projection semantics؛ `indexedDbSyncJournal.test.ts` و`localSyncOutbox.test.ts` يغطيان حدود journal/outbox. لم يُستكمل بعد جرد كل fixture/consumer داخل كل هذه suites.
10. **بحث المستودع:** GitHub code search أعاد نتائج فارغة لهذا المستودع، لذلك تم تأكيد المسارات أعلاه بقراءة الملفات المعروفة/المترابطة مباشرة، وليس بادعاء scan شامل لكل 159 ملف TS/TSX. يجب استكمال البحث عن كل استدعاءات legacy `exportBackup/importBackup` وأي مستهلك غير مباشر قبل migration.

### الاستنتاج المعماري — لا يبدأ الترحيل قبل هذه العقود
- لا يكفي تبديل `getEnginePlans/saveEnginePlans`: يلزم backend async لأن IndexedDB غير متزامن، وبالتالي يلزم startup hydration gate قبل أي consumer يقرأ state، أو adapter متزامن فوق نسخة hydrated في الذاكرة مع كتابة async موثوقة. لا يجوز ترك UI تقرأ localStorage كأنها canonical بعد cutover.
- يجب أن تكون واجهة archive واحدة ذات versioned envelope (schemaVersion, revision/generation, records, integrity metadata) وتوفّر read/prepareMigration/commit/verify/rollback؛ لا تخزن blob واحدًا ضخمًا في Firestore.
- migration: اقرأ legacy دون تعديل، validate كل record والهوية/التكرار، اكتب archive إلى IndexedDB في transaction، أعد قراءته وتحقق من count + stable fingerprint + record IDs، ثم سجّل migration marker. لا تحذف أو تستبدل legacy localStorage في نفس الإصدار؛ احتفظ به read-only حتى مرور دورة تشغيل/إعادة فتح ناجحة وإثبات rollback.
- الكتابات بعد الترحيل يجب أن تكون atomic بين archive revision والـ journal/outbox reference قدر الإمكان، مع idempotency key وexpected base revision. عند فشل quota أو transaction لا تعلن النجاح ولا تحرك sync cursors.
- projection/remote inbox يجب أن ي materialize archive بالكامل ويتحقق من manifest/chunks قبل تحديث cursor. لا تقبل `{ records }` كحمولة واحدة إذا تعدت حد المستند؛ manifest يشير إلى immutable chunks، ثم publish pointer أخيرًا بعد تحقق كل chunk.
- backup export/import يجب أن يبقى متوافقًا: export يجمع نسخة snapshot كاملة خارج حدود التخزين؛ import يتحقق ثم يكتب transactionally مع rollback، دون partially applied archive.
- توافق العملاء: لا يتم تفعيل manifest/chunks في Firestore قبل capability negotiation وقراءة/كتابة آمنة للعملاء الأقدم. لا تعدل Rules أو remote flags دون موافقة.

### التالي
1. استكمال inventory على كل ملفات TS/TSX المتبقية، خاصة أي استدعاءات `exportBackup/importBackup` وlegacy direct storage APIs وsettings/backup UI.
2. رسم تدفق sequence من UI → App state → journal → outbox → remote mutation → inbox projector → archive hydration، وتحديد نقطة واحدة canonical للقراءة والكتابة.
3. إعداد RFC/ADR منفصل للـ IndexedDB archive يحدد envelope, migration, rollback, quota, backup, sync manifest, client compatibility واختبارات crash/restart.
4. لا تنفذ migration أو ترفع حد 100 أو byte budgets قبل مراجعة واعتماد هذا التصميم واختبار كل consumers.

### حدود التحقق
- لا يوجد local test runner متاح من خلال GitHub connector؛ لا نعلن tests pass من قراءة المصدر.
- Quality Gate على الرؤوس السابقة ما زال غير قابل للتشخيص بسبب jobs بلا steps/logs. يلزم exact-head run قابل للفحص.
- Vercel Free build-rate-limit blocker قائم في السجل السابق؛ لا Preview/live verification.
- لا تغيير main أو production rules/schema/data/secrets/flags.


## 2026-11-12 — Auth scope + backup UI audit addendum
- `AuthGate` is the actual startup barrier: it sets a storage scope, replays journal projection for verified users, runs legacy portion migration, and only then mounts `App` after `readyScope` matches. Guest mode also passes through scoped-storage setup/migration. This is the safest integration point for awaiting Engine Plans archive hydration, but the order must be explicit: resolve scope → initialize per-scope IndexedDB archive → copy/verify legacy enginePlans → replay journal using archive-aware projection → migrate portions → mount App.
- `StorageService.setStorageScope` is synchronous today. It resolves legacy unscoped localStorage keys, copies each key to a UID-prefixed destination, verifies copies, removes legacy source keys, and writes ownership marker with rollback. A future IndexedDB archive is not copied by this routine automatically; account/guest ownership choice and first-account migration must be extended to include the archive without making the existing synchronous scope switch falsely report success.
- Per-account archive identity must use the resolved storage scope (e.g. `guest` or `user:<uid>`), never a global singleton store without UID partitioning. Account switching must invalidate stale in-memory hydrated snapshots and abort old-scope writes before mounting the new account.
- Settings backup export is `SettingsView.handleExportBackup → StorageService.exportFullBackup()`; it is currently synchronous and reads `ENGINE_PLANS` directly from localStorage. After IndexedDB becomes canonical, export must become async or use an explicit verified archive snapshot API, and the UI must await it and show failure rather than exporting a stale compatibility copy.
- Settings backup import already uses `importBackupFile → importBackupJournaled`; it validates and commits through the journal. Keep this as the primary UI import path. `StorageService.importBackup` remains a legacy direct-write API with rollback and is not the Settings UI path; search for all non-test callers before deprecating it.
- Reset in Settings delegates to App's journaled reset path; preserve one logical transaction across Engine Plans archive and the other collections. The low-level `StorageService.resetAllData` is a legacy direct key deletion path and must not become the new canonical reset path.
- Updated migration sequence: scope/ownership resolution → per-scope archive hydration/migration → journal replay/materialization → legacy portions migration → App mount. Backup export must read the canonical archive; backup import and reset must commit a new archive revision with journal/outbox consistency and rollback.


## 2026-11-12 — UI consumer scan correction
- Expanded the UI scan beyond `App.tsx`: `src/components/dashboard/DashboardView.tsx` calls `StorageService.getEnginePlans()` directly inside daily-session selection (line 73). This must be replaced by a hydrated `enginePlans` prop/state from App (or a shared async-ready store); otherwise the Dashboard could read a stale/empty compatibility key after IndexedDB cutover.
- There are **two** UI backup-export entrypoints: `SettingsView.handleExportBackup` (line 165) and `ProgressAnalyticsView.handleExportBackup` (line 166). Both call synchronous `StorageService.exportFullBackup()`; both must switch to one async verified export API and handle errors/loading. This correction supersedes any earlier implication that Settings was the only export surface.
- Both Settings and Progress Analytics import through `importBackupFile` (journal-first); Settings export is not journal-aware today. `StorageService.importBackup` remains the legacy direct localStorage writer and is covered by tests, but its full production caller scan is still required before deprecation.
- App state is initialized from `getEnginePlans()`; Dashboard independently reads it; Planning UI consumes props and sends updates. These three paths need one hydrated source of truth and no synchronous fallback-to-empty during archive startup.
- This is still a targeted source audit, not a claim that every one of the 159 TS/TSX files was exhaustively scanned. Continue checking the remaining UI/services for direct backup API calls and legacy archive access before implementation.


## 2026-11-12 — PR #367 remote payload patch review
- Reviewed the actual #367 patch (not just its title): it introduces `syncPayloadLimits.ts` and routes IndexedDB journal validation, local outbox validation, and `writeRevisionedRemoteMutation` through the same `getSyncMutationPayloadLimit` helper. Engine Plans and grouped transactions containing Engine Plans receive an 800,000-byte payload ceiling; ordinary collections retain 128,000 bytes.
- The same patch updates conflict resolution payload checks and conflict snapshot retention sizing (`MAX_CONFLICT_SNAPSHOT_BYTES=1,700,000`, conflict count 29) to keep the aggregate conflict archive near the previous ceiling. It adds tests that exercise 700 KB local journal/outbox/conflict paths and pre-network Firestore writer rejection above the shared cap.
- This is a fixed interim per-mutation cap, not adaptive storage entitlement, not archive chunking, and not a solution for the 100-plan guard or localStorage archive. Current main still has its older 128,000-byte remote writer validation; only the unmerged #367 branch contains the shared 800 KB implementation.
- Do not raise the 800 KB value further. The long-term path remains local IndexedDB archive + verified manifest/chunks + receiver materialization/capability negotiation. Per-document envelope headroom and Firestore limits must be tested with actual serialized records, not only synthetic filler.
- CI for #367's exact head remains unverified/failing without inspectable job steps from the prior audit; do not merge based on source review alone.


## 2026-11-12 18:15 +02:00 — إعادة تحقق PRs وتدقيق Engine Plans archive

- main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` مؤكد من قاعدة PRs ومن Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` بحالة READY على نفس SHA والـ alias `wird-app.vercel.app`. لا live browser/sync smoke.
- أعيد جلب PR metadata: #363 head `9a5eb9579b474c50bc192a4f0dac2001d3aa7afb`; #365 `d0fc6753c32e231bcfe4396e0808963ed5c6978f`; #366 `b289bba34a93d730ca4fd06a08220d75067bf8c7`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #368 `08851241bff289e04b13568188e0b2103a1d02e3`. جميعها OPEN/DRAFT وتستهدف main.
- أحدث Quality Gate runs المطابقة لهذه الرؤوس: #363 `43217043348` / job `131178813698`; #365 `43211160493` / job `131158819288`; #366 `43202600366` / job `131129580249`; #367 `43209066503` / job `131151602011`; #368 `43215055425` / job `131172059517`. كلها completed failure مع `steps=null` و`logs_url=null`; لا pass ولا test-level diagnosis.
- جرى تأكيد Production deployment عبر Vercel read-only: READY، main، exact SHA match. لا إعدادات أو أسرار أو flags تم تغييرها.
- جرد source مؤكد: StorageService localStorage/limit 100؛ App hydration/read/write/session; Dashboard direct getEnginePlans; PlanningEngineWizard props/callback; journaledSnapshotService; sessionPersistence; applyJournalProjection/matchesJournalProjection; backupPersistence journal-first import/reset; Settings + Progress Analytics synchronous export; AuthGate scope → journal replay → legacy portions migration → App mount.
- AuthGate هو hydration barrier المناسب مبدئيًا، لكنه لا يهيئ Engine Plans archive حاليًا. setStorageScope ما زال synchronous وينسخ/يتحقق/يحذف localStorage keys القديمة؛ لا يمكن افتراض أنه يهاجر IndexedDB.
- اختبارات معروفة: storageScope, storageReliability, backupValidation, backupPersistence, journaledSnapshotService, sessionPersistence, journalProjectionReplayer, indexedDbSyncJournal, localSyncOutbox. لم يكتمل بعد مسح كل fixtures/callers؛ GitHub code search أعاد 0 مع incomplete_results، لذلك لا ندّعي فحصًا شاملًا.
- أضيفت خلاصة الحالة والـ blockers إلى أعلى `docs/CONTINUE_HERE.md` في commit `bb32f9352fd94e4d9ad6dd5d06d90936c10306cc` على فرع الوثائق.
- **النتيجة:** لا migration ولا RFC نهائي بعد. الخطوة التالية إكمال caller/fixture scan وسلسلة sync/conflict resolution ثم RFC/ADR. لا رفع حد 100 أو byte budgets. لا merge/deploy أو تغيير Production/Rules/secrets/sync flags.
- لم تُشغّل اختبارات محلية؛ هذا تدقيق source/docs عبر GitHub. لا تدّعِ نجاح اختبارات من هذه المراجعة.


## 2026-11-12 18:25 +02:00 — اكتمال scan مستهلكي Engine Plans والاختبارات
- جرى scan لكل 100 ملف مصدر TS/TSX تحت `src/` ولكل 78 ملف test/spec في المستودع عند main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. هذا فحص نصوص/عقود مصدرية وليس تشغيلًا للاختبارات.
- لم يظهر UI consumer مباشر إضافي خارج App وDashboard؛ MemorizationPlansView يمرر props فقط إلى PlanningEngineWizard. ظهر writer إضافي `demoDataPersistence.ts` عبر grouped journal transaction.
- استُكملت خريطة conflict: `getLocalProjectionSnapshot`, `matchesJournalProjection`, `isLocalProjectionEmpty`, `applyJournalProjection` و`syncConflictResolutionService` كلها تعتمد على Engine Plans localStorage، ويجب تحديثها معًا.
- Test/fixture coverage المحددة: planningEngine, dailySessionSelection, backupValidation, backupPersistence, journaledSnapshotService, sessionPersistence, storageReliability, storageScope, indexedDbSyncJournal, localSyncOutbox, cloudSyncCoordinator, firestoreRules. E2E plans/dashboard لا يختبران archive backend حاليًا. AuthGate startup hydration يحتاج اختبارات صريحة.
- **تصميم ذري:** journal/outbox/cursors في IndexedDB، بينما archive المقترح يحتاج backend async. Conflict use-remote يطبق projection داخل معاملة journal IDB الحالية. لا يمكن الادعاء بذَرّية cross-database. RFC يجب أن يقرر same-DB multi-store transaction أو prepare/commit intent idempotent مع crash recovery، ولا يحرك cursor قبل التحقق الكامل.
- أضيفت خريطة المستهلكين وقيد الذرية إلى أعلى `docs/CONTINUE_HERE.md` في commit `ed9ea1b57adac6c0900361f44c8f679f7df48f4f`.
- لم يُنفذ RFC أو migration أو تعديل حد 100/byte budgets. لم تُشغّل اختبارات محلية. لا merge/deploy أو تغييرات Production/Rules/secrets/flags.


## 2026-11-12 18:35 +02:00 — RFC أرشيف Engine Plans
- أُنشئ `docs/sync/ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md` على فرع الوثائق كتصميم مقترح فقط.
- القرار المقترح: إضافة archive stores إلى قاعدة `wird-sync-journal` نفسها (schema v10) حتى يمكن commit archive revision + journal event + outbox reference في IndexedDB transaction واحدة. لا نستخدم قاعدة IDB ثانية كـ canonical archive.
- يغطي RFC: manifests/records/fingerprints، scope isolation، AuthGate hydration، copy-verify-mark migration، rollback، grouped transactions، Inbox/conflict resolution، remote chunks/capability negotiation، backup/import/reset، quota، ومصفوفة الاختبارات/مراحل rollout.
- لا migration أو كود أو tests منفذة. لا تغيير حدود 100/byte budgets، ولا Production/Rules/secrets/flags، ولا merge/deploy.


# مراجعة المسارات المستقلة — 2026-11-12 18:50 +02:00

## تعديلات مراجعة مضافة إلى فروع PR (لم تُدمج)
- PR #365: عزل موضع قراءة السيرة والعلامات محليًا حسب StorageService scope (`guest` / `user:<uid>`) بدل مفتاح localStorage عالمي. أضيف اختبار تمييز المفاتيح بين guest ومستخدمين. آخر head: `a2e7ac38677466a7976f759dfc890aeb2fe05fda`.
- PR #366: إزالة نمط delete-then-put عند cache hit في Service Worker؛ كان فشل إعادة الكتابة بعد الحذف قد يحرم الطلب الحالي من ملف offline موجود. أصبحت الاستجابة المحفوظة تُعاد أولًا ويُجرّب trimming مع معالجة الفشل. أضيف guard ثابت للاختبار. آخر head: `cade1b630bb429d6a4106de5bf12713df18f3491`.
- PR #368: جعل `finalizeOrphanDeletion` يتطلب `expectedCacheGenerationId` ويرفض إنهاء metadata لجيل أحدث؛ ومنع worker متأخر من مهمة terminal من استبدال cache generation أحدث. أضيف اختباران للسباقات. آخر head: `b5ed5c9bead88835da751c7d6eb5ff7de76d56b2`.
- PR #367 لم يتغير: 800,000 bytes حد ثابت مؤقت فقط؛ لا chunks ولا archive.

## الحالة الفعلية بعد التعديلات
- PR #363 docs head قبل هذا التحديث: `d41096af17fbac98297efe39514d7ebe74cfd0fd`.
- PR #365 head `a2e7ac38677466a7976f759dfc890aeb2fe05fda`.
- PR #366 head `cade1b630bb429d6a4106de5bf12713df18f3491`.
- PR #367 head `fd417faaa96a11920ef3a8e4f1038f567c36a731`.
- PR #368 head `b5ed5c9bead88835da751c7d6eb5ff7de76d56b2`.
- Quality Gate runs الحالية للرؤوس #363/#365/#366/#367/#368: `43258266345`, `43258645058`, `43258830250`, `43209066503`, `43258983666` على الترتيب. كلها failure، وjob steps/logs_url غير متاحة؛ لا نستنتج منها code failure ولا pass.
- كل PRs ما زالت OPEN/DRAFT وmergeable=true عند آخر قراءة. لم يحدث merge.
- لا اختبارات محلية شُغلت في هذه الجلسة. التعديلات أضيفت مع اختبارات/guards مصدرية، لكن يلزم runner صالح ونتائج exact-head قابلة للفحص قبل أي merge.
- main وProduction كما هما؛ deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` ما زال آخر ما تحقق READY على main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. لم يُجرَ deploy جديد.

---


## 2026-11-12 — تنفيذ متطلبات المحفوظ وإعدادات الجلسة + مراجعة السيرة

### الحالة المصدرية الجديدة
- PR #369 branch feat/memorized-ranges-multi-select-20261112 head 7ac00ef32f3b3c2b1158f165ed141e6f332ab88e: أضيفت خدمة memorizedRangeSelection لاستخراج حدود الجزء من QURAN_JUZ_STARTS المولد من Quran dataset، وتقسيم الجزء إلى نطاقات لكل سورة، وتطبيع/دمج النطاقات المتداخلة والمتجاورة. واجهة PlanningEngineWizard أصبحت تدعم اختيار عدة سور عبر checkboxes قابلة للمس مع بحث، أو جزء كامل، أو نطاق آيات مخصص. أضيفت اختبارات service + UI وسجلت في test runner.
- PR #370 branch feat/session-display-settings-disclosure-20261112 head 2bbb54da778ab3eb2ac863e2b12c4e31fbe39dfb: إعدادات عرض الجلسة أصبحت disclosure مطوية افتراضيًا مع aria-expanded/controls، وأضيف lineSpacing وpagePadding إلى تفضيلات الجهاز المحلية وتطبيقهما على عرض الآيات وبطاقات القراءة. أضيفت اختبارات التطبيع والتوافق مع الإعدادات القديمة واختبار UI.
- PR #365 branch feat/seerah-continuous-reader-shell-20261112 head 113f12c43b9b075541b7d28f58fa89cd71ef73d4: اكتشاف وإصلاح bug فعلي في حذف علامة السيرة؛ الدالة كانت تكتب إلى مفتاح global بدل Storage Scope النشط. أصبحت تستخدم نفس scoped-key resolver وأضيف regression test على UID scope.
- PR #363 docs head c58bcfeafb53277a3535b70df43a644c4b754bc5: أضيفت متطلبات المالك الجديدة، وخريطة المسارات المتوازية، وبحث أولي عن مصادر السيرة وحقوقها وشروط API.

### نتيجة بحث السيرة
- لا يوجد اعتماد أو ingestion للمحتوى.
- Dorar History API متاح بطلب ومراجعة يدوية، وشروطه تشمل attribution + رابط المصدر، منع bulk scraping/republishing، caching 24–48 ساعة، server-side token، ومراجعة قبل النشر. السعر/الإتاحة التجارية لم يُحسما؛ لا تكامل قبل موافقة/توضيح.
- Sunnah.com API يتيح جزءًا من بيانات الحديث بعد طلب API key، ويضيف بيانات بعد فحص يدوي؛ ليس corpus شاملًا للسيرة.
- Arabic Collections Online يعرض كتبًا عربية تصفها المنصة بأنها public domain، ومنها سجل تهذيب سيرة ابن هشام؛ يلزم تحقق حقوق كل طبعة/ملف وعدم افتراض أن كل نسخة أو تحقيق متاح لإعادة النشر.
- OpenITI releases منشورة تحت CC BY-NC-SA 4.0 بحسب توثيقها؛ لا تُدمج نصوصها في منتج قابل للتجارية دون مراجعة قانونية للترخيص.
- التفاصيل والروابط في docs/SEERAH_LEARNING_PLAN_AR.md.

### Entitlement / adaptive capacity finding
- فحص src/types/quran.ts وStorageService وserver.ts وfirestore.rules مع probe لمسارات entitlement/subscription المعروفة لم يُظهر entitlement/billing service أو plan tiers أو server-authoritative quota model في main.
- لذلك لا يجوز اختراع Free/Pro أو limits. يلزم لاحقًا عقد entitlement server-verified (مثلاً custom claims/verified backend) وموافقة المالك على أسماء الخطط وحدودها قبل تفعيل حصص حسابية.
- السعة المحلية تبقى منفصلة وتُحسب من browser storage quota/write success. تقسيم sync إلى chunks يحل نقل الملفات الكبيرة ولا ينشئ بحد ذاته entitlement أو unlimited storage.
- لا تغييرات في main أو Firestore Rules أو Production أو secrets أو sync flags.

### Exact-head CI evidence
- #365 head 113f12c43b9b075541b7d28f58fa89cd71ef73d4: Quality Gate run 43273958209, job 131377298902, completed failure; steps=null, logs_url=null.
- #369 head 7ac00ef32f3b3c2b1158f165ed141e6f332ab88e: run 43274079781, job 131377722661, same missing steps/logs.
- #370 head 2bbb54da778ab3eb2ac863e2b12c4e31fbe39dfb: run 43274209101, job 131378172561, same missing steps/logs.
- لا pass ولا code-level test failure يمكن استنتاجه. لم تتوفر local runner/container checkout لتشغيل الاختبارات هنا.
- جميع PRs #363/#365/#366/#367/#368/#369/#370 OPEN/DRAFT؛ لا دمج. main ثابت 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.

## 2026-11-12 — Seerah rights gate and Offline Audio downloader

### Seerah PR #365
- Latest head 0856e6a1e215a74324358173bee9a55924e6a5ad.
- Added a reader source-citation panel displaying title, author/work, edition, exact locator, rights status and safe HTTPS links.
- Publication contract now requires rightsStatus + rightsNotes for every source. unknown / permission_required / missing status blocks publication. link_only permits citation and reviewed paraphrase but not copied quotation. Exact quotes require verified wording and rights allowing quotation.
- Added tests for rights clearance, missing rights status/notes, link-only quote rejection, and safe source URL handling.
- Existing bookmark scope deletion regression fix remains included. No real Seerah content was ingested or approved.
- Exact-head Quality Gate run 43275942614 / job 131384235586 failed with steps=null/logs_url=null. No source-level diagnosis or pass.

### Offline Audio PR #368
- Latest head ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710.
- Added Cache Storage adapter with generation-scoped keys, safe CDN content validation, bounded size, exact read-back byte equality and metadata byte-length reconciliation.
- Added bounded downloader (concurrency <=2), HTTPS allowlist, redirect rejection, credentials omitted, no-store fetch, retryable item failures, pause/cancel/resume, and completed-job retry after browser cache eviction.
- Reconciliation now turns missing bytes in non-terminal jobs into retryable items and recalculates progress; completed historical jobs remain immutable and use a new retry job when bytes are evicted.
- New tests cover adapter, retries, pause/cancel, concurrency, cache eviction and completed-job restoration. No local tests/build/typecheck run.
- Exact-head Quality Gate run 43275594933 / job 131383003139 failed with steps=null/logs_url=null. No source-level diagnosis or pass.
- Still missing Service Worker protocol, user-facing download manager UI, local-first playback integration, orphan cache cleanup policy, browser Cache Storage integration and device offline verification.

### Engine Plans inventory follow-up
- Main source audit reconfirmed StorageService localStorage archive, 100-plan cap in both saveEnginePlans and backup validation, synchronous exportFullBackup, direct legacy importBackup/resetAllData, and synchronous setStorageScope copy/verify/delete behavior.
- backupPersistence import and reset are journal-first; Settings and Progress Analytics still call synchronous exportFullBackup.
- sessionPersistence still caps enginePlansSnapshot at 100 and journaledSnapshotService projects through saveEnginePlans.
- DashboardView still reads StorageService.getEnginePlans directly.
- cloudSyncCoordinator, remoteInboxProjector, indexedDbSyncJournal and LocalSyncOutbox are archive consumers through projection/outbox/inbox. The localStorage legacy outbox still has a 1.5 MB guard, while current durable journal/outbox is IndexedDB.
- This is not yet proof that every indirect caller, test fixture and E2E path has been exhausted. Continue audit; do not begin migration.

## Final rerun audit — 2026-11-12
- Re-ran the latest failed Quality Gate jobs for #365, #368, #369 and #370.
- #365 run 43275942614 / job 131384235586: still failed with steps=null and logs_url=null.
- #368 run 43275594933 / job 131383003139: still failed with steps=null and logs_url=null.
- #369 run 43274079781 / job 131377722661: still failed with steps=null and logs_url=null.
- #370 run 43274209101 / job 131378172561: completed failure with steps=null and logs_url=null.
- Re-run attempts did not expose any test/build stage or source-level failure. Do not call these passes or code failures.
- All PRs #363/#365/#366/#367/#368/#369/#370 remain OPEN/DRAFT. Main base SHA remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.

## 2026-11-12 — Engine Plans pure chunk codec + latest browser tests

### PR #371 — pure lossless chunk codec
- Branch feat/engine-plan-archive-chunk-codec-20261112, latest head 597344a5f95a261df5301da4de992850d4a3f5b5.
- Added deterministic canonical JSON, stable record IDs, fragment splitting with 192,000-byte default transport ceiling, per-chunk/per-record/whole-archive SHA-256, manifest schema/revision/ordered IDs/optional entitlement revision, and strict full materialization validation.
- Added tests for large-record round-trip, deterministic output, order preservation, empty archive, missing/extra/duplicate/corrupt chunks, revision/schema/entitlement tampering, invalid JSON, cycles and unsafe chunk sizes; registered in runAllTests.
- Pure codec only. Not wired to IndexedDB archive, Firestore, remote manifest, capability negotiation or Inbox. No migration.
- Quality Gate run 43278092246 / job 131391785241 failed with steps=null/logs_url=null. No code-level diagnosis or pass.

### Latest E2E additions
- #365 Seerah head 15963abc5dc45268a1129e872d10e41fd7779d05: E2E checks explicit empty source state and no invented citations.
- #369 memorized-range head 814bb8788449ebe3d07d46f00a596a1a7b398a5a: E2E covers multi-Surah checkbox selection, complete Juz across Surah boundaries and custom ayah interval.
- #370 session display head 32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c: E2E covers collapsed-by-default, open/close, line spacing/page padding persistence and reset.
- Corresponding Quality Gate runs 43277331896 / job 131389114054, 43277201392 / job 131388649297, and 43277107786 / job 131388317808 all failed before exposing steps/logs.

### Full repository inventory dimensions
- Exact main tree SHA 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b contains 159 TS/TSX files under src and 78 test/spec files: 59 under src, 18 under e2e, 1 under scripts.
- Reviewed relevant tests include backupPersistence, cloudSyncCoordinator, indexedDbSyncJournal, journalProjectionReplayer, journaledSnapshotService, localSyncOutbox, sessionPersistence, storageScope, syncConflictSafety, storageReliability, cleanInitialization, phase3CoreRemediation, firebaseAuth, backupValidation and relevant E2E.
- This is a complete test-file inventory but not a complete semantic scan of all 159 source files or every fixture. Do not begin migration until all source call paths and test fixtures are audited.

### Current safety
- Main remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.
- All PRs #363, #365, #366, #367, #368, #369, #370, #371 OPEN/DRAFT. No merge/deploy.
- No local tests/build/typecheck run. Quality Gate failures have no steps/logs and are not evidence of code failure or success.
- No Firebase Rules, Production settings, secrets, sync flags or user data changed.

## 2026-11-12 — PR #371 final codec hardening
- Latest head 260df95c620cd534337e39d6707b044eb404139a.
- Added strict dense ordered-record-ID validation, array hidden-property rejection, tampered totalBytes test, and entitlement-revision binding.
- Exact-head Quality Gate run 43278752980 / job 131394096177: failure with steps=null/logs_url=null. No test/build/typecheck evidence can be read; no local tests run.
