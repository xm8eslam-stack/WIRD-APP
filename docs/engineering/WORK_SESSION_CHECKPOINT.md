# WIRD Work Session Checkpoint

**Last updated:** 2026-11-06 — active Quran/Tafsir PR #49 checkpoint  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Branch:** `fix/quran-reader-tafsir-navigation-20261106` (PR #49; `main` remains unchanged)  
**Current HEAD:** `6d56580e2d2477ded76f1425d97e968f4b317eeb`  
**Google AI Studio source branch:** `main`  
**Latest CI run:** [42267565615 — success](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42267565615). Vercel deployment is blocked by the Free-plan build/deployment rate limit; no Preview or Production deployment is verified.

## Resume instructions

For the active Quran/Tafsir task, continue on `fix/quran-reader-tafsir-navigation-20261106`; do not modify `main`. PR #49 is Draft and must remain unmerged until Vercel can deploy the exact head and the deployed experience is verified. For any new independent task, fetch the latest `main` SHA and create a fresh branch. Do not reset, force-push, or merge divergent branches wholesale.

## User goal

Build reliable, no-paid-mandatory-service cloud sync for Qur’an memorization/revision, while auditing and fixing all bugs that can damage the save/revision experience. Each substantial milestone must be tested twice and committed to `main` only after passing.

## Work completed in this session
- `cceed62` + `d013fe6` — daily activity archives now validate dates/counters, reject invalid session metrics, preserve corrupt source bytes, and expose a safe read-only display projection so the app can remain usable while writes/exports stay strict. Rollback of activity/profile snapshots is read-back verified.
- `52306b4` + `ec32f8b` — validate user profile schema and preserve corrupt profile bytes; first CI run exposed an over-escaped date pattern, corrected in the follow-up. Final CI passed.
- `d2d5f8f` + `67eaefe` + `f342b4b` — protect plans, engine plans, revision items, test results, and canonical portions from normal writes when their stored JSON is corrupt or malformed. Keep display reads safe, and explicitly allow canonical recovery only when validated legacy records are available. CI run `42180258989` passed 256 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `b549a29` — introduce a shared Web Crypto UUIDv4 generator and use it for outbox device IDs/mutations plus revision-history and weak-verse record IDs. Added tests proving unique review history IDs even with identical wall-clock timestamps. CI run `42178884028` passed 250 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `59ba288` — validate weak-verse failure coordinates against canonical Surah metadata, reject out-of-range ayahs before mutation, and store canonical Surah labels. Added coordinate-boundary tests.
- `1ba7f0e` — keep the revision center and unrelated retention metrics available when the weak-verse archive is damaged; surface a warning while preserving the raw archive. Added a regression test.
- `1f2b3f3` + `00543fd` — make revision rating a rollback-aware operation: if weak-verse persistence or activity/streak persistence fails, restore the previous portion and weak-verse archive and verify restoration; keep the rating UI open for retry. Added failure-injection tests. A TypeScript import-name collision was caught by CI and corrected in `00543fd`.
- Latest CI run `42178408517` passed 248 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `5cbbe88` + `ef694d8` — prevent corrupt or malformed weak-verse archives from being interpreted as an empty list and overwritten. Added schema/date/counter bounds and regression tests. First CI exposed an over-escaped date regex; corrected it in the follow-up commit. Final run `42177659576` passed 243 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `7f61e4f` + `e8a4ca7` + `73eeb8b` — harden outbox mutation validation: reject changed-payload ID collisions, validate UTF-8 byte limits/control characters, persist device identity on first read, and preserve numeric IDs. Two CI runs exposed false rejection of numeric IDs; final run `42172283822` passed 237 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `543df24` — backup import rollback now returns an explicit verification result. It verifies that scoped localStorage and memory keys were restored, and reports a recovery warning if readback fails. Added a failure-injection regression test. CI run `42171658033` passed 231 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `dc1f85f` — add `persistSessionCompletion` as a user-visible session persistence boundary. It validates exact Quran coordinates, saves canonical memorization progress and activity together, and rolls back the portion if activity/streak persistence fails. Added regression tests for failed-write rollback and review-only behavior. CI run `42171385088` passed 230 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, and server smoke test.
- `655d070` + `1efadca` — add a UID-scoped durable local outbox foundation with secure UUID/device IDs, idempotent enqueue/acknowledgement, retry backoff, bounded batches/payload/storage, corruption preservation, and quota-failure handling. The first CI run exposed a test-mock key-prefix mismatch; the test was corrected to target UID-scoped keys.
- Latest CI run `42177659576` passed: 243 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- `162e847` — preserve exact coordinates when resuming an in-progress memorization passage; regression tests cover range repeat prevention and Surah boundary clamping.
- `0710e27` — correct backup import UI to inspect the returned `success` flag, surface the actual result message, and handle file-read failures.
- `fdd00a2` + `7e01502` + `275e39b` — prepare whole-page progress changes in memory and persist once; add tests for multi-Surah pages, history preservation, invalid pages, and TypeScript-safe assertions.
- Latest CI run `42170371186` passed: 220 automated assertions, 10 Firestore rules emulator tests, dependency audit, TypeScript, production build, and server smoke test.
- `162e847` — fix repeated in-progress passage selection by resuming the exact saved coordinates; add tests for exact resumption and Surah-boundary clamping. CI run `42169589580` passed.

