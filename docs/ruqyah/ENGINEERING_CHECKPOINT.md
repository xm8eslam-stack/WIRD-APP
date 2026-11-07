# Current verified continuation — supersedes stale pending-phase notes below

Last verified: 2026-11-07, after PR #111.

## Repository and PR state
- Main merge SHA for PR #111: `48cf9b236072cd3db2603a57cda5f67b30a778cd`.
- PR #111 merged the external Quran locator sanitizer, canonical Quran text resolution, Arabic/Persian digit normalization, source/topic hard gates, and regression coverage.
- PR #112 was closed as a duplicate of the already-merged PR #111. Its final comment confirms that seven of eight changed files were byte-identical to main and that the remaining checklist wording was stale.
- PR #112 exact-head Quality Gate passed on `f5366a737eb347da3fd43c52e2c861b5b1c380d1` (run `42359009685`). This is evidence for that exact head, not a claim that the same run tested a different SHA.
- No open PRs were returned by the repository PR search at this checkpoint. Branch search is paginated; the first page returned 100 branches and a continuation cursor.
- The main SHA's combined commit status currently reports Vercel failure due to the provider quota error `api-deployments-free-per-day` / `build-rate-limit`. This is a deployment blocker, not evidence of a code-test failure.
- The commit-workflow-runs lookup returned no PR-triggered workflow runs for the queried merge SHA. Do not infer that no checks exist; use the exact PR-head Quality Gate evidence above and inspect the GitHub Actions run directly when available.

## Phase 8 — External Quran index sanitization
**Status: merged in PR #111; do not recreate this work.**
- The proxy accepts only `instant` with `from-quran`; educational topic/category and external Sunnah endpoints are hard-disabled.
- Provider data is validated against `ALL_SURAHS`; the browser receives only the validated item ID and normalized numeric locator.
- Provider-authored Arabic, translations, references, introductions, and category prose are stripped.
- The client resolves numeric coordinates into WIRD's canonical surah metadata and verified Quran corpus.
- Regression coverage includes Arabic-Indic/Persian-Indic normalization, bounds, ambiguous locators, hostile provider fields, malformed responses, and disabled endpoints.

## Current source/audio policy
- The source policy in `docs/ruqyah/SUNNI_SOURCE_POLICY.md` remains authoritative. No new hadith, tafsir, medical claim, or religious instruction was introduced by PR #111.
- Audio remains disabled pending independent verification of reciter identity, exact recording contents, provenance, and usage rights.
- IslamicAPI remains a locator only; its dataset must not be vendored or treated as an independently approved Shariah source.
- MuslimPack Ruqayyah remains GPL-3.0; no code was copied.

## Current UI review findings
- The full-program audio mode selector is disabled and individual Quran audio controls are disabled in the rendered interactive view.
- Legacy audio playback state/handlers and an unreachable `audio_stream` rendering branch remain in `RuqyahView.tsx`. They are not exposed by the current controls, but should be removed or isolated in a separately reviewed refactor with regression tests. Do not reactivate audio.
- The Quran locator library renders canonical Quran text and canonical surah names, not provider-authored text.
- Production browser/mobile/accessibility smoke tests remain unverified from this session.

## Remaining release blockers
1. Vercel deployment is blocked by the free-plan deployment quota. No live production SHA or production alias is verified.
2. Firestore rules deployment and deployed environment-variable values are not verified.
3. Live two-device sync, cross-tab/browser E2E, offline conflict resolution, additive Ruqyah counter merge, tombstones, and account lifecycle release gates remain open as documented in `docs/sync/RELEASE-GATES.md`.
4. Live API behavior, mobile RTL, keyboard-only, and screen-reader smoke tests remain unverified.
5. Audio must remain disabled until all source, content, provenance, and rights gates pass.

## Next engineering action
Complete the static and test-backed RuqyahView refactor to remove unreachable legacy audio playback code without changing the disabled UI or progress behavior. Then run the full Quality Gate on the exact PR head. Do not merge if any required check fails or is unavailable. Once merged, continue with responsive/accessibility integration tests and live release verification when provider quota and deployment access permit.

---

# WIRD Ruqyah — Engineering Checkpoint

Last updated: 2026-11-07

## Current repository state

- Repository: `xm8eslam-stack/WIRD-APP`
- Default branch: `main`
- Latest reviewed phase merge: PR #111, merge commit `48cf9b236072cd3db2603a57cda5f67b30a778cd`.
- Working checkpoint branch: `main` (all current phases merged).
- All twelve listed implementation phases are merged to `main`.

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
| External Quran index sanitization and canonical text resolution | #111 | `48cf9b236072cd3db2603a57cda5f67b30a778cd` | 513 unit tests, 31 Firestore tests, TypeScript, build, server smoke passed |
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

## Completed Phases 6–8 — Source policy, registry, and canonical Quran index

### Phase 6 — Sunni source allowlist and audio restriction (PR #105)

- IslamicAPI from-sunnah is rejected; only Quran index requests are accepted.
- Full-program and individual-verse audio, and Al Furqan dynamic reciter/audio, remain disabled pending source, exact recording, provenance, and rights verification.
- Unreviewed optional religious content was removed; the source hierarchy and reviewed hadith references are documented.

### Phase 7 — Exact content-ID source registry (PR #108)

- Every published Ruqyah item and guideline is bound to its exact reviewed source string by content ID.
- Tests reject missing, changed, duplicated, or unregistered content IDs/references.
- Abu Dawud 5082 grading is explicitly attributed to al-Albani; treatment guidance cites Shaykh Ibn Baz's named fatwa on combining Ruqyah and medical treatment.

### Phase 8 — External Quran index sanitization (PR #111)

- IslamicAPI is used only as a Quran-coordinate index. The proxy accepts only type=instant and source=from-quran; educational topic/category endpoints are hard-disabled with no environment-variable override.
- The server validates numeric IDs, Arabic/Persian digit normalization, one unambiguous coordinate/range, and surah/ayah bounds against canonical metadata.
- The proxy strips provider-authored Arabic, translations, references, introductions, titles, and all other content; it returns only an ID and normalized numeric locator.
- The browser client accepts only the Quran index request shape and resolves text/name metadata from WIRD's verified Quran corpus. Invalid IDs, out-of-range references, and ambiguous multiple-coordinate titles fail closed.
- Exact PR head 805c6c3d7b0c00ab348be4891f1f027d50529974 passed Quality Gate run 42358956417: 513 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server startup smoke.
- Main is now 48cf9b236072cd3db2603a57cda5f67b30a778cd; post-merge Main Quality Gate 42359049396 was still running when this checkpoint was written. Vercel remains build-rate-limit; no production alias/live SHA is verified.

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
