# WIRD Ruqyah — Release and External Source Review

Last reviewed: 2026-11-07

## Current merged implementation

- Phase 1: PR #88 — Quran mapping, multi-ayah playback, Al Furqan reciters, IslamicAPI proxy, and Shariah content cleanup.
- Phase 2: PR #91 — UID-scoped journal-first progress sync, revisioned Firestore writes, two-device projection, version-5 backup, and ordered reset.
- Phase 3: PR #93 — accessible counter actions, selectable Quran text, responsive layout, and accurate API-key error guidance. Audio was subsequently disabled pending source and rights verification.
- Phase 4: PR #105 — reviewed Sunni source policy, Quran-index-only external API usage, and lockdown of unverified recitation/audio sources.
- Phase 5: PR #108 — exact content-ID-to-source registry and named Ibn Baz fatwa reference for combining Ruqyah and medical treatment.
- Phase 6: PR #111 — strict Quran-coordinate sanitization, hard-disabled topic/category endpoints, and canonical WIRD Quran text rendering.
- Phase 7: PR #117 — removed dormant legacy audio playback code and all hidden browser audio handlers while retaining disabled safety notices.
- Phase 8: PR #120 — rejects signed/negative Quran coordinates, mixed/ambiguous/out-of-range locators, and invalid or oversized provider IDs.

The code quality gate passed on each phase. This document records the remaining release work that cannot be truthfully claimed from emulator/build checks alone.

## Deployment gates — do these in order

### 1. Deploy Firestore Security Rules first

`firebase.json` points to the repository's `firestore.rules`. The repository now includes a guarded, manual workflow at `.github/workflows/deploy-firestore-rules.yml`. It deploys only rules, runs only from `main`, and requires both the exact project ID and the typed confirmation `DEPLOY_FIRESTORE_RULES`. It does not deploy automatically on every commit. A checked-in `.firebaserc` is intentionally not required.

Before enabling remote Ruqyah progress sync:

1. Identify the exact Firebase project ID used by the deployed WIRD application from Firebase Console / deployment configuration.
2. Add repository variable `FIREBASE_PROJECT_ID` with that exact ID.
3. Add repository secret `FIREBASE_SERVICE_ACCOUNT_JSON` containing a deployment service-account JSON with permission to publish Firestore Security Rules. Keep this secret out of the repository and all client environments.
4. Review the diff in `firestore.rules` and confirm `ruqyahProgress` is in the owner-scoped collection allowlist.
5. From GitHub Actions, select **Deploy Firestore Rules (Manual)** on the `main` branch, enter the exact project ID, and type `DEPLOY_FIRESTORE_RULES`.
6. Verify the workflow succeeded and the deployed rules version in Firebase Console; test a verified user write/read against `users/{uid}/ruqyahProgress/snapshot`.
7. Confirm unauthenticated, unverified, and cross-user access is denied.

If the repository variable/secret is not configured, the workflow fails closed before deployment.

Do not turn on remote projection before this deployment is confirmed.

### 2. Verify Vercel environment and deployment

The repository's `vercel.json` enables automatic deployment for `main` and disables preview deployments for other branches. The Vercel integration returned a build-rate-limit quota failure during the reviewed PRs. This is a provider quota issue, not a failed code quality gate.

**STOP — do not enable production sync at the current checkpoint.** The values below are documented for a future release only. Do not set either remote-sync flag until every global gate in docs/sync/RELEASE-GATES.md passes, especially user-facing conflict resolution, deterministic Ruqyah additive-increment resolution, tombstone semantics, cross-tab concurrency, account isolation, and verified live two-device testing. These gates are currently open.

In the Vercel project settings, verify the following variables are present in the correct Production environment:

