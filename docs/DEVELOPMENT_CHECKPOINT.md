# WIRD — Current checkpoint (2026-11-12 01:31 +02:00)

## Exact repository and release evidence
- Current `main`: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`: READY on exact main SHA; alias `wird-app.vercel.app`. No live browser or sync smoke was performed.
- Main Quality Gate run `43079260528` failed before steps/logs; `BlobNotFound`. This is unresolved workflow evidence, not a diagnosed test failure or pass.
- PR #363 latest checked head `acdfeef4e4baf99251e4768bbbc808fabab4f130`, base `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, OPEN / DRAFT / mergeable=true, 28 documentation-only files (1,892 additions / 8 deletions). Exact-head run `43120106137`, job `130858118105`, failed after ~2 seconds with `steps=null`; logs returned `BlobNotFound`; one annotation could not be retrieved. No test-level diagnosis exists. Vercel Preview deployment `dpl_CcBtjR4TRcqJd9pNwSZTvkgS2LHA` is READY on that exact SHA.
- This checkpoint edit will create a new PR head. Re-fetch its exact-head checks before any merge decision; keep Draft/HOLD.
- PR #361/#362/#354 are merged and current main descends from all three.
- PR #358/#359 remain Draft/unmerged and overlap in manifest ownership. Their last runs passed other configured suites, Emulator, TypeScript, and build, but failed the revision browser flow because guest-entry did not navigate to the revision route. #362 fixes the helper; no unified replacement is implemented.
- PR #364 remains Draft; exact-head run `43117641418` failed before steps/logs (`BlobNotFound`), Preview succeeded. No Quality Gate pass.
- PR #2 is 115 ahead / 469 behind main; do not merge wholesale.

## Product and technical checkpoints
- Seerah §§16–17 and UX §§6–7 require a connected book (parts → chapters → narrative scenes), claim-level sources, content versions, stable reading anchors, and optional aids. No reader or approved content is implemented.
- Offline audio remains design-only; EveryAyah is stream-only. The storage contract now includes explicit tests for sync/account isolation, quota/browser eviction, orphan/missing cache, and multi-tab races.
- PR #354 proxy hardening is merged; original Ruqyah HTTP 500 root cause and live index response remain unverified.
- Read-only Vercel inventory has shown both Production sync flags true. No settings, secrets, Firebase Rules/data, sync flags, or user data were changed.
- Google AI Studio sync, authenticated A↔B, live browser smoke, and real-device offline playback remain NOT VERIFIED.

## Next safe work
1. Re-fetch PR #363's new head and exact-head Quality Gate; do not merge on Vercel Preview alone.
2. Build one offline-audio implementation only when cross-store recovery and browser tests can be run safely.
3. Continue Ruqyah root-cause verification and sync cutover research without production changes.
4. Inspect reusable reader/router/storage components before any Seerah prototype; no unverified historical placeholder text or API ingestion.


---
## Latest exact-head CI observation — 2026-11-11 16:45 +02:00

- PR #363 head tested: `a8ba43209315acfabecdc4883e6c2f6823c8afed`.
- Quality Gate run `43040464893` ended failed on the only job before any step was recorded. Job logs are unavailable (`BlobNotFound`); there is no test-level failure diagnosis.
- Treat CI as BLOCKED/UNRESOLVED. Do not merge and do not weaken checks. Re-fetch the PR's current head and rerun only when GitHub Actions can provide a job with recorded steps/logs.
- The following documentation-only status commit changes the PR head; re-fetch it before any future gate or merge decision.

---

## آخر محاولة Quality Gate لـ PR #363

- run `43040357411` على SHA `5f613c3754b4d0aabc6aa09741a6d9914a0720ca` انتهى بفشل job واحد قبل تسجيل أي steps أو logs.
- لا يوجد تشخيص اختبار؛ لا تعتبره فشل Playwright أو TypeScript. CI غير محسوم حتى تظهر خطوات قابلة للفحص.

---
# WIRD — أحدث ملحق تحقق (2026-11-11 16:35 +02:00)

- main: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
- PR #362/#361 merged with exact-head Quality Gate PASS.
- PR #363 latest head `5e33453bd076f32ebad9053f3e6d8bc4de8070fc`. Runs `43039009676`, `43039794349`, `43039853668` all failed at the sole job before any steps/logs were recorded. This is unresolved workflow startup/runner evidence, not a diagnosed test failure. Do not merge.
- PR #360/#356 closed as superseded. Unique sync cutover protocol and audio storage contract are carried into docs PR #363.
- PR #358 run `43030195498` and #359 run `43029617572` failed; both PR descriptions now explicitly block merging unchanged and point to the unified contract. #362's Playwright helper fix is now in main; combined implementation must rebase and rerun exact-head checks.
- Production source SHA/live smoke and Google AI Studio sync remain NOT VERIFIED.

