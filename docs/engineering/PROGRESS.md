# WIRD — Engineering Progress Checkpoint

**Date:** 2026-11-07  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Main SHA at latest checkpoint:** `8ac5d87d84077f209eaf49881dd1354ce10d3565`

## Completed and merged in this work segment

- PR #73 — durable remote projection crash recovery; merge SHA `cc887a6bfa07aec880f495221e64dd36edb14ca8`. Exact PR CI and post-merge main run `42350476806` succeeded.
- PR #77 — bidirectional profile sync integration between two isolated devices using Firestore Emulator, independent IndexedDB, and independent localStorage; merge SHA `716cf301bff9a8c7777ee3931dba6366a01afe3b`. Exact PR CI succeeded; emulator reported 26/26.
- PR #78 — offline same-document stale revision conflict test; merge SHA `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`. Exact PR CI succeeded; 450 automated assertions and 27/27 Firestore Rules Emulator tests passed.

## Current engineering state

- Crash recovery intent is durable and finalization is atomic with cursor/revision/inbox completion.
- Profile collection bidirectional device-to-device flow has an emulator-backed integration test.
- Same-document stale offline mutation is rejected by server revision; losing local mutation and remote inbox event are preserved; projector blocks and does not advance cursor.
- Tombstones are intentionally blocked from projection. Safe collection-specific deletion and tombstone retention/garbage collection are not implemented.
- Conflict detection/preservation is implemented; a dedicated conflict record and user-facing resolution/rebase flow are not.
- `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are explicit gates. Production values have not been inspected; do not assume sync is enabled.
- Production Firebase rules deployment is unverified.
- Vercel reports `build-rate-limit`; production deployment of current main and live URL smoke are unverified.

## Exact-head test evidence

| Candidate | Automated suite | Firestore Rules Emulator | TypeScript | Build | Startup smoke |
|---|---:|---:|---|---|---|
| PR #77 head `7d92b0e` | 450/450 | 26/26 | Pass | Pass | Pass |
| PR #78 head `9144a25` | 450/450 | 27/27 | Pass | Pass | Pass |

PR #78's post-merge main run was queued at checkpoint and must be rechecked.

## Open PRs / branches at checkpoint

- PR #73: merged.
- PR #77: merged.
- PR #78: merged.
- Documentation checkpoint branch: `docs/sync-engineering-state-20261107` (this change).
- Re-fetch live GitHub state before relying on this list.

## Next work, ordered by risk

1. Implement and test explicit conflict persistence and user-controlled resolution/rebase; do not silently drop pending local work.
2. Implement collection-specific tombstone projection with durable tombstone ledger, stale-event rejection, and safe retention rules.
3. Expand two-device integration to all collections and test same-document concurrent field changes / independent documents.
4. Test multi-tab locks, upload timeout-after-acceptance, retries/backoff, and long offline queues.
5. Audit account lifecycle, logout/switch/reinstall, schema migration, and session expiry.
6. Add Playwright E2E with independent browser contexts.
7. Verify production rules deployment and exact-SHA Vercel deployment only after release gates pass.

## Safety

No production data, rules, credentials, service accounts, environment variables, or Vercel settings were changed. No production sync activation was performed.


## Additional milestone — PR #81

- PR #81 merged as `059e902194811be71ab4dea9da8609a96967214e`.
- Added IndexedDB v8 UID-scoped `projectionConflicts` archive, bounded at 100 records per UID.
- Blocked projection archives the remote event and exact relevant local snapshot. Repeated observations preserve the original snapshot. Open records are never pruned; only resolved records may be pruned.
- Cloud sync diagnostics and Settings show open conflict count and latest conflict summary.
- Exact-head CI on `415cbe33389a6108d08f9d5785818e8e12458fee`: 459 automated assertions passed, 27 Firestore Rules tests passed, TypeScript/build/startup smoke/dependency audit passed.
- Post-merge main CI run `42351965332` passed on the merge SHA.
- The older PR #76 was closed as superseded by #81. PR #59 was closed as superseded by the revisioned sync work; its legacy serverTimestamp envelope was not merged.

## Updated current state

- Durable conflict evidence is now archived. Conflict resolution/rebase and user controls are still missing.
- Tombstone projection remains intentionally blocked.
- Two-device integration still covers profile upserts and a same-document offline conflict; it does not prove all collections or real-browser contexts.
- Production Vercel check remains `build-rate-limit`; live deployment unverified.


## Atomic conflict reconciliation milestone — PR #85

- PR #85 merged as `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- Conflict archival now verifies inbox/event identity and fingerprint, enforces a 500 KB snapshot cap, and refuses orphan records.
- `finalizeRemoteProjection` and `markRemoteProjected` resolve matching open conflict records atomically with cursor advancement and inbox deletion. Late archive attempts after cursor advancement cannot create orphan open conflicts.
- Projector archives blocked, mismatched-intent, prepare-failure, and finalization-failure paths. Settings shows localized reason and collection details.
- Exact PR head `b6af08b2d9461a1d3d7cc019404692d779500248`: 462 automated assertions passed; Firestore Rules 27/27; TypeScript/build/dependency audit/startup smoke passed.
- Post-merge main run `42352594819` passed on `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- PR #82 and PR #86 closed as superseded by #85; PR #85 is the merged source of truth for atomic conflict reconciliation.

## Updated limitations

- The archive's `reconciled` state means the corresponding event was safely projected/cursor-committed; it does not represent a user choosing local vs remote data.
- Manual conflict resolution/merge/rebase UI remains absent. Tombstone projection remains blocked. Profile-only two-device integration and one same-document offline conflict test do not certify all collections or physical devices.
- Vercel still reports `build-rate-limit`; current main is not verified as deployed.

## 2026-11-07 — Live continuation checkpoint after PR #89

- Re-fetched repository state; the checkpoint SHA from the earlier section is historical. Current main at this checkpoint: e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- PR #62 merged as 8535802d3609c854b1c91742135c84894e5e074f. Exact-head Quality Gate 42342109962 passed; post-merge Main Quality Gate 42354256341 passed on that exact merge SHA.
- PR #89 merged as e894140c91ec8086d111989dcdb601d3cdbf9ce4, reapplying the audio repeat fix from stale PR #63 onto current main. Exact-head runs 42354410219 and 42354399498 passed. PR #63 was closed as superseded; its divergent branch was not merged.
- Post-merge Main run 42354517460 was still in progress when this checkpoint was written. Recheck it against the exact main SHA before claiming post-merge CI success.
- PR #88 Ruqyah integration is merged at 6af7ce1d27543429911ca686550bc26f446ec2e0; Main run 42354021822 passed. Ruqyah progress currently persists in UID-scoped local storage only; it is not yet part of the cloud sync collection/projection model.
- A separate branch feat/ruqyah-cloud-sync-20261107 is under active development. Its observed exact-head run 42354431882 failed: 491 passed / 3 failed because StorageService.saveRuqyahProgressSnapshot was called but is not implemented. Do not merge that branch based on allowlist changes alone. Re-fetch its latest head and checks before any action; later commits may have changed it.
- Important design gap: Ruqyah counters are mutable per-item totals. A cross-device merge policy (per-device counters or immutable increment events) is not defined. Do not sync a whole counter snapshot with last-write-wins semantics because concurrent increments can be lost.
- Existing cloud-sync release blockers remain: no user-facing keep-local/use-remote/merge/rebase workflow; tombstone projection blocked; two-device coverage is profile-only plus one offline conflict; all-collection, cross-tab browser, account-lifecycle and production rules/deployment verification remain outstanding.
- Vercel still reports a daily build-rate-limit status. No current-main production deployment or live URL smoke is claimed.
- No production data, Firebase rules deployment, secrets, Vercel settings, or remote-sync flags were changed.

## 2026-11-07 — Live checkpoint after Ruqyah sync and accessibility merges

- Current main checkpoint: f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Main Quality Gate run 42355600523 passed on this exact SHA.
- PR #91 merged at a618036b995ff45749748e90e2a4d3ec1037c838. It adds UID-scoped journal-first Ruqyah progress sync, revisioned Firestore writes, two-device sequential projection, and backup version 5 support. Its exact-head run 42355023151 passed.
- PR #93 merged at f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Its exact-head run 42355488786 passed 500 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build, and server startup smoke.
- PR #92 merged at bd6fc3a79267ee7136746fed17c58a6ceac8b58c. It protects unversioned canonical portion archives, prevents direct writes during pending legacy migration, validates duplicate portion IDs/coordinate ranges, generates stable IDs for legacy history rows without IDs, and preserves validated backup import/migration paths. Exact-head run 42355486226 passed.
- PR #94 is under review on branch fix/ruqyah-first-sync-collection-scan-20261107. It adds Ruqyah to the coordinator legacy-state scan and a true concurrent-offline conflict test. Do not merge until exact-head tests, Firestore emulator, TypeScript, build, and startup smoke all pass.
- Ruqyah progress is now part of the revisioned sync path, but its aggregate counters still do not have a deterministic additive merge policy. Concurrent offline increments are safely blocked and archived, not automatically merged. Manual conflict-resolution UI remains absent.
- Current release blockers remain: user-facing conflict resolution (including merge/rebase), safe tombstone projection, cross-tab/browser concurrency, full collection coverage, account lifecycle isolation, production Firestore rules deployment, and exact-SHA production deployment/live smoke.
- Vercel production deployment remains unverified because of build-rate-limit quota failures. GitHub Actions success is not deployment evidence.
- No production secrets, environment variables, Firebase rules deployment, real user data, or remote-sync flags were changed.

### Subsequent checkpoint update — PR #95 merged

- PR #95 merged at 52e62d6b21057cf0d796cc3b137f4087cbe2e983. Its exact-head Quality Gate passed on c2e9478f6053ddc95aaa5058d7a5ab074255d58b; the merge adds post-success Ruqyah progress notifications for direct backup import and full reset, with rollback-safe notification timing.
- Main Quality Gate run 42355938085 was in progress on 52e62d6b21057cf0d796cc3b137f4087cbe2e983 when this note was added; verify its final conclusion before the next release decision.
- PR #94 was created against the previous main SHA f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Its changes are disjoint from PR #95, but re-check mergeability and exact-head CI after main advanced.
- PR #96 documents the global stop condition: do not set remote-sync flags until manual conflict resolution, additive counter merge, tombstones, cross-tab coordination, account isolation, and live verification all pass.

## 2026-11-07 — Current main checkpoint after PR #98

- Current main SHA: 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. Main Quality Gate run 42356505550 passed on this exact SHA.
- PR #97 merged at 217f7136244d4d7afd02a9c52be86f520c1baefa. It adds the server-side IslamicAPI proxy, strict topic block allowlisting, disabled-by-default educational topics, and bounded streaming response reads. Exact-head runs 42356248195 and 42356243586 passed.
- PR #98 merged at 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. It adds a manual-only, main-only, typed-confirmation Firestore rules deployment workflow. It has NOT been dispatched and does NOT mean production rules are deployed.
- PR #100 is open to add a Firestore Emulator preflight before credentials are written or the deploy command runs. Do not dispatch the current manual workflow until this preflight is merged and explicit deployment approval is given.
- Current main Vercel status is failure with build-rate-limit on SHA 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. A previous SHA f2c3f32f had Vercel success, but that does not establish that latest main is deployed. Production alias and live SHA are unverified.
- PR #94 merged the Ruqyah legacy first-sync scan and a concurrent-offline conflict-preservation test. This proves safe blocking/archive retention, not additive counter merge.
- Keep VITE_WIRD_REVISIONED_SYNC_ENABLED and VITE_WIRD_REMOTE_PROJECTION_ENABLED disabled until manual conflict resolution, deterministic Ruqyah additive merge, tombstone semantics, cross-tab concurrency, account isolation, and live two-device verification pass.
- No production rules deployment, production secret update, Vercel setting change, or remote-sync activation occurred.

## 2026-11-07 — Main checkpoint after bidirectional sync and Ruqyah source hardening

- Current main: `d71908b3e411bcd7d1db2b09318eb3c95564198e`. Main Quality Gate run `42357565644` passed on this exact SHA: 509 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and production-server startup smoke.
- PR #101 merged at `014d958dd358b3a98e7ac67db7c4a57d241fbc52`. It adds A → B projection coverage through all eight collection routes. Its first version used empty arrays for six collections; this limitation is documented rather than overstated.
- PR #103 merged at `c8e420573a588e22b78bf8f3702fb9812a3f282d` and corrects the matrix: PR #101 was one-way and did not validate populated records in six arrays.
- PR #104 merged at `46ed9e5976b2f22f2495a270edf8c2255e27962b`. Settings now shows a read-only view of preserved local/remote conflict snapshots, guarded by exact active UID scope. It does not resolve conflicts.
- PR #106 merged at `14390679530f5a523a77997d882f12160c3ad1c9`. It adds the reverse B → A pass through all eight collection routes, revision 2 checks, and full ordered event stream projection. Exact-head runs `42357426174` and `42357436438` passed; 510 unit assertions and 31 Firestore Rules tests passed. Six collection payloads remain empty arrays, so populated-record serialization is still unverified.
- PR #105 merged at `d71908b3e411bcd7d1db2b09318eb3c95564198e`. It restricts IslamicAPI to Quran reference indexing, renders Quran text only from WIRD's verified corpus, keeps topic content disabled, removes unverified optional religious content, and disables unverified full-program and individual-verse Ruqyah audio. Exact-head CI passed; post-merge Main run `42357565644` passed.
- PR #108 is open for a stricter ID-to-source registry test. Review requested two fixes before merge: map each content ID to its exact source (not a global Set), and replace or explicitly classify the generic `إرشاد صحي عام` source on guideline `g-4`.
- Vercel status for current main remains `failure` (`build-rate-limit` / free deployment quota). No deployed production SHA or live post-deploy smoke is verified.
- Remaining release blockers: keep-local/use-remote/merge conflict state machine, deterministic additive Ruqyah increments, safe tombstone projection, real cross-tab/browser concurrency, account lifecycle race testing, populated domain-record coverage for all collections, full Playwright E2E, production Firestore rules deployment, and verified live deployment.
- Remote sync flags remain disabled for real users. No production secrets, variables, Firebase rules, user data, or deployments were changed.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.


## 2026-11-07 — PR #111 and populated eight-collection sync verification

- PR #111 merged as `48cf9b236072cd3db2603a57cda5f67b30a778cd`. It restricts IslamicAPI to validated Quran locator coordinates; displayed Quran text and metadata resolve from WIRD's canonical corpus. Duplicate PR #112 was closed after all code/test files were confirmed identical to main and its only remaining difference was stale checklist wording.
- PR #114 merged as `8ac5d87d84077f209eaf49881dd1354ce10d3565`; exact PR head `9ff200bc731ac99db0d662f76dad97b370d00c9b` passed both push and pull-request Quality Gate runs `42359408488` and `42359412200`.
- Exact-head evidence: 513 automated assertions passed, 31 Firestore Rules Emulator tests passed, dependency audit passed, TypeScript passed, production build passed, and production/development server startup smoke passed.
- PR #114 replaces empty fixtures for plans, enginePlans, portions, weakVerses, tests, and activityEvents with valid non-empty domain records. All eight collections now have populated fixtures. The Emulator test performs sequential A → B → A projection with distinct B-side edits and compares complete local projection records and remote payload fields, plus revision 1/2.
- This does not prove simultaneous concurrent merge for every collection, long-offline replay, real-browser cross-tab behavior, or Playwright/device E2E. It closes the empty-record serialization/round-trip gap documented under PR #101/#106.
- Current main SHA: `8ac5d87d84077f209eaf49881dd1354ce10d3565`. Post-merge Main Quality Gate run `42359547235` was in progress when this checkpoint was prepared; recheck its final conclusion before claiming main's post-merge gate passed.
- Vercel status remains `build-rate-limit`; this is a provider deployment quota failure, not a successful deployment. No production Firebase rules deployment, live deployed SHA, live two-device verification, environment-variable change, secret change, or production sync activation is claimed.
- PR #2 remains a draft and is 115 commits ahead / 262 behind current main; do not merge it wholesale. Review and selectively reapply any still-useful changes only.
- Next priority: design and implement an idempotent user-directed conflict-resolution state machine with durable preservation and latest-revision revalidation; then tombstone semantics, additive Ruqyah counters, cross-tab/Playwright, and account lifecycle stress tests. Keep production sync gates disabled.