- `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` — future release only; keep disabled until all global release gates pass.
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` — future release only; keep disabled until all global release gates pass and Firestore rules are deployed.
- `ISLAMICAPI_API_KEY` — server-side secret only; never prefix it with `VITE_`, never expose it to browser code.

Redeploy `main` after changing variables. Verify the deployment commit SHA equals the merged `main` commit and the deployment is Ready before testing.

### 3. Live two-device sync test

Use two real browsers/devices signed in to the same verified account:

1. Start with an account whose Ruqyah progress is known.
2. Increment a counter on device A; verify the local UI updates immediately.
3. Wait for sync; verify the exact count appears on device B without reload.
4. Increment another counter on device B; verify device A receives it.
5. Reload both devices and confirm convergence.
6. Repeat with network offline on A, then reconnect and confirm the queued mutation uploads.
7. Switch to another account and confirm the first account's Ruqyah progress is not visible.
8. Test guest mode; guest progress must remain local-only.
9. Test simultaneous edits and stale revisions; conflicts must preserve recoverable local and remote values. Do not accept last-write-wins overwrites.
10. Verify that two offline increments from the same base are not presented as an automatically merged total. Current snapshot semantics block and archive the conflict; they do not compute the additive result. Do not enable production sync until the user-facing resolution flow can resolve this case without losing increments.

### 4. Quran index API and disabled audio safety

- Verify IslamicAPI returns only validated Quran locators; provider-authored Arabic, translation, reference prose, introductions, and category data must never reach the browser.
- Verify valid ASCII/Arabic/Persian numeral coordinates resolve to WIRD's canonical Quran text and surah metadata.
- Verify missing-key, 429, upstream HTTP failure, HTML, malformed JSON, out-of-range coordinates, and ambiguous multi-coordinate titles fail safely.
- Confirm the full-program audio mode selector and individual verse audio controls remain disabled and cannot be activated by mouse or keyboard. The legacy audio-stream mode and player handlers were removed in PR #117.
- Confirm RuqyahView contains no browser Audio instantiation or playback handler, and no audio request starts when changing programs, retrying API requests, or remounting the view.
- Confirm the API key never appears in client bundles, browser request URLs, logs, or error messages.

### 5. Accessibility and responsive review

- Keyboard-only: mode selectors, category selectors, counter buttons, API details, and retry action. Disabled audio controls must not appear as active keyboard targets.
- Screen reader: labels, disabled audio notice, pressed/expanded states, progress percentage, loading and error live regions.
- Copy/select canonical Quran and reviewed Sunnah text without changing counters.
- Mobile widths (320px, 360px, 390px), tablet and desktop.
- Light/dark theme, Arabic RTL wrapping, long headings, long supplications, and reduced motion.
- Confirm no audio starts or overlaps while the audio feature remains disabled.

## Sunni content and audio gate

See `docs/ruqyah/SUNNI_SOURCE_POLICY.md` for the exact source hierarchy and checked hadith references.

- IslamicAPI is permitted only as a Quran locator. Its `from-sunnah` and category endpoints are rejected; the proxy strips all provider-authored fields and returns only validated numeric coordinates and an item ID. Canonical Quran text and surah metadata are rendered from WIRD's verified corpus.
- Educational topic and category endpoints are hard-disabled in the proxy. Do not reintroduce them until each article is curated from a named, reviewed Sunni source and passes the source registry tests.
- Full-program recordings and Al Furqan's dynamic reciter/audio provider are disabled. No unverified audio catalogue or recording URL is exposed.
- Do not re-enable any disabled content/audio mode without a source record, exact verification, usage-rights review, and regression tests.

## External project and license review

### MuslimPack Ruqayyah

Repository: https://github.com/muslimpack/Ruqayyah

- The repository's LICENSE file is GNU GPL-3.0.
- It is a Flutter application, not a drop-in React/web module.
- Useful product ideas reviewed: separate feedback settings for count/single completion/all completion, adjustable feedback volume, haptics, and a layered audio manager.
- No source code from this repository has been copied into WIRD. Reusing or adapting its code in a distributed WIRD build would require a GPL-3.0 compatibility and source-distribution decision. Implement equivalent behavior independently unless the project explicitly adopts GPL-3.0 obligations or obtains separate permission.
- Its README attributes its Ruqyah content to the book `الرقية الشرعية من القرآن والسنة النبوية` by Dr. Khalid bin Abdulrahman Al-Jarisi. Do not copy book text wholesale without checking the relevant text rights and source attribution.

### IslamicAPI and its dataset

- API documentation: https://islamicapi.com/doc/ruqyah/
- The documented API exposes 308 instant recitation entries across three programs and 146 educational articles across 13 topics, with Arabic and other language support.
- The API endpoint requires an API key. WIRD uses a server-side proxy; the key must remain a server secret.
- The API is free of charge but requires registration and an API key. The provider's terms also reserve fair-use rate limiting and suspension rights; do not interpret "free" as unlimited requests. See https://islamicapi.com/terms/.
- The public dataset README states that the data may be used for personal, educational, commercial, and other purposes without attribution, but the repository has no separate LICENSE file. Treat this as a README permission statement rather than an SPDX license; do not vendor or redistribute the raw dataset until formal license/legal review. API access still requires a key and remains subject to the provider's fair-use terms. WIRD currently uses the API only as a Quran locator.
- Topic articles cover sensitive subjects such as sihr, jinn, illness, hijamah, and detoxification. WIRD intentionally does not expose the entire topic corpus as authoritative Shariah/medical guidance until each article and its references have been reviewed. Quran text must continue to resolve to WIRD's canonical Quran corpus.

## Known release blockers

- User-facing keep-local/use-remote/merge conflict resolution is not implemented.
- Ruqyah aggregate counter snapshots do not yet support deterministic additive merge for independent offline increments.
- Tombstone projection, cross-tab coordination, comprehensive account lifecycle isolation, and all-collection conflict handling remain unverified.
- Live Firestore rules deployment is not verified from this repository session.
- Vercel reports a build-rate-limit quota error; live production deployment status must be checked in the Vercel dashboard.
- The deployed values of the three environment variables above are not observable through GitHub CI.
- The proxy's per-IP limiter is an in-memory, per-serverless-instance safeguard, not a globally coordinated quota. Educational topic endpoints are hard-disabled regardless of environment variables. The provider's account-level fair-use limits remain authoritative; use a shared rate-limit store only if traffic justifies it.
- Real browser/device playback and two-device cloud sync have not been run against production.

Never mark these blockers as passed based only on unit tests or emulator results.