Commits on main (in order):
- `6355677` — isolate review sessions from memorization progress; add session completion tests; make session activity/streak write rollback-aware.
- `761e973` — correct review completion labels, ayah metric, and actual streak display.
- `2b55ad3` — surface failed localStorage writes and propagate save failures through profile/plans/revision/test workflows; add a failed-write regression test.
- `db5285e` — unique-ayah retention score, exact Mushaf pages for reviewed ranges, and persistence failure handling in revision flows.
- `c67c788` — due-date-aware daily session selection, explicit plan scope handling, and next-uncovered range selection.
- `0831e01` — accurate dashboard page preview/effect dependencies and partial plan-day completion state.

The exact full SHAs are available in the GitHub commit history. The current HEAD is the source of truth.

## Confirmed current architecture

- Firebase Authentication exists.
- UID-scoped local storage and guest separation exist.
- Legacy data ownership decision exists.
- Firestore rules, emulator configuration, and emulator tests exist.
- Firestore client integration, merge engine, immutable activity/weak-verse event ledger, and cross-device sync do **not** exist yet. The UID-scoped outbox primitive and shared UUID generator exist but are not yet wired into domain mutations.
- Firestore rules are not confirmed deployed to the production Firebase project.
- User reports the Vercel app is live at `https://wird-app.vercel.app/#/dashboard`.

## Important discovered risks

1. Daily activity is still stored as aggregate per-day logs; concurrent device updates would be lossy.
2. Weak-verse mistake counts are aggregated; they need immutable events or a transaction-safe model.
3. Portion review history needs stable unique event IDs before merging across devices.
4. Session completion and revision rating now roll back ordinary localStorage failures; revision rollback verifies portion and weak-verse archive restoration. Backup import rollback verifies restoration. Corrupt profile/log/plan/revision/test/portion archives are no longer silently normalized and overwritten by ordinary writes. Crash-atomicity still requires a journal/transactional store before sync.
5. Firestore rules currently validate a generic envelope; collection-specific payload validation and immutable event restrictions remain.
6. Revision-history IDs now use collision-resistant UUIDs rather than millisecond timestamps, preparing the data model for safe cross-device event identity.
6. A green Vercel deployment does not prove Firebase rules deployment or sync.

## Additional verified local reliability fixes

- Backup import previously treated the returned result object as a boolean; because objects are truthy, the UI displayed success even when import failed. It now branches on `result.success`, shows the actual failure message, and handles FileReader errors.
- Whole-page status changes previously wrote portions one by one, allowing partial-page persistence on quota/error. They are now assembled and validated in memory, then saved once through the canonical storage service.

## Additional progress-range defect found

