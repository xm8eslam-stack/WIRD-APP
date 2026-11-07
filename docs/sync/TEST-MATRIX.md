# WIRD Sync Test Matrix

**Evidence checkpoint:** 2026-11-07. Test results apply only to the exact SHAs listed.

| Area | Coverage / evidence | Result | Limitation |
|---|---|---|---|
| Unit/regression suites | GitHub Actions exact-head workflow | 450 passed, 0 failed | Assertion count is suite output, not a statement of full product coverage |
| Firestore Rules | Emulator on PR #77 SHA `7d92b0efc5241b6ce2d7e2e0139b9c4183ebf2a7` | 26 passed, 0 failed | Emulator only; production rules deployment unverified |
| Two-device bidirectional | PR #77 | Passed | Profile collection only; separate fake IndexedDB/localStorage, independent auth clients |
| Offline same-document conflict | PR #78 SHA `9144a25c4454db4ccb0309a979eff69fc0039860` | Passed | Confirms stale rejection and preservation/blocking, not a conflict-resolution UI |
| Crash recovery | PR #73 | Passed in CI | Does not replace browser crash testing on real devices |
| TypeScript | PR #77 and #78 exact-head workflows | Passed | Exact-head CI only |
| Production build | PR #77 and #78 exact-head workflows | Passed | Not a Vercel deployment |
| Production startup smoke | PR #77 and #78 exact-head workflows | Passed | Not a live production URL smoke |
| Dependency audit | PR #77 and #78 exact-head workflows | Passed | Snapshot at CI run time |
| Tombstones | Projector guard tests | Blocked safely | Actual delete propagation is not implemented |
| Browser E2E / mobile / tablet | Not verified in this work segment | Not run | Requires Playwright/browser workflow evidence |
| Offline stress / load | Not verified | Not run | Hundreds/thousands of queued writes and long offline windows remain |
| Production Vercel | Status returns `build-rate-limit` | Unverified | External deployment limit, not a successful deployment |

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
