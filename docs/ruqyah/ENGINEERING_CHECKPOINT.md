# Current verified continuation — after PR #141

Last verified: 2026-11-07.

## Current repository and merged work
- Repository: `xm8eslam-stack/WIRD-APP`; base branch: `main`.
- PR #111 merged Quran index sanitization and canonical WIRD Quran text resolution. Merge SHA: `48cf9b236072cd3db2603a57cda5f67b30a778cd`.
- PR #116 refreshed this checkpoint. Merge SHA: `d49e2f57ad81bfba22722ba513c85382b74879f7`.
- PR #117 removed dormant verse/full-program audio playback code from `RuqyahView.tsx`, retaining visibly disabled audio notices and all reading/progress functionality. Merge SHA: `673ddfcb5af046f785e2da18abc73c4a1bba2339`.
- PR #120 tightened external Quran locator validation and provider item IDs. Merge SHA: `66d3ac74d8402fb13718ff38d8c7ad4bb889cd89`.
- PR #123 added canonical locator search and keyboard-focus visibility in the extended Quran library. Merge SHA: `21003bc51e9c4bb80f449d662ab7f4c4cdaafe9e`.
- PR #124 removed wildcard CORS grants from the same-origin Ruqyah proxy. Merge SHA: `f47ed3bb5bc7f88b8170fa14a33260412ffb979d`.
- PR #127 added desktop/mobile Playwright coverage for the extended Quran locator library's loading, success, empty, network-error/retry, invalid-locator, and search states. Merge SHA: `59e481e52e212f8dc659782fb319b59038393bc1`.
- PR #117 exact-head Quality Gate passed on `8cdfc2bb94a18522f17ae8270ca22fc9929652de`, run `42359507976`: 518 unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- PR #120 exact-head Quality Gate passed on `bc95c5a0018b32be6d8868c85ec556afb6a4eed4`, run `42359703038`: 520 unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- PR #123 exact-head Quality Gate passed on `bba9ad53fc1a0079d67ef0bee0e94867fec74096`, run `42360037568`: 521 unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- PR #124 exact-head Quality Gate passed on `0ffb40d027d118ed52e53e70ae688cc0a44c3424`, run `42360270891`: 521 tests, 31 Firestore Rules tests, dependency audit, TypeScript, production build, server smoke, and browser smoke passed.
- PR #127 exact-head Quality Gate passed on `c406d3c4675171df30adfd272d9b97e61da09f87`, run `42360845123`: 521 unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and all 16 desktop/mobile Playwright tests passed (6 app-shell + 10 Ruqyah locator-library tests).
- PR #130 refreshed this checkpoint and release checklist; merge commit `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`.
- PR #131 documented merged and superseded Ruqyah work branches; merge commit `ae5c8a162f5aec8ea5bb5ef6a16c9d5b23611ab6`.
- PR #135 fixed stale in-memory Ruqyah counters after corrupt progress is detected during initial hydration or a cross-tab/custom-event refresh. Merge commit: `9e62e26c06fb1821095390db4c32e5f81b8233a8`.
- PR #135 exact-head Quality Gate passed on `da312046dec7192cd0a2da6b025542c7f407e579`, run `42363462082`: 526 automated unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and all 18 desktop/mobile Playwright tests passed.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit`. This is a deployment quota failure, not a code Quality Gate failure. No live production alias or deployed SHA is verified.

## Latest Ruqyah UI state — after PR #137
- PR #135 fixed stale in-memory Ruqyah counts when stored progress becomes corrupt during hydration or a progress refresh. Merge SHA: `9e62e26c06fb1821095390db4c32e5f81b8233a8`.
- PR #135 exact-head Quality Gate: `da312046dec7192cd0a2da6b025542c7f407e579`, run `42363462082`: 526 unit/integration assertions, 31 Firestore Rules tests, dependency audit, TypeScript, production build, server smoke, and 18 desktop/mobile Playwright tests passed.
- PR #136 refreshed this checkpoint and release checklist. Merge SHA: `0d71633b9fe69fdb4b3928c8698f20e539ef57f0`.
- PR #137 adds an explicit in-context confirmation before clearing category counters, supports cancellation, explains the scope of the reset, closes the prompt on category/mode changes, and disables reset controls while progress is unhydrated or corrupt. Merge SHA: `900bd989299a08ea09eb046d5579395d0bab7064`.
- PR #137 exact-head Quality Gate: `5875e5851c6e81fe4397389079badef4e360a0c0`, run `42363918110`: 526 unit/integration assertions, 31 Firestore Rules tests, dependency audit, TypeScript, production build, server smoke, and 20 desktop/mobile Playwright tests passed.
- The Vercel status remains a Free-plan `build-rate-limit` failure; production deployment is not verified. No live production claim is made.