> This note supersedes older status snapshots below.

---
# WIRD — أحدث ملحق تحقق (2026-11-11 16:30 +02:00)

- main: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
- #362 merged `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd`, exact-head Quality Gate PASS.
- #361 merged `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`, exact-head Quality Gate PASS; EveryAyah remains stream-only.
- #363 latest head before this checkpoint update: `204c6738f5fb14845efbcf580d051e97405e3257`; run `43039009676` and attempt 2 failed before recording any job steps. Exact-head CI remains unresolved.
- #358/#359 remain overlapping unmerged proposals; #356 closed as superseded after salvaging its unique activity cutover protocol.
- Added proposed offline audio storage contract. No downloader implementation or UI is claimed.
- Production source SHA/live smoke and Google AI Studio sync: NOT VERIFIED.

> This note supersedes older status snapshots below.

---
# WIRD — أحدث حالة موثقة

آخر تحقق من GitHub: 2026-11-11 16:15 +02:00
آخر main: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
PR #362 مدمج: `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd` — إصلاح انتظار guest-entry hydration، Quality Gate PASS.
PR #361 مدمج: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe` — EveryAyah stream-only مع تنظيف cache قديم، Quality Gate PASS.
PR #360 القديم فشل في check واحد، وإعادة التشغيل فشلت دون تسجيل خطوات. أُعيد بناء فرع الوثائق فوق main الحالي مع الاحتفاظ بتعديل حقوق EveryAyah؛ هذه النسخة الجديدة تحتاج Quality Gate على رأسها النهائي.
PR #358 و#359 ما زالا متداخلين في ملكية manifest لتخزين الصوت؛ لا تدمجهما قبل عقد تخزين موحد.
PR #356 يحتاج مراجعة diff مقابل مركز الوثائق الحالي.
Production source SHA وlive smoke ومزامنة Google AI Studio: NOT VERIFIED.

هذه الحالة تتقدم على أي لقطة تاريخية أدناه. المصدر الحي للمهام هو هذا الملف؛ لا تعتمد حالات PR قديمة دون إعادة جلب GitHub.

---
# WIRD — أحدث ملحق تحقق (2026-11-11 16:02 +02:00)

- `main` الحالي: `8dd21522430cc014db4eb5da8437f89c42f190f9`.
- PR #360: آخر SHA موثق قبل آخر مزامنة للـ work log هو `8873b135bcfd5a3a6d7bddf7f6081cc08015df5f`؛ تلاه تحديثات توثيقية. لا توجد نتيجة exact-head موثقة للرأس النهائي؛ أعد جلب PR head وcheck-runs قبل الدمج. آخر فشل معروف كان Desktop/Mobile Playwright، وrerun attempt 2 لم يقدم job-step evidence.
- PR #362 head `e2079734a0d150c1046307611a2b28346fdcdb1d`: Quality Gate PASS؛ إصلاح guest-entry hydration لم يدمج بعد.
- PR #361 head `3008c4788caba61930be008e3cb40dcf52cfd78f`: Quality Gate PASS؛ PR مفتوح.
- PR #358/#359/#356: Draft، فشل Playwright smoke على الرؤوس المرصودة؛ لا تدمج نماذج manifest المتداخلة.
- Production source SHA وlive smoke وGoogle AI Studio sync: NOT VERIFIED.
- هذه الدفعة توثيقية فقط؛ لا runtime/Quran data/Firestore/Production settings/secrets/flags.

> هذا الملحق أحدث من كل نقاط التوقف التاريخية التالية.

---

# WIRD — أحدث ملحق تحقق (2026-11-11 15:58 +02:00)

