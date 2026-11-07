# WIRD Sync Release Gates

## Latest verified update — PR #157 merged (2026-11-07)

- Current main merge SHA: `22fdd996d7aabc0669fef504c50970d5ba015d73`.
- PR #149 merged as `78ada24ecadbda3460178550e871632f6d81d770`; exact head `c675a2d164b88994c08a5368bf1695712f2625f3` passed Quality Gate run `42368745026` (#2871), implementing use-latest-remote.
- PR #155 merged as `c620697538ef72eec3d1c2c78bb456c0403232ce`; exact head `1d4ea9d5acb5be0179af6935f79c4a100fab1ecf` passed Quality Gate run `42370175733` (#2909), implementing a narrow confirmed keep-local path for supported single-collection upserts.
- PR #156 merged documentation/checkpoint maintenance as `12d4efa62692615defa56cb0bef27b36e4ecc2a8`.
- PR #157 merged as `22fdd996d7aabc0669fef504c50970d5ba015d73`; exact head `b2752297842d6fd30d7b4ae86eb33d48585e9ce8` passed Quality Gate run `42372550605` (#2977): 551 automated assertions, Firestore Rules Emulator 31/31, approved Quran audio CDN/range probes 8/8, TypeScript, production build, server smoke, and desktop/mobile Playwright 30/30.
- PR #157 adds V2 per-device monotonic increment components and reset watermarks for Ruqyah progress. Compatible V2 snapshots merge component-wise by max, preserving independent offline increments and making repeated delivery idempotent. Concurrent resets of the same observed baseline do not double-subtract; increments not observed by a reset survive.
- V1 snapshots migrate through a shared `legacy` baseline. Different non-zero legacy values are ambiguous because pre-V2 offline increments cannot be reconstructed; those conflicts remain archived and blocked rather than being merged by max or sum. Valid pending V1 Outbox entries are superseded by a validated V2 full snapshot while immutable journal events remain preserved.
- Repository Firestore Rules now require a complete V2 Ruqyah snapshot for new writes, preventing old V1 clients from overwriting V2 components. Production Firestore Rules deployment is not verified.
- User-authored/grouped merge, tombstone/delete semantics, cross-tab/account lifecycle stress, and real-device production sync remain open. Both production sync flags remain disabled.
- Vercel still reports `build-rate-limit`; no live production deployment or production playback is claimed.

A release gate is passed only with evidence on the exact candidate SHA.

## Required before enabling production sync

- [ ] All active user mutation paths are journaled and audited.
- [ ] Firestore rules are deployed to the intended production Firebase project and verified to match the transaction contract.
- [ ] Emulator-backed two-device contexts cover all eight populated collection routes and Ruqyah progress in both directions; real-device browser/device E2E is still required.
- [ ] Offline retry, idempotent replay, timeout-after-acceptance, and restart tests pass.
- [ ] Same-document stale revision conflicts preserve both versions and have tested resolution paths. Use-latest-remote is implemented by PR #149; narrow keep-local re-publication for supported single-collection upserts by PR #155; compatible V2 Ruqyah counter merge by PR #157. Divergent legacy baselines, grouped syncMeta decisions, and user-authored merge remain open.
- [ ] Tombstone projection, offline deletion, stale update rejection, and safe retention/compaction are implemented and tested.
- [ ] Cross-tab sync serialization is tested in independent real browser contexts.
- [ ] Account switch/logout/reinstall/schema migration tests pass.
- [ ] Playwright desktop/mobile app-shell smoke and Ruqyah locator-library checks pass; full auth/CRUD/sync/two-device browser E2E remains outstanding.
- [ ] Load/stress tests cover expected queue sizes and bounded retry behavior.
- [ ] Remote projection and upload feature flags are reviewed and explicitly configured.
- [ ] Production deployment is tied to the exact candidate SHA and a live URL smoke test passes.

## Current release decision

