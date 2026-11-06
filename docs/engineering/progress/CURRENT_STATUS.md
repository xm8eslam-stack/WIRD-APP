# WIRD — Current Engineering Status

**Updated:** 2026-11-06 (PR #37 checkpoint)  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Recent milestone PRs:** #14, #15, #16, #18, #20, #24–#28, #30–#32, and #34–#37 merged. Older superseded PRs remain historical only; compare every open branch with current main before considering reuse.

## Latest verified position — after PR #37

- Current main SHA: `60d475d1f4f06ea4a852751e1548297d9c7dc6de` (PR #37 merge).
- PR #36 merged as `9b76227b9498b23fa79fb39264d4b4be98fa16e4`: deterministic UID-scoped IndexedDB journal replay runs before authenticated app state initializes; legacy already-projected events are skipped safely; new snapshots are validated and cursor advancement follows successful local projection.
- PR #37 merged as `60d475d1f4f06ea4a852751e1548297d9c7dc6de`: authenticated profile settings/theme, preset-plan snapshots, and engine-plan snapshots use journal-first event+outbox persistence. Cross-tab snapshot writes are serialized with Web Locks; older pending events are replayed before new snapshots, and stale writes are blocked after recovery changes local state.
- PR #37 exact-head Quality Gate runs `42251723375` (PR) and `42251711748` (push) both passed on exact head `d45dd9e7284101e332f15b2f408cd62001a961be`: automated suites, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- Post-merge main Quality Gate run `42251976734` is pending/in progress at this checkpoint on exact main SHA `60d475d1f4f06ea4a852751e1548297d9c7dc6de`; verify its final result before treating the merge as fully main-gated.
- Vercel production deployment for this main SHA is not confirmed. Green GitHub Actions is not a deployment receipt.
- Phase 2 remains **IN PROGRESS**. PR #37 is a first slice, not full journal integration: session profile/activity aggregation, canonical portions/revision, weak verses, tests, backup import/reset, and remaining mutation paths are not yet journal-first.
- Open PR #8 compares as 21 ahead / 62 behind and PR #2 as 115 ahead / 191 behind; both are divergent and must not be merged wholesale.

### Next implementation sequence

1. Add journal-first canonical portion/revision mutations without weakening existing multi-key rollback verification.
2. Add grouped event+outbox transaction and grouped projection/rollback semantics for logically atomic multi-archive operations such as session completion and weak-verse recording.
3. Connect test results, activity/session records, and backup import/reset with deterministic recovery semantics.
4. Align Firestore payloads with immutable event semantics for activity, tests, and weak-verse records; aggregate daily logs/counters locally.
5. Implement Firestore adapter/worker, acknowledgements, retries, tombstones, collection-specific rules, and two-device/offline tests.
6. Complete manual UI/audio/accessibility QA and confirm a real Vercel Production deployment for the exact main SHA before release.

## Latest continuation checkpoint — 2026-11-06

- Last verified application-code main SHA before this documentation checkpoint: e355acffc376b0af355e95926e6315dbf8083951.
- PR #14 merged as c0390692d5f9ec7e81e04c8a674dbb035e0924ec: page-based Mushaf reader for 604 pages; generated exact navigation for all 30 Juz and 240 Hizb quarters; Surah/page/Juz/Hizb navigation; page bookmarks and last-read persistence; tafsir access; continuous ayah audio across page boundaries; shared 0.75×–2× playback speed in Quran Library, memorization session, and Mushaf reader. EveryAyah link-back attribution and separate audio-rights documentation added.
- PR #15 merged as 57fa70624dc1a9651b87035fd1a66565e284d5a9: detailed activity/profile rollback status, durable read-back verification that bypasses memory fallback, and combined rollback reporting for memorization, revision, and weak-verse operations.
- PR #16 merged as 1de59512e61e359ba001eeaae663e50597b6f58f: local outbox writes now verify the durable previous state after failure and surface recovery-required errors when restoration cannot be confirmed.
- PR #18 merged as c5483159c074e780853fa7dd3c10806396b73354: canonical portion writes in status updates, add-portion, memorization completion, and revision ratings now report whether the previous durable archive was preserved after a failed write.
- PR #20 merged as 7b6d43bc136f91a882ff12a3434b527ac25af1ec: backup export refuses incomplete durable reads; backup import refuses to start until a trustworthy pre-import snapshot is captured.
- Exact-head Quality Gates passed: PR #14 run 42219689112; PR #15 run 42220560997; PR #16 run 42220935595; PR #18 run 42221760076; PR #20 run 42222703837. Post-merge main run 42222910479 passed on application-code commit 7b6d43b.
- Vercel status on main 7b6d43bc: failure solely from the free daily deployment limit; retry in 24 hours. Production deployment is not confirmed.
- Branches feat/phase5-premium-ui-ux (115 ahead / 176 behind) and work/wird-audit-remediation (92 ahead / 300 behind) remain divergent; do not merge either wholesale.
- Next exact action: continue Phase 2 audit for every remaining single-/multi-key domain mutation and backup/restore failure path. Then design an IndexedDB event journal with crash recovery and atomic event+outbox writes. Only after those tests pass should a Firestore sync coordinator be connected. Do not activate cloud sync or deploy production rules without explicit approval.

## Verified repository position

- Latest application-code commit on `main` before this documentation checkpoint: `7b6d43bc136f91a882ff12a3434b527ac25af1ec` — PR #20 (durable backup snapshot guard). PR #18 portion-write rollback merge: `c5483159c074e780853fa7dd3c10806396b73354`; PR #16 outbox merge: `1de59512e61e359ba001eeaae663e50597b6f58f`; PR #15 activity/weak-verse rollback merge: `57fa70624dc1a9651b87035fd1a66565e284d5a9`; PR #14 Mushaf/audio merge: `c0390692d5f9ec7e81e04c8a674dbb035e0924ec`. Re-fetch `main` HEAD before every integration; progress-document commits may advance it.
- Previous merges: PR #6 `aacc7aeaf5f5c3d8fa34e010a376ad6ba8ae1784`; PR #5 `fd480526dd3eac728f60b3554e83309354903ad8`; PR #4 `647eff6624627d2c93ef797a317c6e7f1e0789c1`.
- CI run `42180258989` is documented as successful for the code commit: 256 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- GitHub Actions run `42190653101` on PR #9 head `2b520ebcf6c51ae155de508ddf49e49d421ba7ab` passed automated tests, 10 Firestore emulator tests, TypeScript, production build, and server smoke test. The merged code is `f8e0cef`.
- Vercel failed on the latest application-code main commit `7b6d43bc` due the free daily deployment limit (`Deployment rate limited — retry in 24 hours`). This is not a code build failure; production deployment is not confirmed.
- PR #1 was merged previously; do not merge it again.
- `main` is the only final integration branch. Never force-push.

## Current milestone

**PHASE 2 — Memorization/revision correctness audit**  
**Status:** IN PROGRESS on `main`; PR #14 (Mushaf/audio), PR #15 (activity/profile + weak-verse rollback certainty), PR #16 (outbox durable rollback certainty), PR #18 (canonical portion-write rollback certainty), and PR #20 (durable backup snapshot guard) are merged and quality-gated. Snapshot restore/reset failure injection, remaining mutation paths, IndexedDB event journal, cloud sync, and manual release QA are still open.  
**Baseline:** PHASE 1 remains COMPLETED on main.  
**Latest storage-integrity milestones:** PR #13 merge `346b725`; PR #15 merge `57fa706` (activity/profile + weak-verse rollback certainty); PR #16 merge `1de5951` (outbox durable rollback certainty). PR #16 exact-head run `42220935595` and post-merge main run `42221103563` passed. Earlier PR #13 run `42217300654` passed 317 assertions and the full quality gate.  
**Verified:** strict record/backup validation (PR #4), session and Quran-range pre-write validation (PR #5), outbox identity/idempotency hardening (PR #6), and deterministic portion merge/history preservation (PR #9).  
**Remaining:** inspect every remaining single-/multi-key mutation path (especially memorization/revision savePortions failure paths and backup/restore) for durable rollback verification. PR #15 and PR #16 close specific activity/profile, weak-verse, and outbox reporting gaps. Cross-tab atomicity belongs to the IndexedDB event-journal milestone. M4 follows after both gates.

## Completed and verified foundations

- Firebase Authentication and verified-user gating.
- UID-scoped local storage and guest separation.
- Explicit legacy-data ownership choice.
- Canonical Quran data and per-Surah lazy-loaded chunks.
- Page-based full Mushaf reader and continuous audio, with generated 604-page / 30-Juz / 240-Hizb-quarter navigation and page bookmarks (PR #14; manual responsive QA remains open).
- Shared playback-speed preference/control across every confirmed audio view, with visible EveryAyah link-back attribution (PR #14).
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
- Activity/profile and weak-verse multi-key rollback certainty with direct durable read-back (PR #15).
- Local sync-outbox durable rollback verification and recovery-required reporting (PR #16).
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
- `feat/phase5-premium-ui-ux`: diverged, 115 commits ahead and 171 behind at comparison time; do not merge wholesale.
- `work/wird-audit-remediation`: diverged, 92 commits ahead and 295 behind at comparison time; do not merge wholesale.
- `docs/engineering-progress-checkpoints`: six progress documents merged through PR #3 (squash commit `82efeac`).

## Current risk register

1. **Resolved in PR #6:** acknowledged mutation fingerprints now reject changed-content ID reuse while preserving exact retries; legacy acknowledgements without fingerprints fail closed.
2. **Critical before cloud sync:** aggregate daily activity and weak-verse counters are not safe for concurrent multi-device merge.
3. **High:** localStorage cannot atomically commit domain state plus outbox; a write-ahead event journal / transactional IndexedDB design is needed.
4. **High:** Firestore rules are generic-envelope-only and not production complete.
5. **High — local atomicity:** the outbox's localStorage read-modify-write is not cross-tab atomic; do not enable cloud sync until a transactional IndexedDB design is in place.
6. **High — Phase 2:** PR #15, #16, #18, and #20 close activity/profile, weak-verse, outbox, canonical-portion, and backup snapshot-read gaps; snapshot restore/reset, remaining mutation, event-journal, and cross-tab atomicity audits remain open.
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

1. Audit restoreStorageSnapshot and resetAllData with storage-unavailable and partially applied-write failure injection; PR #20 now guards export and pre-import snapshot capture.
2. Audit remaining domain mutation call sites for a detailed durable rollback result; primary savePortions failure paths now use savePortionsDetailed.
3. Audit the local outbox read/modify/write behavior across tabs; single-key writes remain non-transactional across tabs.
4. Design and test an IndexedDB append-only event journal plus atomic event/outbox transaction, crash recovery, quota handling, deterministic replay.
5. Only then connect domain mutations to a UID-scoped Firestore sync coordinator; add two-account/two-device/offline emulator tests and collection-specific rules.
6. Do not activate Firestore production writes, deploy production rules, or claim release readiness until explicit approval and real deployment verification.


## 2026-11-06 — PR #12 rollback failure-injection checkpoint

- PR #12 merged to main as `1ffd6c23363d636a6b395620e7f9c7cd15828827` (test-only).
- PR head `522bbc549074217af8e3d434538078cc5a8204bc`; Actions WIRD Quality Gate #741 / run `42216315142` passed: **315 passed / 0 failed**, 10 Firestore Security Rules Emulator tests, dependency audit, TypeScript, production build, and server startup smoke test.
- Added three regression cases for weak-verse quota failure, failed rollback with explicit recovery-required warning, and profile quota failure after successful portion/weak-verse/activity writes.
- Vercel check passed for the PR head before merge; post-merge Vercel status on merge SHA was still pending at the last check. Production deployment is not yet confirmed.
- Phase 2 remains IN PROGRESS; next audit targets silent-write/read-back mismatch and all remaining multi-key mutation paths.


## 2026-11-06 — PR #13 durable readback verification checkpoint

- PR #13 merged to main as `346b725ae76a177372375f5045e7816eb09a0d1c`.
- PR head `d6753835d70a71b7f3a5f15a7f3512d9f92bf843`; GitHub Actions WIRD Quality Gate #759 / run `42217300654` passed: **317 passed / 0 failed**, 10 Firestore Security Rules Emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- Durable writes now snapshot the previous raw value, verify exact readback, attempt and verify restoration after mismatch/exception, and update memory fallback only after successful durable verification. Durable removal is also verified; `removeRawItem` now exposes its boolean result.
- Regression coverage includes silent no-op writes, mismatched/corrupted writes, silent removal failure, and weak-verse mutation rollback after silent write mismatch.
- Vercel check failed with `build-rate-limit` on the PR head; GitHub Actions quality gate passed. Production deployment remains unconfirmed.
- Phase 2 remains IN PROGRESS. Next task is auditing all multi-key mutation callers and failure/recovery behavior beyond the weak-verse path.


## 2026-11-06 — PR #24 reset rollback integrity

- PR #24 merged as `753dbf7d95f6f577f022952f122280de69d8e074`; transactional full-reset rollback and final-state snapshot restoration are now on `main`.
- Exact-head Quality Gate run `42232090692` (#883) passed: automated tests, Firestore rules emulator, dependency audit, TypeScript, production build, and server smoke test.
- New tests prove reset performs no deletions when a trusted durable snapshot cannot be read and restores earlier successful deletions when a later key removal fails.
- Post-merge main run `42232397539` (#885) completed successfully on exact main SHA `753dbf7d95f6f577f022952f122280de69d8e074`.
- Remaining critical work: full mutation-path audit, IndexedDB event journal + atomic outbox, cross-tab/crash recovery, Firestore sync/rules, two-device tests, and manual release QA. Production deployment is not confirmed.


## 2026-11-06 — PR #26 legacy account-import rollback

- PR #26 merged to main as `e355acffc376b0af355e95926e6315dbf8083951`; first-account legacy import now preflights a directly readable snapshot of source keys, scoped destinations, and the ownership marker.
- Snapshot-read failure aborts before mutation; conflicting destination values are rejected before copying; failures during copy, source removal, or ownership-marker commit attempt a full snapshot restore and do not activate the new account scope.
- Exact-head Quality Gate runs `42235874739` and `42235863281` passed on PR head `24682b573b31240d23950ed7e92ddea69947ce24`: 334 automated assertions passed, 10 Firestore emulator tests passed, dependency audit, TypeScript, production build, and server smoke test passed.
- Post-merge main run `42236088244` passed on exact SHA `e355acffc376b0af355e95926e6315dbf8083951`.
- Phase 2 remains IN PROGRESS. Next mutation-audit target: failure-injection coverage for canonical portions + schema-version + legacy compatibility projection writes in `saveUnifiedPortions`. Local outbox cross-tab atomicity, IndexedDB event journal, Firestore sync/rules, two-device tests, manual QA, and production deployment confirmation remain open.


## 2026-11-06 — PR #28 canonical portion transaction

- PR #28 merged to main as `f739b64aae61398c51769340f0e4182d51624fca`; `saveUnifiedPortions` now snapshots and transactionally verifies the canonical archive, schema version, and both legacy compatibility projections.
- If the canonical write, schema-version commit, or either legacy projection fails, the full previous durable snapshot is restored and verified; a partial save is not reported as success.
- Exact-head Quality Gate runs `42236675217` and `42236639584` passed on PR head `bb5a5224671fc3d1ef83b619b01556f8c6c39c01`: 336 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- Post-merge main Quality Gate run `42236977371` passed on exact main SHA `f739b64aae61398c51769340f0e4182d51624fca`.
- Phase 2 remains IN PROGRESS. Remaining blockers: full multi-key mutation audit, cross-tab outbox atomicity, IndexedDB event journal, Firestore sync/rules, two-device tests, manual QA, and production deployment confirmation.


## 2026-11-06 — IndexedDB sync journal and async outbox foundation

- PR #30 merged as `6c48b2937bd99ddead88c5ca829381bf096e0c94`: append-only events and outbox delivery records now commit atomically in IndexedDB; cross-tab duplicate enqueue and abort atomicity are tested.
- PR #31 merged as `16481abc42c337defa522aa8049a0b62c5f41042`: legacy localStorage outbox migration is atomic, idempotent, collision-safe, and retains the old source as a recovery copy.
- PR #32 merged as `f3a207844020494ebf6a350ae9cb27d6db62398e`: LocalSyncOutbox now exposes async IndexedDB operations and imports changed legacy snapshots safely.
- Exact-head Quality Gates: PR #30 SHA `9bc4945d92737df086396f436b2388a92972bf92` — 344 tests; PR #31 SHA `2f6e82213188110c9ae69cf057c376b1eb40051d` — 349 tests; PR #32 SHA `d97d8cf10cd076a726dbf377c8a4078b8c2dec2c` — 346 tests. Each also passed 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- Post-merge main runs #30 `42238366343` and #31 `42239494829` passed. PR #32 main run `42240305979` passed on exact SHA `f3a207844020494ebf6a350ae9cb27d6db62398e`.
- Important: no production UI/service call sites yet enqueue domain mutations. Firestore sync is not implemented or activated; this is the tested storage foundation only.


## 2026-11-06 — PR #34 monotonic event sequence and projection cursor

- PR #34 merged to main as `bfff3969d510c49da6d0224a375b87ca2959c651`.
- IndexedDB v1 events are backfilled with deterministic per-UID sequence numbers during the v1→v2 upgrade.
- Event writes allocate monotonic sequences atomically with outbox writes. Cross-tab transactions receive unique contiguous sequence numbers.
- Durable projection cursor APIs now support bounded replay pages and contiguous-only advancement.
- Exact-head Quality Gate on PR SHA `148e7b27873219f552edee41b819f7b08949e7a5`: 348 automated assertions, 10 Firestore rules tests, TypeScript, production build, dependency audit, and server smoke test all passed.
- Post-merge main Quality Gate run `42241532674` passed on exact main SHA `bfff3969d510c49da6d0224a375b87ca2959c651`.
- Next: implement replay into localStorage before app state initialization, then connect actual domain mutation paths. Firestore sync remains inactive.