- `main` الحالي: `8dd21522430cc014db4eb5da8437f89c42f190f9`.
- PR #360 آخر head: `8873b135bcfd5a3a6d7bddf7f6081cc08015df5f`; لا توجد check-runs ظاهرة لهذا الرأس وقت هذه المراجعة. آخر run على الرأس السابق فشل في Playwright؛ rerun attempt 2 فشل قبل تسجيل أي job steps.
- PR #362 head `e2079734a0d150c1046307611a2b28346fdcdb1d`: Quality Gate PASS؛ إصلاح guest-entry hydration لم يدمج بعد.
- PR #361 head `3008c4788caba61930be008e3cb40dcf52cfd78f`: Quality Gate PASS؛ PR مفتوح.
- PR #358/#359/#356: Draft، فشل Playwright smoke على الرؤوس المرصودة؛ لا تدمج نماذج manifest المتداخلة.
- Production source SHA وlive smoke وGoogle AI Studio sync: NOT VERIFIED.
- تغييرات هذه الدفعة توثيقية فقط؛ لا runtime/Quran data/Firestore/Production settings/secrets/flags.

> هذا الملحق أحدث من كل نقاط التوقف التاريخية التالية.

---

# WIRD — أحدث ملحق تحقق (2026-11-11 15:52 +02:00)

- `main` الحالي: `8dd21522430cc014db4eb5da8437f89c42f190f9`.
- #360 head `6e3c3c4be799c77a39dab539e3161c3d9f98958d`, run `43030878508`: Desktop/Mobile Playwright smoke FAIL؛ الاختبارات وRules Emulator وTypeScript وbuild وAPI/audio smoke PASS. Vercel build-rate-limit وليس نشرًا.
- #362 head `e2079734a0d150c1046307611a2b28346fdcdb1d`: Quality Gate PASS؛ إصلاح guest-entry hydration race لم يدمج بعد.
- #361 head `3008c4788caba61930be008e3cb40dcf52cfd78f`: Quality Gate PASS؛ PR مفتوح.
- #358/#359/#356: Draft، وQuality Gate فشل في Desktop/Mobile Playwright smoke على الرؤوس المرصودة؛ لا تدمج #358 و#359 قبل توحيد تصميم manifest.
- Production source SHA وlive smoke وGoogle AI Studio sync: NOT VERIFIED.
- لا تغييرات على runtime أو Quran corpus أو Firestore أو Production settings/secrets/flags في تحديث التوثيق.

> هذا الملحق أحدث من كل نقاط التوقف التاريخية التالية؛ لا تستخدم أرقامها أو تعليماتها كحالة حية.

---

# CURRENT DEVELOPMENT CHECKPOINT — 2026-11-11 (latest repository review)

> Current continuation: [`CONTINUE_HERE.md`](./CONTINUE_HERE.md). Unified roadmap: [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md). Detailed documentation inventory: [`DOCUMENTATION_CATALOG.md`](./DOCUMENTATION_CATALOG.md).

- Repository: `xm8eslam-stack/WIRD-APP`; canonical branch: `main`.
- Latest main SHA observed in this review: `8dd21522430cc014db4eb5da8437f89c42f190f9`; PR #353 merged.
- PR #353 Quality Gate run `43028294037` completed successfully on its exact PR head. Do not mislabel this as an independently observed post-merge main-only run.
- GitHub Vercel status on main SHA `8dd2152`: success. Exact Production deployment source SHA and live smoke were not independently verified.
- PR #360 documentation hub/roadmap: updated head `2ad93b0225a6ab22877b99a8f95128cf8963d091`; Quality Gate run `43030765045` was pending at last observation.
- PR #358 offline download job/item store: Quality Gate run `43028986222` completed successfully; PR remains open/unmerged pending architecture review.
- PR #359 offline audio manifest metadata store: Quality Gate run `43029617572` remained in progress at last observation.
- PR #356 sync documentation update: Quality Gate run `43029328133` completed successfully; PR remains open and its older checkpoint text must be reconciled with current main.
- PR #358 and #359 overlap in IndexedDB manifest responsibilities. Review their architecture together; do not merge both without an explicit compatible design.
- No application runtime code, Quran corpus, Firestore Rules/data, production secrets, environment variables, or deployment settings were changed by this documentation work.

## Immediate continuation
1. Observe exact-head Quality Gate for #360/#359; #358 and #356 passed their recorded exact-head runs but still need content/overlap review.
2. Consolidate the competing offline-audio manifest models before downloader/UI implementation.
3. Reconcile #356 sync documentation with the new documentation hub and current main SHA.
4. Re-test Ruqyah 500/502 and the ayah index before marking resolved.
5. Keep production deployment verification and owner-only settings separate from CI.
6. Record any owner action in [`OWNER_ACTIONS.md`](./OWNER_ACTIONS.md).

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


## 2026-11-11 — Seerah learning plan established

