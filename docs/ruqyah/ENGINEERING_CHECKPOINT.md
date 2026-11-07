# WIRD Ruqyah — Engineering Checkpoint

Last updated: 2026-11-07

## Current repository state

- Repository: `xm8eslam-stack/WIRD-APP`
- Default branch: `main`
- Latest reviewed phase merge: PR #100, merge commit `810e5ae3b9b63cf0b9d68c0d35466af7ae118a9d`.
- Working checkpoint branch: `docs/ruqyah-checkpoint-refresh-20261107`.
- All nine implementation phases below are merged to `main`.

## Merged implementation phases

| Phase | PR | Merge commit | Verification |
|---|---:|---|---|
| Canonical Quran, audio, API, content audit | #88 | `6af7ce1d27543429911ca686550bc26f446ec2e0` | 488 unit tests, 27 Firestore tests, TypeScript, build, server smoke passed |
| Journal-first Ruqyah progress sync + backup v5 | #91 | `a618036b995ff45749748e90e2a4d3ec1037c838` | 500 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Accessible counters and audio UX | #93 | `f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3` | 500 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Backup/reset refresh consistency + release checklist | #95 | `52e62d6b21057cf0d796cc3b137f4087cbe2e983` | 504 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| IslamicAPI proxy hardening + topic gate | #97 | `217f7136244d4d7afd02a9c52be86f520c1baefa` | 509 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Guarded manual Firestore rules deploy workflow | #98 | `8089579d020a6a4831cdc9ba4f25f8672f30cc3d` | 509 unit tests, 29 Firestore tests, TypeScript, build, server smoke passed |
| Firestore Emulator preflight for manual rules deploy | #100 | `810e5ae3b9b63cf0b9d68c0d35466af7ae118a9d` | Exact-head Quality Gate passed; manual workflow now runs rules emulator tests before credentials/deploy |
| Canonical storage migration integrity | #92 | `bd6fc3a79267ee7136746fed17c58a6ceac8b58c` | Exact-head Quality Gate passed; unversioned archive protection, duplicate IDs/ranges, stable legacy history IDs |
| Ruqyah first-sync scan + concurrent offline conflict preservation | #94 | `f2c3f32f6440bfd387168ed7fe32f66760cd9d39` | Exact-head Quality Gate passed; stale concurrent write is blocked and both snapshots/outbox/inbox/conflict evidence are retained |

Dependency audit passed in phases #93–#98. The previous main SHA `f2c3f32f6440bfd387168ed7fe32f66760cd9d39` had a Vercel `success` status, but the latest main SHA `8089579d020a6a4831cdc9ba4f25f8672f30cc3d` currently has Vercel `failure` with `build-rate-limit`. The Vercel dashboard target is not accessible from this session, so no production alias or live-site SHA is verified.

## Implemented architecture and behavior

### Ruqyah content and audio
1. Quran passages resolve to WIRD's canonical Quran corpus using validated surah/ayah coordinates.
2. Multi-ayah audio uses ordered global ayah queues; the first-ayah-only playback bug was removed.
3. Al Furqan reciter catalogue and per-ayah audio are served through a validated server proxy.
4. Full-program recordings are separate from individual Quran reciter audio.
5. IslamicAPI provides Arabic instant-category and instant entries through a server-only proxy.
6. Unsupported repetition counts and unsubstantiated disease/magic claims were removed.
7. Educational topic endpoints remain disabled by default behind server-only `RUQYAH_TOPICS_ENABLED`; do not enable until each article and reference is reviewed.

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
4. Mode/category controls, program audio selectors, progress meter, seek/volume sliders and sleep timer expose accessible states.
5. Audio switching resets the correct source/timeline, event listeners are cleaned up, and changing reciter stops the old recitation.
6. API-key setup guidance appears only for an actual missing-key response, not generic network failures.

### API proxy security
1. Rate limiting uses Vercel-provided `x-real-ip` where available; client-controlled `x-forwarded-for` is not used as the identity.
2. In-memory rate-limit buckets are bounded; this is per-serverless-instance best effort, not a global quota.
3. Upstream body declared length is checked before reading and streaming is capped at 2 MiB, including chunked responses.
4. Topic content blocks are type-allowlisted.
5. Topic and topic-category API endpoints require server-side `RUQYAH_TOPICS_ENABLED=true`; default is disabled.

