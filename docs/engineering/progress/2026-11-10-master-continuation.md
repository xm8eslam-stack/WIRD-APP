# WIRD — Master Continuation Checkpoint
## 2026-11-10

This checkpoint supplements older sync-focused resume notes. Always re-fetch the current branch, PRs, and workflow status before continuing.

## Canonical state observed

- Repository: `xm8eslam-stack/WIRD-APP`
- Canonical branch: `main` (Google AI Studio source)
- Main SHA observed: `0c462cab03ef3792a1241d20b36132684f6f173a`
- Exact main Quality Gate run: `42850126184` — passed on the observed main SHA.
- Latest production deployment observed: commit `f287670a28c8ed96b734044f96b3e3a4036c7f09`, older than the observed main SHA.
- Vercel production/preview deployments are currently blocked by the Free-plan daily deployment limit (`api-deployments-free-per-day`). Do not describe current main as live in production.
- `ISLAMICAPI_API_KEY` exists as a sensitive environment variable in both Preview and Production. Its value was not read; existence does not prove that the provider accepts it.
- No production secrets, Firebase rules, or sync feature flags were changed during this work.

## Active feature work

### PR #298 — Global sidebar controls

Branch: `feat/sidebar-global-controls-20261110`

- Physical `KeyB` with Ctrl+B / Cmd+B supports Arabic keyboard layouts.
- Shortcut is ignored in editable controls and repeated keydown events.
- Mobile/tablet drawer closes on Escape and locks background scrolling while open.
- Drawer closes when the viewport returns to desktop.
- Main reading area can use the full available width while the desktop sidebar is collapsed.
- Existing header toggle and direct sidebar X controls remain the single shared navigation system.
- First exact-head run failed because the E2E locator matched both header and sidebar close buttons. The test now targets the header toggle explicitly.
- Latest exact-head run status must be checked before merge.

PR #292 is closed as superseded by PR #298. PR #294 is closed as superseded by PR #303. PR #296 is closed as superseded by PR #302. PR #297 is closed as superseded by PR #301.

### PR #303 — Continuous Quran audio and segment repetition

Branch: `feat/quran-continuous-audio-queue-20261110`

- Added a reusable queue controller with next-ayah preloading, pause/resume, rate updates, bounded start/end ranges, finite/infinite segment repetition, cleanup, and stale-event protection.
- Integrated into the Mushaf reader and the shared memorization/revision session view.
- The Mushaf reader is also used from Reading Khatma, so the same range-repeat controls are available there.
- The current implementation preloads separate ayah files to reduce artificial gaps. Do not claim sample-accurate gapless audio where the source files contain silence or the browser/network cannot buffer in time.
- Unit and Playwright tests cover queue ordering, selected-range repetition, and playback control.
- The first run failed only a static assertion that still expected a direct audio element after the Mushaf switched to the shared queue controller. The assertion was updated to verify queue playback-rate propagation.
- Exact-head Quality Gate must be checked after that test update.

### PR #302 — Reading Khatma plan and progress

Branch: `feat/reading-khatma-plan-20261110`

- Adds configurable duration and daily reading sessions.
- Computes remaining pages, daily target, per-session target, today's unique page log, and target completion date from pages explicitly marked read.
- Supports plan updates, pause/resume, and extension of the target date by paused calendar days.
- Preserves completed-cycle history when a new Khatma starts.
- Reading progress remains local in the existing storage key; no cloud-sync schema was changed.
- The panel now shows progress, today's reading, daily session targets, target date, pause/resume, plan changes, and completed Khatma history.
- Legacy records without plan metadata are normalized to a compatible default plan.
- Exact-head Quality Gate must be checked on the latest branch SHA, not an earlier run.

### PR #301 — Ruqyah index resilience

Branch: `fix/ruqyah-index-resilience-20261110`

- The upstream IslamicAPI proxy retries transient 502/503/504 responses once.
- Provider 401 (rejected key), 429 (rate limit), unavailable source, timeout, and invalid response are reported distinctly.
- The client caches only validated numeric Quran locators and provider IDs for up to 90 days.
- When the provider fails, the UI can keep showing the last validated locator index. Actual ayah text continues to resolve exclusively from WIRD's canonical local Mushaf corpus.
- No third-party Arabic text, translation, tafsir, or religious wording is cached or displayed.
- No external dataset was bundled because the reviewed public repository did not expose explicit license metadata.
- Exact-head Quality Gate must be checked on the latest branch SHA.

## Validation and merge policy

- A completed PR workflow on an older head does not validate a later commit.
- Inspect the full job result and failure logs for every exact-head workflow.
- Fix any test failures and trigger a new run on the final SHA.
- Merge only after the exact-head Quality Gate passes and the diff is reviewed.
- Vercel deployment failure due to the daily quota is not itself a code-quality failure. The owner accepts merging safe, tested changes even if Vercel cannot deploy immediately.
- Keep `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` unchanged and disabled until the existing sync release gates are met.
- Do not alter production secrets, Firebase rules, or deployment configuration without explicit approval.

## Next work

1. Finish and inspect exact-head CI for PRs #294, #296, #297, and #298.
2. Fix any failures and rerun the full Quality Gate on the final head SHA.
3. Review diffs independently; merge only safe PRs whose exact-head gate passes.
4. Once Vercel deployment quota permits, deploy the resulting main SHA and verify the live app.
5. Test continuous playback and segment repetition on desktop, mobile, and tablet with a real audio source.
6. Verify the IslamicAPI key against the live provider after deployment; a configured variable can still contain a rejected key.
7. Verify Khatma progress survives reload and remains consistent with pages explicitly marked read.
8. Continue the broader page-by-page UI review and the existing cloud-sync work without activating sync flags.
