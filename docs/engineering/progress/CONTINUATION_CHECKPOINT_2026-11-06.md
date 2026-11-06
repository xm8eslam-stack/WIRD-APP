# WIRD — Continuation Checkpoint (2026-11-06)

## Canonical position
- Repository: xm8eslam-stack/WIRD-APP
- Canonical branch: main (Google AI Studio source)
- Last verified application-code main SHA before this documentation checkpoint: f739b64aae61398c51769340f0e4182d51624fca
- Main Quality Gate: run 42236977371 — pending on exact main SHA f739b64aae61398c51769340f0e4182d51624fca at checkpoint preparation.
- Production deployment for current main SHA f739b64aae61398c51769340f0e4182d51624fca: not confirmed. Earlier Vercel checks reported the free daily deployment cap; verify the current deployment directly before release.

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


## 2026-11-06 — PR #25 progress checkpoint merged

- PR #25 merged to `main` as `698c523c08d13e1b2f29e279fa7ecb65c086e31c`; all three progress/checklist files were updated after PR #24.
- Exact-head Quality Gate runs `42232706103` (PR) and `42232700533` (push) passed on head `57c9e310daa3368e1f5d93c74532d6c73e578323`.
- PR #25 was documentation-only; its merge did not mark Phase 2 or release readiness complete.

## 2026-11-06 — PR #26 legacy account-import rollback merged

- PR #26 merged to `main` as `e355acffc376b0af355e95926e6315dbf8083951` from exact PR head `24682b573b31240d23950ed7e92ddea69947ce24`.
- First-account legacy import now captures a directly readable snapshot of legacy source keys, scoped destination keys, and the ownership marker before mutation. If snapshot reads are unavailable, import stops before any write.
- Conflicting destination data is rejected before mutation. Copy, source removal, and ownership-marker commit failures trigger restoration of the previous snapshot; the active account scope is not switched on failure.
- Added failure-injection tests for a multi-key import that fails during source removal and for unreadable snapshot preflight.
- Exact-head Quality Gate: PR run `42235874739` and push run `42235863281` both passed on SHA `24682b573b31240d23950ed7e92ddea69947ce24`: **334 automated assertions passed, 0 failed; 10 Firestore rules emulator tests passed; dependency audit, TypeScript, production build, and server smoke test passed**.
- Post-merge main Quality Gate run `42236088244` passed on exact main SHA `e355acffc376b0af355e95926e6315dbf8083951`.
- Production deployment remains unconfirmed; green CI is not a Vercel deployment receipt.

## Updated next actions — Phase 2 remains IN PROGRESS

1. Continue the mutation-integrity audit, beginning with failure injection for `saveUnifiedPortions` across the canonical archive, schema version, and legacy compatibility projections.
2. Complete the remaining multi-key domain mutation and durable rollback/recovery audit.
3. Replace localStorage outbox read/modify/write with an IndexedDB append-only event journal and atomic event/outbox transaction; test cross-tab atomicity, crash recovery, quota handling, and deterministic replay.
4. Connect domain mutations to UID-scoped Firestore only after the journal is tested; finish collection-specific rules and two-account/two-device/offline tests.
5. Complete manual responsive, accessibility, Quran navigation/tafsir, and audio QA; verify an actual production deployment before release.


## 2026-11-06 — PR #27 progress checkpoint merged

- PR #27 merged to `main` as `b73bcc862e54d12681b86238423e2bde2ea303f8`; the continuation checkpoint, current status, and release checklist now include PR #25/#26 outcomes.
- Exact-head Quality Gate runs `42236361054` (PR) and `42236329526` (push) passed on SHA `5f2729849dbd1665fbbfd9591b42cae946c24680`. A duplicate push run was cancelled by workflow concurrency; the exact-head PR and push runs both passed.

## 2026-11-06 — PR #28 canonical portion transaction merged

- PR #28 merged to `main` as `f739b64aae61398c51769340f0e4182d51624fca` from exact head `bb5a5224671fc3d1ef83b619b01556f8c6c39c01`.
- `saveUnifiedPortions` now treats the canonical archive, schema version, and legacy portions/revision projections as one logical transaction. It captures directly readable prior bytes before writing, verifies each durable write, and restores the full previous snapshot if canonical, schema-version, or compatibility-projection persistence fails.
- Added failure-injection tests for schema-version commit failure and a legacy revision projection write that applies before throwing.
- Exact-head Quality Gate: PR run `42236675217` and push run `42236639584` both passed on SHA `bb5a5224671fc3d1ef83b619b01556f8c6c39c01`: **336 automated assertions passed, 0 failed; 10 Firestore rules emulator tests passed; dependency audit, TypeScript, production build, and server smoke test passed**.
- Post-merge main Quality Gate run `42236977371` is pending at checkpoint preparation; update this line only after its exact SHA result is confirmed.
- Production deployment for the current main SHA is not confirmed; CI success does not establish a Vercel deployment.

## Updated next actions — Phase 2 remains IN PROGRESS

1. Audit all remaining multi-key mutation paths and verify that each failed write either restores the exact previous durable bytes or surfaces a recovery-required state.
2. Replace localStorage outbox read/modify/write with an IndexedDB append-only event journal and atomic event/outbox transaction; test cross-tab atomicity, crash recovery, quota handling, and deterministic replay.
3. Connect domain mutations to UID-scoped Firestore only after the journal is tested; finish collection-specific rules and two-account/two-device/offline tests.
4. Complete manual responsive, accessibility, Quran navigation/tafsir, and audio QA; verify an actual production deployment before release.