## Keyboard reset accessibility — PR #139
- PR #139 restores keyboard focus to the reset trigger after Cancel and Confirm, and supports Escape to cancel without changing progress. The Escape handler is attached to the shared interactive section so it receives the key while focus remains on the reset trigger.
- PR #139 merge SHA: `28a1c4339d31bb66549402db36cfc40357caf65f`.
- The initial PR #139 browser run on `0b84daf09f154109ccd5b818c7ac8865572cb880`, run `42364241818`, correctly failed the Escape regression on desktop and mobile because the key handler was scoped only to the confirmation panel. The handler was moved to the interactive section and re-tested.
- Exact-head Quality Gate passed on `5e84ffd443d6d4657c8c61cd7958892deccc6e72`, run `42364428561`: 526 automated assertions, 31 Firestore Rules tests, dependency audit, TypeScript, production build, server smoke, and all 20 desktop/mobile Playwright tests passed.
- No religious content, API policy, audio source, or sync semantics changed.

## Narrow mobile responsive verification — PR #141
- PR #140 refreshed this checkpoint and release checklist after PR #139; merge SHA: `d9ad6b51ad8133e32057ff170e9ff0a136b78305`.
- PR #141 adds browser regression checks at 320px, 360px, and 390px for both the extended Quran locator library and interactive Ruqyah reading/counter view.
- Assertions cover document width, body width, and the Ruqyah content container's scroll/client widths; all six width/mode checks passed in desktop and mobile Chromium projects.
- PR #141 merge SHA: `55eb7519772eaf9e7fa5bdb8611ed557df2d3ae2`.
- Exact-head Quality Gate passed on `6faa9efa07d700c0f4782f9306cddb3958ff78c0`, run `42364704191`: 526 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and all 22 desktop/mobile Playwright tests passed.
- No responsive overflow was detected at the tested widths in either Ruqyah mode. This is automated browser evidence, not a substitute for manual device/screen-reader review.

