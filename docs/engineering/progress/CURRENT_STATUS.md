# WIRD — Current Engineering Status

**Updated:** 2026-11-06  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Checkpoint PRs:** #3, #4, #5, #6, #9, #10, #11, and #12 merged; PR #7 was closed without merge as superseded.

## Verified repository position

- Latest application-code merge on `main`: `84aac72c9d3489f93d200e331c35760eb754462e` — PR #11 (Phase 2 queue/metrics slice). Latest test-only merge: `1ffd6c23363d636a6b395620e7f9c7cd15828827` — PR #12 (multi-key rollback failure injection). Re-fetch `main` HEAD before every integration; progress-document commits may advance it.
- Previous merges: PR #6 `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`; PR #5 `fd480526dd3eac728f60b3554e83309354903ad8`; PR #4 `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- CI run `42180258989` is documented as successful for the code commit: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- GitHub Actions run `42190653101` on PR #9 head `2b520ebcf6c51ae155de508ddf49e49d421ba7ab` passed automated tests, 10 Firestore emulator tests, TypeScript, production build, and server smoke test. The merged code is `f8e0cef`.
- Vercel failed for PR #9 due the free daily deployment limit (`api-deployments-free-per-day`). This is not a code build failure; production deployment for `f8e0cef` is not confirmed.
- PR #1 was merged previously; do not merge it again.
- `main` is the only final integration branch. Never force-push.

## Current milestone

