# WIRD — Current Engineering Status

**Updated:** 2026-11-06 09:53 +02:00  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Working documentation branch:** `docs/engineering-progress-checkpoints`

## Verified repository position

- Latest observed `main` commit: `d9737e0e16ea1f87b9811621dce42d8f6d4e8450` — documentation checkpoint.
- Latest observed code commit referenced by the engineering audit: `f342b4bc7e02a48f88b90646098eea178901c8ea`.
- CI run `42180258989` is documented as successful for the code commit: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- The combined status lookup for `d9737e0` reports a failed Vercel status pointing to the free build/deployment rate limit. This is not evidence of a code build failure. A successful production deployment for this exact commit is not confirmed.
- PR #1 was merged previously; do not merge it again.
- `main` is the only final integration branch. Never force-push.

## Current milestone

**M4 — Local event ledger and durable outbox integration**  
**Status:** IN PROGRESS / partially prepared.  
**Last code milestone:** local archive integrity hardening, code commit `f342b4b`.  
**Latest main ref observed:** `d9737e0`.

## Completed and verified foundations

- Firebase Authentication and verified-user gating.
- UID-scoped local storage and guest separation.
- Explicit legacy-data ownership choice.
- Canonical Quran data and per-Surah lazy-loaded chunks.
- Backup validation and rollback verification.
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
- `docs/engineering-progress-checkpoints`: documentation checkpoint work only; must be integrated to main after review.

## Current risk register

1. **High:** outbox acknowledgement retains only bounded acknowledged IDs; after an ID is evicted, replay protection relies on remote deterministic document IDs. Reusing an acknowledged mutation ID with different content currently returns `already_acknowledged` without comparing payload. Verify and fix this before relying on the outbox as a durable idempotency boundary.
2. **Critical before cloud sync:** aggregate daily activity and weak-verse counters are not safe for concurrent multi-device merge.
3. **High:** localStorage cannot atomically commit domain state plus outbox; a write-ahead event journal / transactional IndexedDB design is needed.
4. **High:** Firestore rules are generic-envelope-only and not production complete.
5. **Medium:** complete file-by-file audit of all mutation call sites, backup/restore, PWA, APIs, and Quran integrity remains open.
6. **Release:** Vercel rate limit previously blocked a production deployment; retry only through the normal platform path when quota permits.

## Last verified tests

- CI run `42180258989`: documented PASS for the code commit `f342b4b`.
- The latest documentation-only commit `d9737e0` has a Vercel rate-limit failure status; GitHub Actions result for that exact docs commit was not independently verified in this inspection.
- No new code tests were run in this documentation checkpoint.

## Next exact action

1. Finish targeted audit of `localSyncOutbox.ts`, its tests, and every call site.
2. Add regression coverage for acknowledged-ID reuse with changed payload, pending/acknowledged overlap, bounded acknowledgement history, retry overflow, and account switching.
3. Evaluate a transactional local journal using Dexie / native IndexedDB / idb before selecting a persistence dependency.
4. Design the event ledger schema and migration/replay contract before changing synchronous storage APIs.
5. Implement one small M4 slice on a short-lived branch, run full CI, independently review, then integrate into `main` with verified SHA and CI.
