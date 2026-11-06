# WIRD — Current Engineering Status

**Updated:** 2026-11-06  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Checkpoint PR:** #3 merged; progress documentation is now on `main`.

## Verified repository position

- Latest confirmed main merge before this status update: `82efeacd9118406d850336fa3c862fd5016bed14` — PR #3 documentation checkpoint. This status update itself is committed directly to main; re-fetch HEAD on resume.
- Latest observed code commit referenced by the engineering audit: `f342b4bc7e02a48f88b90646098eea178901c8ea`.
- CI run `42180258989` is documented as successful for the code commit: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- The combined status lookup for `d9737e0` reports a failed Vercel status pointing to the free build/deployment rate limit. This is not evidence of a code build failure. A successful production deployment for this exact commit is not confirmed.
- PR #1 was merged previously; do not merge it again.
- `main` is the only final integration branch. Never force-push.

## Current milestone

**PHASE 1 — Record-level local data validation**  
**Status:** IN PROGRESS.  
**Last code milestone:** local archive integrity hardening, code commit `f342b4b`.  
**Next:** strict validation for every record in every persisted archive and backup collection. M4 follows after Phase 1 and Phase 2 gates.

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
- `docs/engineering-progress-checkpoints`: six progress documents merged through PR #3 (squash commit `82efeac`).

## Current risk register

1. **High — confirmed:** outbox acknowledgement retains only bounded acknowledged IDs; reusing an acknowledged mutation ID with different content currently returns `already_acknowledged` without comparing payload. Add regression coverage and fix before relying on the outbox as a durable idempotency boundary.
2. **Critical before cloud sync:** aggregate daily activity and weak-verse counters are not safe for concurrent multi-device merge.
3. **High:** localStorage cannot atomically commit domain state plus outbox; a write-ahead event journal / transactional IndexedDB design is needed.
4. **High:** Firestore rules are generic-envelope-only and not production complete.
5. **High:** `readJsonArrayArchive()` validates only that the root is an array; `savePlans`, `saveEnginePlans`, `saveRevisionItems`, and `saveTest` do not validate each record. `validateBackupPayload()` also accepts several arrays after root-type checks without complete per-record validation, so malformed nested records can enter through backup import.
6. **Medium:** complete file-by-file audit of all mutation call sites, backup/restore, PWA, APIs, and Quran integrity remains open.
6. **Release:** Vercel rate limit previously blocked a production deployment; retry only through the normal platform path when quota permits.

## Last verified tests

- CI run `42180258989`: documented PASS for code commit `f342b4b`.
- CI run `42184381262`: PASS on PR #3 head, including automated tests, dependency audit, 10 Firestore emulator tests, TypeScript, production build, and server smoke test.
- Vercel status on merge commit `82efeac` reports the known free build-rate-limit failure; production deployment is not confirmed.
- No application code changed in the documentation checkpoint.

## Next exact action

1. Implement strict record-level validators for plans, engine plans, revision items, tests, logs, weak verses, and every backup collection; preserve invalid source bytes.
2. Add malformed-record, invalid-boundary, legacy-compatibility, and no-partial-backup-import tests.
3. Complete Phase 2 mutation/range validation.
4. Fix the confirmed outbox acknowledged-ID/content mismatch and add uniqueness/disjointness/retry-overflow tests.
5. Evaluate Dexie / Valibot / Zod against representative schemas and transactional journal requirements before adding dependencies.
6. Then design and implement the append-only event ledger and durable event+outbox transaction; do not activate Firestore production writes.
