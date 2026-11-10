## Current operational checkpoint — 2026-11-10 (verified follow-up)

This checkpoint supersedes any older statement below that contradicts the current Production inventory or the owner's direct device test. It is a documentation update only; no runtime code, Firebase rules, production secrets, Vercel settings, or user data were changed.

### Production and user-observed operation

- Current `main` source SHA: `c8f86a4a32e554cf2275dd070d5bf864896e251c`.
- Latest Vercel Production deployment: `dpl_5YVP1Z9rgsgBdzEJsLpxdb8dp52Y`, state `READY`, deployed from the same `main` SHA. This establishes deployment/source parity, not every live feature path.
- Vercel environment inventory was inspected by variable name/target only; secret values were not decrypted or displayed:
  - `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` for Production.
  - `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` for Production.
- Owner-confirmed manual real-device test: authenticated sync was enabled and tested on two devices; the owner reports it is working. Treat the tested two-device path as **owner-reported PASS**. Do not describe the two-device test as absent or unverified. The scope and exact records/operations exercised were not independently captured in an automated trace, so do not generalize this observation to every failure/recovery scenario.
- GitHub Quality Gate run `42762626953` completed with conclusion `success`. The run covered the repository CI suite, TypeScript, Firestore Emulator tests, production build, server smoke, and desktop/mobile browser smoke. CI success is distinct from live production verification.

### Current sync status classification

**Operational baseline: PASS (bounded evidence).** Production flags are on, the current deployment is Ready on current main, and the owner reports successful two-device use. Preserve this working configuration.

**Implemented protections (source-level):** UID-scoped state; durable local-first outbox/journal; revision-checked Firestore writes; ordered immutable remote events; separate inbox/projection processing; auth-scope checks; retry triggers on startup/activity/reconnect; and local transaction boundaries for grouped projection. These are implementation findings, not a claim that every edge case has passed live testing.

**Known limitations / follow-up gates (not evidence that ordinary sync is broken):**
1. Collection-specific tombstone/delete semantics remain deliberately blocked. Do not convert deletes into empty upserts or bypass the guard. Safe deletion requires per-collection semantics, offline replay, stale-update rejection/anti-resurrection, recovery, and retention/compaction.
2. Grouped `syncMeta` **use-remote** is supported through one local journal transaction; grouped `keep-local`/merge is not fully supported and must remain blocked until an atomic grouped rebase/queue path is implemented and tested.
3. Ruqyah V2 compatible snapshots have deterministic component-wise merge/reset-watermark behavior. Divergent legacy V1 baselines remain ambiguous and must be archived/blocked rather than guessed.
4. Cross-tab concurrency, account-switch/logout/reinstall isolation, crash/long-offline replay, queue stress, and complete authenticated production journeys need broader targeted coverage. Existing CI/Emulator tests are not substitutes for these scenarios.
5. Historical audit/worklog statements that both flags were absent, sync was inactive, or the user's two-device test had not occurred are superseded by this checkpoint.

### Safety and change boundary

- Keep both Production sync flags enabled; do not toggle them during documentation or follow-up work.
- Do not change Production secrets, Firebase rules/schema, Vercel protection/settings, or user data without explicit approval.
- Do not claim that CI, Emulator, or a Ready deployment alone proves all live sync behavior.
- Separate owner-reported real-device evidence, automated CI, Emulator coverage, deployment evidence, and untested edge cases in every future report.

---

# WIRD Sync Release Gates

## Latest verified update — 2026-11-10 (automation run 2)

### Source, CI, and Vercel

