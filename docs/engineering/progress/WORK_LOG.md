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


## 2026-11-12 — Smart memorization plan payload budget correction

- The user-facing 450 KB check, IndexedDB journal allowance, and revisioned Firestore writer had drifted apart. In particular, the remote writer still enforced the generic 128 KB cap, so some plan payloads accepted by the journal could fail only when uploaded.
- Added one shared payload-limit contract: ordinary mutations remain 128 KB; smart engine-plan snapshots and grouped session transactions that include them use 800 KB end-to-end across journal, legacy outbox validation, and remote writer.
- The 800 KB cap is a bounded increase (about 1.78×), not the requested 3–4×. A 1.35–1.8 MB single-document payload cannot be safely sent through the current one-document Firestore projection because standard Firestore documents are limited to 1 MiB. Larger plans require a versioned multi-document/chunked projection with atomic reconstruction and recovery, not a larger scalar limit.
- Increased the per-conflict evidence budget to 1.7 MB to cover the larger local plan snapshot plus its pending mutation evidence, while reducing the retained conflict-record cap from 100 to 29 to keep the theoretical aggregate archive budget near 50 MB. Unresolved conflicts remain protected; capacity exhaustion blocks safely without deleting evidence.
- Added regression coverage for 700 KB plan snapshots through the IndexedDB journal and outbox facade, the shared budget selector, grouped session transaction handling, and rejection by the remote writer above the 800 KB cap.
- No Firestore Rules, production flags, credentials, Firebase data, or user data changed. This is code-only and remains unmerged pending exact-head CI and independent review.
- Follow-up: design and test chunked engine-plan storage if real plans regularly exceed 800 KB; preserve whole-plan local reconstruction and versioned atomic completion before changing remote schema.
