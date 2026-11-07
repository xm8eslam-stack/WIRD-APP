# WIRD Engineering Checkpoint — current state after PR #157

Last verified: 2026-11-07.

## Latest verified continuation — PR #157 merged

- Current main merge SHA: `22fdd996d7aabc0669fef504c50970d5ba015d73` (PR #157, squash merge).
- Exact tested PR head: `b2752297842d6fd30d7b4ae86eb33d48585e9ce8`; WIRD Quality Gate run `42372550605` (#2977) completed successfully on that exact head.
- Passed gates: 551 automated assertions; Firestore Rules Emulator 31/31; approved Quran audio CDN/range probes 8/8; TypeScript; production build; production server startup smoke; desktop/mobile Playwright 30/30.
- PR #157 replaces scalar last-write-wins Ruqyah progress snapshots with V2 per-device monotonic increment components and reset watermarks. Component-wise max merge is deterministic, idempotent, and order-independent. Independent offline increments are preserved; concurrent resets of the same observed baseline do not double-subtract; increments unseen by a reset survive.
- The remote projector auto-merges only when both local and remote snapshots are valid V2 and their migrated legacy baselines are compatible. V1 snapshots are migrated through a shared `legacy` baseline. Different non-zero legacy baselines are ambiguous because pre-V2 per-device increments cannot be reconstructed; these conflicts remain archived and blocked rather than guessed.
- Valid pending V1 Ruqyah Outbox writes are superseded atomically by a validated V2 full-snapshot mutation during migration; immutable journal events remain preserved. Malformed or unsupported pending entries fail closed.
- Firestore Rules now require the complete V2 Ruqyah snapshot envelope for new writes, preventing an old V1 client from overwriting V2 device components. This is a repository rule change only; production Firestore rules deployment has not been verified.
- PR #149 (use latest remote), PR #155 (keep local for supported single-collection upserts), and PR #157 (automatic V2 Ruqyah counter merge) are merged. User-authored merge, tombstone/delete resolution, grouped `syncMeta` conflict resolution, cross-tab coordination, and comprehensive account lifecycle isolation remain open.
- Both production sync feature flags remain disabled. Vercel still reports `build-rate-limit`; no production deployment, live audio playback, deployed Firestore Rules, or real-device production sync is claimed.
- Next: implement/test tombstone and offline deletion semantics, grouped `syncMeta` conflict handling, cross-tab/account lifecycle isolation, then verify deployed rules and live two-device sync after deployment quota recovery.

## Historical sync continuation — PR #149 merged (superseded by PR #155)

- Current verified main head after the merge: `78ada24ecadbda3460178550e871632f6d81d770`.
- PR #149 (feat(sync): add confirmed use-remote conflict resolution) merged successfully with squash merge SHA `78ada24ecadbda3460178550e871632f6d81d770`.
- Exact tested PR head: `c675a2d164b88994c08a5368bf1695712f2625f3`; WIRD Quality Gate run `42368745026` (#2871) completed successfully on that exact head.
- Passed gates: dependency audit, automated test suites, approved Quran audio CDN availability/byte-range checks, Firestore Rules Emulator, TypeScript, production build, production server startup smoke, and desktop/mobile Playwright smoke.
- PR #149 implements only the explicit, user-confirmed use latest remote snapshot decision. It validates the full remote revision/schema envelope, rechecks the snapshot immediately before commit, archives the relevant local mutations, atomically commits journal transitions, supports safe cancellation, and detects the already-projected snapshot recovery case.
- At the PR #149 checkpoint, keep-local re-publication had not yet been implemented; PR #155 later added a narrow supported path. User-authored merge, collection-specific tombstone resolution, deterministic additive merge for independent offline Ruqyah increments, cross-tab coordination, and verified live two-device production sync remain open.
- Both production sync feature flags remain disabled. No Firebase rules, production settings, secrets, or user records were changed by PR #149.
- Vercel production deployment and live audio playback remain unverified due the previously reported Free-plan build/deployment quota. Do not treat CI success as a production deployment.
- Next after PR #155: implement deterministic additive Ruqyah counter reconciliation, then tombstone/delete semantics and grouped syncMeta resolution, followed by cross-tab/account lifecycle and live two-device tests.


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

## Screen-reader progress announcements — PR #145
- PR #144 refreshed this checkpoint and release checklist through the narrow-screen regression coverage; merge SHA: `fff12b41aa87103ea9cfc53054ef583240f7c860`.
- PR #145 marks each reading counter as an atomic polite live status region and supplies explicit Arabic accessible labels for both free-reading counts and source-defined remaining repetition counts.
- PR #145 merge SHA: `3452c7bfe8c2ac5095fe6c7ced454a3588dc3c7c`.
- PR #146 documented merged and superseded Ruqyah work branches; merge commit `8379fdeb7f3891f95c3f1c71dd7e225b96c58a73`.
- PR #147 completed the merged branch inventory; merge commit `ccd9e44c896d334b57688afddbba05f9e5c1dc13`. Exact-head Quality Gate passed on `ed897f22801cda8c9b7674df355b04536571f460`, run `42365509031`: 526 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and 24 desktop/mobile Playwright tests passed.
- PR #148 added durable UID-bound conflict-resolution decision intents; merge commit `7b8b92dab41b3996483c38b5da9033c7e350fb5e`. Its changes are in `docs/sync/CONFLICT-RESOLUTION.md`, `src/services/indexedDbSyncJournal.ts`, `src/services/indexedDbSyncJournal.test.ts`, and `src/services/localSyncOutbox.ts`; the audio restoration branch was rebased onto this main SHA without overlapping those files.
- PR #150 restored curated Al Quran Cloud ayah-level audio playback; merge commit `c1e480b94c08df152fb75c797ddc0caeebc148e6`. Exact-head Quality Gate passed on `36fa7642b5027cb70d1bdaf7cd95653be82bcee4`, run `42367520935`: 533 automated assertions, 31 Firestore Rules Emulator tests, 8/8 live CDN smoke probes, dependency audit, TypeScript, production build, server smoke, and 30 desktop/mobile Playwright tests passed.
- PR #151 refreshed the engineering checkpoint and release checklist after PR #150; merge commit `6173ba3a5bf2c518d5f077370f7fa52c8a9d6323`.
- Exact-head Quality Gate passed on `a19038862946025780f4f9f41c2609900d022ff3`, run `42365003132`: 526 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and all 24 desktop/mobile Playwright tests passed.
- Regression verifies that the free Al-Fatihah count changes from 0 to 1 with a live label, and the Al-Ikhlas source-defined remaining count changes to 2 of 3 after recording.
- No Quran text, hadith, fixed repetition values, or source registry changed.

## Quran audio restoration — PR #150 merged; production verification pending
- Merged PR: #150, branch `feat/ruqyah-audio-restoration-alqurancloud-20261107`; merge commit `c1e480b94c08df152fb75c797ddc0caeebc148e6`.
- Exact-head validation: `36fa7642b5027cb70d1bdaf7cd95653be82bcee4`, Quality Gate run `42367520935`: 533 automated assertions passed; 31 Firestore Rules Emulator tests passed; 8/8 live CDN MP3/range probes passed; dependency audit, TypeScript, production build, server smoke, and 30 desktop/mobile Playwright tests passed.
- Source: Al Quran Cloud terms and CDN documentation; WIRD uses ayah-level educational streaming only and does not mirror or bundle files. Provider terms state that recitations are licensed by reciters or their estates; audio source history and third-party copyright caveats are recorded in `SUNNI_SOURCE_POLICY.md`.
- Curated API edition IDs: `ar.husary`, `ar.minshawi`, `ar.abdulbasit`, `ar.sudais`, `ar.shuraim`, `ar.ajamy`, and `ar.alafasy`. The implementation maps API edition IDs to actual CDN folders and their documented 64/128/192 kbps rates.
- Restored per-ayah and current-section Quran playlists from WIRD's canonical local ayah coordinates, with reciter selection, pause/resume/stop, seek, volume, sequential playback, one managed audio instance, navigation cleanup, and no silent source fallback.
- Audio completion never increments reading counters. Audio playback does not provide or modify Quran text.
- Full-program recordings containing supplications remain disabled because no complete recording has passed content, reciter, and rights verification.
- Acoustic limitation: provider metadata, terms, CDN directory inventory, and eight representative live audio endpoints were checked. CI does not constitute human listening review of every recording.
- Vercel reports `build-rate-limit` on the Free plan. Code is merged, but the latest Production deployment and playback on the live site are not verified. Do not claim production audio is live until a deployment tied to `c1e480b94c08df152fb75c797ddc0caeebc148e6` succeeds and is tested on real devices.
- Next: after a successful deployment, test multiple reciters, first/middle/final ayahs, seek, pause/resume, weak connectivity, category navigation, and single-instance cleanup on phone and desktop. Keep full-program recordings disabled until a separate rights/content audit.

## Branch hygiene
### Merged continuation branches
- PR #116: `docs/ruqyah-checkpoint-pr111-20261107-refresh`
- PR #117: `refactor/ruqyah-lock-audio-ui-20261107`
- PR #120: `fix/ruqyah-reject-signed-locators-and-bound-ids-v2-20261107`
- PR #121: `docs/ruqyah-checkpoint-after-pr117-20261107`
- PR #123: `feat/ruqyah-library-search-accessibility-20261107`
- PR #124: `fix/ruqyah-proxy-same-origin-cors-20261107`
- PR #127: `test/ruqyah-library-ui-states-v2-20261107`
- PR #130: `docs/ruqyah-checkpoint-after-pr127-20261107`
- PR #131: `docs/ruqyah-branch-hygiene-20261107`
- PR #135: `fix/ruqyah-clear-stale-progress-on-corrupt-scope-20261107`
- PR #136: `docs/ruqyah-checkpoint-after-pr135-20261107`
- PR #137: `fix/ruqyah-confirm-progress-reset-20261107`
- PR #138: `docs/ruqyah-checkpoint-after-pr137-20261107`
- PR #139: `a11y/ruqyah-reset-focus-return-escape-20261107`
- PR #140: `docs/ruqyah-checkpoint-after-pr139-20261107`
- PR #141: `test/ruqyah-narrow-mobile-overflow-20261107`
- PR #144: `docs/ruqyah-checkpoint-after-pr141-20261107`
- PR #145: `a11y/ruqyah-live-progress-announcements-20261107`
- PR #146: `docs/ruqyah-checkpoint-after-pr145-20261107`
- PR #147: `docs/ruqyah-complete-branch-hygiene-20261107`
- PR #150: `feat/ruqyah-audio-restoration-alqurancloud-20261107`
- PR #151: `docs/ruqyah-audio-merged-checkpoint-20261107`

### Superseded non-PR branches
- `fix/ruqyah-reject-signed-locators-and-bound-ids-20261107` — superseded by the v2 branch after main advanced.
- `test/ruqyah-library-ui-states-20261107` — superseded by the v2 branch after adding the supported guest-auth flow.
- `feat/ruqyah-audio-restoration-final-20261107` — redundant ref created from PR #150's tested head after the PR was already merged; it has no unique commits and no associated PR.

### Current documentation work
- `docs/ruqyah-checkpoint-after-pr150-20261107` is the active documentation-only branch for this checkpoint refresh; it is not a runtime feature branch.

### Cleanup limitation
- The available GitHub integration exposes branch search and ref updates but no delete-ref operation. The superseded and redundant branches are documented as inactive, not falsely reported as deleted; remove them through GitHub's branch UI when available.
- Other Ruqyah-named branches that predate this continuation were not modified or assumed to be active. Audit their associated PRs before deleting.

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

## Audio state — after merged PR #150
- `RuqyahView.tsx` owns one managed browser Audio instance for Quran ayah playback and current-section playlists.
- The enabled source is the curated Al Quran Cloud allowlist recorded in `SUNNI_SOURCE_POLICY.md`; API edition IDs map to actual CDN folders and documented bitrates.
- The player supports reciter selection, play/pause/resume/stop, progress seeking, volume, sequential ayah playback, and cleanup on category changes, library navigation, and unmount.
- Audio is derived from WIRD's local canonical ayah coordinates. It never supplies Quran text or increments reading counters.
- Full-program recordings containing supplications remain disabled until a complete reciter, content, provenance, and rights audit is completed.
- CI's eight live endpoint probes validate representative MPEG files and byte-range responses; they are not a human listening audit of every file.
- Production playback remains unverified because Vercel is blocked by the Free-plan build-rate-limit.

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
3. Live production two-device sync, divergent legacy Ruqyah conflict resolution, grouped/user-authored conflict resolution, tombstones, cross-tab concurrency, and account lifecycle release gates remain open as documented in `docs/sync/RELEASE-GATES.md`. Compatible V2 Ruqyah counter merge is implemented and Emulator-tested by PR #157.
4. Production API behavior and real-device RTL, keyboard-only, and screen-reader checks remain unverified. The Playwright browser tests are local/CI browser checks, not a deployed production session.
5. Ayah-level audio passed exact-head CI and is merged in PR #150; production playback remains unverified until Vercel deployment quota recovers. Full-program recordings remain disabled pending separate content and rights verification.

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
2. Multi-ayah Quran audio uses ordered global ayah queues and the curated Al Quran Cloud CDN mapping merged in PR #150.
3. Al Furqan's dynamic reciter catalogue and audio proxy remain blocked pending independent source/recording/rights verification.
4. Full-program recording URLs remain unavailable and the full-program control remains disabled pending full-content verification.
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
4. Mode/category controls and progress meter expose accessible states; the ayah-level player has accessible reciter, status, progress, volume, and playback controls.
5. The Al Quran Cloud ayah-level source is enabled under the documented educational-streaming policy; full-program recordings remain disabled.
6. API-key setup guidance appears only for an actual missing-key response, not generic network failures.

### API proxy security
1. Rate limiting uses Vercel-provided `x-real-ip` where available; client-controlled `x-forwarded-for` is not used as the identity.
2. In-memory rate-limit buckets are bounded; this is per-serverless-instance best effort, not a global quota.
3. Upstream body declared length is checked before reading and streaming is capped at 2 MiB, including chunked responses.
4. Topic content blocks are type-allowlisted.
5. Topic and topic-category API endpoints are hard-disabled and always reject requests.
6. Third-party Sunnah content is rejected before upstream access; backend accepts only `from-quran`.
7. Provider-authored Quran titles, Arabic strings, references, introductions, translations, and category labels are never exposed to the browser; only numeric coordinates are returned after server validation.

## Historical Phase 6 record — Sunni source allowlist and audio restriction (merged in PR #105)

Working branch: `fix/ruqyah-sunni-source-allowlist-20261107`

- Backend rejects IslamicAPI `from-sunnah`; only Quran index requests are accepted.
- API library offers only Quran locator data and renders canonical WIRD Quran text.
- Removed third-party full-program audio URLs; all reserved audio slots have empty URLs.
- Disabled Al Furqan dynamic reciter catalogue and audio playback. Its API route fails closed with `503 QURAN_AUDIO_SOURCE_NOT_VERIFIED`; the URL builder throws.
- Individual verse audio controls and the full-program mode are visibly disabled until the reciter, exact recording, source chain, and permissions are verified.
- Removed optional guidance/narration without sufficient review; clarified Abu Dawud 5082 as Hasan (al-Albani), Abu Dawud 5088 as Sahih (al-Albani), and Bukhari 2311 as a suspended placement with connected routes.
- Added `docs/ruqyah/SUNNI_SOURCE_POLICY.md` with the source hierarchy, checked references, blocked-source list, and required review workflow.
- Added tests for third-party Sunnah rejection, disabled full-program audio, and fail-closed unverified reciter endpoints.

Phase 6 was superseded and merged through PR #105; current audio status is recorded above and in the source policy.

## Historical Phase 7 record — reviewed source registry hardening (merged in PR #108)

Historical working branch: `test/ruqyah-source-registry-hardening-20261107`

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
4. Live two-device sync, production API, mobile RTL, and keyboard/screen-reader smoke tests have not been executed against the deployed site. Ayah-level Quran audio is merged in PR #150, but production playback is not verified because Vercel is blocked by `build-rate-limit`; full-program audio remains disabled pending separate source and rights review.

## Required live verification after deployment

1. On verified account A, increment a Ruqyah counter; confirm device B receives the exact count without reload.
2. Increment from B; confirm A receives it; reload both and verify convergence.
3. Test offline edit/reconnect, simultaneous edits, stale revision conflict retention, guest local-only behavior, and account switching.
4. Test version-5 export/import and legacy v4 import preservation.
5. Test reset on two devices and confirm progress is cleared through the journal.
6. After a successful deployment, verify PR #150's ayah-level player on production: all seven reciters, first/middle/final ayahs, pause/resume, seek, volume, navigation cleanup, weak-network failure, and no silent fallback. Full-program recordings containing supplications remain disabled.
7. Test API missing key, 429, upstream 5xx, HTML, malformed JSON, oversized/chunked body, and Arabic success.
8. Test keyboard-only navigation, screen-reader labels, text selection/copy, 320px–390px mobile widths, RTL wrapping, light/dark themes.

## Resume procedure

1. Read this checkpoint and `docs/ruqyah/RELEASE_CHECKLIST.md`.
2. Fetch current `main` SHA and all open PRs; never trust a copied SHA.
3. Review any pending PR diff and exact-head CI runs before merging.
4. Do not enable remote projection until all global release gates pass and live Firestore rules are confirmed deployed: safe resolution for divergent legacy and grouped conflicts, tombstones, cross-tab concurrency, account isolation, and live production two-device verification. Compatible V2 Ruqyah counter merge is implemented but does not waive these remaining gates.
5. Do not expose educational topic endpoints; any future locally curated article must have named Sunni source review, rights review, and source-registry tests before implementation.
6. PR #150 is merged. The next audio task is production smoke verification once Vercel deployment quota permits; do not re-open source implementation unless production tests reveal a defect. Full-program recordings remain disabled pending separate content and rights verification.
7. Only after explicit approval and all global release gates pass, configure deployment credentials and dispatch the manual rules workflow. It now runs the Firestore Emulator suite before writing credentials or deploying. Then redeploy `main` and run every live verification item above.
7. If a task is blocked by unavailable credentials or provider quota, document the exact blocker and continue with independent code review/tests; never claim the blocked production action succeeded.
