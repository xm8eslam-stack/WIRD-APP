# WIRD — Current Engineering Status

**Updated:** 2026-11-06  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Checkpoint PRs:** #3, #4, #5, and #6 merged; progress documentation, record validation, session/range validation, and outbox hardening are on `main`.

## Verified repository position

- Latest confirmed code merge before this status update: `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784` — PR #6 outbox integrity milestone. This status update itself is committed directly to main; re-fetch HEAD on resume. This status update itself is committed directly to main; re-fetch HEAD on resume.
- Latest verified code merge: `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784` (PR #6). Previous session/range merge: `fd480526dd3eac728f60b3554e83309354903ad8` (PR #5).
- CI run `42180258989` is documented as successful for the code commit: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- The combined status lookup for `d9737e0` reports a failed Vercel status pointing to the free build/deployment rate limit. This is not evidence of a code build failure. A successful production deployment for this exact commit is not confirmed.
- PR #1 was merged previously; do not merge it again.
- `main` is the only final integration branch. Never force-push.

## Current milestone

**PHASE 1 — Record-level local data validation**  
**Status:** IN PROGRESS.  
**Last code milestone:** local outbox state integrity, PR #6 merge `aacc7ae` (following record-validation PR #4 and session/range PR #5).  
**Status detail:** acknowledged mutation fingerprints, pending/acknowledged uniqueness and disjointness, device consistency, retry overflow, and strict batch bounds are implemented.  
**Remaining:** `unifiedPortionService.ts` merge/dedup/conflict audit and cross-tab transactional design keep Phase 1 open; review scheduling/statistics audit keeps Phase 2 open. M4 follows after both gates.

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
- Corrupt archive preservation for profile, daily activity, plans, engine plans, revision items, tests, weak verses, and canonical portions.
- Secure UUID generation and local outbox primitive.
- Session completion and revision operations with ordinary write-failure rollback.
- Firestore rules foundation and emulator tests.
- CI quality gate for tests, TypeScript, build, rules emulator, dependency audit, and server smoke test.

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

- `main`: canonical.
- `feat/phase4-data-integrity-backup-v4`: previously merged by PR #1; do not merge again.
- `feat/phase5-premium-ui-ux`: diverged, 115 commits ahead and 104 behind at comparison time; do not merge wholesale.
- `work/wird-audit-remediation`: diverged, 92 commits ahead and 228 behind at comparison time; do not merge wholesale.
- `docs/engineering-progress-checkpoints`: six progress documents merged through PR #3 (squash commit `82efeac`).

## Current risk register

1. **High — confirmed:** outbox acknowledgement retains only bounded acknowledged IDs; reusing an acknowledged mutation ID with different content currently returns `already_acknowledged` without comparing payload. Add regression coverage and fix before relying on the outbox as a durable idempotency boundary.
2. **Critical before cloud sync:** aggregate daily activity and weak-verse counters are not safe for concurrent multi-device merge.
3. **High:** localStorage cannot atomically commit domain state plus outbox; a write-ahead event journal / transactional IndexedDB design is needed.
4. **High:** Firestore rules are generic-envelope-only and not production complete.
5. **High — remaining Phase 1:** `unifiedPortionService.ts` merge/dedup/conflict handling and final persistence-boundary audit remain open. The outbox's localStorage read-modify-write is not cross-tab atomic; do not enable cloud sync until a transactional IndexedDB design is in place.
6. **High — Phase 2:** session counter clamping and basic Quran/revision range gaps were fixed in PR #5; review scheduling, duplicate-operation prevention, and remaining mutation/statistics paths still need audit.
7. **Medium:** complete file-by-file audit of all mutation call sites, backup/restore, PWA, APIs, and Quran integrity remains open.
6. **Release:** Vercel rate limit previously blocked a production deployment; retry only through the normal platform path when quota permits.

## Last verified tests

- CI run `42180258989`: documented PASS for code commit `f342b4b`.
- CI run `42184381262`: PASS on PR #3 head.
- CI run `42186678874`: PASS on PR #4 head.
- CI run `42187380137`: PASS on PR #5 head.
- CI run `42187959928`: PASS on PR #6 head: 277 automated tests, 10 Firestore emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- Vercel status on merge commit `647eff6` reports the known free build-rate-limit failure.
- Vercel status on application-code merge commit `fd48052`: **success**.
- Vercel status on outbox merge commit `aacc7ae`: **failure** due the known free build-rate limit. GitHub Actions quality gate passed; production deployment for PR #6 is not confirmed.
- No application code changed in the documentation checkpoint.

## Next exact action

1. Finish Phase 1 audit of `unifiedPortionService.ts`: merge/dedup behavior, overlap handling, conflict audit, history preservation, and failure rollback.
2. Complete cross-tab/concurrent-write analysis; keep current localStorage outbox disconnected from cloud writes until transactional IndexedDB event+outbox design is verified.
3. Continue Phase 2 review-scheduling, duplicate-operation, and statistics audits; session counter and Quran/revision input checks are already merged in PR #5.
4. Re-run full CI and independent review for each reliability slice.
5. After Phase 1/2 pass, design the append-only event ledger and durable event+outbox transaction; do not activate Firestore production writes.
