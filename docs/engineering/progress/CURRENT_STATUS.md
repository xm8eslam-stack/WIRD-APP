# WIRD — Current Engineering Status

**Updated:** 2026-11-06 after PR #57 merge and PR #58 scope-isolation hardening  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Latest main SHA:** `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`

## Latest completed work

- **PR #49** — Quran reader/Tafsir route repair and direct Surah-to-Mushaf navigation; merged as `15979e4a009ef0aa5b4981cbcbb4f2124f25dfc3`; exact-head Quality Gate `42267849373` passed.
- **PR #50** — Journal-first session completion for memorization progress, activity, and profile streak; merged as `dacba8298db954392f7fbcbbf10af9f18ecc31dc`; exact-head Quality Gate `42276148126` passed.
- **PR #51** — Matching smart-plan task included in the same session transaction; merged as `99c466b9de6ae977979f8989443fba5b94017a30`; exact-head Quality Gate `42276561011` and post-merge main run `42276748346` passed.
- **PR #52** — Backup import and factory reset journal-ordered; merged as `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`; exact-head run `42277464313` and post-merge main run `42277666291` passed.
- **PR #53** — Removed unused direct-write handlers and refreshed engineering checkpoints; merged as `87c4ec4456c69e35e1d62a368c97a5992d0309ac`; exact-head run `42278253060` and post-merge main run `42278457062` passed.
- **PR #54** — Typed, semantically validated local domain-event envelopes; merged as `6cc1d20e63257387044334da45e38bc204961c09`; exact-head run `42280361752` and post-merge main run `42280564932` passed.
- Main includes direct Quran Library navigation/Juz-index commit `033b8abda6bbf4f5c58d9b20d835f3268230abb6`.
- **PR #55** — Journaled development demo data and rollback/restart recovery coverage; merged as `c4de1ea12549a9c8a51f818e3b855d1da1d45f96`; exact-head runs `42281993489` and `42281999065` passed; post-merge main run `42282206155` passed.
- **PR #57** — Removed read-side writes from profile/portion getters and moved legacy portion migration into AuthGate through the journal; merged as `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`; exact-head runs `42283803166` and `42283813448` passed; post-merge main run `42284039747` passed.

## Deployment status

- The latest Vercel check on PR #54 reported success, but the production URL has not been independently verified against the latest main SHA. Treat deployment as unconfirmed; this does not block merging tested changes.
- Per the owner's explicit instruction, this is not a merge blocker for tested changes.
- It is not a successful deployment receipt. Production deployment and live browser verification remain unconfirmed.

## Phase 2 — local data reliability

Completed and merged:
- Profile/plans, canonical page progress, manual portions, test snapshots, weak-verse failure/resolution, and revision rating paths use journal-first persistence.
- Session completion groups memorization progress, activity/profile streak, and matching smart-plan task into one recoverable event.
- Backup import/reset replay older pending events first and apply grouped snapshots through the journal.
- App-level unused direct local-only session/revision handlers have been removed.

Still open:
- PR #55 closed the known development demo direct-write path. Remaining audit items: legacy outbox migration/reset behavior, device-local reader/Tafsir/audio preferences, and any unreviewed multi-key mutation callers.
- Review legacy localStorage outbox migration against explicit reset and IndexedDB-loss scenarios.
- Add failure-injection coverage for IndexedDB unavailable/blocked states, quota/read failures, rollback verification, and reload recovery.
- Define immutable domain-event semantics and deterministic aggregate derivation before cloud sync.

## Phase 3 — domain event model

- PR #54 is merged. It introduced a versioned, typed `domainEvent` envelope attached to append-only IndexedDB journal entries.
- Event types covered: `session.completed`, `revision.rated`, `test.completed`, `weak_verse.failed`, and `weak_verse.resolved`.
- Event identity must equal the journal mutation ID; semantic payload validation rejects malformed records before enqueue.
- Session/revision/weak-verse retry paths preserve event ID and timestamp; test event timestamps derive deterministically from the test date.
- This is **local journal metadata**, not yet a separate Firestore event collection or remote sync implementation.

## Remaining cloud/release work

- Firestore client/repository, sync worker, remote acknowledgements, retries/backoff, tombstones, collection-specific rules, and two-device/offline tests are not implemented.
- Production Firestore rules deployment and Vercel Production deployment are not verified.
- Do not enable cloud writes, deploy production rules, or perform destructive migrations without explicit approval.

## Current status

- PR #55 and PR #57 are merged and verified on `main`.
- PR #57 makes profile and portion getters read-only and moves legacy portion migration to a journaled startup step after pending-event replay.
- PR #58 is in progress to guard the migration against account-scope changes while it waits for the journal lock.
- The local mutation audit continues for legacy outbox migration and any remaining multi-key mutation callers; device-local reader/Tafsir/audio preferences are intentionally local and guarded against storage exceptions.

## Next implementation sequence