- Application-code `main` SHA at this checkpoint (before this documentation-only PR): `182aae6a757668eb4c54782601682ba91c3d1251` (PR #191 merge).
- Main Quality Gate run `42716625092` completed successfully on that exact SHA.
- PR #191 (`feat/offline-content-preparation`) merged as `182aae6a757668eb4c54782601682ba91c3d1251`. Exact tested head `1be4df2843326b94b30918b0279161a11dd10838`; PR gate passed 614 assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and 54 desktop/mobile Playwright tests. The offline package caches same-origin JS/CSS (including lazy Quran chunks) only after explicit user action; audio, tafsir, APIs, Firebase/auth, and remote data remain outside the package.
- Vercel Production deployment `dpl_7MrJV9KtkTT2PYEwnij2kXCRnXwW` is `READY` on the exact main SHA and has alias `https://wird-app.vercel.app`. Its build event stream still emits `TS2688: Cannot find type definition file for 'vite/client'` despite completing deployment.
- PR #192 (`fix/vercel-node26-vite-client-types`) remains open. Exact head `bbd7966e1589a5392410e8b4e68a31f60cf1634d`, Quality Gate run `42721449912` succeeded, and preview deployment `dpl_8rDrfF15qnwqGLXjhsttgK2HgGzH` is `READY`. The preview build stream did not contain TS2688. It has not been merged; do not claim the production diagnostic is fixed until the PR is merged and a new production build is checked.

### Firestore rules deployment evidence

- Manual workflow run `42691610063` completed successfully on source SHA `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`.
- The workflow authenticated to the canonical Firebase project `wird-quran-app`, recognized the exact deny-all bootstrap baseline, compiled the reviewed rules, and logged `released rules firestore.rules to cloud.firestore` / `Deploy complete!`.
- The `firestore.rules` blob at that deployment SHA and the application-code `main` SHA at this checkpoint is identical: `6c9cbf1e7a1ebe4325240d751d40aec9efabc760`. This is deployment evidence for the current rules source, not proof of a complete live two-device sync journey.

### Production configuration drift — owner attention required

- Environment-variable names/targets were inspected without decrypting any secret values.
- Both `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are currently `true` for Production. This conflicts with the release policy below: tombstones, grouped `syncMeta` resolution, cross-tab/account lifecycle stress, full offline replay, and complete authenticated production verification are still open. No production setting was changed in this run. Confirm the intended state with the owner before any further activation/deactivation.
- The Ruqyah backend reads only `process.env.ISLAMICAPI_API_KEY`. Vercel currently lists that exact variable for Preview only, while Production has `ISLAMICAPI_API_KEY1`; the suffixed variable is not read by the code. Production Ruqyah index requests may therefore return the explicit missing-key response (HTTP 503). This does not by itself explain the previously reported HTTP 500; no matching `/api/ruqyah` runtime error log was found in the inspected 50-minute window. Add the exact key name to Production and redeploy only through the owner-approved settings workflow; never expose its value.
- Vercel project protection is enabled with `all_except_custom_domains`; the only listed project domain is `wird-app.vercel.app`. No public custom domain is listed. This likely gates the only listed Vercel-managed domain; anonymous public access remains unverified because an anonymous external browser smoke could not be completed. Do not infer public access from a `READY` deployment. No access-protection setting was changed. See [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) and [Deployment Protection](https://vercel.com/docs/deployment-protection).

### Release decision

**HOLD.** The main deployment is Ready, but the production build still emits TS2688, the exact API key target mismatch remains, public access/live smoke is blocked by Vercel protection, and production sync flags are enabled despite incomplete release gates. The offline package improves app-shell availability but does not prove offline sync or audio/API availability. Keep user data local and preserve all existing data; do not alter production secrets, flags, rules, or protection without explicit owner approval.

### Next actions

1. Resolve the exact `ISLAMICAPI_API_KEY` Production target and verify the server proxy response without exposing the key.
2. Obtain the owner's decision on production sync flags and public Vercel access; do not change either setting without authorization.
3. Revalidate PR #192 and its exact-head checks at the next release gate; only merge after review/protection requirements are satisfied.
4. Continue tombstone and grouped `syncMeta` conflict design, cross-tab/account lifecycle tests, and real-device offline replay tests.
5. Keep full-program Ruqyah recordings out of production until content and licensing review is complete.

---

## Historical checkpoint — PR #187 merged (2026-11-09; superseded by the 2026-11-10 update above)

> The following records the state at the PR #187 checkpoint before the later Firestore Rules deployment and before the 2026-11-10 Vercel environment inventory. Use the latest update at the top for current operational state.

- PR #187, **Automatic cloud-sync lifecycle**, merged into `main`. Exact PR head: `fddb169f3ca4192fe8d8136a5e6ba4cd880416da`; merge commit: `898058d492ef8b319972918fc1664151e001bcb2`.
- Exact-head Quality Gate completed successfully: automated test suites, native TypeScript API import checks, approved Quran audio CDN/range checks, Firestore Rules Emulator tests, TypeScript validation, production build, server startup smoke, Chromium installation, and desktop/mobile Playwright smoke tests. No PR review threads remained.
- PR #187 updates `src/services/cloudSyncCoordinator.ts`: an immediate sync attempt follows coordinator startup/pending-count refresh; focus, pageshow, and visible-tab events trigger a retry while online; and triggers received during an active sync are coalesced into a follow-up cycle. Existing mutation-triggered sync, reconnect handling, and periodic retry remain in place.
- Vercel production deployment for merge SHA `898058d492ef8b319972918fc1664151e001bcb2` reached `READY` and received the production alias `https://wird-app.vercel.app`. The build event stream also emitted TypeScript diagnostic `TS2688: Cannot find type definition file for 'vite/client'`, while Vercel nevertheless completed deployment. CI TypeScript validation and production build passed; investigate this Vercel-only diagnostic separately rather than treating READY as proof that the warning is harmless.
- User-reported manual two-device test: a change made on the computer appeared on the iPad after manual sync, and a change made on the iPad appeared on the computer. This verifies the tested bidirectional manual path, not automatic offline recovery.
- **Offline app-shell behavior is not verified.** The user observed that disconnecting the internet causes the browser app to stop working. Therefore, do not ask the user to leave the browser app open offline as a sync test. First inspect PWA manifest/installability, service-worker registration and caching strategy, app-shell/static asset caching, and the offline behavior of required data/API reads. Confirm that local mutations are persisted to IndexedDB/outbox while offline and replay automatically after connectivity returns and the app is reopened or becomes active.
- Automatic reconnect behavior has not yet been proven on a real device. Test separately after offline app-shell capability and offline mutation persistence are confirmed. Distinguish browser/app availability offline from background sync/retry behavior.
- Production Firestore Rules deployment is still not verified. Do not claim it was deployed based on Emulator tests or Vercel deployment.
- Keep `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` disabled until all release gates below are met and the production configuration is explicitly approved. Do not change production flags, secrets, or Firebase rules without the required explicit approval.


## Historical checkpoint — PR #157 merged (2026-11-07)

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

- [ ] All active user mutation paths are journaled and audited end-to-end, including recovery after failed local writes.
- [x] Reviewed Firestore Rules were deployed to canonical project `wird-quran-app` by workflow run `42691610063`; the deployed source commit and current main have identical `firestore.rules` blob SHA `6c9cbf1e7a1ebe4325240d751d40aec9efabc760`. The deployment log confirms release to `cloud.firestore`; a separate post-deploy Rules API readback has not yet been run.
- [x] Emulator-backed two-device service contexts cover all eight populated collection routes and Ruqyah progress in both directions in the previously recorded CI suite. Real-device authenticated browser/device E2E remains required.
- [ ] Offline retry, idempotent replay, timeout-after-acceptance, and restart tests pass in real browser/device contexts. Existing service tests do not replace this end-to-end gate.
- [ ] Same-document stale revision conflicts preserve both versions and have tested resolution paths. Use-latest-remote is implemented by PR #149; narrow keep-local re-publication for supported single-collection upserts by PR #155; compatible V2 Ruqyah counter merge by PR #157. Divergent legacy baselines, grouped syncMeta decisions, and user-authored merge remain open.
- [ ] Tombstone projection, offline deletion, stale update rejection, and safe retention/compaction are implemented and tested.
- [ ] Cross-tab sync serialization is tested in independent real browser contexts.
- [ ] Account switch/logout/reinstall/schema migration tests pass across authenticated browser contexts.
- [x] PR #191 adds opt-in offline preparation for same-origin JS/CSS and passed 54 desktop/mobile Playwright tests, including offline Mushaf opening on desktop and mobile Settings reachability. Audio, tafsir, API, Firebase/auth, and remote data are excluded; real-device offline mutation/replay remains unverified.
- [ ] Load/stress tests cover expected queue sizes and bounded retry behavior.
- [ ] Production upload/projection flags have explicit owner approval and are aligned with the completed release gates. The latest Vercel inventory currently shows both as `true`; this is configuration drift, not evidence that the full gate is passed.
- [ ] Production deployment is tied to the exact candidate SHA and a live URL smoke test passes. The current Production deployment is Ready on main, but external smoke is blocked by Vercel Authentication protection on the only listed `wird-app.vercel.app` domain.

## Historical release decision at the PR #187 checkpoint (superseded by the 2026-11-10 update)

**Not approved for full production cloud-sync activation yet.** Since the PR #157 checkpoint, PR #187 has made sync retries respond to app startup/activity and coalesced in-flight triggers; its exact-head Quality Gate passed, and its merge SHA `898058d492ef8b319972918fc1664151e001bcb2` is deployed to Vercel production with state `READY`. The user has also manually verified bidirectional changes between computer and iPad. These are meaningful improvements, but they do not prove offline-first app operation or automatic offline recovery.

The immediate next engineering task is an offline-capability audit and implementation as needed: inspect PWA/service-worker/app-shell caching; verify that the app can reopen and essential screens/data remain usable without network; verify that offline mutations persist durably to the local journal/outbox; then verify automatic replay after reconnect, app restart, and foregrounding. Do not conflate a browser tab failing to load offline with a sync retry failure. The user's current observation is that the browser app stops working when internet is disconnected, so offline operation is an open issue, not a passed gate.

Other release blockers remain: production Firestore Rules deployment/verification; complete conflict-resolution semantics (including user-authored/grouped decisions and legacy ambiguity handling); tombstone/delete projection and retention; independent-tab concurrency; account-switch/logout/reinstall/schema-migration coverage; long-offline, retry/stress, and full authenticated browser journeys; and real-device automatic/offline sync verification. Keep both production sync flags disabled until the entire gate set is satisfied and production activation is explicitly approved.


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


## Offline/PWA implementation checkpoint — PR #189 merged (2026-11-09)

### Implemented and merged to main

- PR #189 merged to `main` with merge commit `4780586b21cdb126578d4cd37f691d5cd4af8745`. Its tested PR head was `2534de4653a51fac60307af4e13b8dc3532447f4`.
- Exact PR-head Quality Gate passed: automated test suites, Firestore Rules Emulator, TypeScript validation, production build, production server startup smoke, and desktop/mobile Chromium browser tests.
- Vercel preview for the tested PR head reached `READY`. After merge, Vercel production deployment `dpl_4tTuhDnHE1PuczNPrkpy9AtahRCh` also reached `READY`, with `wird-app.vercel.app` as its alias and Git commit `4780586b21cdb126578d4cd37f691d5cd4af8745`.
- Vite emits `wird-precache-manifest.json` from the production entry chunk and its static JS/CSS dependency graph. It does not traverse dynamic imports, so lazy routes and large Quran datasets are not indiscriminately downloaded at install time.
- Service worker cache version is `wird-app-v3`. Installation caches the HTML shell, validates the generated manifest, and atomically adds same-origin JS/CSS assets before activation. A failed required asset prevents activation with a partial shell. The bounded opt-in EveryAyah session-audio cache remains separate and survives shell upgrades.
- The worker continues to bypass application API paths. Firebase/authenticated responses, tafsir responses, private data, and secrets are not added to the precache manifest.
- Playwright now verifies that the worker controls the page, JS/CSS exist in the v3 cache, and the app shell reloads while the browser context is offline. The test passed on both configured Chromium desktop and mobile projects.
- A coordinator lifecycle test verifies that offline/online, focus, pageshow, and visible-tab events update state and request automatic retry attempts. Existing IndexedDB journal tests verify that a committed event and pending outbox mutation survive closing and reopening the database connection.
- The coordinator retries queued work on reconnect, focus, pageshow, visible-tab changes, startup, mutation enqueue, and its foreground periodic interval. It does not promise background upload while the browser is fully closed.

### Remaining acceptance gates — not claimed as passed

- Vercel production build logs also contain repeated `TS2688: Cannot find type definition file for 'vite/client'` diagnostics during its serverless TypeScript transpilation phase, plus existing large-chunk warnings. The deployment still completed `READY`, and the exact-head GitHub TypeScript validation and production build passed. Track the Vercel-specific diagnostic separately; do not treat the successful deployment as proof that the diagnostic is resolved.
- Test the installed production PWA on a real browser/device: load online once, go offline, reopen, confirm locally saved progress remains visible, reconnect, foreground/reopen, and confirm the pending count drains. Use a test-owned account/data only; do not risk live user data.
- Verify a full authenticated offline mutation → browser termination/reopen → online replay journey in a controlled browser environment. The existing fake-IndexedDB close/reopen tests are storage-layer evidence, not a substitute for this real-browser journey.
- Confirm behavior of routes that were not visited before going offline and remote-only content (tafsir, auth operations, external audio, hosted Quran font) individually. Only the static app shell and previously cached/runtime-fetched assets are covered by this change.
- Production Firestore Rules deployment and the two production sync flags remain separate release gates. Do not enable either flag as part of this PWA change.

**Release decision:** the offline app-shell implementation is merged, its CI browser test passes, and the production deployment is `READY` on the production alias. Real-device authenticated offline/reconnect acceptance remains outstanding. No Firebase rules, production secrets, environment variables, production sync flags, or remote-sync activation settings were changed.



## Current sync release status — 2026-11-10

This section is the current status and supersedes older historical statements where they conflict.

### Confirmed
- PR #197 and PR #198 are merged.
- PR #198 is deployed to Production at `wird-app.vercel.app`, deployment `dpl_DcQBhZU4QVrtZm1qoV8CwUryez9J`, merge commit `c6befabbacbb5f7ad6351e9dca6c604408713285`.
- PR #198's exact-head GitHub Quality Gate passed automated tests, Firestore Rules Emulator, TypeScript, production build, server smoke, and desktop/mobile browser smoke.
- User manually tested the account on two devices and reported that synchronization works.
- Revisioned sync and remote projection production flags are enabled; do not change them without explicit approval.

### Still constrained / not solved generically
- Tombstones are rejected locally and blocked by the remote projector; do not advance the cursor past a blocked tombstone.
- `weakVerses` remains a full-list snapshot. Independent first failures may create distinct IDs for the same verse; resolution is a full-snapshot removal and can be undone by stale data without deletion semantics.
- `activityEvents` remains a full daily aggregate snapshot. A session domain event exists, but it is not yet the source of a deterministic event-derived activity projection.
- No blind union, counter sum, or timestamp-only conflict winner is acceptable for these collections.
- Ruqyah V2 has a special constrained merge path; do not generalize it to other collections.

### Active PRs
- PR #199: documentation-only continuity checkpoint and refresh of sync architecture/worklog/release notes. Exact-head GitHub CI is being run; Vercel may report the Free-plan build-rate limit.
- PR #200: grouped transaction document-ID propagation and regression test for per-result test projection/recovery. Exact-head Quality Gate is pending. Do not merge until tests, TypeScript, Rules Emulator, build, server smoke, and browser smoke pass on the exact head SHA.

### Safety gates
1. Preserve the local-first archives and backup compatibility.
2. Keep tombstone behavior fail-closed until collection-specific delete/anti-resurrection semantics and tests exist.
3. Do not merge daily aggregates by addition; introduce immutable session identity or an equivalent idempotent design first.
4. Do not merge weak verses by ID-only union; define same-coordinate concurrency, notes/text conflict, and deletion behavior first.
5. Do not change Firestore production rules/schema, secrets, environment settings, or production sync flags without explicit approval.
6. Report GitHub CI, Vercel deployment, and real-device checks separately.



## Follow-up after grouped projection fix — 2026-11-10

- PR #200 is merged to `main` at `5a866f22c254fd35b9c487f7d69546e6b691a9d3`; exact-head Quality Gate passed. It fixes grouped child document-ID forwarding and test snapshot-vs-per-result recovery semantics.
- No Vercel deployment record was found for that merge SHA because the Vercel status check was blocked by `build-rate-limit`. Do not claim this patch is deployed until a matching Production deployment is verified.
- PR #201 is open for a profile revision-key inconsistency: revision rating currently targets `profile/profile`, while other profile writers target `profile/main`. This must be unified to one revision stream before merge.



## Current production deployment — 2026-11-10

- PR #201 is merged to `main` at `12468243db7707c19a1bf75823ca1dc6e09f9ad8`; exact-head GitHub Quality Gate passed.
- Production deployment `dpl_d4u8eFLiZoxAwnd6UW5tQk8GPTKt` is `READY` on `wird-app.vercel.app` and matches the merge SHA exactly.
- This production deployment includes PR #200's grouped child document-ID propagation/recovery fix and PR #201's canonical profile document identity fix.
- Remaining data-integrity work: weak-verse cross-device reconciliation including resolution anti-resurrection, and activity aggregation from immutable session events. No blind union or addition; tombstones remain blocked.
- The user-reported two-device sync test predates these two latest code fixes; do not imply a fresh physical-device round trip was performed after this deployment.



## Follow-up release gate — weak-verse identity and remaining data integrity

- PR #207 is merged at `d45e30e521c3f20c7c6e48aa81b7bc37798952b4`; exact head passed all 30 Quality Gate steps.
- New weak-verse records use stable coordinate IDs. Historical IDs are preserved to keep resolution-event references valid.
- This change is not a weak-verse reconciliation release. Do not enable automatic merge of weak-verse snapshots or automatic keep-local/keep-remote resolution until tests prove preservation of independent verse additions, same-verse concurrent failures, retries, and resolution anti-resurrection.
- Activity-event reconciliation remains gated until immutable session events can rebuild daily aggregates exactly once, including legacy daily-log baselines and account/device recovery.
- No Firestore rules/schema, production settings, secrets, or sync flags changed in PR #207.
