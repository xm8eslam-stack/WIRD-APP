# CURRENT VERIFIED TEST COVERAGE — 2026-11-11

This section supersedes older status summaries below where they conflict with the exact SHA/run evidence listed here.

## Exact-head results

| Scope | Exact SHA | Quality Gate run | Result |
|---|---|---|---|
| Main before PR #328 | 3667a8c003b79984546d48a9defc20c6f2bcd367 | [42920401307](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42920401307) | Passed |
| Main after PR #328 merge | 50bb25eeba2f1ed4ceae228b347c67b40f60c697 | Post-merge main-only run not independently observed | Pending evidence |
| PR #325 stale-snapshot CAS | 6d0deea025f7ca7ee6b5d1efd65e55805334e630 | [42917981860](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42917981860) | Passed |
| PR #326 continuous audio/Mushaf controls | merged SHA 3667a8c003b79984546d48a9defc20c6f2bcd367 | [42919276966](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42919276966) | Passed |
| PR #328 direct memorization ayah jump | merged SHA `50bb25eeba2f1ed4ceae228b347c67b40f60c697` (head `0c41126b1e018892119ced669936335326f8b1e7`) | [42921569974](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42921569974) | Passed |

PR #325 passed 667 assertions, 31 Firestore Rules Emulator tests, 8/8 approved audio probes, 140 desktop/mobile Playwright tests, TypeScript, production build, and server smoke. PR #326 passed 674 assertions, 604 Mushaf coordinate-map checks, 31 Rules Emulator tests, 8/8 audio probes, 150 Playwright tests, TypeScript, production build, and server smoke. Pre-merge main run #42920401307 completed successfully on exact SHA `3667a8c`. PR #328's merge-ref Quality Gate run #42921569974 passed 152 Playwright checks with 2 skipped, dependency audit (0 vulnerabilities), Firestore Rules Emulator, TypeScript, production build, and server smoke. A separate post-merge main-only run for `50bb25e` has not been independently observed.

## Current sync coverage and explicit gaps

- PR #325 verifies compare-and-set protection for full weakVerses and activityEvents snapshots using a deterministic base fingerprint; stale/divergent projections fail closed and grouped rollback preserves prior child projections.
- This is a stale-write guard, not general conflict convergence. Whole-snapshot keep-local/use-remote choices for these two collections remain blocked.
- Tombstone/delete projection, anti-resurrection, retention, and restore semantics remain unsupported; blocked events must not be skipped by advancing the projection cursor.
- A fresh real-device A↔B round trip after PR #325 is not verified. Existing Emulator route coverage and historical user-reported two-device success are distinct evidence.
- Still needed: immutable session-activity event projection with exact legacy daily-log baseline preservation; populated-record concurrency/replay tests; account lifecycle and cross-tab isolation; long-offline replay; crash/quota injection; tombstone replay/restore tests.

## Release/deployment distinction

- Latest verified Production remains deployment dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5 on SHA dac125dd8770cc4881e2c6cea6fe94623ad52144, state READY.
- Current main SHA `50bb25e` is not confirmed deployed. Its post-merge GitHub Vercel status now reports `success`, but Vercel deployment details could not be read (team-scope 403); exact Production SHA/state and live smoke are not verified. The last documented READY Production SHA remains `dac125dd8770cc4881e2c6cea6fe94623ad52144`.
- PR #328's GitHub Quality Gate passed; Vercel Production deployment remains a separate, unverified gate.
- No production Firestore rules/schema, secrets, sync flags, or user data were changed.

---

# CURRENT VERIFIED TEST COVERAGE — 2026-11-07 (through PR #158)

This section supersedes older "not implemented" summaries below where the listed PRs have since landed.

## Exact-head Quality Gate results

| PR | Feature | Exact head | Quality Gate run | Result |
|---|---|---|---|---|
| #149 | Confirmed use-remote conflict resolution | `c675a2d164b88994c08a5368bf1695712f2625f3` | `42368745026` | Passed |
| #155 | Confirmed keep-local resolution for supported single-collection upserts | `1d4ea9d5acb5be0179af6935f79c4a100fab1ecf` | `42370175733` | Passed |
| #157 | Ruqyah V2 per-device counter convergence | `b2752297842d6fd30d7b4ae86eb33d48585e9ce8` | `42372550605` | Passed |
| #158 | Release/checkpoint documentation | `c90af2e8838a52136e50f422981737966e104d29` | `42372993374` | Passed |

Each run's complete job finished with conclusion `success`. The Quality Gate covers the repository's configured automated tests, Firestore Rules Emulator, dependency audit, TypeScript, production build, server startup smoke, and desktop/mobile Playwright steps. Verify job-step details on the run before quoting test counts or asserting a specific sub-suite.

## Verified new behaviors

- PR #149: use-remote conflict resolution, exact Firestore revalidation, archived mutation identity checks, atomic cursor/inbox/outbox/revision finalization, cancellation, and retry after an interrupted local projection.
- PR #155: keep-local re-publication for supported single-collection upsert conflicts; exact local snapshot validation; latest remote revision revalidation; atomic replacement outbox enqueue; old evidence retained.
- PR #157: V2 Ruqyah component-wise PN-counter merge, reset-watermark convergence, concurrent increments/resets, V1 migration guards, malformed payload rejection, deterministic crash recovery, and a two-device Firestore Emulator scenario proving offline concurrent increment convergence.