- New specialist plan: `docs/SEERAH_LEARNING_PLAN_AR.md`.
- WIRD product priority is explicit: memorization/revision first; Seerah of the Prophet ﷺ and Companions second.
- Scope includes structured stages and short lessons, person/event/place relationships, source-linked timeline, optional verified maps, post-lesson quizzes, stage and cumulative tests, error review, spaced retrieval, local-first progress, and optional offline content packs.
- Source/API research is preliminary only: SeerahBook (read-only graph, source provenance, based on a specific lecture series), Dorar Historical Encyclopedia API (manual access approval and bearer token), and Islamic Network People/Events APIs (Early Access). Seerah Library and Sirah Atlas are UX references only.
- No API provider has been approved; no runtime integration or content ingestion occurred. Licensing, Arabic coverage, claim-level references, privacy, rate limits, availability, and offline rights remain gates.
- Safety decisions: no AI-authored religious/historical claims or published quiz answers; every claim/question must have references and review status; disputed/approximate material is labelled; no depictions of the Prophet ﷺ or Companions; no unlicensed reproduction of modern books/translations.
- Documentation changes are confined to the existing docs PR branch. No runtime code, Quran corpus, Firebase/Firestore, user data, production settings, secrets, sync flags, or deployments changed.
- Application tests: NOT RUN (documentation-only). PR #363 exact-head CI must be re-fetched and pass before merge; the previously observed CI run was unresolved due to a job with no recorded steps/logs.


## 2026-11-11 17:52 +02:00 — Seerah API schema research and CI retry

- Expanded the Seerah plan with the actual Islamic Network People/Events OpenAPI specs, not just landing-page descriptions.
- People API includes multilingual biography, birth/death year, person kind, event/quote/story aggregations and related-person links. Language keys are optional per record; no guarantee every biography has Arabic. It is Early Access.
- Events API is calendar-oriented: the Hijri month/day field is an annual observance date, distinct from optional historical year. It is useful as a calendar enrichment source, not a complete chronological Seerah syllabus.
- SeerahBook is read-only with per-IP limits and provenance claims; its About page distinguishes approximate/disputed/weak reports and dramatized reconstructions. Never present reconstructed wording as a verbatim quote, especially for the Prophet ﷺ or Companions.
- Dorar API requires manual approval, server-side bearer token, attribution and clickable source URL; bulk download/republication is prohibited, cache limited to 24–48 hours, 60 req/min, and preview review required. Not an offline corpus provider.
- Architectural decision: WIRD Seerah Content Registry (reviewed, versioned local content) remains the publication source; APIs are discovery/verification adapters only until content reuse/offline rights are explicitly clarified.
- PR #363 head at check: `fc20a4f485f47f5ae7b94567bf521885a67ed284`. Quality Gate run `43051925917` failed with job `130631077198`, no steps and no downloadable logs (BlobNotFound). Retried failed job; new job `130632989788` failed identically before steps/logs. CI remains BLOCKED/UNRESOLVED, not a known test failure and not a pass.
- Vercel status is blocked by free deployment rate limit; PR timeline separately reports Preview READY `DaCNAppQni39XbMag8PkLxGbNQ9k`. This is not Production/live smoke evidence.
- No runtime code, production data/settings, Firebase Rules, secrets, API tokens, user content, or deployments were changed. No API records were fetched or ingested.


## 2026-11-11 17:55 +02:00 — latest exact-head gate

- PR #363 latest head before this checkpoint update: `835881de9d6f9719e2afe3acd4bd737bd73d2cf1`, OPEN / DRAFT.
- Quality Gate run `43052636315` failed; job `130633602897` returned no recorded steps. This does not establish that TypeScript, tests, or build ran. No downloadable logs are available from the related attempts.
- A retry of the preceding run reproduced the same pre-step failure. Stop repeated retries until runner conditions change or usable logs appear.
- Vercel status is still the free deployment-rate limit failure. Earlier READY preview is not evidence for this exact head or Production.
- Merge remains blocked pending an inspectable, successful exact-head Quality Gate.


## 2026-11-11 — Seerah claim-level provenance decision

- Islamic Network People schema has no per-claim source field for biography/date/relationship; Events exposes a generic source string only. These are discovery/navigation aids, not sufficient publication sources.
- SeerahBook states claim provenance, but primary source inspection is still required; dramatized/reconstructed wording is never a direct quotation.
- WIRD content registry must store claim-level source, edition/page or stable URL, report status, date precision, reviewer and content version. Offline publication requires separate rights clearance.
- Updated the specialist Seerah plan and unified roadmap. No external records ingested.