## Branch hygiene
- Merged continuation branches: `docs/ruqyah-checkpoint-pr111-20261107-refresh` (PR #116), `refactor/ruqyah-lock-audio-ui-20261107` (PR #117), `fix/ruqyah-reject-signed-locators-and-bound-ids-v2-20261107` (PR #120), `docs/ruqyah-checkpoint-after-pr117-20261107` (PR #121), `feat/ruqyah-library-search-accessibility-20261107` (PR #123), `fix/ruqyah-proxy-same-origin-cors-20261107` (PR #124), `test/ruqyah-library-ui-states-v2-20261107` (PR #127), and `docs/ruqyah-checkpoint-after-pr127-20261107` (PR #130), `docs/ruqyah-branch-hygiene-20261107` (PR #131), and `fix/ruqyah-clear-stale-progress-on-corrupt-scope-20261107` (PR #135), and `a11y/ruqyah-reset-focus-return-escape-20261107` (PR #139), `docs/ruqyah-checkpoint-after-pr139-20261107` (PR #140), and `test/ruqyah-narrow-mobile-overflow-20261107` (PR #141).
- Two superseded non-PR branches remain and must not be reused: `fix/ruqyah-reject-signed-locators-and-bound-ids-20261107` (superseded by the v2 branch after main advanced) and `test/ruqyah-library-ui-states-20261107` (superseded by the v2 branch after adding the supported guest-auth flow).
- The available GitHub integration exposes branch search and ref updates but no delete-ref operation. These two branches are therefore documented as inactive rather than falsely reported as deleted; remove them through GitHub's branch UI when available.
- Other Ruqyah-named branches visible in the repository predate this continuation and were not modified or assumed to be active. Audit their associated PRs before deleting.

## Ruqyah progress corruption isolation — PR #135
- Both progress hydration and cross-tab/custom-event refresh now clear the in-memory count map when `loadRuqyahProgress()` returns `status: 'corrupt'`.
- The original corrupt storage bytes remain preserved. The component continues to block progress writes while `progressCorrupt` is true; it does not silently replace the stored record.
- The user may explicitly choose the existing recovery action, which writes an empty valid snapshot through WIRD's journal/local-only persistence path.
- Regression coverage in `e2e/ruqyah-library.spec.ts`: record a count in guest mode, corrupt the stored snapshot, dispatch `wird:ruqyah-progress-updated`, and assert the warning appears and the stale count disappears.
- Desktop and mobile Playwright projects both passed this regression in exact-head run `42363462082`.

## Quran index/API boundary
**Status: merged in PR #111 and hardened in PR #120.**
- IslamicAPI is used only as a locator index; only `instant/from-quran` is accepted.
- Educational topic/category and third-party Sunnah endpoints remain hard-disabled.
- The proxy validates coordinates against `ALL_SURAHS`, strips provider-authored text and metadata, and returns only the validated item ID and numeric locator.
- Provider-authored Arabic, translations, references, introductions, and category prose never reach the browser.
- Browser resolution uses WIRD's canonical surah metadata and verified Quran corpus.
- Arabic-Indic and Persian-Indic digits, including mixed numeral inputs, normalize to ASCII.
- Signed/negative coordinates are rejected, including signs before the surah number or after an Arabic surah-name prefix.
- Reversed ranges, out-of-range surah/ayah references, malformed/ambiguous references, oversized coordinates, and invalid/oversized numeric provider IDs fail closed.
- The extended locator library searches only canonical WIRD surah names and normalized coordinates. Filtering does not rebuild Quran text on each keystroke.

## Audio state
- `RuqyahView.tsx` no longer instantiates browser Audio objects or contains playback handlers, audio timers, audio refs, or an audio-stream mode.
- Full-program and individual verse audio controls remain visibly disabled with explanatory labels.
- Audio must remain disabled until reciter identity, exact recording content, provenance, and usage rights are independently verified. No substitute provider may be activated merely because it is available.

## CORS and rate limiting
- The Ruqyah proxy no longer emits wildcard `Access-Control-Allow-Origin`, methods, or headers. It is consumed through same-origin WIRD requests; OPTIONS does not grant cross-origin access.
- The current in-memory rate limiter remains per Serverless Instance, not globally shared. It is only a best-effort per-instance throttle, not a global abuse-prevention guarantee.
- No Redis/KV/global rate-limit backend is configured or assumed.

## Source and licensing policy
- `docs/ruqyah/SUNNI_SOURCE_POLICY.md` remains authoritative.
- No new hadith, tafsir, medical treatment claim, or religious instruction was introduced by PR #117, #120, #123, #124, or #127.
- MuslimPack Ruqayyah's code is GPL-3.0 and the app is Flutter/Dart with audioplayers, BLoC, GetIt, local storage/database, vibration, and wakelock dependencies; it is not a drop-in React module. No code was copied.
- IslamicAPI's public dataset README states broad free use without attribution, but the repository has no separate LICENSE file. Do not vendor/redistribute the dataset until formal license/legal review; the API's own terms still govern API access and fair use.

## Remaining release blockers
1. Vercel production deployment is blocked by the free-plan quota. No live production SHA/alias is verified.
2. Firestore rules deployment and production environment-variable values are not verified.
3. Live two-device sync, additive offline Ruqyah counter merge, user-facing conflict resolution, tombstones, cross-tab concurrency, and account lifecycle release gates remain open as documented in `docs/sync/RELEASE-GATES.md`.
4. Production API behavior and real-device RTL, keyboard-only, and screen-reader checks remain unverified. The Playwright browser tests are local/CI browser checks, not a deployed production session.
5. Audio remains disabled pending independent source, provenance, content, and rights verification.

## Next engineering actions
1. Perform a manual visual review at 320px–390px, tablet, and desktop widths, with special attention to RTL overflow, font rendering, long ayah ranges, and focus-ring clipping.
2. Review and, if a shared backend becomes available, replace the per-instance throttle with a global rate limit. Do not claim global protection until implemented and tested.
3. Verify the production API and live deployment after Vercel quota becomes available.
4. Complete the remaining sync release gates and live multi-device verification.

---

# WIRD Ruqyah — Engineering Checkpoint

Last updated: 2026-11-07

## Current repository state

- Repository: `xm8eslam-stack/WIRD-APP`
- Default branch: `main`
- Latest reviewed phase merge: PR #108, merge commit `4ae28edf7d30e41f11727a7b85b67d9056d78408`.
- Working checkpoint branch: `fix/ruqyah-quran-index-sanitization-20261107`.
- All eleven implementation phases below are merged to `main`.

## Merged implementation phases

| Phase | PR | Merge commit | Verification |
|---|---:|---|---|
| Canonical Quran, audio, API, content audit | #88 | `6af7ce1d27543429911ca686550bc26f446ec2e0` | 488 unit tests, 27 Firestore tests, TypeScript, build, server smoke passed |
| Journal-first Ruqyah progress sync + backup v5 | #91 | `a618036b995ff45749748e90e2a4d3ec1037c838` | 500 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Accessible counters and audio UX | #93 | `f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3` | 500 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Backup/reset refresh consistency + release checklist | #95 | `52e62d6b21057cf0d796cc3b137f4087cbe2e983` | 504 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| IslamicAPI proxy hardening + topic gate | #97 | `217f7136244d4d7afd02a9c52be86f520c1baefa` | 509 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Sunni source allowlist and unverified audio lockdown | #105 | `d71908b3e411bcd7d1db2b09318eb3c95564198e` | 509 unit tests, 31 Firestore tests, TypeScript, build, server smoke passed |
| Exact Sunni source registry and Ibn Baz treatment guidance | #108 | `4ae28edf7d30e41f11727a7b85b67d9056d78408` | 510 unit tests, 31 Firestore tests, TypeScript, build, server smoke passed |
| Guarded manual Firestore rules deploy workflow | #98 | `8089579d020a6a4831cdc9ba4f25f8672f30cc3d` | 509 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Firestore Emulator preflight for manual rules deploy | #100 | `810e5ae3b9b63cf0b9d68c0d35466af7ae118a9d` | Exact-head Quality Gate passed; manual workflow now runs rules emulator tests before credentials/deploy |
| Canonical storage migration integrity | #92 | `bd6fc3a79267ee7136746fed17c58a6ceac8b58c` | Exact-head Quality Gate passed; unversioned archive protection, duplicate IDs/ranges, stable legacy history IDs |
| Ruqyah first-sync scan + concurrent offline conflict preservation | #94 | `f2c3f32f6440bfd387168ed7fe32f66760cd9d39` | Exact-head Quality Gate passed; stale concurrent write is blocked and both snapshots/outbox/inbox/conflict evidence are retained |

Dependency audit passed in phases #93–#98. The previous main SHA `f2c3f32f6440bfd387168ed7fe32f66760cd9d39` had a Vercel `success` status, but the latest main SHA `d71908b3e411bcd7d1db2b09318eb3c95564198e` currently has Vercel `failure` with `build-rate-limit`. The Vercel dashboard target is not accessible from this session, so no production alias or live-site SHA is verified.

## Implemented architecture and behavior

### Ruqyah content and audio
1. Quran passages resolve to WIRD's canonical Quran corpus using validated surah/ayah coordinates.
2. Multi-ayah audio uses ordered global ayah queues; the first-ayah-only playback bug was removed.
3. Al Furqan's dynamic reciter catalogue and audio proxy are now blocked pending source/recording/rights verification.
4. Full-program recording URLs are empty and the playback UI is disabled pending full-content verification.
5. IslamicAPI is used only as a Quran-reference index through a server-only proxy; only `from-quran` is accepted. The proxy returns only a validated item ID and normalized numeric coordinates; provider-authored text, translations, references, and category labels are stripped. Displayed Arabic and surah metadata come from WIRD's canonical corpus.
6. Unsupported repetition counts and unsubstantiated disease/magic claims were removed.
7. Educational topic and category endpoints are hard-disabled; no environment-variable override exists. Do not reintroduce them until each article is curated from a named, reviewed Sunni source.

### Progress and synchronization
1. Progress schema v1: max 200 item IDs, each count 0–1000, validated IDs and timestamp.
2. Dedicated UID-scoped `ruqyahProgress` collection is allowlisted in local outbox, IndexedDB journal, revisioned mutation validator, remote projector, and Firestore rules.
3. Authenticated progress writes use WIRD's journal-first revisioned sync path; guests remain local-only.
4. Remote projection validates snapshots, protects pending local changes, and participates in grouped transaction rollback.
5. Initial empty UI state is not auto-uploaded before remote sync; mounted views refresh after same-tab and cross-tab progress projection.
6. Version-5 backup exports/imports progress while versions 1–4 remain supported. Legacy backups without the field preserve existing progress.
7. Journaled reset writes an empty progress snapshot as an ordered mutation; direct reset/import notify mounted readers only after successful completion.

### UI and accessibility
1. Quran and supplication text can be selected and copied.
2. Counter increments require an explicit button; clicking/selecting text no longer changes progress.
3. Counter values are bounded; fixed-target actions disable after completion.
4. Mode/category controls and progress meter expose accessible states; unverified audio controls are visibly disabled.
5. Audio playback is intentionally disabled until the reciter/source and recording provenance are verified.
6. API-key setup guidance appears only for an actual missing-key response, not generic network failures.

### API proxy security
1. Rate limiting uses Vercel-provided `x-real-ip` where available; client-controlled `x-forwarded-for` is not used as the identity.
2. In-memory rate-limit buckets are bounded; this is per-serverless-instance best effort, not a global quota.
3. Upstream body declared length is checked before reading and streaming is capped at 2 MiB, including chunked responses.
4. Topic content blocks are type-allowlisted.
5. Topic and topic-category API endpoints are hard-disabled and always reject requests.
6. Third-party Sunnah content is rejected before upstream access; backend accepts only `from-quran`.
7. Provider-authored Quran titles, Arabic strings, references, introductions, translations, and category labels are never exposed to the browser; only numeric coordinates are returned after server validation.

## Pending Phase 6 — Sunni source allowlist and audio restriction

Working branch: `fix/ruqyah-sunni-source-allowlist-20261107`

- Backend rejects IslamicAPI `from-sunnah`; only Quran index requests are accepted.
- API library offers only Quran locator data and renders canonical WIRD Quran text.
- Removed third-party full-program audio URLs; all reserved audio slots have empty URLs.
- Disabled Al Furqan dynamic reciter catalogue and audio playback. Its API route fails closed with `503 QURAN_AUDIO_SOURCE_NOT_VERIFIED`; the URL builder throws.
- Individual verse audio controls and the full-program mode are visibly disabled until the reciter, exact recording, source chain, and permissions are verified.
- Removed optional guidance/narration without sufficient review; clarified Abu Dawud 5082 as Hasan (al-Albani), Abu Dawud 5088 as Sahih (al-Albani), and Bukhari 2311 as a suspended placement with connected routes.
- Added `docs/ruqyah/SUNNI_SOURCE_POLICY.md` with the source hierarchy, checked references, blocked-source list, and required review workflow.
- Added tests for third-party Sunnah rejection, disabled full-program audio, and fail-closed unverified reciter endpoints.

Phase 6 is not merged yet. Wait for exact-head CI before merging.

## Pending Phase 7 — Reviewed source registry hardening

Working branch: `test/ruqyah-source-registry-hardening-20261107`

- Added an explicit code-level allowlist of reviewed source references for every Ruqyah item and guideline.
- The test suite now rejects any item with a missing, changed, or newly introduced source string until it is reviewed and added to the allowlist.
- Clarified the grading on all three protective-surah entries: Abu Dawud 5082 is Hasan according to al-Albani; Bukhari 5017 supports the bedtime recitation/nasf.
- Updated `docs/ruqyah/SUNNI_SOURCE_POLICY.md` with the registry rule.

Phase 7 requires exact-head CI before merge.

## Pending Phase 8 — External Quran index sanitization

Working branch: `fix/ruqyah-quran-index-sanitization-20261107`

- Disable the external `instant-category` endpoint; category labels and program descriptions from the provider are not trusted.
- Hard-disable all educational topic and topic-category endpoints, with no environment-variable override, until a fully curated Sunni source set is approved.
- The API proxy validates each Quran locator against WIRD's canonical `ALL_SURAHS` metadata and returns only `{ id, title: "surah:start-end" }`.
- Strip provider-authored Arabic text, reference labels, introductions, translations, and all other extra fields before the response reaches the browser.
- The client resolves normalized numeric coordinates to canonical surah names and verified Quran text. Provider titles are never rendered.
- Remove category-index fetches and all provider-authored content fields from the frontend type.
- Add regression tests for category endpoint rejection, exact response sanitization, hostile extra fields, and canonical text resolution.
- Update source policy, release checklist, and checkpoint.

Phase 8 requires exact-head CI before merge.

## External source and licensing decisions

- MuslimPack Ruqayyah: https://github.com/muslimpack/Ruqayyah — Flutter app under GPL-3.0. No code was copied. Reusing its source code requires a GPL-3.0 compatibility/source-distribution decision or separate permission. Its README attributes content to a published Ruqyah book; do not copy book text wholesale without rights review.
- IslamicAPI: https://islamicapi.com/doc/ruqyah/ and https://islamicapi.com/terms/ — API is described as free but requires registration/API key and is subject to fair-use restrictions. Keep `ISLAMICAPI_API_KEY` server-side.
- IslamicAPI dataset repository has no discoverable LICENSE file on its main branch. WIRD uses only the documented Quran locator API and does not vendor or redistribute the raw dataset. Topic/article endpoints are hard-disabled.

## Production release blockers — NOT VERIFIED

1. **Firestore rules are not claimed deployed.** The repository now has a guarded manual workflow `.github/workflows/deploy-firestore-rules.yml`, but it has not been dispatched.
   - Required GitHub repository variable: `FIREBASE_PROJECT_ID`.
   - Required GitHub repository secret: `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Dispatch only from `main`, enter the exact project ID, and type `DEPLOY_FIRESTORE_RULES`.
   - Workflow deploys only `firestore:rules`; it fails closed when inputs/secrets are missing.
2. **Vercel production deployment is not fully verified.** The latest main SHA `d71908b3e411bcd7d1db2b09318eb3c95564198e` has Vercel `failure` due to `build-rate-limit`; the earlier `success` on `f2c3f32f6440bfd387168ed7fe32f66760cd9d39` is not evidence that the latest main deployed. The dashboard target is inaccessible from this session. Confirm quota recovery, production alias, deployed SHA, and live site smoke before claiming production readiness.
3. **Deployed environment variables are not observable from this GitHub session.** Keep both remote-sync flags disabled until every global release gate passes, including manual conflict resolution, deterministic additive Ruqyah counter merge, tombstone semantics, cross-tab concurrency, account isolation, and verified live two-device testing.
   - `VITE_WIRD_REVISIONED_SYNC_ENABLED=true`
   - `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` only after Firestore rules deployment.
   - `ISLAMICAPI_API_KEY` server-side secret only.
4. Live two-device sync, production API, mobile RTL, and keyboard/screen-reader smoke tests have not been executed against the deployed site. Audio is intentionally disabled until its source is approved.

## Required live verification after deployment

1. On verified account A, increment a Ruqyah counter; confirm device B receives the exact count without reload.
2. Increment from B; confirm A receives it; reload both and verify convergence.
3. Test offline edit/reconnect, simultaneous edits, stale revision conflict retention, guest local-only behavior, and account switching.
4. Test version-5 export/import and legacy v4 import preservation.
5. Test reset on two devices and confirm progress is cleared through the journal.
6. Confirm unverified audio catalogue, individual verse audio, and full-program audio remain disabled; test audio only after a vetted provider and recording assets are approved.
7. Test API missing key, 429, upstream 5xx, HTML, malformed JSON, oversized/chunked body, and Arabic success.
8. Test keyboard-only navigation, screen-reader labels, text selection/copy, 320px–390px mobile widths, RTL wrapping, light/dark themes.

## Resume procedure

1. Read this checkpoint and `docs/ruqyah/RELEASE_CHECKLIST.md`.
2. Fetch current `main` SHA and all open PRs; never trust a copied SHA.
3. Review any pending PR diff and exact-head CI runs before merging.
4. Do not enable remote projection until all global release gates pass and live Firestore rules are confirmed deployed: manual conflict resolution, deterministic additive Ruqyah merge, tombstones, cross-tab concurrency, account isolation, and live two-device verification.
5. Do not expose educational topic endpoints; any future locally curated article must have named Sunni source review, rights review, and source-registry tests before implementation.
6. Only after explicit approval and all global release gates pass, configure deployment credentials and dispatch the manual rules workflow. It now runs the Firestore Emulator suite before writing credentials or deploying. Then redeploy `main` and run every live verification item above.
7. If a task is blocked by unavailable credentials or provider quota, document the exact blocker and continue with independent code review/tests; never claim the blocked production action succeeded.