**PHASE 2 — Memorization/revision correctness audit**  
**Status:** IN PROGRESS on `main`; PR #10 and #11 code slices and PR #12 rollback tests merged. PR #12's complete quality gate passed; remaining read-back mismatch and full mutation-path audit are still open.  
**Baseline:** PHASE 1 remains COMPLETED on main.  
**Last code milestone:** PR #11 merge `84aac72`; latest rollback-test checkpoint PR #12 merge `1ffd6c2`, Actions run `42216315142` (PR head `522bbc5`) passed.  
**Verified:** strict record/backup validation (PR #4), session and Quran-range pre-write validation (PR #5), outbox identity/idempotency hardening (PR #6), and deterministic portion merge/history preservation (PR #9).  
**Remaining:** test read-back mismatch/silent-write failure, inspect each durable mutation path for rollback completeness, and verify profile/activity/weak-verse failure combinations. Cross-tab atomicity belongs to the event-journal milestone. M4 follows after both gates.

## Completed and verified foundations

- Firebase Authentication and verified-user gating.
- UID-scoped local storage and guest separation.
- Explicit legacy-data ownership choice.
- Canonical Quran data and per-Surah lazy-loaded chunks.
- Backup validation and rollback verification, including deep per-record import/export checks and rejection of inconsistent projections.
- Runtime validation for persisted plans, engine plans, revision items, tests, weak verses, daily logs, legacy portions, and canonical portions.
- Legacy archive validation before migration/recovery; malformed sources are preserved.
- Duplicate daily activity dates rejected to prevent double counting.
- Session counters, durations, task names, and Quran coordinates validated before mutation.
- Revision ratings, weak-ayah ranges, notes, and durations validated before review-state writes.
- Outbox acknowledged IDs fingerprinted; pending/acknowledged uniqueness and disjointness enforced; retry and batch overflow rejected.
- Portion migration now preserves distinct review attempts even when their content is identical; same-ID retries deduplicate and same-ID conflicts receive deterministic preserved IDs.
- Existing conflict-audit entries survive duplicate portion merges; audit/history bounds fail closed without mutating source archives.
- Quran coordinates, calendar dates, SM-2 grades, target scopes, and revision queue limits are validated before calculations; unbounded numeric ranges are rejected.
- Portion status/strength merges conservatively so a weaker status cannot retain a stronger label.
- Corrupt archive preservation for profile, daily activity, plans, engine plans, revision items, tests, weak verses, and canonical portions.
- Secure UUID generation and local outbox primitive.
- Session completion and revision operations with ordinary write-failure rollback.
- Firestore rules foundation and emulator tests.
- CI quality gate for tests, TypeScript, build, rules emulator, dependency audit, and server smoke test.

## Phase 2 mutation-integrity slice — merged and verified

- PR #10 (`fix/phase2-retention-mutation-audit` → `main`) was squash-merged as `e69871897c2561e7aa75c6e31f9005169ed08c23`.
- Files changed in the current Phase 2 slice: `src/services/retentionService.ts`, `src/services/unifiedPortionService.ts`, `src/components/revision/RevisionCenterView.tsx`, and focused tests in `src/services/*Persistence.test.ts`, `src/services/weakVerseRecording.test.ts`, and `src/tests/backupValidation.test.ts`.
- Implemented in branch: service-boundary Quran range and status validation; duplicate portion additions merge with existing history/counters instead of resetting progress; unknown portion status updates reject; weak-verse archive rejects duplicate IDs/coordinates; weak-verse writes validate coordinates and inputs; resolving an already-resolved weak verse is idempotent; revision modal blocks rapid duplicate submissions and resets stale inputs; repeat memorization preserves weak status and counters.
- A review correction removed memorization sessions from the revision-history ledger so dashboard `totalReviewsCompleted` is not inflated. Regression test asserts review history remains unchanged and metrics remain accurate.
- GitHub Actions Quality Gate #681 (`42194241711`) passed on PR head `958067b1b1e3c64513b1732c947e81c18a830a52`: 304 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- Final PR head before merge: `958067b1b1e3c64513b1732c947e81c18a830a52`. Squash merge SHA on main: `e69871897c2561e7aa75c6e31f9005169ed08c23`.
- The reviewed Phase 2 mutation-integrity slice is merged. Phase 2 itself remains IN PROGRESS; do not mark it completed until daily queue, aggregate statistics, and remaining rollback/mutation-path audits are complete.

## Phase 2 queue/metrics audit — merged and verified

- PR #11 from `fix/phase2-queue-metrics-audit` was squash-merged as `84aac72c9d3489f93d200e331c35760eb754462e`.
- Merged behavior: shared deterministic priority sorting for daily and weekly queues; removal of the unused gracePeriodDays queue option; legacy `init-` first-memorization entries filtered from review history without deleting stored history; duplicate review event IDs counted once across portion records; average ease excludes not-memorized portions; weak-ayah text is mandatory at the review-service boundary.
- Actions Quality Gate #708 (`42195579600`) passed on PR head `1c7e57e6beeed1327900acc38c5642298ba37aad`: 312 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.

## Not yet implemented / not verified

- No Firestore client adapter or live cloud sync coordinator.
- Local outbox is not yet connected to all domain mutation paths.
- Activity is still represented by mutable per-day aggregates.
- Weak-verse mistakes are still aggregated counters.
- Portion review history requires event-ledger integration and deterministic merge.
- Existing multi-key localStorage operations are not crash-atomic.
- Firestore rules still need collection-specific payload validation and create-only event restrictions.
- Production Firestore rules deployment is not verified.
- Real two-device sync is not implemented.
- Google AI Studio in-app sync cannot be inspected from this workspace.
- Vercel production deployment for the latest observed commit is not confirmed.

## Branch inventory (observed)

- `fix/phase2-session-counter-validation`: superseded; PR #7 closed without merge because PRs #5/#6 already contain stronger versions.
- `fix/phase1-unified-portion-merge`: merged by PR #9 as `f8e0cef`.
- `fix/phase2-retention-mutation-audit`: merged by PR #10 as `e698718`.

- `main`: canonical.
- `feat/phase4-data-integrity-backup-v4`: previously merged by PR #1; do not merge again.
- `feat/phase5-premium-ui-ux`: diverged, 115 commits ahead and 104 behind at comparison time; do not merge wholesale.
- `work/wird-audit-remediation`: diverged, 92 commits ahead and 228 behind at comparison time; do not merge wholesale.
- `docs/engineering-progress-checkpoints`: six progress documents merged through PR #3 (squash commit `82efeac`).

## Current risk register

1. **Resolved in PR #6:** acknowledged mutation fingerprints now reject changed-content ID reuse while preserving exact retries; legacy acknowledgements without fingerprints fail closed.
2. **Critical before cloud sync:** aggregate daily activity and weak-verse counters are not safe for concurrent multi-device merge.
3. **High:** localStorage cannot atomically commit domain state plus outbox; a write-ahead event journal / transactional IndexedDB design is needed.
4. **High:** Firestore rules are generic-envelope-only and not production complete.
5. **High — local atomicity:** the outbox's localStorage read-modify-write is not cross-tab atomic; do not enable cloud sync until a transactional IndexedDB design is in place.
6. **High — Phase 2:** PR #10 and PR #11 slices are merged and CI-verified; remaining work is multi-key rollback failure injection and any uncovered mutation paths.
7. **Medium:** complete file-by-file audit of all mutation call sites, backup/restore, PWA, APIs, and Quran integrity remains open.
8. **Release:** Vercel rate limit previously blocked a production deployment; retry only through the normal platform path when quota permits.

## Last verified tests

- PR #10 / Actions run `42194241711` (Quality Gate #681): **304 automated assertions passed, 0 failed**; **10 Firestore rules emulator tests passed**; dependency audit, TypeScript, production build, and server smoke test passed. PR head `958067b1b1e3c64513b1732c947e81c18a830a52`; squash merge `e69871897c2561e7aa75c6e31f9005169ed08c23`.

- CI run `42190653101`: PASS on PR #9 head `2b520eb`; automated tests, 10 Firestore emulator tests, TypeScript, production build, and server smoke test.
- Merge commit: `f8e0cef696b6b74f2f9872cf69a9d3ad6bcc731c`.
- CI run `42180258989`: documented PASS for code commit `f342b4b`.
- CI run `42184381262`: PASS on PR #3 head.
- CI run `42186678874`: PASS on PR #4 head.
- CI run `42187380137`: PASS on PR #5 head.
- CI run `42187959928`: PASS on PR #6 head: 277 automated tests, 10 Firestore emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- Vercel status on merge commit `647eff6` reports the known free build-rate-limit failure.
- Vercel status on application-code merge commit `fd48052`: **success**.
- Vercel status on outbox merge commit `aacc7ae`: **failure** due the known free build-rate limit.
- Vercel status on PR #9: **failure** due `api-deployments-free-per-day`; production deployment for merge commit `f8e0cef` is not confirmed.
- No application code changed in the documentation checkpoint.

## Next exact action

1. Continue the Phase 2 multi-key rollback audit for review + weak-verse + activity writes.
2. Inject weak-verse write failures, activity/profile write failures, storage quota errors, and read-back mismatches; verify full rollback or an explicit recovery-required state.
3. Add tests for failure after each durable write and confirm the original raw archives remain recoverable.
4. Keep localStorage outbox disconnected from cloud writes; cross-tab atomicity still requires an IndexedDB event+outbox transaction.
5. Do not activate Firestore production writes or deploy production rules without explicit approval.


## 2026-11-06 — PR #12 rollback failure-injection checkpoint

- PR #12 merged to main as `1ffd6c23363d636a6b395620e7f9c7cd15828827` (test-only).
- PR head `522bbc549074217af8e3d434538078cc5a8204bc`; Actions WIRD Quality Gate #741 / run `42216315142` passed: **315 passed / 0 failed**, 10 Firestore Security Rules Emulator tests, dependency audit, TypeScript, production build, and server startup smoke test.
- Added three regression cases for weak-verse quota failure, failed rollback with explicit recovery-required warning, and profile quota failure after successful portion/weak-verse/activity writes.
- Vercel check passed for the PR head before merge; post-merge Vercel status on merge SHA was still pending at the last check. Production deployment is not yet confirmed.
- Phase 2 remains IN PROGRESS; next audit targets silent-write/read-back mismatch and all remaining multi-key mutation paths.
