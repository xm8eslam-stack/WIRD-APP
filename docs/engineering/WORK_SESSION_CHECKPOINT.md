# WIRD Work Session Checkpoint

**Last updated:** 2026-11-06  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Branch:** `main`  
**Current HEAD:** `f342b4bc7e02a48f88b90646098eea178901c8ea`  
**Google AI Studio source branch:** `main`  
**Latest CI run:** [42180258989 — success](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42180258989)

## Resume instructions

Continue from the current `main` HEAD. Do not reset, force-push, or merge the divergent Phase 5 branch wholesale. Before every write, fetch the current main SHA and use a non-forced compare-and-swap update. Commit one reviewed milestone at a time.

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
