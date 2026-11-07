# WIRD Ruqyah — Release and External Source Review

Last reviewed: 2026-11-07

## Current merged implementation

- Phase 1: PR #88 — Quran mapping, multi-ayah playback, Al Furqan reciters, IslamicAPI proxy, and Shariah content cleanup.
- Phase 2: PR #91 — UID-scoped journal-first progress sync, revisioned Firestore writes, two-device projection, version-5 backup, and ordered reset.
- Phase 3: PR #93 — accessible counter actions, selectable Quran text, semantic audio controls, responsive layout, and accurate API-key error guidance.

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
- `RUQYAH_TOPICS_ENABLED` — leave unset/false. The educational topic endpoints remain disabled until every article and reference is reviewed; do not enable it as part of normal release.

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

### 4. Live audio and API tests

- Reciter list loads and fallback list works if the catalogue endpoint is unavailable.
- Play a single Quran ayah and a multi-ayah passage; verify order, repeat behavior, pause, stop, and switching reciters.
- Switch between full-program recordings while one is playing; confirm the old source stops and timeline resets.
- Let a full recording end; confirm pressing Play starts it again from the beginning.
- Test volume, seek, sleep timer, and browser tab backgrounding.
- Verify IslamicAPI missing-key, 429, upstream HTTP failure, HTML response, malformed JSON, and successful Arabic response.
- Confirm API key never appears in client bundles, browser network URLs, logs, or error messages.

### 5. Accessibility and responsive review

- Keyboard-only: mode selectors, category selectors, counter buttons, reciter select, play/pause, seek, volume, timer, and API details.
- Screen reader: labels, pressed/expanded states, progress percentage, loading and error live regions.
- Copy/select Quran and Sunnah text without changing counters.
- Mobile widths (320px, 360px, 390px), tablet and desktop.
- Light/dark theme, Arabic RTL wrapping, long headings, long supplications, and reduced motion.
- Confirm audio does not overlap when switching between verse and full-program playback.

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
- The dataset README describes the data as free/open source, but the public dataset repository currently has no discoverable LICENSE file. Do not vendor or redistribute the raw dataset until a clear written data license is available. Using the documented API remains subject to the provider's current API terms.
- Topic articles cover sensitive subjects such as sihr, jinn, illness, hijamah, and detoxification. WIRD intentionally does not expose the entire topic corpus as authoritative Shariah/medical guidance until each article and its references have been reviewed. Quran text must continue to resolve to WIRD's canonical Quran corpus.

## Known release blockers

- User-facing keep-local/use-remote/merge conflict resolution is not implemented.
- Ruqyah aggregate counter snapshots do not yet support deterministic additive merge for independent offline increments.
- Tombstone projection, cross-tab coordination, comprehensive account lifecycle isolation, and all-collection conflict handling remain unverified.
- Live Firestore rules deployment is not verified from this repository session.
- Vercel reports a build-rate-limit quota error; live production deployment status must be checked in the Vercel dashboard.
- The deployed values of the three environment variables above are not observable through GitHub CI.
- The proxy's per-IP limiter is an in-memory, per-serverless-instance safeguard, not a globally coordinated quota. Educational topic endpoints are disabled by default behind the server-side `RUQYAH_TOPICS_ENABLED` flag. The provider's account-level fair-use limits remain authoritative; use a shared rate-limit store only if traffic justifies it.
- Real browser/device playback and two-device cloud sync have not been run against production.

Never mark these blockers as passed based only on unit tests or emulator results.