## Still not proven / required next tests

- Tombstone application, conflict resolution, resurrection prevention, and safe retention remain intentionally unsupported.
- Grouped `syncMeta` keep-local/merge resolution remains unsupported; tests must prove atomicity across every child collection.
- Divergent V1 Ruqyah baselines must remain blocked and preserved; no automatic reconciliation may infer missing increments.
- Full cross-tab concurrency, account lifecycle isolation under browser reload/sign-out, long-offline event replay, out-of-order delivery, and broad crash/failure injection remain incomplete.
- Real production two-device behavior, deployed Firestore rules, production environment flags, Vercel deployed SHA, and live browser/audio smoke are not proven by these CI runs.

---

# WIRD Sync Test Matrix

**Evidence checkpoint:** 2026-11-07. Test results apply only to the exact SHAs listed.

| Area | Coverage / evidence | Result | Limitation |
|---|---|---|---|
| Unit/regression suites | PR #129 exact head `334a73a05bddc4d574cdf8c25a0299f329b22c49` | 525 passed, 0 failed | Assertion count is suite output, not full product coverage |
| Firestore Rules | PR #129 exact-head Emulator run | 31 passed, 0 failed | Emulator only; production rules deployment unverified |
| Populated collection round trip | PR #114 + PR #125 | All eight collections populated; sequential A → B → A; multiple records preserved in array collections | Emulator-backed isolated service contexts, not real devices or simultaneous conflict merge |
| Document-scoped projection | PR #129 | Same-document pending write blocks; unrelated test-result document progresses | Grouped syncMeta remains collection-wide; no field merge |
| Conflict evidence | PR #126 | Local snapshot plus pending Outbox mutations retained; 500 KB combined cap; repeated observations deduplicated | No user decision workflow yet |
| Browser app shell | PR #122 | 6/6 Playwright desktop/mobile Chromium checks passed | Shell, reload, JS errors, overflow only; not auth/CRUD/sync |
| Ruqyah locator library | PR #127 | 10 locator-library browser checks passed (5 desktop + 5 mobile) | Locator/library UI only; not full recitation or cloud sync |
| TypeScript / production build / server smoke | PR #129 exact head | Passed | Exact-head CI only; not live Vercel deployment |
| Dependency audit | PR #129 exact head | Passed | Snapshot at CI run time |
| Tombstones | Projector guards | Blocked safely | Actual delete propagation, resurrection prevention, and retention not implemented |
| Offline stress / load | Not yet verified | Not run | Hundreds/thousands of queued writes, long offline windows, crash/IDB quota stress remain |
| Full browser auth/sync | Not yet verified | Not run | Independent auth sessions, cross-tab, full CRUD, two-device sync journeys remain |
| Production Firebase / Vercel | Main status `build-rate-limit` | Unverified | No production rules deployment or deployed SHA/live smoke claim |

## Exact main verification

- PR #73 merge SHA: `cc887a6bfa07aec880f495221e64dd36edb14ca8`; post-merge main workflow run `42350476806` succeeded.
- PR #77 merge SHA: `716cf301bff9a8c7777ee3931dba6366a01afe3b`; post-merge main workflow run `42350951068` succeeded.
- PR #78 merge SHA: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; post-merge workflow was queued at checkpoint and must be rechecked before calling main verification complete.

| Durable projection conflict archive | PR #81 SHA `415cbe33389a6108d08f9d5785818e8e12458fee` | Passed | 459 automated assertions; archive preserves remote event and original local bytes; conflict remains unresolved |
| Post-merge main gate | Main SHA `059e902194811be71ab4dea9da8609a96967214e`, run `42351965332` | Passed | Same CI workflow passed after merge |

| Atomic conflict reconciliation | PR #85 head `b6af08b2d9461a1d3d7cc019404692d779500248` | Passed | 462 automated assertions; 27/27 Firestore Rules; first snapshot preserved, already-applied event resolution, late archive/orphan guard, oversized snapshot rejection |
| Post-merge main gate | Main SHA `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`, run `42352594819` | Passed | Exact merge commit verified by main workflow |

## 2026-11-07 coverage update

- Plan lifecycle regression tests were added in PR #62; exact-head Quality Gate 42342109962 passed and post-merge main run 42354256341 passed.
- Quran audio repeat controller tests were added in PR #89; exact-head runs 42354410219 and 42354399498 passed. Main post-merge run 42354517460 was still in progress at checkpoint time.
- Ruqyah progress currently has local persistence, account-scope isolation, corrupt archive preservation, validation and reset tests. These are not cloud sync tests.
- Required but not yet implemented for Ruqyah cloud sync: two-device concurrent increments, offline increment replay, duplicate increment delivery, event ordering, account switching with pending increments, crash during journal enqueue, remote projection, and reset propagation.
- The observed experimental Ruqyah sync branch run 42354431882 failed 3 local progress tests due to a missing StorageService method; it is not mergeable evidence.