- The file-by-file review found that resuming a saved `currently_memorizing` portion clipped it to the daily target. Completion only updates exact coordinate matches, leaving the larger parent portion in-progress; the next dashboard selection therefore repeats the same starting ayah. The fix now resumes the exact persisted passage and clamps only to the canonical Surah verse count. Regression tests cover exact resumption and malformed overlong endpoints.
- CI run `42169589580` and later full quality gates passed.

## M4 implementation status

- The outbox primitive is implemented and tested. Session completion now has a dedicated persistence boundary, but it still uses the legacy activity aggregate and does not yet enqueue through the outbox. The outbox is not a sync engine and does not contact Firestore.
- Next: add immutable activity and weak-verse events to the same durable local mutation boundary; integrate session completion, review rating, test result, plan/profile writes; derive daily logs and mistake counts from deduplicated events; test crash/reload and replay semantics.

## Mandatory next sequence

### Step A — finish the file-by-file audit
Review every remaining tracked source/config/test file, with special attention to:
- all StorageService and RetentionService write call sites,
- backup import/export and migration,
- plan lifecycle and revision queue,
- Quran data loading and source integrity,
- PWA/service worker cache behavior,
- API endpoints and environment-variable handling,
- all tests and GitHub Actions workflow.

Record each finding with file path, severity, evidence, fix, and test.

### Step B — local event ledger + durable outbox
Do not start Firestore writes first. Implement:
- UUID event/mutation IDs,
- append-only activity and weak-verse events,
- daily-log/streak derivation,
- UID-scoped durable outbox,
- atomic local state + outbox behavior,
- retry and duplicate-idempotency tests.

### Step C — Firestore adapter + deterministic merge
- Use per-record documents, transactions for mutable state, immutable event documents, tombstones, server timestamps, and bounded incremental sync.
- Use memory cache initially; do not enable persistent Firestore web cache by default because cache is not automatically cleared between sessions.
- Keep all local data available offline.

### Step D — rules and integration tests
- Per-collection payload schemas and size limits.
- Create-only event collections.
- Two-client emulator tests for concurrent changes, account switching, offline replay, stale snapshots, and duplicate retries.

### Step E — controlled production rollout
Only after explicit user approval:
- back up local data,
- deploy reviewed rules to the correct Firebase project,
- test on two devices and two accounts,
- enable sync behind a controlled rollout,
- retain local export/restore and rollback.

## Do not do

- Do not claim cloud sync works before M4–M7 pass.
- Do not replace local arrays wholesale with a cloud snapshot.
- Do not merge `feat/phase5-premium-ui-ux` wholesale; it is divergent.
- Do not change the Quran text or generate Quran text with AI.
- Do not deploy production Firebase rules without approval.
- Do not delete local data as part of initial cloud migration.

## Source documents

- `docs/engineering/IMPLEMENTATION_ROADMAP.md`
- `docs/engineering/FIRESTORE_SYNC_DESIGN.md`
- `docs/engineering/SECURITY_AUDIT.md`
- `docs/engineering/OPEN_SOURCE_RESEARCH.md`


## Quran reader and Tafsir repair — 2026-11-06

- Active PR: https://github.com/xm8eslam-stack/WIRD-APP/pull/49
- Branch: `fix/quran-reader-tafsir-navigation-20261106`; base main SHA `4fa6a1acffb0723c89bb963b237e67e6f4b7173f`.
- Root cause identified: Express did not register `/api/tafsir`; Vite middleware could serve the TypeScript source module instead of JSON in development.
- Fixed by mounting the existing Tafsir handler before Vite middleware. Added server smoke checks for both production and development.
- Added direct opening of selected Surahs at their first Mushaf page and exact first-ayah page resolution from the generated page index. General Mushaf entry retains saved-page resume behavior.
- All 114 Surah page starts have regression coverage.
- Code head `8f213b3a912657b0d1e36f7c851085b742629e2c` passed PR Quality Gate `42267248254` and push Quality Gate `42267243769`.
- Vercel deployment was blocked by the daily Free-plan deployment cap. Do not claim production deployment or merge until the deployment gate is resolved and the deployed app is verified.