1. Finish the remaining local mutation audit, including legacy outbox migration/reset and any remaining multi-key mutation callers; add failure-injection coverage where gaps remain.
2. Derive daily aggregates and streaks deterministically from the merged domain-event ledger.
3. Define record-level Firestore document mapping and conflict semantics.
4. Implement Firestore adapter and sync coordinator behind an inactive feature gate.
5. Test offline replay, duplicate delivery, account isolation, tombstones, and two-device conflicts in emulators.
6. Deploy production rules/activate cloud writes only after backup review and explicit approval; complete browser QA and actual deployment verification.

## Working rules

- Inspect current main → create a fresh branch → implement → run exact-head Quality Gate → review all jobs → merge → verify resulting main SHA.
- Vercel rate-limit is not a merge gate per owner instruction, but never claim deployment success without exact-SHA evidence.
- Do not merge stale/diverged PRs #2 or #8 wholesale.

## Historical implementation record

The detailed historical checkpoint entries below are retained for traceability. Their old “current” and “next action” statements are historical snapshots; this top section is the authoritative current state.

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


## 2026-11-07 — Revisioned remote sync verification update

- PR #73 merged as `cc887a6bfa07aec880f495221e64dd36edb14ca8`: durable remote projection intent, recovery, and atomic finalization.
- PR #77 merged as `716cf301bff9a8c7777ee3931dba6366a01afe3b`: Firestore Emulator two-device profile round trip using independent IndexedDB/localStorage and authenticated clients; exact-head checks passed; Rules 26/26.
- PR #78 merged as `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`: same-document offline conflict regression; stale revision rejected, local pending mutation and remote inbox preserved, projection cursor blocked; exact-head checks passed; Rules 27/27.
- Exact-head CI for PR #77/#78: 450 automated assertions, Firestore Rules Emulator, TypeScript, production build, startup smoke, and dependency audit passed.
- Important boundary: tests cover profile upserts and one same-document conflict. They do not certify all collections, browser E2E, load/stress, conflict-resolution UI, or tombstones.
- Tombstone projection remains deliberately blocked pending collection-specific delete semantics. Production rules deployment and Vercel production deployment remain unverified; Vercel status is `build-rate-limit`.
- New detailed documents: `docs/sync/ARCHITECTURE.md`, `STATE-MACHINE.md`, `CONFLICT-RESOLUTION.md`, `FAILURE-RECOVERY.md`, `TEST-MATRIX.md`, `RELEASE-GATES.md`, and `docs/engineering/PROGRESS.md`.
- Current main at this checkpoint: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; post-merge main workflow was queued and requires exact-SHA verification.


## 2026-11-07 — Durable conflict archive merged

- PR #81 merged as `059e902194811be71ab4dea9da8609a96967214e`.
- IndexedDB v8 adds a UID-scoped bounded `projectionConflicts` store. Blocked projector decisions preserve the remote event and relevant local snapshot; repeated observations do not overwrite the first snapshot; open conflicts are never pruned.
- Settings exposes open conflict count and latest conflict summary. This is diagnostic/recovery support, not conflict resolution.
- Exact-head PR CI: 459 automated assertions, 27 Firestore Rules Emulator tests, TypeScript, production build, dependency audit, and startup smoke passed. Post-merge main run `42351965332` passed.
- PR #76 and #59 closed as superseded; no stale-base changes were merged directly.
- Current main SHA: `059e902194811be71ab4dea9da8609a96967214e`.
- Remaining blockers: user-facing conflict resolution/rebase, tombstone projection/retention, all-collection two-device coverage, real-browser E2E, long-offline/load tests, and live production deployment/rules verification.


## 2026-11-07 — Atomic conflict reconciliation merged

