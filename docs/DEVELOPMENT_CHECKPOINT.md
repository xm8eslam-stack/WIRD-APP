# CURRENT DEVELOPMENT CHECKPOINT — 2026-11-12 (offline-first + app readiness)

> This checkpoint supersedes older statements below wherever they conflict. Historical evidence remains preserved. Source baseline reviewed: main 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b; work branch: feat/offline-first-app-readiness-20261112.

## Product-level direction

WIRD is now being developed with offline-first completeness and future app packaging as a first-class release track, in parallel with Quran, worship, Seerah, UX, and sync work. The intended future application must remain useful without a connection after a deliberate initial setup. Offline is not a promise that every third-party API or account operation works without a network.

## Existing offline foundation found on main

- PWA manifest, service-worker registration, first-visit shell caching, SPA navigation fallback, and generated Vite asset manifest already exist.
- Explicit resumable offline-package preparation downloads same-origin build assets (including lazy-loaded chunks) to a separate content cache; status reports cached/missing totals.
- Local Quran/worship data and local-first user activity already provide an offline-capable foundation.
- A browser-storage status/persistence request service exists; persistent storage is requested only after explicit user action.
- Quran/ruqyah audio currently has bounded opportunistic pre-cache, not a full offline audio library.
- Mushaf page cache is bounded; tafsir and validated hadith content are cached only after viewing and within their retention limits.
- External API routes, Firebase/Auth, uncached tafsir/hadith, and optional external ruqyah index remain network-dependent.
- EveryAyah bulk/offline audio caching is prohibited by the current rights review; only the reviewed Al Quran Cloud CDN path may be considered for explicit user-owned downloads after rechecking provider terms.

## Current offline status — do not overclaim

The repository has a meaningful offline foundation, but full offline readiness is not yet certified. Existing service-worker and preparation-service tests establish implementation contracts, not real-browser proof of offline use after restart, storage eviction resilience, every lazy route, all media, or offline-to-online reconciliation. Future app packaging is also not yet implemented or selected.

## Parallel work tracks

1. Offline audit and completeness: inspect every route, lazy chunk, image/font/data asset, navigation path, worker message, cache namespace, and storage boundary; classify bundled / explicitly downloaded / opportunistically cached / network-only.
2. Offline data reliability: move new durable user-owned content toward a transactional IndexedDB repository where appropriate; preserve existing archives and migrations; do not casually replace working local storage or sync journals.
3. Offline reading and worship: Quran text and essential daily worship content must be available locally; tafsir/hadith/API data remains source-validated and only previously cached records can be shown offline; show clear freshness/source state.
4. Audio: keep opportunistic cache separate from user-pinned downloads; only approved provider/reciter/bitrate; quota-aware, resumable, cancelable, verifiable, deletable, and never synced/backed up to cloud.
5. Offline UX: add a single understandable offline center with package readiness, storage estimate, download/resume, missing content, and explicit network-only labels; no misleading green ready state.
6. App readiness: preserve responsive PWA and installability; add platform capability checks and a future native wrapper evaluation (Capacitor first candidate, not yet adopted) only after offline web gates. Avoid premature native plugins or platform-specific rewrites.
7. Sync and recovery: offline writes remain local; online replay must be idempotent, UID-scoped, conflict-safe, and must never erase local unsynced work. Production sync flags, rules, and cutover remain owner-controlled.
8. Release verification: real-browser desktop/mobile offline test matrix, cold start/restart, airplane mode, lazy route traversal, media, account switching, quota/eviction, app update, and offline-to-online recovery.

## Release gates

- A fresh install can open the app shell; an explicit full package can finish, resume, and accurately report readiness.
- All user-facing routes needed for core Quran and daily worship are reachable offline after package completion.
- No API endpoint, credential, Firebase/Auth operation, or network-only feature is represented as offline-capable.
- Quran text stays bundled and verified; no generated substitute for Quran, hadith, tafsir, or fiqh.
- Local user data survives offline reload/restart and account/guest scope changes without leakage.
- Offline mutations reconcile online without loss or duplicate counting; do not enable production sync on the basis of browser tests alone.
- Storage limits, persistent-storage denial, quota exhaustion, partial downloads, cancellation, and cache eviction have explicit tested behavior.
- PWA installation and platform behavior are verified on target browsers; native packaging decision is evidence-based.
- Exact-head GitHub quality gate and Vercel deployment are separate; live offline smoke is a third, explicit gate.