## 2026-11-07 — Ruqyah concurrent offline conflict coverage

- The sequential two-device Ruqyah round-trip verifies revision 1 then revision 2 projection.
- PR #94 adds a separate concurrent-offline scenario: two devices increment from the same base revision; the first server mutation is accepted, the stale second mutation is rejected, and the second device retains its Outbox mutation, imported remote Inbox event, local snapshot, archived conflict evidence, and unchanged projection cursor.
- This test proves conflict preservation, not automatic convergence or additive merge. The user-facing conflict-resolution workflow and a deterministic way to merge additive counter increments remain release blockers.
- The revisioned sync coordinator legacy-state scan now explicitly includes ruqyahProgress so existing documents cannot be skipped by first-sync detection.

## 2026-11-07 — Multi-collection two-device projection matrix

- PR #101 adds an Emulator-backed **one-way A → B projection pass** through all eight user data collection routes: profile, plans, enginePlans, portions, weakVerses, tests, activityEvents, and ruqyahProgress. It is not a bidirectional round-trip test.
- The test writes revisioned mutations on device A, imports the ordered immutable event stream on device B, runs the actual remote inbox projector, verifies local archive presence/cursor advancement, and checks owner reads plus cross-user read denial for every route.
- Payload depth is limited: plans, enginePlans, portions, weakVerses, tests, and activityEvents currently use empty `records: []` arrays. Profile and Ruqyah have non-empty representative payloads. Therefore this validates collection routing, event transport, projection dispatch, cursor handling, and owner rules; it does **not** validate populated-record schemas/serialization for those six arrays, reverse B → A flow, simultaneous writes, or conflict convergence.
- Remaining multi-collection work: add valid populated domain records per collection, assert field-level round-trip equality, test B → A and alternating edits, and exercise offline/retry/crash cases across more than one collection. Real-device/mobile E2E, account lifecycle switching, cross-tab browser E2E, and conflict-resolution UI also remain unverified.

## 2026-11-07 — Bidirectional route coverage update (PR #106)

- PR #106 extends the earlier A → B pass with B → A revision-2 writes for all eight routes and imports the complete contiguous 16-event stream on A, including A's own already-applied events. Exact-head runs `42357426174` and `42357436438` passed (510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, startup smoke).
- This is bidirectional route/event projection coverage, not complete domain-record coverage: plans, enginePlans, portions, weakVerses, tests, and activityEvents still use empty `records: []` payloads. Profile and Ruqyah have representative non-empty payloads; Ruqyah is asserted to change from 3 to 4.
- Remaining: populate valid records for each collection, assert field-level equality in both directions, and add simultaneous edits, offline replay, duplicate delivery, out-of-order, crash, and account-switch cases per collection.
- PR #104's Settings conflict inspector is read-only; it is not evidence that manual resolution has shipped.


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
- Next: implement the conflict decision state machine with atomic archival/revalidation and crash recovery; then tombstones, additive Ruqyah counters, broader Playwright workflows, backup/restore stress, and account lifecycle tests.


## 2026-11-07 — multi-record and browser coverage update

- PR #125 expands all eight collection fixtures with multiple populated records where the model is collection-array based. Device B changes only one record; the untouched record must remain byte-for-byte equivalent in both A → B and B → A projections. Exact-head Quality Gate: 521 automated assertions, 31 Firestore Rules Emulator tests, six Playwright app-shell checks; post-merge main run passed.
- PR #122 adds six Playwright app-shell checks: desktop and mobile viewport projects, hard refresh, no uncaught page errors, and no viewport horizontal overflow. Mobile uses Chromium with iPhone 13 viewport/touch emulation because only Chromium is installed.
- PR #127 adds 10 Ruqyah locator-library browser checks (five desktop and five mobile); the combined Playwright suite has 16 tests. These are UI/library tests, not full authentication, CRUD, or sync journeys.
- PR #126 verifies durable conflict evidence: pending local mutation payloads are archived, repeat observations append without replacing the original snapshot, and oversized evidence fails closed while inbox/outbox remain intact.
- PR #129 verifies document-scoped projection at both projector and atomic finalization layers: same-document pending writes block; a different test-result document in the same collection does not. Grouped syncMeta remains collection-scoped.
- Still not covered: concurrent edits to the same collection snapshot from multiple real devices, long-offline replay, out-of-order multi-event stress, cross-tab races, full browser auth/sync workflows, tombstone replay, and live Firebase verification.


## 2026-11-11 — Activity-event design checkpoint

- Current main: `50bb25eeba2f1ed4ceae228b347c67b40f60c697`.
- `activityEvents` is still a daily aggregate snapshot. PR #325's base fingerprint blocks stale replacement but does not merge independent activity histories.
- New design: `docs/sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. No runtime sync code or Firestore Rules changed. Required before implementation: exact legacy baseline/cutover semantics, local calendar date/time-zone capture, idempotent event IDs, offline-device conflict preservation, and backup/restore compatibility.
- Keep tombstones and whole-snapshot conflict choices fail-closed until collection-specific semantics and anti-resurrection tests pass.
