# WIRD — Continuation Checkpoint (2026-11-06)

## Canonical position
- Repository: xm8eslam-stack/WIRD-APP
- Canonical branch: main (Google AI Studio source)
- Last verified application-code main SHA before this documentation checkpoint: 7b6d43bc136f91a882ff12a3434b527ac25af1ec
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

4. PR #18 — c5483159c074e780853fa7dd3c10806396b73354
   - Detailed durable rollback status for canonical portion writes.
   - Recovery-required messages for portion status, add-portion, memorization completion, and revision rating failures.

5. PR #20 — 7b6d43bc136f91a882ff12a3434b527ac25af1ec
   - Backup export refuses to produce a file when durable reads cannot be verified.
   - Backup import stops before writing if a trustworthy rollback snapshot cannot be captured.

## Quality gates
- PR #14 exact-head run 42219689112: success.
- PR #15 exact-head run 42220560997: success.
- PR #16 exact-head run 42220935595: success.
- PR #18 exact-head run 42221760076: success.
- PR #20 exact-head run 42222703837: success.
- Post-merge main run 42221958603 passed after PR #18; post-PR #20 main run 42222910479 passed.

## Remaining blockers — do not claim the app is production-ready
- Cloud sync coordinator is not implemented.
- Local outbox is not connected to all domain mutation paths.
- No append-only IndexedDB event journal or atomic event+outbox transaction.
- Cross-tab atomicity, crash/reload recovery, and offline replay remain unverified.
- Snapshot restore/reset failure paths and outbox cross-tab read/modify/write still need failure-injection review; backup export and pre-import snapshot capture are guarded by PR #20.
- Firestore rules still need collection-specific validation and production deployment review.
- Real two-device/two-account sync has not been tested.
- Manual responsive, accessibility, and audio behavior QA is still open.
- Vercel production deployment is rate-limited; current main is not confirmed deployed.

## Branch safety
- feat/phase5-premium-ui-ux: 115 ahead / 171 behind — do not merge wholesale.
- work/wird-audit-remediation: 92 ahead / 295 behind — do not merge wholesale.
- Never force-push or merge stale branches wholesale. Start every new feature branch from the freshly fetched main.

## Exact next action
1. Audit restoreStorageSnapshot and resetAllData with storage-unavailable and partially applied-write failure injection.
2. Audit remaining mutation call sites and outbox cross-tab read/modify/write behavior; single-key outbox writes remain non-transactional across tabs.
4. Design IndexedDB append-only event journal + atomic event/outbox transaction, crash recovery, quota handling, deterministic replay.
5. Connect domain mutations to UID-scoped Firestore sync only after the journal is tested.
6. Add two-account/two-device/offline tests, collection-specific Firestore rules, and manual UI/audio QA.
7. Do not deploy production rules, activate cloud writes, or claim release readiness without explicit approval and successful real deployment verification.


## 2026-11-06 — PR #24 transactional reset and snapshot restoration checkpoint

- PR #24 merged to `main` as `753dbf7d95f6f577f022952f122280de69d8e074` from head `545d7f7921a185d7a2cc8e4c92a38896484828d6`.
- `resetAllData` now captures a complete trusted snapshot before deleting any key; unreadable storage stops the reset before the first deletion.
- If any deletion fails or cannot be durably verified, reset attempts to restore the complete previous dataset and still returns failure (it never reports a partial reset as success).
- `restoreStorageSnapshot` now judges success from the final memory and durable read-back, not a transient cleanup result when the final value already matches the snapshot.
- Added failure-injection coverage for partial deletion rollback and snapshot-read preflight failure. Existing restore durable-readback coverage remains in place.
- PR exact-head Quality Gate run `42232090692` (#883): **success** — automated suites, Firestore rules emulator, dependency audit, TypeScript, production build, and server smoke test.
- Post-merge main Quality Gate run `42232397539` (#885) completed successfully on exact main SHA `753dbf7d95f6f577f022952f122280de69d8e074`.
- Vercel reported its known free deployment-rate limit on the PR head. This is not a code-build failure and production deployment remains unconfirmed.

## Updated remaining work — do not claim release readiness
1. Audit remaining domain mutation call sites and multi-key rollback/recovery behavior.
2. Replace localStorage outbox read/modify/write with an IndexedDB transactional event journal; prove cross-tab atomicity, crash recovery, quota handling, and deterministic replay.
3. Connect domain mutations to UID-scoped Firestore only after the journal and replay tests pass.
4. Complete collection-specific Firestore rules and two-account/two-device/offline tests.
5. Complete manual responsive, accessibility, Quran navigation/tafsir, and audio QA; confirm a real production deployment.