## Active work branch

- feat/offline-first-app-readiness-20261112 is a documentation/architecture checkpoint branch from the exact main baseline above.
- PR #366 is open as Draft/HOLD for the offline package/public-asset coverage work; exact-head checks and preview remain to be verified.
- The build manifest now includes recursively discovered supported public assets in the explicit offline package, excluding sw.js so the browser can manage worker updates.
- No production deployment, Firebase rules/data, secrets, environment variables, sync flags, or user data were changed.
- No merge is authorized until code work, independent review, and exact-head quality gates are complete.

---

# CURRENT DEVELOPMENT CHECKPOINT — 2026-11-11

> This is the latest verified checkpoint. Older checkpoints below are historical and must not override this section.

## Repository and exact source state

- Repository: xm8eslam-stack/WIRD-APP; source branch: main.
- Current main SHA: `50bb25eeba2f1ed4ceae228b347c67b40f60c697` (PR #328 merge).
- Last exact-main Quality Gate before PR #328: [run 42920401307](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42920401307) — success on `3667a8c003b79984546d48a9defc20c6f2bcd367`. PR #328's separate merge-ref Quality Gate passed on run `42921569974`; a post-merge main-only run for `50bb25e` was not independently observed.
- Last documented READY Production deployment: `dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5`, source SHA `dac125dd8770cc4881e2c6cea6fe94623ad52144`. It predates current main; no matching deployment is verified.
- Post-merge GitHub Vercel status for `50bb25e` is now `success`. The Vercel deployment detail endpoint returned team-scope 403, so its exact deployment state/source SHA and live smoke could not be independently confirmed. The last documented READY deployment record remains `dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5` on `dac125dd8770cc4881e2c6cea6fe94623ad52144`; do not assume it is the new deployment. No manual deploy or quota bypass.
- Google AI Studio sync is not independently verified.

## Memorization session UX

- PR #202/#206 already provide UI scale 80–110%, Quran font size 20–44px, compact/comfortable density, focused/all-session ayah view, and sticky previous/next navigation. This implementation is present in the current Production ancestry; preferences remain local-only.
- PR #328 is merged as `50bb25eeba2f1ed4ceae228b347c67b40f60c697`; it adds a direct ayah selector to the sticky memorization/revision navigation so the user can jump within the active range without repeatedly pressing Next or scrolling.
- PR #328 head `0c41126b1e018892119ced669936335326f8b1e7`; Quality Gate run [42921569974](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42921569974) passed on the PR merge ref: 152 Playwright checks passed, 2 skipped, dependency audit found 0 vulnerabilities, Firestore Rules Emulator, TypeScript, production build, server startup smoke, and the rest of the configured workflow succeeded. The PR was reviewed and squash-merged.

## Sync integrity

- PR #325 merged at 966d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6 with stale-snapshot compare-and-set protection for weakVerses and activityEvents.
- PR #326 merged at 3667a8c003b79984546d48a9defc20c6f2bcd367; its Quality Gate passed continuous Quran playback and Mushaf controls.
- Whole-snapshot conflict choices for weakVerses and activityEvents remain blocked by syncConflictSafety. Tombstones remain unsupported and fail closed. No fresh post-PR #325 real-device A↔B test is verified.
- Next sync design: immutable/idempotent session-activity events with exact legacy DailyLog baseline handling; separately define per-collection tombstone, replay, restore, and anti-resurrection semantics. No migration or conflict-policy change until tests prove safety.

## Production and owner-only boundaries

- Vercel project metadata reports SSO protection enabled for all non-custom domains; only wird-app.vercel.app is listed. Do not change public-access settings without explicit owner approval.
- A prior Vercel inventory recorded both sync build flags as enabled; they were not re-read or changed in this follow-up. The release gate remains HOLD for full sync certification.
- No Firestore Rules/schema, production data, secrets, environment variables, or remote-sync flags were changed.
- Do not claim current main is deployed, cloud sync is fully certified, or Google AI Studio is synchronized without new direct evidence.

## Immediate continuation

1. Continue the activity-event ledger design in `docs/sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`; keep runtime migration disabled until legacy/offline-device cutover is safe.
2. Keep `weakVerses`/`activityEvents` whole-snapshot conflict choices and tombstones fail-closed; implement collection-specific semantics only after populated-record, replay, crash, and anti-resurrection tests.
3. Verify Vercel deployment only through the normal GitHub→Vercel path after quota recovery; then verify exact SHA and perform safe read-only smoke.
4. Keep all production settings, secrets, rules, and data unchanged without explicit authorization.

---

# CURRENT DEVELOPMENT CHECKPOINT — 2026-11-07

> This section supersedes the historical Phase 4 checkpoint below. Read this current section first.
> Verified repository main at the start of this checkpoint: `228bc383c2e3e57eb8c344699361c0edc0e67974` (PR #158).

## Current merged engineering state

- PR #149 merged as `78ada24ecadbda3460178550e871632f6d81d770`: explicit, confirmed use-latest-remote conflict resolution for supported upsert snapshots, with fresh Firestore revalidation, durable local evidence, atomic journal finalization, and crash recovery.
- PR #155 merged as `c620697538ef72eec3d1c2c78bb456c0403232ce`: explicit keep-local re-publication for supported single-collection upsert conflicts. It archives old mutation evidence and queues one consolidated replacement against the latest verified remote revision. It deliberately excludes grouped `syncMeta`, tombstones, and Ruqyah counters.
- PR #157 merged as `22fdd996d7aabc0669fef504c50970d5ba015d73`: V2 Ruqyah progress with per-device monotonic PN-counter components and reset watermarks; compatible V2 snapshots merge additively and idempotently. Divergent V1 legacy baselines remain blocked.
- PR #158 merged as `228bc383c2e3e57eb8c344699361c0edc0e67974`: release/checkpoint documentation for the Ruqyah V2 merge.
- Exact-head Quality Gate runs passed:
  - PR #149 head `c675a2d164b88994c08a5368bf1695712f2625f3`: run `42368745026`.
  - PR #155 head `1d4ea9d5acb5be0179af6935f79c4a100fab1ecf`: run `42370175733`.
  - PR #157 head `b2752297842d6fd30d7b4ae86eb33d48585e9ce8`: run `42372550605`.
  - PR #158 documentation head `c90af2e8838a52136e50f422981737966e104d29`: run `42372993374`.
- The checks included automated tests, Firestore Rules Emulator, dependency audit, TypeScript, production build, server smoke, and desktop/mobile Playwright where configured. Do not infer live production verification from CI.

## Current safety boundaries

- Use-remote is available only for validated supported upsert state; tombstones remain rejected.
- Keep-local is limited to supported single-collection upsert conflicts. Grouped `syncMeta`, Ruqyah counters, and tombstones are not handled by this path.
- Ruqyah V2 automatic convergence applies only when both snapshots are valid V2 and legacy baselines are compatible. Divergent V1 baselines stay archived and blocked.
- Both production sync feature flags must remain disabled until the complete global release gate passes:
  - `VITE_WIRD_REVISIONED_SYNC_ENABLED`
  - `VITE_WIRD_REMOTE_PROJECTION_ENABLED`
- Firestore rules deployment, Vercel production deployment, deployed environment values, and real production two-device behavior are not verified from this GitHub session. Vercel has previously returned `build-rate-limit`; never claim a live deployment without a confirmed deployed SHA and smoke test.
- Do not deploy rules, change secrets/environment variables, or activate production sync without explicit approval and all release gates.

## Next engineering priorities

1. Define and implement collection-specific tombstone semantics, including prevention of stale-device resurrection, durable archive/recovery, revision handling, and negative tests. Keep unsupported collection tombstones blocked.
2. Add safe grouped `syncMeta` keep-local/merge handling or an explicit, well-tested alternative; never split an atomic grouped transaction into partial writes.
3. Expand cross-tab, account-switch, offline replay, crash recovery, and populated multi-domain concurrent tests.
4. Complete backup/restore/reset stress and full authenticated browser journeys.
5. Once authorized and provider limits permit: verify Firestore rules deployment, Vercel production SHA, deployed flags, and live two-device sync/audio behavior.

## Continuation rules

- Fetch the current `main` ref and open PRs before every new change; do not rely on this checkpoint SHA after another merge.
- Never merge a code PR unless its exact current head passes the complete Quality Gate and its diff has been reviewed.
- Merge each independently passing, safe PR to `main`, then verify the merge commit and update this checkpoint.
- Keep production sync disabled and preserve local-first behavior until the full release gate is independently verified.

---

# WIRD APP — Development Checkpoint

> Last updated: 2026-11-05 — post-merge checkpoint
> Purpose: durable handoff marker. Read this file before continuing development.

## Repository and branch rules

- Repository: `xm8eslam-stack/WIRD-APP`
- Google AI Studio is connected to the default branch `main`.
- Vercel deploys from GitHub; verify the Production Branch is `main`.
- Merged working branch: `feat/phase4-data-integrity-backup-v4`.
- PR #1: merged — https://github.com/xm8eslam-stack/WIRD-APP/pull/1
- Merge commit: `bc368d6894afacf420529ca55c827a21cd695635`.
- Google AI Studio is connected to `main`; all PR #1 changes are now part of `main`.
- Never force-push or overwrite `main`.

## Exact saved point

- Last code-change HEAD before the checkpoint-only documentation commit: `38764e713ce2527eac716a9246ad5a09d426f9c4`
- Initial checkpoint documentation commit: `85e618540cfe547b49cde302c550aa1d34c91e5e`
- Latest checkpoint revision (clarified SHA labels): `e96a09d4bdde34f78a139320f2b36e6f407ac6cb`
- Previous `main` base SHA: `862f6056ac5d54abf9f26249941ba994e74bf6a9`.
- Feature head merged: `a043da31f7f8d170bcbfb0c41a0d687cf2c6b2ec`.
- Merge commit / `main` SHA verified after merge: `bc368d6894afacf420529ca55c827a21cd695635`.
- Feature-branch CI run #125 / `42088739952`: success; all steps passed.
- Merge-commit CI run `42089276504`: success; dependency installation, tests, TypeScript validation, and Vite production build all passed.
- Prior detailed source-code test summary: 181 passed, 0 failed; TypeScript and production build passed.

## Work preserved on the feature branch

The branch includes the cumulative Phase 4 work recorded in PR #1, including:

1. Backup v4 validation, canonical unified portion records, legacy migration, import write verification and storage rollback.
2. Local-calendar date correctness across profile/streak, sessions, retention, dashboard, revision, progress, advisor and settings.
3. Quran data validation and generated per-Surah chunks from the canonical complete Quran source; lazy loading in Quran Library, memorization sessions and Dashboard.
4. PWA/session audio cache with bounded retention and cache-upgrade handling.
5. Mobile ergonomics and 604-page progress map improvements.
6. On-demand Tafsir Muyassar integration with response validation, attribution and bounded local cache.
7. GitHub Actions quality gate for tests, TypeScript and production build.
8. Page progress accuracy: exact page-to-ayah segments, cross-Surah page support, no fabricated progress defaults, explicit full-page coverage, and conservative overlapping status handling.
9. Canonical backup/storage integrity: exact Surah ayah boundaries, canonical IDs, date/range validation, refusal to persist invalid records, and preserving invalid canonical data when no safe legacy recovery source exists.
10. Regression tests for the above, including partial-page completion and recovery edge cases.

For the authoritative complete change list, inspect PR #1 and compare the feature branch with `main`; this checkpoint is a handoff summary, not a substitute for reviewing the diff.

## Important files touched in the latest continuation

- `scripts/split-quran-data.mjs`
- `package.json`
- `src/services/pageProgressService.ts`
- `src/services/pageProgressService.test.ts`
- `src/services/unifiedPortionService.ts`
- `src/services/storageService.ts`
- `src/services/retentionService.ts`
- `src/services/retentionService.test.ts`
- `src/components/progress/ProgressAnalyticsView.tsx`
- `src/components/revision/RevisionCenterView.tsx`
- `src/components/dashboard/DashboardView.tsx`
- `src/tests/backupValidation.test.ts`
- `src/tests/phase3CoreRemediation.test.ts`
- `src/tests/runAllTests.ts`
- `src/tests/mobileErgonomics.test.ts`
- `api/tafsir.ts`
- `.github/workflows/ci.yml`

Always fetch the current file versions before editing; paths above are not a guarantee that no later edits occurred.

## Release / synchronization state

- PR #1 is merged and closed; `main` contains the full Phase 4 change set.
- Vercel GitHub integration reported a **Ready Preview** for the PR feature branch before merge.
- Vercel Production deployment for merge commit `bc368d6894afacf420529ca55c827a21cd695635` was rejected with `api-deployments-free-per-day` (retry in 24 hours). Production deployment is **not confirmed**.
- Google AI Studio can now sync from `main`; the actual in-app sync must be confirmed by the user because this workspace cannot inspect the AI Studio UI.
- Do not claim production deployment success.

## Known cautions / next investigations

1. Confirm the user has synced the `main` branch in Google AI Studio and inspect any sync/build feedback they report.
2. Re-check Vercel Production deployment after the free daily deployment quota resets; do not bypass the limit.
3. Re-check Quran chunk-size warning and lazy-loading behavior in built output.
4. Inspect any remaining runtime/data flows that create `WirdPortion` IDs to ensure all use `createCanonicalPortionId`.
5. Confirm storage migration does not discard recoverable data and never silently replaces invalid canonical payload with empty data.
6. Re-check exact Quran source attribution and independent Tanzil comparison before claiming textual equivalence.
7. Do not change Firebase security rules, authentication, secrets, or Vercel project settings without explicit evidence and authorization.

## Exact continuation instruction

On resumption:

1. Read this checkpoint first and verify current `main` SHA before any edits.
2. PR #1 is already merged; do not attempt to merge it again.
3. Continue with Google AI Studio sync verification and Vercel Production deployment retry only after the quota reset.
4. Before any new feature work, inspect the current repository state and run CI.
5. If a tool/context limit approaches, commit safe work and update this checkpoint with exact SHAs, CI state, deployment state, and next action.


## 2026-11-11 — Post-merge memorization navigation and sync design

- PR #328 merged to `main` as `50bb25eeba2f1ed4ceae228b347c67b40f60c697`.
- Existing memorization display controls remain: session scale 80–110%, ayah text 20–44px, compact/comfortable spacing, focused/all-session display, and device-local preferences. The new sticky selector jumps directly to any ayah in the selected session and stops active playback before switching.
- Sync design discovery is recorded in `docs/sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. No runtime sync code, Firestore Rules/schema, production flags, secrets, or user data changed in this documentation follow-up.
- Production release remains HOLD: current main deployment and live smoke are not verified; the last documented READY deployment predates this merge. Google AI Studio synchronization is also unverified.


## 2026-11-12 — PR #366 exact-head verification checkpoint

- Latest reviewed PR #366 head: 156274bde0bfedf7c7a87816918acda187376e9f.
- Vercel Preview deployment dpl_EdiisDzw8bygdpNqH98b1AiiF7QX is READY and its git source SHA matches the exact PR head. This verifies the Vite deployment build, not interactive browser/offline behavior.
- GitHub Actions run 43186509970 ended with failure, but its job reported no steps and log retrieval returned BlobNotFound. This is an unresolved runner/log infrastructure failure; no test/typecheck/build step is evidenced as having executed.
- PR #366 remains Draft/HOLD. No merge, production deployment, live browser smoke, or real-device airplane-mode test was performed.