## 2026-11-10 — Current cloud-sync status (supersedes older sync checkpoint statements)

The historical sections below describe earlier project phases and are not the current implementation state. Use this update as the source of truth for cloud sync.

- The revisioned local journal/outbox, Firestore remote mutation path, remote inbox, and local projection flow are implemented and active in the deployed WIRD release.
- PR #197 and PR #198 are merged. PR #198 is deployed to Production at `wird-app.vercel.app`; merge commit `c6befabbacbb5f7ad6351e9dca6c604408713285`, Vercel deployment `dpl_DcQBhZU4QVrtZm1qoV8CwUryez9J`.
- PR #198 passed exact-head GitHub Quality Gate, including application tests, Firestore Rules Emulator, TypeScript, production build, server smoke, and desktop/mobile browser smoke.
- The user manually tested the account on two devices and confirmed that cloud synchronization works. This is a user-reported live test and must be distinguished from CI.
- `tests` now has safe per-result merge by immutable result ID while `tests/snapshot` remains authoritative.
- `weakVerses` and `activityEvents` remain full-snapshot projections. Weak-verse IDs include the mutation ID for first failure; resolution is a full-snapshot removal. Activity uses per-day aggregates even though session completion emits a stable-ID domain event. Do not use blind union or addition.
- Tombstones remain unsupported and fail closed. Do not change their behavior without a per-collection deletion and anti-resurrection design.
- PR #200 is open to preserve child document IDs in grouped journal apply/recovery, with a regression test. It is not merged until its exact-head quality gates pass.
- PR #199 is the documentation continuity update. No production Firestore rules/schema, secrets, environment settings, or sync flags were changed during this review.
- The Vercel Free-plan build-rate-limit can block preview deployments; it does not invalidate a passing GitHub test run, and a passing GitHub run does not prove a Vercel deployment.

## 2026-11-10 — Latest post-PR #200 sync follow-up

- PR #200 merged to `main` at `5a866f22c254fd35b9c487f7d69546e6b691a9d3`; its exact-head Quality Gate passed all stages. Grouped journal projections and recovery now preserve each child document ID, including the distinction between test-result snapshot and per-result semantics.
- Vercel did not produce a deployment record for that merge SHA because the Free-plan `build-rate-limit` blocked the PR deployment check. Do not claim the latest sync fix is live until a matching deployment is verified.
- PR #201 addresses a newly found mismatch between revision profile writes (`profile/profile`) and all other profile snapshot writers (`profile/main`). The duplicate document IDs create separate Firestore revision streams for one profile; the fix and regression test are pending exact-head CI.

## 2026-11-10 — Latest production sync baseline after PR #201

- PR #201 merged as `12468243db7707c19a1bf75823ca1dc6e09f9ad8`; its exact-head Quality Gate passed.
- Production Vercel deployment `dpl_d4u8eFLiZoxAwnd6UW5tQk8GPTKt` is `READY` and matches the same SHA on alias `wird-app.vercel.app`.
- The deployed source includes PR #200's grouped child document-ID forwarding/recovery semantics and PR #201's correction so revision rating writes the canonical `profile/main` document.
- The user confirmed two-device sync before these latest fixes; a fresh physical-device round trip after this deployment is not yet claimed.
- Remaining known integrity work is weak-verse anti-resurrection and daily activity event-based aggregation; tombstones remain fail-closed.



## 2026-11-10 — Sync checkpoint after PR #207

- PR #207 merged at `d45e30e521c3f20c7c6e48aa81b7bc37798952b4`; exact head `fc1c5d58a59e806f75d14649d3610858663852d4` passed the full 30-step Quality Gate.
- New weak-verse entries use stable Quran-coordinate IDs across journal-first and legacy writers. Existing IDs are intentionally not rewritten because resolution events refer to them.
- Weak-verse snapshots still need event/tombstone semantics before safe multi-device reconciliation. No blind union, no counter addition, and no deletion resurrection.
- Activity logs remain aggregated by date. Use immutable session-completion events to design a deduplicated materialized view, but preserve legacy baseline data and transactional rollback.
- PR #206 is separately implementing memorization-session UI scaling and sticky ayah navigation; it must pass its exact-head Quality Gate before merge. Vercel preview builds may be blocked by the Free-plan build-rate limit.


