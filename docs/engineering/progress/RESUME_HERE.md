# WIRD — Resume Here

**Start here after every interruption. Updated 2026-11-06.**

1. Open repository `xm8eslam-stack/WIRD-APP`.
2. Fetch `main` and confirm its current HEAD; the latest confirmed main code merge before this resume-file update is `f8e0cef696b6b74f2f9872cf69a9d3ad6bcc731c` (PR #9); documentation updates may advance main, so re-fetch main HEAD before any work. Do not assume it is still current.
3. Read, in order:
   - `docs/engineering/progress/CURRENT_STATUS.md`
   - `docs/engineering/progress/MASTER_ROADMAP.md`
   - `docs/engineering/progress/WORK_LOG.md`
   - `docs/engineering/WORK_SESSION_CHECKPOINT.md`
   - `docs/engineering/IMPLEMENTATION_ROADMAP.md`
   - `docs/engineering/FIRESTORE_SYNC_DESIGN.md`
   - `docs/engineering/SECURITY_AUDIT.md`
4. Inspect current `main` and the current uncommitted/working branch state. Verify the last CI run and deployment status independently.
5. Do not merge PR #1 again. It was already merged.
6. Do not merge `feat/phase5-premium-ui-ux` or `work/wird-audit-remediation` wholesale; both were significantly diverged from main when last compared.
7. Continue from the verified PR #4, #5, #6, and #9 milestones:
   - PR #4 record-level storage and backup validation is merged and CI-verified; do not repeat it.
   - PR #5 strict session counters, pre-write validation, Quran range checks, and revision-input validation are merged and CI-verified; do not repeat them.
   - PR #6 acknowledged mutation fingerprints, pending/acknowledged uniqueness and disjointness, device identity checks, retry overflow checks, and outbox rollback verification are merged and CI-verified; do not repeat them.
   - PR #9 closes Phase 1: portion migration preserves distinct review attempts, same-ID conflicts, pre-existing conflict audits, and conservative status/strength; Quran range, date, SM-2 grade, and queue-boundary checks are merged and CI-verified.
   - next audit Phase 2 in `RetentionService`: `updatePortionStatus`, `recordMemorizationCompletion`, `recordRevisionPerformance`, weak-verse recording/resolution, daily queue selection, and dashboard statistics.
   - test duplicate operations, review-history append semantics, aggregate counts, and rollback across multi-key writes.
   - analyze cross-tab concurrency; current localStorage outbox is not transactional and must remain disconnected from cloud sync.
   - only after Phase 2 gates, design append-only event schemas and a transactional IndexedDB event+outbox journal.
8. Preserve all local/legacy data. Do not perform destructive migrations.
9. Work in small reviewed milestones. Run tests, TypeScript, production build, Firestore emulator tests, and independent review before integrating each code milestone.
10. Integrate only verified work into `main`; confirm the exact resulting SHA and CI. Never force-push.
11. Do not deploy production Firestore rules, enable production cloud sync, or change secrets/project settings without explicit user approval.

## Last known exact state
- Latest confirmed main code merge before this resume-file update: `f8e0cef696b6b74f2f9872cf69a9d3ad6bcc731c` (PR #9). Documentation updates may advance main; re-fetch current main HEAD before making any changes.
- Documentation PR #3: https://github.com/xm8eslam-stack/WIRD-APP/pull/3 — merged as `82efeacd9118406d850336fa3c862fd5016bed14`.
- Record-validation PR #4: https://github.com/xm8eslam-stack/WIRD-APP/pull/4 — merged as `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- Session/range validation PR #5: https://github.com/xm8eslam-stack/WIRD-APP/pull/5 — merged as `fd480526dd3eac728f60b3554e83309354903ad8`.
- Local outbox integrity PR #6: https://github.com/xm8eslam-stack/WIRD-APP/pull/6 — merged as `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`.
- Portion merge/history integrity PR #9: https://github.com/xm8eslam-stack/WIRD-APP/pull/9 — merged as `f8e0cef696b6b74f2f9872cf69a9d3ad6bcc731c`.
- CI run `42184381262` on the PR #3 head passed all steps.
- CI run `42186678874` on PR #4 head passed all quality gates.
- CI run `42187380137` on PR #5 head passed all quality gates.
- CI run `42187959928` on PR #6 head passed 277 automated tests, 10 Firestore emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- CI run `42190653101` on PR #9 head passed automated tests, 10 Firestore emulator tests, TypeScript, production build, and server smoke test.
- Vercel still reports the free deployment rate limit; production deployment is not confirmed.
- Latest audited baseline code commit: `f342b4bc7e02a48f88b90646098eea178901c8ea`.
- Latest record-validation code merge: `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- Latest session/range validation code merge: `fd480526dd3eac728f60b3554e83309354903ad8`.
- Latest outbox integrity code merge: `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`.
- CI run `42180258989`: documented successful for the audited code commit.
- Vercel: latest observed status was rate-limited; production deployment not confirmed.
- Superseded PR #7: https://github.com/xm8eslam-stack/WIRD-APP/pull/7 — closed without merge because its session/outbox changes were already merged more completely in PR #5 and PR #6. Do not reopen or merge its stale branch.
- Phase 1 is completed by PR #9; Phase 2 review scheduling, duplicate-operation, and statistics audit remains open.
- M4 event-ledger integration: not complete.
- Firestore sync: not implemented.
- Production rules deployment: not confirmed and requires explicit approval.

If any current evidence differs from these notes, current GitHub state wins. Update all checkpoint files with the newly verified facts before stopping.


## 2026-11-06 — Latest continuation checkpoint (takes precedence over older next-action notes)

- Current working branch: `fix/phase2-retention-mutation-audit`.
- Canonical branch: `main`; its verified HEAD at the beginning of this continuation was `87d6abfb95809c2395e5acff7bfe4ab90e9d9a6f`. Re-fetch both refs before further edits.
- Initial comparison: working branch was 16 commits ahead / 0 behind main. Additional code commits were added during this continuation; the latest code commit before this checkpoint's documentation updates was `360702ad4b6ab3e8e5233670ad0eb5203fd50678`. Re-run compare for the current branch HEAD.
- Phase 1 remains COMPLETED on main by PR #9. Phase 2 remains IN PROGRESS and is not merged or CI-verified.
- Phase 2 changes on the branch cover: manual status validation/strength consistency; canonical duplicate portion merging without history/counter reset; weak-verse unique IDs and Quran coordinates; strict direct weak-verse mutation validation; idempotent weak-verse resolution; backup duplicate weak-verse rejection; revision modal double-submit protection and stale input reset.
- Memorization completion was deliberately removed from the revision-history ledger to keep review statistics semantically accurate. The updated regression test checks review history and total review count remain unchanged by a memorization session.
- New tests have been added but not yet executed in a confirmed GitHub Actions run. A draft PR is the next step to trigger CI.
- External architecture research: Microsoft Event Sourcing guidance, Brenopms TypeScript event-sourcing reference, and Ummah Library (AGPL-3.0). No external code copied; no dependency added.
- No Phase 2 code has been written to main. Do not force-push or merge until tests and independent review pass.
- No Firestore production rules deployment, live cloud sync, destructive migration, or production data mutation has occurred.

### Resume instructions

1. Fetch latest main and working branch refs and compare them.
2. Re-read this file, CURRENT_STATUS.md, MASTER_ROADMAP.md, and WORK_LOG.md.
3. Inspect the full Phase 2 diff, especially `retentionService.ts`, `RevisionCenterView.tsx`, and all touched tests.
4. Create/inspect a draft PR to run CI; wait for test, lint, build, Firestore emulator, audit, and smoke-test results.
5. Fix all failures and perform an independent second review.
6. Continue remaining Phase 2 daily queue/statistics/rollback tests. Only merge verified changes to main.


## 2026-11-06 — Latest verified main checkpoint (PR #10 merged)

- Canonical branch: `main`.
- Latest application-code merge: `e69871897c2561e7aa75c6e31f9005169ed08c23` (PR #10 squash merge). Re-fetch the current main HEAD before new work because progress-document commits may advance it.
- PR #10 head before merge: `958067b1b1e3c64513b1732c947e81c18a830a52`.
- GitHub Actions Quality Gate #681 / run `42194241711`: PASS — 304 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, server smoke test.
- Vercel check remains rate-limited by the Free-plan daily deployment cap; production deployment of the merge commit is not confirmed.
- Phase 1 remains COMPLETED. Phase 2 remains IN PROGRESS; PR #10 merged only the mutation-integrity slice.
- Merged changes: status update validation and strength consistency; safe duplicate canonical portion merge preserving history/counters/weaker status; canonical Surah metadata; weak-verse input/coordinate validation and unique ID/coordinate enforcement; idempotent resolution; backup duplicate rejection; revision UI in-flight guard and stale-input reset; fail-closed handling when canonical Quran text cannot be loaded; memorization sessions excluded from review-history metrics.
- New/updated regression tests passed in CI. No new third-party code or dependency copied; external research is documented in EXTERNAL_SOURCES.md.
- No production migration, production Firestore rules deployment, or live cloud sync activation occurred.

### Exact next action

1. Read CURRENT_STATUS.md, MASTER_ROADMAP.md, WORK_LOG.md, and RELEASE_CHECKLIST.md.
2. Fetch latest main HEAD and inspect the merged Phase 2 code if any later changes exist.
3. Continue auditing daily revision queue, weekly overview, dashboard aggregate metrics, review-history semantics, and rollback under quota/read-back failures.
4. Add targeted tests and run the complete quality gate plus independent second review before the next main integration.
5. Keep cloud sync disabled until the transactional IndexedDB event+outbox design and multi-tab tests are complete; production rules deployment still requires explicit approval.


## 2026-11-06 — Latest working checkpoint: Phase 2 queue/metrics audit

- Canonical integration branch: `main`; latest known main checkpoint at branch creation: `0de185af757cfecead14beb98a465cf088200fff`.
- Current working branch: `fix/phase2-queue-metrics-audit`.
- Current code head before progress-document updates: `c2d5ab906bc66443f63bdc049595d0504e303937`; re-fetch current branch HEAD after documentation commits.
- Prior PR #10 remains merged and verified (Actions #681: 304 assertions, 10 Firestore emulator tests, audit, TypeScript, build, smoke test).
- Current branch implements shared deterministic daily/weekly queue ordering; removes the unused queue gracePeriodDays option; filters legacy initial-memorization init- history entries from review totals without deleting raw history; deduplicates review event IDs in the flattened review view; excludes not_memorized portions from average ease; and requires weak-ayah text before recording a failed review.
- Regression tests cover all of those behaviors plus invalid calendar dates and daily queue backlog cap. They have not yet run in CI.
- External research reviewed ts-fsrs (MIT, Node >=24, v6 breaking changes), fsrs.js (deprecated/transition recommendation), Anki scheduling migration guidance, and FSRS Helper load-balancing features. No code/dependency adopted; no SM-2 schedule migration.

### Exact next action

1. Re-fetch branch HEAD and main; inspect all changed files and test fixtures.
2. Open a draft PR from `fix/phase2-queue-metrics-audit` to `main` and run CI.
3. Fix any failures, perform a separate second review, then merge only after all required checks pass.
4. Continue rollback failure-injection tests for review + weak-verse + activity multi-key writes.
5. Keep cloud sync disabled until a transactional IndexedDB event/outbox design is tested.


## 2026-11-06 — Latest verified main checkpoint (PR #11 merged)

- Canonical branch: `main`.
- Latest application-code merge: `84aac72c9d3489f93d200e331c35760eb754462e` (PR #11 squash merge). Re-fetch main HEAD before new work because documentation commits may advance it.
- PR #11 head before merge: `1c7e57e6beeed1327900acc38c5642298ba37aad`.
- GitHub Actions WIRD Quality Gate #708 / run `42195579600`: PASS — 312 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, server smoke test.
- Vercel still reports the Free-plan daily deployment cap; production deployment of this merge is not confirmed.
- Phase 1 remains COMPLETED. Phase 2 remains IN PROGRESS; PR #10 and #11 merged only the mutation-integrity and queue/metrics slices.
- Daily/weekly queue ordering is shared and deterministic; legacy first-memorization init- history is filtered from review counts without deleting stored entries; duplicate review event IDs count once; average ease excludes not_memorized portions; missing weak-ayah text is rejected before writes.
- No external code or dependency copied; no SM-2-to-FSRS migration or rescheduling performed.
- No production migration, production Firestore rules deployment, or live cloud sync activation occurred.

### Exact next action

1. Read CURRENT_STATUS.md, MASTER_ROADMAP.md, WORK_LOG.md, RELEASE_CHECKLIST.md.
2. Fetch latest main HEAD and inspect the merged rollback implementation in retentionService.ts and StorageService multi-key write helpers.
3. Add failure-injection tests for weak-verse write failure, activity/profile write failure, quota errors, and read-back mismatch; assert all touched archives are restored or a recovery-required state is surfaced.
4. Run the complete quality gate and a second independent review; merge only after all checks pass.
5. Keep cloud sync disabled until a transactional IndexedDB event/outbox design and multi-tab tests are complete.


## 2026-11-06 — Latest verified rollback-test checkpoint (PR #12 merged)

- Canonical branch: `main`.
- Latest test-only merge: `1ffd6c23363d636a6b395620e7f9c7cd15828827` (PR #12 squash merge). Re-fetch main HEAD before new work because progress-document commits may advance it.
- PR head tested: `522bbc549074217af8e3d434538078cc5a8204bc`.
- GitHub Actions WIRD Quality Gate #741 / run `42216315142`: PASS — 315 assertions, 0 failures; 10 Firestore rules emulator tests; dependency audit; TypeScript; production build; server startup smoke test.
- PR #12 adds coverage for weak-verse quota failure, failed rollback warning, and profile quota failure after portion/weak-verse/activity writes. The third test explicitly asserts the earlier writes succeeded before the injected failure.
- PR #12 is test-only. No app runtime behavior, data, migration, SM-2 schedule, Quran text, Firestore production rules, or cloud sync changed.
- Vercel check passed for PR head before merge; post-merge deployment on merge SHA was pending at the last check.
- Phase 2 remains IN PROGRESS; do not mark complete.

### Exact next action

1. Read CURRENT_STATUS.md, MASTER_ROADMAP.md, WORK_LOG.md, EXTERNAL_SOURCES.md, and RELEASE_CHECKLIST.md.
2. Fetch latest `main` HEAD and inspect `StorageService.setItem`, `saveUnifiedPortions`, `restoreRawSnapshot`, and every multi-key mutation caller.
3. Add a silent-write/read-back-mismatch failure-injection test where a storage adapter reports success but returns stale bytes; verify callers do not report a committed session and that recovery state is explicit.
4. Audit weak-verse, review, memorization, activity, profile, backup/restore, and outbox mutation paths for missing checks or unverified rollback.
5. Run full quality gate and an independent second review; merge only after success.
6. Keep cloud sync disabled until IndexedDB transactional event/outbox design and multi-tab tests are complete.


## 2026-11-06 — Latest verified durable-storage checkpoint (PR #13 merged)

- Canonical branch: `main`.
- Latest storage-integrity merge: `346b725ae76a177372375f5045e7816eb09a0d1c` (PR #13 squash merge). Re-fetch main HEAD before new work because progress-document commits may advance it.
- PR head tested: `d6753835d70a71b7f3a5f15a7f3512d9f92bf843`.
- GitHub Actions WIRD Quality Gate #759 / run `42217300654`: PASS — 317 assertions, 0 failures; 10 Firestore rules emulator tests; dependency audit; TypeScript; production build; server startup smoke test.
- Storage writes now verify exact durable readback and attempt to restore previous raw bytes after mismatch/exception. Removal verifies absence and returns a boolean from the public raw API.
- Tests cover silent no-op writes, mismatched writes, silent removal failure, and weak-verse mutation rollback after a silent counter-write mismatch.
- Vercel failed with `build-rate-limit`; production deployment remains unconfirmed.
- No data migration, cloud sync activation, Firestore production rules deployment, or Quran text changes.
- Phase 2 remains IN PROGRESS; do not mark complete.

### Exact next action

1. Read CURRENT_STATUS.md, MASTER_ROADMAP.md, WORK_LOG.md, EXTERNAL_SOURCES.md, and RELEASE_CHECKLIST.md.
2. Fetch latest `main` HEAD and audit all multi-key write callers: `persistSessionCompletion`, `RetentionService.recordRevisionPerformance`, `recordWeakVerseFailure`, `StorageService.recordSessionCompletion`, backup import/restore, and outbox mutations.
3. Identify any caller that ignores a false return, reports success before all writes are verified, or fails to verify rollback of every touched key.
4. Add targeted failure-injection tests for each missing path, including quota errors, silent readback mismatch, and restoration failure.
5. Run full quality gate and independent second review; merge only after success.
6. Keep cloud sync disabled until IndexedDB transactional event/outbox design and multi-tab tests are complete.
