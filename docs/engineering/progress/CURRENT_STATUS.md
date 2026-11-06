# WIRD — Current Engineering Status

**Updated:** 2026-11-06 after PR #53 and the latest main Tafsir commit  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Canonical branch:** `main` (Google AI Studio source)  
**Latest main SHA:** `dee0e7a926700092e3d4b3e5fd63e74565428de0`

## Latest completed work

- **PR #49** — Quran reader/Tafsir route repair and direct Surah-to-Mushaf navigation; merged as `15979e4a009ef0aa5b4981cbcbb4f2124f25dfc3`; exact-head Quality Gate `42267849373` passed.
- **PR #50** — Journal-first session completion for memorization progress, activity, and profile streak; merged as `dacba8298db954392f7fbcbbf10af9f18ecc31dc`; exact-head Quality Gate `42276148126` passed.
- **PR #51** — Matching smart-plan task included in the same session transaction; merged as `99c466b9de6ae977979f8989443fba5b94017a30`; exact-head Quality Gate `42276561011` and post-merge main run `42276748346` passed.
- **PR #52** — Backup import and factory reset journal-ordered; merged as `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`; exact-head run `42277464313` and post-merge main run `42277666291` passed.
- **PR #53** — Removed unused direct-write handlers and refreshed engineering checkpoints; merged as `87c4ec4456c69e35e1d62a368c97a5992d0309ac`; exact-head run `42278253060` and post-merge main run `42278457062` passed.
- Latest main also contains commit `dee0e7a926700092e3d4b3e5fd63e74565428de0` adding multiple Tafsir sources/book IDs. No GitHub Actions workflow run was found for that exact direct main commit at checkpoint time; the PR #54 Quality Gate will test against this latest base.

## Deployment status

- Vercel still reports `build-rate-limit` / `api-deployments-free-per-day`.
- Per the owner's explicit instruction, this is not a merge blocker for tested changes.
- It is not a successful deployment receipt. Production deployment and live browser verification remain unconfirmed.

## Phase 2 — local data reliability

Completed and merged:
- Profile/plans, canonical page progress, manual portions, test snapshots, weak-verse failure/resolution, and revision rating paths use journal-first persistence.
- Session completion groups memorization progress, activity/profile streak, and matching smart-plan task into one recoverable event.
- Backup import/reset replay older pending events first and apply grouped snapshots through the journal.
- App-level unused direct local-only session/revision handlers have been removed.

Still open:
- Finish file-by-file audit of legacy APIs and development-only demo loaders.
- Review legacy localStorage outbox migration against explicit reset and IndexedDB-loss scenarios.
- Add failure-injection coverage for IndexedDB unavailable/blocked states, quota/read failures, rollback verification, and reload recovery.
- Define immutable domain-event semantics and deterministic aggregate derivation before cloud sync.

## Phase 3 — domain event model

- Current PR branch introduces a versioned, typed `domainEvent` envelope attached to append-only IndexedDB journal entries.
- Event types covered: `session.completed`, `revision.rated`, `test.completed`, `weak_verse.failed`, and `weak_verse.resolved`.
- Event identity must equal the journal mutation ID; semantic payload validation rejects malformed records before enqueue.
- Session/revision/weak-verse retry paths preserve event ID and timestamp; test event timestamps derive deterministically from the test date.
- This is **local journal metadata**, not yet a separate Firestore event collection or remote sync implementation.

## Remaining cloud/release work

- Firestore client/repository, sync worker, remote acknowledgements, retries/backoff, tombstones, collection-specific rules, and two-device/offline tests are not implemented.
- Production Firestore rules deployment and Vercel Production deployment are not verified.
- Do not enable cloud writes, deploy production rules, or perform destructive migrations without explicit approval.

## Next implementation sequence

1. Complete remaining local mutation and recovery audit, including legacy outbox/reset behavior.
2. Finish and merge the typed domain-event envelope after exact-head Quality Gate and second review.
3. Define event-ledger/aggregate derivation and record-level Firestore document mapping.
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