- PR #85 merged as `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- Conflict archive writes validate UID metadata, inbox event identity/fingerprint, existing archive identity, and snapshot size. A conflict is marked `resolved/reconciled` atomically with successful cursor advancement and inbox deletion.
- Already-applied events use the same atomic reconciliation path. Late archive attempts cannot create orphan open conflicts after cursor advancement.
- Exact PR CI: 462 assertions passed, Firestore Rules 27/27, TypeScript, build, dependency audit, startup smoke passed. Post-merge main run `42352594819` passed.
- PR #82 and #86 closed as superseded by #85.
- Current main SHA: `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- Manual conflict choice/rebase UI, tombstone projection, all-collection multi-device coverage, browser E2E, load tests, and live production deployment/rules remain unverified.

## Authoritative live status — 2026-11-07 after PR #89

The historical checkpoint above is not the current main state. Re-fetch GitHub before further changes.

- Current main SHA at this checkpoint: e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- PR #62 merged as 8535802d3609c854b1c91742135c84894e5e074f; exact-head run 42342109962 and post-merge main run 42354256341 succeeded.
- PR #89 merged as e894140c91ec8086d111989dcdb601d3cdbf9ce4; exact-head runs 42354410219 and 42354399498 succeeded. PR #63 was closed as superseded, not merged.
- Post-merge Main run 42354517460 was in progress at checkpoint time; do not mark post-merge validation complete until it finishes successfully on this exact SHA.
- PR #88 Ruqyah integration is merged. Its progress service stores counts in UID-scoped local storage, but Ruqyah progress is not cloud-synchronized.
- The separate Ruqyah sync experiment branch feat/ruqyah-cloud-sync-20261107 had a failing exact-head run 42354431882 (491 passed, 3 failed). Failure: missing StorageService.saveRuqyahProgressSnapshot. Re-fetch latest branch state because it may have advanced since this observation.
- Do not add Ruqyah counts to cloud sync until a deterministic concurrent-increment model exists. A full-snapshot last-write-wins policy can lose increments from independent devices.
- Cloud sync is NOT approved for production activation. Manual conflict resolution, safe tombstone projection, all-collection sync tests, cross-tab browser tests, account lifecycle, production Firestore rules verification, and exact-SHA production deployment/live smoke remain open.
- Vercel deployment remains unverified due the build-rate-limit quota failure. This is separate from GitHub Actions.

## Authoritative live status — 2026-11-07 after PR #93

The prior checkpoint paragraphs are historical. Current main at this update is f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3; Main Quality Gate run 42355600523 passed on this exact SHA.

- PR #91 merged at a618036b995ff45749748e90e2a4d3ec1037c838. Ruqyah progress now uses the durable journal/revisioned Firestore path and version-5 backups. Exact-head Quality Gate 42355023151 passed.
- PR #92 merged at bd6fc3a79267ee7136746fed17c58a6ceac8b58c. It fixes unversioned canonical archive overwrite protection, pending-migration direct writes, duplicate canonical portion validation, and stable legacy history IDs. Exact-head Quality Gate 42355486226 passed.
- PR #93 merged at f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Exact-head Quality Gate 42355488786 passed 500 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build, and server startup smoke.
- PR #94 is open and adds Ruqyah to legacy first-sync detection plus a concurrent-offline conflict-preservation test. Its exact-head CI is pending/in progress; re-fetch the head and all checks before merge.
- Ruqyah concurrent offline increments are not automatically additive-merged. The new test requires the stale write to be rejected and both snapshots/outbox/inbox/conflict archive preserved without cursor advancement. User-facing conflict resolution and deterministic additive merge remain release blockers.
- Tombstone projection remains blocked. No user-facing keep-local/use-remote/merge workflow is complete.
- Cross-tab browser concurrency, full multi-collection two-device coverage, account lifecycle isolation, production Firestore rules deployment, and exact-SHA production deployment/live smoke remain unverified.
- Vercel build-rate-limit failures are provider quota failures, not successful deployments. Production environment values and remote-sync activation are not verified and must not be changed without explicit authorization.

### Subsequent checkpoint update — PR #95 merged

- PR #95 merged at 52e62d6b21057cf0d796cc3b137f4087cbe2e983. Its exact-head Quality Gate passed on c2e9478f6053ddc95aaa5058d7a5ab074255d58b; the merge adds post-success Ruqyah progress notifications for direct backup import and full reset, with rollback-safe notification timing.
- Main Quality Gate run 42355938085 was in progress on 52e62d6b21057cf0d796cc3b137f4087cbe2e983 when this note was added; verify its final conclusion before the next release decision.
- PR #94 was created against the previous main SHA f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Its changes are disjoint from PR #95, but re-check mergeability and exact-head CI after main advanced.
- PR #96 documents the global stop condition: do not set remote-sync flags until manual conflict resolution, additive counter merge, tombstones, cross-tab coordination, account isolation, and live verification all pass.

## Authoritative live status — 2026-11-07 after PR #98

- Current main: 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. Main Quality Gate run 42356505550 passed on this exact SHA.
- PR #97 merged at 217f7136244d4d7afd02a9c52be86f520c1baefa; exact-head Quality Gate runs 42356248195 and 42356243586 passed. The API proxy keeps the provider key server-side, allowlists topic block types, bounds streamed response bodies to 2 MiB, and leaves educational topic endpoints disabled by default.
- PR #98 merged at 8089579d020a6a4831cdc9ba4f25f8672f30cc3d; exact-head run 42356412901 passed. It adds a guarded manual Firestore rules deployment workflow. It has not been dispatched; production rules are not claimed deployed.
- PR #100 is open to add Firestore Emulator tests as a pre-deploy gate. Do not dispatch the workflow until PR #100 is merged and deployment is explicitly approved.
- Vercel status for current main SHA 8089579d020a6a4831cdc9ba4f25f8672f30cc3d is failure: build-rate-limit. Earlier success on f2c3f32f does not verify the current main deployment. No production alias/live SHA is confirmed.
- Manual conflict-resolution UI/state machine remains absent. Ruqyah aggregate snapshots safely block/archive concurrent stale writes but do not calculate an additive merge.
- Tombstones remain blocked; cross-tab browser concurrency, full account lifecycle isolation, and complete multi-collection two-device coverage remain unverified.
- Keep remote sync flags disabled. Do not deploy rules, alter secrets, or change Vercel production settings without explicit approval.