**Not approved for full production cloud-sync activation.** The current verified work includes populated multi-record service round trips across all eight collection routes, document-scoped projection guards, a bounded local-mutation conflict evidence archive, use-latest-remote (PR #149), supported single-collection keep-local (PR #155), and compatible V2 Ruqyah counter convergence (PR #157). PR #157 passed 551 automated assertions, 31/31 Firestore Rules Emulator tests, 8/8 Quran audio CDN probes, TypeScript, production build, server smoke, and 30 desktop/mobile Playwright tests on its exact head. These are meaningful automated gates, not live-device or production proof. Divergent V1 legacy baselines remain archived and blocked; user-authored/grouped merge, tombstones, long-offline/cross-tab stress, full auth/sync browser journeys, production Firestore Rules deployment, and exact-SHA live deployment remain open. Keep production sync flags disabled.


## New evidence since the initial checkpoint

PR #81 added a bounded UID-scoped durable archive for blocked remote projection conflicts and Settings diagnostics. Exact-head PR CI passed with 459 automated assertions, Firestore Rules Emulator 27/27, TypeScript, production build, dependency audit, and production startup smoke. Post-merge main run `42351965332` passed on `059e902194811be71ab4dea9da8609a96967214e`.

This closes the conflict-evidence preservation gap, but not the resolution gate. Production sync remains not approved.


## PR #85 update

Atomic conflict reconciliation is now implemented: an open archive record is marked reconciled in the same IndexedDB transaction as cursor advancement and inbox deletion, with event fingerprint/inbox validation and bounded snapshot size. PR #85 exact-head CI passed (462 assertions, 27/27 Firestore Rules, TypeScript, build, dependency audit, startup smoke); post-merge main run `42352594819` passed on `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.

Still not approved for production sync: user-directed conflict choices/merge/rebase remain absent, tombstone projection remains blocked, two-device tests cover a limited collection set, and live Vercel/production rules verification remains outstanding.

## 2026-11-07 checkpoint update

The following remain release blockers and must not be waived:

- User-authored merge semantics, deterministic additive Ruqyah counter merge, tombstone/delete resolution, cross-tab/account lifecycle isolation, durable decision history for additional decision types, and live multi-device verification. Narrow use-latest-remote and supported keep-local decisions are implemented by PRs #149 and #155.
- Collection-specific tombstone projection, stale-event rejection, offline deletion and safe retention/compaction.
- Multi-collection two-device coverage is now exercised in isolated Emulator-backed service contexts across all eight populated collection routes, including multi-record preservation. Simultaneous concurrent merge, long-offline replay, and real-device verification remain outstanding.
- Cross-tab concurrency in independent real browser contexts and account-switch/logout/reinstall isolation.
- Collection-specific Firestore payload validation and negative authorization tests, plus confirmation that production rules match the candidate.
- Exact-SHA production deployment and post-deploy browser smoke. Vercel build-rate-limit failures are not deployment evidence.
- Ruqyah progress is present in the revisioned collection model, but keep-local resolution is disabled for this collection until a deterministic additive counter model and two-device increment tests are implemented.
- Main checkpoint SHA at this update: e894140c91ec8086d111989dcdb601d3cdbf9ce4. Post-merge CI run 42354517460 was still in progress; recheck before release.

## 2026-11-07 — Updated after Ruqyah sync integration

- Ruqyah progress is now in the revisioned collection model and version-5 backup. PR #94 must close the legacy first-sync scan gap and pass concurrent-offline conflict-preservation tests.
- Concurrent Ruqyah counter increments are not yet additively merged. Stale writes must remain blocked and both snapshots retained; production activation remains prohibited until the data model can preserve and resolve independent increments deterministically.
- Narrow use-remote and supported keep-local conflict choices now revalidate the server revision and preserve Outbox/archive evidence (PRs #149/#155). User-authored merge/rebase, additive Ruqyah counter semantics, and tombstone resolution remain release blockers.
- Tombstone projection remains blocked. Do not remove the guard until delete semantics, stale-event rejection, offline delete, resurrection prevention, and retention/compaction are tested per collection.
- Cross-tab browser concurrency, full collection coverage, account lifecycle isolation, production Firestore rules deployment, and exact-SHA live deployment/post-deploy smoke remain blockers.
- Main checkpoint SHA: f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Main Quality Gate run 42355600523 passed; this does not verify production deployment.

## 2026-11-07 — Deployment workflow checkpoint

- Current main SHA 8089579d020a6a4831cdc9ba4f25f8672f30cc3d passed Main Quality Gate run 42356505550.
- PR #98 added a manual-only, main-only, typed-confirmation workflow that deploys only Firestore rules. It has not been dispatched; no production rules deployment is claimed.
- PR #100 is open to add a Firestore Emulator preflight to the manual deploy workflow. Do not dispatch until this preflight is merged and explicit deployment approval is given.
- Current main Vercel status is build-rate-limit failure; production alias and deployed SHA are unverified.
- Do not set VITE_WIRD_REVISIONED_SYNC_ENABLED or VITE_WIRD_REMOTE_PROJECTION_ENABLED until manual conflict resolution, additive Ruqyah counter merge, tombstones, cross-tab concurrency, account isolation, and live two-device verification pass.

## 2026-11-07 — Updated after PR #104/#106/#105

- PR #104 adds a UID-guarded read-only conflict inspector. Manual keep-local/use-remote/merge/rebase remains a blocker.
- PR #106 adds bidirectional A ↔ B revisioned projection across eight collection routes and exact-head Emulator/CI coverage. Six collection arrays remain empty in the fixture; populated domain-record serialization is still a blocker.
- PR #105 restricts external Ruqyah API use to Quran reference indexing, keeps educational topics disabled, and blocks unverified recitation audio. The source policy is documented; PR #108 adds an exact source registry and must be reviewed for ID-to-reference binding and `g-4` health guidance attribution.
- Current main SHA: `d71908b3e411bcd7d1db2b09318eb3c95564198e`; Main Quality Gate `42357565644` passed (509 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, build, startup smoke).
- Vercel remains failed with `build-rate-limit`; production deployment/live SHA is not verified.
- Remaining blockers: manual conflict resolution, deterministic additive Ruqyah counter merge, tombstone projection/retention, real multi-tab/browser concurrency, in-flight account lifecycle isolation, populated multi-collection records, Playwright E2E, production rules deployment, and exact-SHA live deployment/post-deploy smoke.
- Keep both remote sync flags disabled and do not dispatch the manual rules workflow until explicit approval and all gates pass.

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
- Subsequent main work: PR #117 removed dormant unverified audio playback code (merge SHA `673ddfcb5af046f785e2da18abc73c4a1bba2339`; exact-head run `42359507976`, 518 assertions and 31 rules tests passed). PR #120 hardened signed Quran coordinates and provider IDs (merge SHA `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`; exact-head run `42359703038`, 520 assertions and 31 rules tests passed).
- PR #115's browser test branch failed only during Playwright browser installation because Ubuntu 26.04 is unsupported by Playwright 1.56.1; its test/config files were reapplied on current main in PR #122 using Ubuntu 24.04. PR #122 remains under exact-head CI; browser smoke is not yet claimed passed.
- PR #118 was closed as a duplicate of already-merged PR #117 after confirming the 360-line playback removal is already on main. PR #113's older Ruqyah checkpoint is being superseded by PR #121; its release checklist changes are being preserved there.


- PR #111 merged as `48cf9b236072cd3db2603a57cda5f67b30a778cd`. It restricts IslamicAPI to validated Quran locator coordinates; displayed Quran text and metadata resolve from WIRD's canonical corpus. Duplicate PR #112 was closed after all code/test files were confirmed identical to main and its only remaining difference was stale checklist wording.
- PR #114 merged as `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`; exact PR head `9ff200bc731ac99db0d662f76dad97b370d00c9b` passed both push and pull-request Quality Gate runs `42359408488` and `42359412200`.
- Exact-head evidence: 513 automated assertions passed, 31 Firestore Rules Emulator tests passed, dependency audit passed, TypeScript passed, production build passed, and production/development server startup smoke passed.
- PR #114 replaces empty fixtures for plans, enginePlans, portions, weakVerses, tests, and activityEvents with valid non-empty domain records. All eight collections now have populated fixtures. The Emulator test performs sequential A → B → A projection with distinct B-side edits and compares complete local projection records and remote payload fields, plus revision 1/2.
- This does not prove simultaneous concurrent merge for every collection, long-offline replay, real-browser cross-tab behavior, or Playwright/device E2E. It closes the empty-record serialization/round-trip gap documented under PR #101/#106.
- Current main SHA: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`. Post-merge Main Quality Gate run `42359547235` completed successfully on `8ac5d87d84077f209eaf49881dd1354ce10d3565`.
- Vercel status remains `build-rate-limit`; this is a provider deployment quota failure, not a successful deployment. No production Firebase rules deployment, live deployed SHA, live two-device verification, environment-variable change, secret change, or production sync activation is claimed.
- PR #2 remains a draft and is 115 commits ahead / 266 behind current main; do not merge it wholesale. Review and selectively reapply any still-useful changes only.
- Next priority: design and implement an idempotent user-directed conflict-resolution state machine with durable preservation and latest-revision revalidation; then tombstone semantics, additive Ruqyah counters, cross-tab/Playwright, and account lifecycle stress tests. Keep production sync gates disabled.


## 2026-11-07 — populated multi-record sync, Playwright, and conflict-evidence checkpoint

- Current main at checkpoint: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`.
- PR #122 merged as `beec50a623febdfa79f286f7c2b87d8234b2b150`; exact head `945c0f73e965d0111d46c53179465ee4c98fb83a` passed six Playwright app-shell checks (three desktop, three mobile Chromium/iPhone 13 viewport emulation). Post-merge main run `42360161749` passed.
- PR #125 merged as `ceebd11995bece572d40230ab084858be5a40cf2`; exact head `b24e0eb8221c23498878ee0a58727990ad9f2dfd` passed 521 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright checks. Post-merge main run `42360526021` passed.
- PR #126 merged as `802811d45a6d7e977d3b4082fd08ebf5e95151fa`; exact head `9886ca8a090cf07f04b51943fbc254a4b98ce221` passed 521 automated assertions and 31 Firestore Rules Emulator tests plus the remaining Quality Gate steps, including Playwright. Post-merge main run `42360725981` passed.
- PR #129 merged as `ab1a2cd04a1456a6430985ce6f6e72a1b137907d`; exact head `334a73a05bddc4d574cdf8c25a0299f329b22c49` passed 525 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright app-shell checks. Its post-merge main run was cancelled when the subsequent documentation-only PR #130 updated main; current main Quality Gate run `42361224358` is the relevant post-merge validation and was in progress at this checkpoint.
- PR #129 makes normal remote projection and the final IndexedDB cursor/revision transaction document-scoped. Same-document pending writes still block; unrelated test-result documents can progress independently. Grouped `syncMeta` transactions retain collection-wide guards.
- PR #126 adds durable pending local mutation evidence to Conflict Archive, including mutation IDs, fingerprints, base revisions, sequence numbers, and payloads. Repeated observations append by mutation ID; a fingerprint mismatch or combined snapshot size above 500 KB aborts without deleting inbox/outbox entries or advancing the cursor. Settings displays at most ten archived mutation payloads while retaining the full archive.
- This is not yet a user-directed conflict-resolution state machine: keep-local, use-remote, safe merge, and revision revalidation actions remain unimplemented. Tombstones, additive multi-device Ruqyah counters, full auth/sync browser journeys, real two-device verification, and production deployment remain release blockers.
- PR #127 added 10 Ruqyah locator-library browser checks (five desktop and five mobile); combined with six app-shell checks, the full Playwright suite has 16 tests; PR #130 refreshed the Ruqyah checkpoint and release checklist after CORS hardening and locator-library E2E. These browser checks do not replace live Firebase/device tests.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit` on reviewed main updates. No live deployed SHA, live two-device verification, Firebase production-rules deployment, secret/environment-variable change, or production sync activation is claimed.
- PR #2 remains a draft, 115 commits ahead / 276 behind current main. Do not merge it wholesale.
- Next: implement deterministic additive Ruqyah counter reconciliation and collection-specific tombstone/delete semantics; then grouped syncMeta resolution, cross-tab/account lifecycle stress, broader Playwright workflows, backup/restore stress, and live two-device tests.


## Historical release-gate decision at the PR #129 checkpoint (superseded by PR #155)

The desktop/mobile Playwright app-shell baseline is now merged and passing (PR #122: 6/6 checks); the Ruqyah locator-library browser suite is also merged (PR #127: 10 locator-library checks (five desktop and five mobile)). PR #125 adds populated multi-record coverage across the eight data collections. PR #126 preserves pending local mutation evidence on conflicts, and PR #129 makes projection guards document-scoped for ordinary events while retaining collection-wide syncMeta protection.

**At this historical checkpoint, release remained blocked.** PRs #149/#155 later implemented narrow use-remote and supported keep-local decisions. User-authored merge, tombstones, additive Ruqyah increments, full auth/CRUD/two-device browser journeys and real Firebase live verification remain outstanding; production rules are not claimed deployed; Vercel deployment remains rate-limited. Do not enable production sync flags.