## 2026-11-11 — Final checkpoint after PR #325 and PR #326 merges

- Current main SHA: `3667a8c003b79984546d48a9defc20c6f2bcd367`. PR #325 merged as `966d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6`; PR #326 merged as `3667a8c003b79984546d48a9defc20c6f2bcd367`. No force-push or direct-main edits were used.
- PR #325 adds base-snapshot compare-and-set protection for full `weakVerses` and `activityEvents` projections, including weak-verse failure/resolution, session completion/revision rating, backup import, reset, and demo fixture operations. Stale bases fail closed; grouped transaction rollback preserves earlier child projections. Exact-head run `42917981860`: 667 assertions, 31 Rules Emulator tests, 8/8 audio probes, 140 Playwright tests, TypeScript, production build, server smoke — all passed.
- PR #326 adds a shared continuous audio queue for Mushaf and memorization/revision sessions, bounded/infinite segment repetition, cross-page continuation, flexible Mushaf text/spacing/width controls, and a 10-second timeout for opportunistic offline audio pre-cache. It also guards the next-page autoplay transition against reading stale previous-page ayahs. Exact-head run `42919276966`: 674 assertions, 604 coordinate-map checks, 31 Rules Emulator tests, 8/8 audio probes, 150 Playwright tests, TypeScript, production build, and server smoke — all passed.
- The requested memorization page/element sizing feature was already implemented and is now explicitly documented: PR #202/#206 provide UI scale 80–110%, ayah text 20–44px, compact/comfortable density, one-ayah/all-session view, and sticky navigation. The all-session view allows tapping any ayah directly instead of stepping through every ayah. Preferences are stored locally per device and are independent of cloud sync.
- Production remains at deployment `dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5`, commit `dac125dd8770cc4881e2c6cea6fe94623ad52144`, state `READY`. Current main `3667a8c` is not deployed; Vercel reports `build-rate-limit`. No current-main live smoke test is verified; do not call this a completed Production release.
- No Firestore rules/schema, secrets, production environment variables, or remote-sync flags changed. The higher-level policy still blocks whole-snapshot `keep-local/use-remote` choices for `weakVerses/activityEvents`; tombstone/delete semantics and a real two-device test remain open. Do not claim cloud sync is fully released.
- Google AI Studio sync is unverified. Next: when Vercel quota allows, verify a Production deployment matching `3667a8c` and run live smoke; then perform a controlled two-device sync test before considering any broader conflict-resolution or remote-sync activation.


## 2026-11-11 — PR #328 merged; activity-event sync design started

- Current main SHA: `50bb25eeba2f1ed4ceae228b347c67b40f60c697`.
- PR #328 adds direct ayah selection to sticky memorization/revision navigation; active single-ayah/segment playback is stopped before changing the current ayah. Existing 80–110% session scale, 20–44px ayah text, density, and focused/all-session controls remain intact.
- Exact PR Quality Gate run `42921569974`: 152 Playwright passed, 2 skipped; dependency audit 0 vulnerabilities; Firestore Rules Emulator, TypeScript, production build, and server smoke passed.
- Sync source review confirms `DailyLog` is still a per-day aggregate and `activityEvents/snapshot` still projects a full record array. `session.completed` domain events exist, but their current payload has no explicit local calendar date/time-zone field. The new design document defines an idempotent event ledger and a non-destructive legacy baseline/cutover; no runtime behavior changed.
- Whole-snapshot conflict choices for `weakVerses`/`activityEvents` remain fail-closed. Tombstones remain unsupported. No Firestore Rules/schema, production data, secrets, environment variables, or remote-sync flags changed.
- The GitHub Vercel status for `50bb25e` now reports `success`, but exact deployment SHA/Production state and live smoke remain unverified because Vercel team access returned 403. Last documented READY SHA remains `dac125dd8770cc4881e2c6cea6fe94623ad52144`. Google AI Studio sync is unverified.


