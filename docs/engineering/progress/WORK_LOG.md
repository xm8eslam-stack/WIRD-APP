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
- Vercel check on merge commit `fd48052` was pending at verification time; deployment is not yet confirmed.
- Phase 2 is partially advanced, not complete. Phase 1 remains open because `localSyncOutbox.ts` and the remaining storage/session boundaries still require audit.
- Next priority: audit outbox state integrity and fix the confirmed acknowledged-ID/content mismatch, pending/acknowledged uniqueness and disjointness, and retry overflow. Then continue the remaining revision/mutation-path audit.
