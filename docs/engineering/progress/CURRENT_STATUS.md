# WIRD — Current Engineering Status

**Updated:** 2026-11-06 (active PR #49 exact-head Quality Gate passed; Vercel deployment remains rate-limited)
**Repository:** `xm8eslam-stack/WIRD-APP`
**Canonical branch:** `main` (Google AI Studio source)
**Current main SHA:** `ee94a199fd354f3680807f0dbf8aa5da5e8adc6f`



## 2026-11-06 — Active Quran reader and Tafsir repair (PR #49)

- Working branch: `fix/quran-reader-tafsir-navigation-20261106`; base main SHA: `4fa6a1acffb0723c89bb963b237e67e6f4b7173f`.
- Root cause found for the reported `Unexpected token 'i', "import { A"...` failure: the client calls `/api/tafsir`, but the custom Express server did not register that route. In development, the request fell through to Vite middleware and could return the TypeScript module source instead of JSON.
- Fixed by mounting the existing `api/tafsir.ts` handler in `server.ts` before Vite middleware; the Vercel serverless handler remains in place.
- Added production and development server smoke checks that assert `/api/tafsir` returns JSON for invalid coordinates, rather than source code.
- Added a direct Mushaf-opening action for every Surah row and the selected-Surah panel. The selected Surah opens at its first Mushaf page; the general Mushaf entry continues to resume the saved reading position.
- In-reader Surah jumps now resolve the first-ayah page from the generated 604-page index. Added a regression test validating all 114 Surah start pages against the generated page index.
- Application-code head `8f213b3a912657b0d1e36f7c851085b742629e2c` passed exact-head PR run `42267248254` and push run `42267243769`.
- Latest documentation-inclusive PR head `6d56580e2d2477ded76f1425d97e968f4b317eeb` passed exact-head WIRD Quality Gate run `42267565615` (run #1217): dependency audit, automated tests, Firestore emulator, TypeScript, production build, and production+development server smoke tests all succeeded.
- Exact-head Vercel status remains failed with `build-rate-limit` / `api-deployments-free-per-day`; no Preview or Production deployment is verified.
- Vercel deployment is blocked by the Free-plan daily deployment limit (`api-deployments-free-per-day`, retry after 24 hours). This is a deployment gate, not a successful deployment. Do not merge or claim production availability while this required check remains failed.
- PR #49 remains open as a draft; main has not been modified.
- Next: keep PR #49 open and unmerged; when the Vercel daily limit resets, retry deployment, verify the exact branch Preview and API response, then review whether merge is safe. Do not merge while Vercel's required check is failing.

## Latest verified position — after PR #45

- PR #36 merged: deterministic UID-scoped IndexedDB journal replay runs before authenticated app state initializes; replay is sequence-ordered, protected by Web Locks, and advances the cursor only after verified local projection.
- PR #37 merged: authenticated profile settings/theme, preset plans, and engine-plan snapshots use journal-first event+outbox persistence.
- PR #38 merged: progress checkpoint and Firestore design were updated after PRs #36/#37.
- PR #40 merged: Progress Analytics page-status changes now persist canonical portion snapshots through the journal.
- PR #41 merged: manual portion additions now use pure snapshot preparation and journal-first canonical persistence.
- PR #42 merged: test-result snapshots use stable result IDs, idempotent retry, and conflicting-ID rejection.
- PR #43 merged as `dc258764723b4d88635175c912d159e6adaacf4b`: grouped transaction envelope commits multiple local projections as one IndexedDB event+outbox pair; failed child projection restores and verifies affected keys; stable mutation identity is preserved across retries.
- PR #44 merged as `0a24862e255946ea487e120cd6d82f5a3c81eb20`: manual and test-driven weak-verse failures now journal the canonical weak portion and weak-verse counter together. Preparation is non-mutating and checks durable source reads before enqueue.
- PR #45 merged as `ee94a199fd354f3680807f0dbf8aa5da5e8adc6f`: weak-verse resolution is journal-first, idempotent, and does not alter canonical portion rating or schedule.
- PR #43 exact-head runs `42258043045` (PR) and `42258032606` (push) passed on `73faac0434cf626c6d55907f579aa245ba037a1e`; post-merge main run `42258433095` passed on `dc258764723b4d88635175c912d159e6adaacf4b`.
- PR #44 exact-head runs `42260702702` (PR) and `42260691784` (push) passed on `d01d31605204ebb50ff93467d4739323f280b5ed`; post-merge main run `42261020224` passed on `0a24862e255946ea487e120cd6d82f5a3c81eb20`.
- PR #45 exact-head runs `42261861919` (PR) and `42261851120` (push) passed on `e2a28de43cc4f31176883af8022a34cb2e1ec773`. Post-merge main Quality Gate `42262136009` **passed** on the exact main SHA above.
- Vercel Production deployment for the current main SHA is **not confirmed**. GitHub Actions success is not a deployment receipt.

## Phase 2 status — IN PROGRESS

The IndexedDB journal, outbox, sequencing, replay, grouped projection rollback, and several journal-first mutation paths are implemented. This is not full mutation coverage and is not cloud sync.

**Still not journal-first / not complete:**
- Revision ratings and their grouped portion + optional weak-verse + activity/profile updates.
- Memorization/session completion, including activity logs and profile streak.
- All remaining activity/profile aggregate mutation paths.
- Backup import/reset and recovery semantics when pending journal events exist.
- Complete immutable event semantics for activity, revision, weak-verse, and test records. Current weak-verse and test flows still journal full local snapshots; do not describe them as immutable cloud event models.
- Firestore client/repository, sync worker, server acknowledgements, retries/backoff, tombstones, collection-specific security rules, and two-device/offline sync.
- Production Firestore rules deployment, manual responsive/accessibility/audio QA, and verified Vercel Production deployment.

## Next implementation sequence

1. Journal-first revision ratings: prepare the SM-2 portion snapshot without writes, include optional weak-verse failure and activity/profile snapshots in one grouped journal transaction, and preserve stable retry identity.
2. Journal-first memorization/session completion: group canonical portion, activity log, profile streak, and any related plan updates as one recoverable action.
3. Journal backup import/reset with explicit ordering, pending-event handling, and crash/recovery tests; never clear or overwrite an unprojected event.
4. Reconcile mutable local aggregates with immutable event-ledger semantics before defining their Firestore representation.
5. Implement the Firestore adapter/worker, acknowledgements, retries, tombstones, collection-specific rules, and two-device/offline tests. Keep cloud writes inactive until the release gate passes.
6. Complete manual UI/audio/accessibility QA and verify an actual Vercel Production deployment for the exact main SHA.

## Branch and release safety

- Start new work from the freshly fetched `main` SHA and use independent feature branches.
- Compare every old or open branch against current main; never merge divergent branches wholesale.
- Do not activate Firestore production writes or deploy production rules without explicit approval.
- Do not claim release readiness until all mutation paths, two-device/offline tests, manual QA, and exact-SHA production deployment are verified.

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