## 2026-11-11 — Current WIRD continuation baseline (supersedes older release notes)

- Verified current main: 3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188 (PR #344).
- PR #344 exact head 36b5f34a5faea009e60454dd248ce3dabee130d5 passed Quality Gate 42965801925; post-merge main run 43023291577 passed.
- Vercel Production deployment dpl_AU9ATDJEsm99z4CWir3WLvvdn32m is READY and matches the exact current main SHA.
- PR #199 documentation continuity update is merged (merge commit b0b0ce8f4d80fed65ab9d097a0d5341efe3a880a); subsequent main updates supersede its older SHA/deployment checkpoint statements.
- Activity event reducer (activityEventProjection.ts) exists with pure unit tests but remains disconnected from production storage/cloud sync. Current persisted DailyLog[] still aggregates by date.
- Weak-verse coordinate identity and base-snapshot CAS guards are in main; they prevent stale snapshot overwrites, but not automatic convergence of independent concurrent changes. Keep weakVerses and activityEvents whole-snapshot conflict choices blocked.
- No server-visible per-device legacy activity cutover watermark exists. Do not wire the event reducer into production, rewrite historical logs, change Firestore Rules/schema, alter secrets/settings, or change sync flags until offline-client cutover, backup/restore, crash recovery, and Emulator tests are complete and explicitly approved.
- Tombstones remain fail-closed. No new physical-device A↔B round trip is claimed after the latest deployment.


## 2026-11-11 — Documentation-only main advance after PR #348

- PR #348 merged as d1d33384609bdc4a3c99120956901c92289d5f26. Its changes are documentation and a planning document only; no runtime source, Firestore Rules/schema, sync settings, or user data changed.
- Main Quality Gate run 43025089584 is in progress on d1d33384609bdc4a3c99120956901c92289d5f26.
- Vercel reports build-rate-limit for the d1d333 deployment and no matching deployment record exists. The last verified READY Production deployment remains dpl_AU9ATDJEsm99z4CWir3WLvvdn32m on source SHA 3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188. Since PR #348 was documentation-only, the Production runtime code is unchanged, but exact main/Production SHA parity is no longer true until a new deployment succeeds.
- This PR's docs should preserve that distinction: current main SHA d1d333..., last READY Production SHA 3dd4fb..., no new live feature behavior is implied.


## 2026-11-11 — Latest main advance after PR #354

- Current main SHA: 8c49f716726e329189a1141c28a69059543ea5ba. It includes PR #351's quota-recovery test and PR #354's defensive Ruqyah proxy failure handling.
- PR #354 exact head 086dbb0cb7a675bd502ea0f918b41d5b145b19f9 passed Quality Gate run 43025838426 and merged as the current main SHA. The change maps unexpected proxy failures to a controlled JSON 502 and uses only allowlisted diagnostic metadata; it does not prove the earlier HTTP 500 root cause is fixed.
- Main Quality Gate run 43026982133 is still in progress at this checkpoint. Vercel has no deployment record for SHA 8c49f716726e329189a1141c28a69059543ea5ba; the last READY Production runtime deployment remains dpl_AU9ATDJEsm99z4CWir3WLvvdn32m on SHA 3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188. Do not claim the Ruqyah proxy fix is live in Production yet.
- PR #353's updated head cc40ca4c16dbe6e7cab0091859d5f4ac39d6be7b and PR #355's updated head 0f0cc611c5f610f6135db5760fbba8401ca8214d each have fresh Quality Gate runs in progress (43027225508 and 43027223673). Earlier failed runs were on superseded heads; evaluate only the latest exact heads.
- PR #355 currently adds only a pure, bounded audio-range planner from canonical Quran metadata and the reviewed Al Quran Cloud allowlist. It does not yet download, store, or play audio offline.
- No Production environment variables, sync flags, Firestore Rules/schema, or user data were changed by these changes.
