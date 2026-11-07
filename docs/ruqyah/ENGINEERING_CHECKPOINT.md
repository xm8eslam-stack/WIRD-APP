# WIRD Ruqyah — Engineering Checkpoint

Last updated: 2026-11-07

## Project state

- Repository: `xm8eslam-stack/WIRD-APP`
- Default branch: `main`
- Phase 1 PR #88 is merged. Merge commit: `6af7ce1d27543429911ca686550bc26f446ec2e0`.
- Phase 2 PR #91 is merged. Merge commit: `a618036b995ff45749748e90e2a4d3ec1037c838`.
- Phase 3 branch: `feat/ruqyah-ux-accessibility-20261107`
- Phase 3 objective: remove accidental counter mutations, improve keyboard/screen-reader operation, and correct audio/API error handling while preserving WIRD's visual language.

## Phase 1 completed and merged

1. Quran display uses WIRD's verified Quran corpus and validated surah/ayah ranges.
2. Multi-ayah audio queues use canonical global ayah numbers.
3. Al Furqan reciter catalogue and per-ayah playback integration are proxied and validated server-side.
4. IslamicAPI Ruqyah library is integrated through an allowlisted server proxy with API-key isolation, validation, timeout, rate-limit and cache controls.
5. Full-program recordings are distinct from individual Quran reciter audio.
6. Local Ruqyah progress has corruption detection and UID-scoped storage.
7. Repetition counts and descriptions were audited; unsupported fixed counts and unsubstantiated medical/magic claims were removed.
8. Regression tests and setup documentation were added.

Phase 1 CI passed unit tests, Firestore rules, TypeScript, production build and server startup smoke test. Vercel preview was blocked by a provider build-rate-limit quota; live audio/API browser checks remain a deployment task.

## Phase 2 changes implemented on the working branch

1. Added a shared strict schema for progress snapshots (schema v1, maximum 200 item IDs, maximum count 1000, safe timestamp and ID validation).
2. Added `ruqyahProgress` as a dedicated sync collection in:
   - local outbox validation;
   - IndexedDB journal validation;
   - remote transaction projector allowlist;
   - Firestore security rules.
3. Added storage projection support:
   - exact local conflict snapshot bytes;
   - conservative first-sync empty/non-empty detection;
   - validated remote projection;
   - grouped journal transaction rollback coverage.
4. Added `persistRuqyahProgressSnapshot` using WIRD's existing journal-first write path. Authenticated users enqueue durable mutations; guests retain local-only behavior.
5. Updated the Ruqyah UI to persist through the journal, guard account-scope changes, avoid auto-uploading an empty initial snapshot, and refresh mounted views when local or remote progress projections change.
6. Added progress to version-5 backup export/import while retaining support for backup versions 1–4.
7. Added progress to the ordered journaled reset transaction; reset no longer deletes the journal-managed progress projection out of band.
8. Added tests for journal persistence, remote projection validation, version-5 backup restore, reset behavior, Firestore allowlisting, and a two-device progress sync round trip.

## Phase 3 changes implemented on the working branch

1. Removed the page-wide `select-none` behavior so Quran and supplication text can be selected and copied.
2. Replaced card-wide click-to-increment behavior with an explicit accessible counter button. This prevents accidental counter increments while selecting or copying Quran text.
3. Added a safe upper bound to repeatable counters and disabled fixed-target controls after completion.
4. Converted full-program audio selection cards into semantic buttons with selected state and keyboard focus styling.
5. Added accessible state labels to view modes, categories, audio controls, progress meter, seek slider, volume slider, and sleep timer.
6. Improved full-program audio switching: pause old source, reset timeline metadata, load the new source, and restore stopped state on play failure.
7. Cleaned up audio event listeners on component unmount.
8. Stopped the current verse playback when the selected reciter changes so the UI cannot imply a new reader while the old reader continues.
9. API library only displays the server-key setup instructions for the specific missing-key response; other network/rate-limit/upstream errors now show their own error without misleading configuration advice.
10. Added loading/error live-region semantics and expanded/collapsed state for external-library details.

## Phase 3 verification status

- Working branch has not yet completed full CI.
- Required gates: 500+ unit suites, Firestore rules emulator, dependency audit, TypeScript, production build, server smoke test.
- Manual review still required at mobile widths, keyboard-only navigation, text selection/copy, light/dark theme, Arabic RTL layout, and actual audio playback switching.

## Critical correctness rules

- Do not auto-persist an empty progress object on first mount. It can race the first remote pull and create an avoidable revision conflict.
- Remote projection must not overwrite non-empty local progress when a local mutation is pending or the remote collection is not initialized.
- Do not directly mutate the Ruqyah progress key from the UI for authenticated users; use `persistRuqyahProgressSnapshot`.
- Do not remove the progress key after journaled reset. The reset snapshot is a normal journaled collection mutation.
- Preserve local and remote data on revision conflict. Never use last-write-wins or timestamp-only overwrites.
- The collection remains private under `users/{uid}/ruqyahProgress/snapshot`, protected by the same verified-owner revision envelope as the other collections.

## Verification status

- Source edits and regression tests are committed to the working branch.
- Full CI has not yet been observed for the latest branch head.
- Required gates: `npm test`, Firestore Rules Emulator tests, TypeScript (`npm run lint`), production build, server startup smoke test, dependency audit.
- After CI passes, review exact PR head SHA and all checks before merge.
- After merge, verify Vercel deploy and perform two-device browser smoke test: update counters on device A, observe device B, update from B, then reload A. Also test offline edits, conflict retention, guest-only mode, account switching, backup export/import and reset.
- Cloud upload/download remains gated by the existing Vite flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED`; verify their deployed values before claiming live sync is enabled.

## Resume procedure

1. Read this file and fetch the current `main`, branch and PR heads; do not trust any copied SHA.
2. Inspect every current diff, especially the collection allowlists and storage projection maps.
3. Inspect CI logs and fix all test/type/build/rules failures.
4. Run/review two-device Firestore emulator test and confirm the progress collection round trip.
5. Merge only after all required code checks pass. Treat a Vercel quota failure separately from code CI.
6. Complete Phase 3 UI/accessibility CI and review; merge only after the exact head passes.
7. Continue with post-deploy audio/API smoke tests and the remaining RTL/accessibility review.