## External source and licensing decisions

- MuslimPack Ruqayyah: https://github.com/muslimpack/Ruqayyah — Flutter app under GPL-3.0. No code was copied. Reusing its source code requires a GPL-3.0 compatibility/source-distribution decision or separate permission. Its README attributes content to a published Ruqyah book; do not copy book text wholesale without rights review.
- IslamicAPI: https://islamicapi.com/doc/ruqyah/ and https://islamicapi.com/terms/ — API is described as free but requires registration/API key and is subject to fair-use restrictions. Keep `ISLAMICAPI_API_KEY` server-side.
- IslamicAPI dataset repository has no discoverable LICENSE file on its main branch. WIRD uses the documented API and does not vendor or redistribute the raw dataset. Keep topic articles disabled until content and references are reviewed.

## Production release blockers — NOT VERIFIED

1. **Firestore rules are not claimed deployed.** The repository now has a guarded manual workflow `.github/workflows/deploy-firestore-rules.yml`, but it has not been dispatched.
   - Required GitHub repository variable: `FIREBASE_PROJECT_ID`.
   - Required GitHub repository secret: `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Dispatch only from `main`, enter the exact project ID, and type `DEPLOY_FIRESTORE_RULES`.
   - Workflow deploys only `firestore:rules`; it fails closed when inputs/secrets are missing.
2. **Vercel production deployment is not fully verified.** The latest main SHA `8089579d020a6a4831cdc9ba4f25f8672f30cc3d` has Vercel `failure` due to `build-rate-limit`; the earlier `success` on `f2c3f32f6440bfd387168ed7fe32f66760cd9d39` is not evidence that the latest main deployed. The dashboard target is inaccessible from this session. Confirm quota recovery, production alias, deployed SHA, and live site smoke before claiming production readiness.
3. **Deployed environment variables are not observable from this GitHub session.** Keep both remote-sync flags disabled until every global release gate passes, including manual conflict resolution, deterministic additive Ruqyah counter merge, tombstone semantics, cross-tab concurrency, account isolation, and verified live two-device testing.
   - `VITE_WIRD_REVISIONED_SYNC_ENABLED=true`
   - `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` only after Firestore rules deployment.
   - `ISLAMICAPI_API_KEY` server-side secret only.
   - Leave `RUQYAH_TOPICS_ENABLED` unset/false.
4. Live two-device sync, production audio, production API, mobile RTL, and keyboard/screen-reader smoke tests have not been executed against the deployed site.

## Required live verification after deployment

1. On verified account A, increment a Ruqyah counter; confirm device B receives the exact count without reload.
2. Increment from B; confirm A receives it; reload both and verify convergence.
3. Test offline edit/reconnect, simultaneous edits, stale revision conflict retention, guest local-only behavior, and account switching.
4. Test version-5 export/import and legacy v4 import preservation.
5. Test reset on two devices and confirm progress is cleared through the journal.
6. Test reciter list, one-ayah and multi-ayah audio order, pause/resume, reciter switching, full-program switching, replay after end, seek, volume and sleep timer.
7. Test API missing key, 429, upstream 5xx, HTML, malformed JSON, oversized/chunked body, and Arabic success.
8. Test keyboard-only navigation, screen-reader labels, text selection/copy, 320px–390px mobile widths, RTL wrapping, light/dark themes.

## Resume procedure

1. Read this checkpoint and `docs/ruqyah/RELEASE_CHECKLIST.md`.
2. Fetch current `main` SHA and all open PRs; never trust a copied SHA.
3. Review any pending PR diff and exact-head CI runs before merging.
4. Do not enable remote projection until all global release gates pass and live Firestore rules are confirmed deployed: manual conflict resolution, deterministic additive Ruqyah merge, tombstones, cross-tab concurrency, account isolation, and live two-device verification.
5. Do not enable educational topic endpoints until a scholar/content reviewer has approved each article and its references.
6. Only after explicit approval and all global release gates pass, configure deployment credentials and dispatch the manual rules workflow. It now runs the Firestore Emulator suite before writing credentials or deploying. Then redeploy `main` and run every live verification item above.
7. If a task is blocked by unavailable credentials or provider quota, document the exact blocker and continue with independent code review/tests; never claim the blocked production action succeeded.
