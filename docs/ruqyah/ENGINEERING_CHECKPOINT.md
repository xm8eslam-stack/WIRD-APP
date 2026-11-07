# Current verified continuation — after PR #120

Last verified: 2026-11-07.

## Current repository and merged work
- Repository: `xm8eslam-stack/WIRD-APP`; base branch: `main`.
- PR #111 merged Quran index sanitization and canonical WIRD Quran text resolution. Merge SHA: `48cf9b236072cd3db2603a57cda5f67b30a778cd`.
- PR #116 refreshed this checkpoint. Merge SHA: `d49e2f57ad81bfba22722ba513c85382b74879f7`.
- PR #117 removed dormant verse/full-program audio playback code from `RuqyahView.tsx`, retaining visibly disabled audio notices and all reading/progress functionality. Merge SHA: `673ddfcb5af046f785e2da18abc73c4a1bba2339`.
- PR #120 tightened external Quran locator validation and provider item IDs. Merge SHA: `66d3ac74d8402fb13718ff38d8c7ad4bb889cd89`.
- PR #117 exact-head Quality Gate passed on `8cdfc2bb94a18522f17ae8270ca22fc9929652de`, run `42359507976`: 518 unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- PR #120 exact-head Quality Gate passed on `bc95c5a0018b32be6d8868c85ec556afb6a4eed4`, run `42359703038`: 520 unit/integration assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server smoke test all passed.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit`. This is a deployment quota failure, not a code Quality Gate failure. No live production alias or deployed SHA is verified.

## Phase 8 — Quran index/API boundary
**Status: merged in PR #111 and hardened in PR #120.**
- IslamicAPI is used only as a locator index; only `instant/from-quran` is accepted.
- Educational topic/category and third-party Sunnah endpoints remain hard-disabled.
- The proxy validates coordinates against `ALL_SURAHS`, strips provider-authored text and metadata, and returns only the validated item ID and numeric locator.
- Provider-authored Arabic, translations, references, introductions, and category prose never reach the browser.
- Browser resolution uses WIRD's canonical surah metadata and verified Quran corpus.
- Arabic-Indic and Persian-Indic digits, including mixed numeral inputs, normalize to ASCII.
- Signed/negative coordinates are rejected, including signs before the surah number or after an Arabic surah-name prefix.
- Reversed ranges, out-of-range surah/ayah references, malformed/ambiguous references, oversized coordinates, and invalid/oversized numeric provider IDs fail closed.
- PR #120 regression coverage passed on exact head for signed coordinates, mixed numeral normalization, and oversized IDs.

## Audio state
- `RuqyahView.tsx` no longer instantiates browser Audio objects or contains playback handlers, audio timers, audio refs, or an audio-stream mode.
- Full-program and individual verse audio controls remain visibly disabled with explanatory labels.
- Audio must remain disabled until reciter identity, exact recording content, provenance, and usage rights are independently verified. No substitute provider may be activated merely because it is available.

## Source and licensing policy
- `docs/ruqyah/SUNNI_SOURCE_POLICY.md` remains authoritative.
- No new hadith, tafsir, medical treatment claim, or religious instruction was introduced by PR #117 or #120.
- MuslimPack Ruqayyah's code is GPL-3.0 and the app is Flutter/Dart with audioplayers, BLoC, GetIt, local storage/database, vibration, and wakelock dependencies; it is not a drop-in React module. No code was copied.
- IslamicAPI's public dataset README claims broad free-use permission, but the repository has no separate LICENSE file. Do not vendor/redistribute the dataset until the permission is legally clarified; the API's own terms still govern API access and fair use.

## Remaining release blockers
1. Vercel production deployment is blocked by the free-plan quota. No live production SHA/alias is verified.
2. Firestore rules deployment and production environment-variable values are not verified.
3. Live two-device sync, additive offline Ruqyah counter merge, user-facing conflict resolution, tombstones, cross-tab concurrency, and account lifecycle release gates remain open as documented in `docs/sync/RELEASE-GATES.md`.
4. Production API, mobile RTL, keyboard-only, screen-reader, and real-device smoke tests remain unverified.
5. Audio remains disabled pending independent source, provenance, content, and rights verification.

## Next engineering actions
1. Review Ruqyah reading and locator-library UI at 320px–390px, tablet, and desktop widths; inspect RTL overflow and focus/keyboard behavior.
2. Add meaningful integration coverage for API library loading, error, empty, and successful canonical-text states.
3. Continue security review of proxy abuse limits and production behavior; distinguish per-instance rate limiting from a global quota.
4. Complete live release verification only when Vercel quota and production access are available.

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
