# WIRD — Continuation Checkpoint (2026-11-06)

## Canonical position
- Repository: xm8eslam-stack/WIRD-APP
- Canonical branch: main (Google AI Studio source)
- Current main SHA: 1de59512e61e359ba001eeaae663e50597b6f58f
- Main Quality Gate: run 42221103563 — success (tests, Firestore emulator, dependency audit, TypeScript, production build, server smoke).
- Production deployment: not confirmed. Vercel reports the free daily deployment cap and asks to retry in 24 hours.

## Completed since the previous checkpoint
1. PR #14 — c0390692d5f9ec7e81e04c8a674dbb035e0924ec
   - Full page-based Mushaf reader, all 604 pages.
   - Exact generated page coordinates; all 30 Juz and 240 Hizb-quarter starts.
   - Page / Surah / Juz / Hizb navigation, page bookmarks, last-read position, tafsir access.
   - Continuous ayah recitation across page and Surah boundaries.
   - Shared 0.75×–2× speed controls in Quran Library, memorization sessions, and Mushaf.
   - EveryAyah link-back attribution and audio-rights documentation.
2. PR #15 — 57fa70624dc1a9651b87035fd1a66565e284d5a9
   - Detailed activity/profile rollback status.
   - Durable read-back that bypasses memory fallback.
   - Combined rollback certainty for memorization, revision, and weak-verse operations.
3. PR #16 — 1de59512e61e359ba001eeaae663e50597b6f58f
   - Durable outbox rollback verification.
   - Explicit recovery-required errors for partially applied outbox writes whose restoration is refused.

## Quality gates
- PR #14 exact-head run 42219689112: success.
- PR #15 exact-head run 42220560997: success.
- PR #16 exact-head run 42220935595: success.
- Post-merge main run 42221103563: success.

## Remaining blockers — do not claim the app is production-ready
- Cloud sync coordinator is not implemented.
- Local outbox is not connected to all domain mutation paths.
- No append-only IndexedDB event journal or atomic event+outbox transaction.
- Cross-tab atomicity, crash/reload recovery, and offline replay remain unverified.
- Remaining single-key and backup/restore mutation paths need failure-injection review.
- Firestore rules still need collection-specific validation and production deployment review.
- Real two-device/two-account sync has not been tested.
- Manual responsive, accessibility, and audio behavior QA is still open.
- Vercel production deployment is rate-limited; current main is not confirmed deployed.

## Branch safety
- feat/phase5-premium-ui-ux: 115 ahead / 171 behind — do not merge wholesale.
- work/wird-audit-remediation: 92 ahead / 295 behind — do not merge wholesale.
- Never force-push or merge stale branches wholesale. Start every new feature branch from the freshly fetched main.

## Exact next action
1. Audit recordMemorizationCompletion, recordRevisionPerformance, and every remaining savePortions failure path for durable rollback verification.
2. Re-check backup import/export and snapshot restoration with storage-unavailable and partial-write failure injection.
3. Audit outbox cross-tab read/modify/write behavior; current single-write rollback is safer but not transactional across tabs.
4. Design IndexedDB append-only event journal + atomic event/outbox transaction, crash recovery, quota handling, deterministic replay.
5. Connect domain mutations to UID-scoped Firestore sync only after the journal is tested.
6. Add two-account/two-device/offline tests, collection-specific Firestore rules, and manual UI/audio QA.
7. Do not deploy production rules, activate cloud writes, or claim release readiness without explicit approval and successful real deployment verification.
