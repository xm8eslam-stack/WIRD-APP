# WIRD — Current Engineering Status

**Updated:** 2026-11-06  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Checkpoint PRs:** #3, #4, #5, #6, and #9 merged; PR #7 was closed without merge as superseded.

## Verified repository position

- Latest confirmed `main` HEAD at this checkpoint: `87d6abfb95809c2395e5acff7bfe4ab90e9d9a6f` (verified by compare against the active Phase 2 branch). Re-fetch before every integration.
- Previous merges: PR #6 `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`; PR #5 `fd480526dd3eac728f60b3554e83309354903ad8`; PR #4 `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- CI run `42180258989` is documented as successful for the code commit: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- GitHub Actions run `42190653101` on PR #9 head `2b520ebcf6c51ae155de508ddf49e49d421ba7ab` passed automated tests, 10 Firestore emulator tests, TypeScript, production build, and server smoke test. The merged code is `f8e0cef`.
- Vercel failed for PR #9 due the free daily deployment limit (`api-deployments-free-per-day`). This is not a code build failure; production deployment for `f8e0cef` is not confirmed.
- PR #1 was merged previously; do not merge it again.
- `main` is the only final integration branch. Never force-push.

## Current milestone

**PHASE 2 — Memorization/revision correctness audit**  
**Status:** IN PROGRESS on `fix/phase2-retention-mutation-audit`; not merged to main and not CI-verified yet.  
**Baseline:** PHASE 1 remains COMPLETED on main.  
**Last code milestone:** PR #9 merge `f8e0cef`; all code gates passed in CI run `42190653101`.  
**Verified:** strict record/backup validation (PR #4), session and Quran-range pre-write validation (PR #5), outbox identity/idempotency hardening (PR #6), and deterministic portion merge/history preservation (PR #9).  
**Remaining outside Phase 1:** cross-tab atomicity belongs to the event-journal milestone; review scheduling, duplicate operations, and statistics remain Phase 2 work. M4 follows after both gates.

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

## Phase 2 branch checkpoint (not yet verified)

- Branch `fix/phase2-retention-mutation-audit` is 16 commits ahead and 0 behind `main` at the last comparison; additional focused commits were added afterward, so re-run compare before PR review.
- Files changed in the current Phase 2 slice: `src/services/retentionService.ts`, `src/services/unifiedPortionService.ts`, `src/components/revision/RevisionCenterView.tsx`, and focused tests in `src/services/*Persistence.test.ts`, `src/services/weakVerseRecording.test.ts`, and `src/tests/backupValidation.test.ts`.
- Implemented in branch: service-boundary Quran range and status validation; duplicate portion additions merge with existing history/counters instead of resetting progress; unknown portion status updates reject; weak-verse archive rejects duplicate IDs/coordinates; weak-verse writes validate coordinates and inputs; resolving an already-resolved weak verse is idempotent; revision modal blocks rapid duplicate submissions and resets stale inputs; repeat memorization preserves weak status and counters.
- A review correction removed memorization sessions from the revision-history ledger so dashboard `totalReviewsCompleted` is not inflated. Regression test asserts review history remains unchanged and metrics remain accurate.
- Tests were added/updated but have **not yet been executed in a confirmed CI run**. One invalid Quran test fixture was found during review and corrected before PR.
- Last code commit created during this continuation: `360702ad4b6ab3e8e5233670ad0eb5203fd50678` (verify branch HEAD again; subsequent documentation commits will advance it).
- No Phase 2 change has been merged to `main`. Do not label Phase 2 completed until PR checks and independent review pass.

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
6. **High — Phase 2:** the current branch adds validation and regression coverage but awaits full CI, independent review, and main integration; continue auditing review scheduling, duplicate-operation semantics, and statistics paths.
7. **Medium:** complete file-by-file audit of all mutation call sites, backup/restore, PWA, APIs, and Quran integrity remains open.
8. **Release:** Vercel rate limit previously blocked a production deployment; retry only through the normal platform path when quota permits.

## Last verified tests

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

1. Re-fetch branch HEAD and `main`; compare exact SHAs and inspect all eight changed files.
2. Open a draft PR from `fix/phase2-retention-mutation-audit` to `main` to run repository CI; do not merge until all required checks pass.
3. Fix any test/type/build/security failures, then perform a second independent review of duplicate operations, history semantics, weak-verse integrity, and rollback.
4. Revisit daily queue and dashboard statistics paths; add tests for invalid dates, aggregate correctness, and history classification.
5. Keep localStorage outbox disconnected from cloud writes; cross-tab atomicity still requires an IndexedDB event+outbox transaction.
6. Only after Phase 2 is verified and merged, proceed to the transactional event ledger. Do not activate Firestore production writes.
