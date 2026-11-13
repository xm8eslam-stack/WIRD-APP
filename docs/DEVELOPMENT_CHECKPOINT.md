

# Latest continuation — 2026-11-13 (follow-up audit)

## Exact state
- GitHub main: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` (unchanged).
- Production Vercel deployment: `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, READY, target production, source SHA matches main, alias `wird-app.vercel.app`. SSO remains enabled for non-custom domains. No deploy or settings change.
- Open PR heads: #372 `950640ea78d29e87d426a89d8887c15e4de2abac`; #371 `260df95c620cd534337e39d6707b044eb404139a`; #370 `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c`; #369 `814bb8788449ebe3d07d46f00a596a1a7b398a5a`; #368 `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #366 `cade1b630bb429d6a4106de5bf12713df18f3491`; #365 `adc1ef01b7a0c5eb7e280395520108c94788af5d`; #364 `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`; #363 `3cb28412d96259f91451efdfce71ffe614beaf15`. All OPEN/DRAFT.

## CI/Bun
- #372 is a four-file isolated candidate with one Bun app dependency graph and a frozen lockfile. Package-only Bun 1.4.4 install/frozen install/audit/CLI checks passed in the isolated sandbox. Full app checks were NOT TESTED.
- Exact-head Actions run `43391729769`, attempt 2/job `131773203535`, still has no steps/logs and is BLOCKED; Vercel reports `api-deployments-free-per-day`. No preview is expected because `vercel.json` disables feature-branch deployments. Do not alter this policy to force preview.

## Engine Plans archive audit
- See section 16 in [the RFC](./sync/ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md) for verified direct UI, startup, backup, journal/outbox/inbox/conflict and test-registry consumers.
- Confirmed high-risk seams: App initializes Engine Plans synchronously; Dashboard independently reads StorageService; AuthGate has no archive hydration barrier; Settings and Progress Analytics export synchronously; backup validation/session persistence retain the 100-plan cap; journal/remote projection/conflicts still materialize localStorage; DB schema is v9 and current main per-mutation Engine Plans budget is 450,000 bytes.
- Targeted review is not an exhaustive repository-wide indirect-call/fixture/E2E audit. Migration remains HOLD. Next: finish complete call-site-to-test matrix, then implement only local archive stages with crash/quota/scope tests; do not start remote chunks or change payload budgets prematurely.

## Coordination
- Shared paths remain serialized: #365/#367/#368/#369/#371 touch `src/tests/runAllTests.ts`; #367/#369 share `PlanningEngineWizard.tsx`; older #358/#359 remain superseded by #368. #372 has no changed-path overlap with these product PRs.
- GitHub Quality Gate failures with missing job steps/logs remain BLOCKED, not code FAIL or PASS. No merge, deploy, production config, Firebase Rules, secret, SSO, branch-protection or sync-flag change.
## 2026-11-13 — latest CI repair state

PR #372 proposes the Bun-only app dependency graph and a frozen Bun lock. Isolated Bun 1.4.4 checks pass (frozen install, audit high with 0 advisories / 360 packages; CLI version checks); full app tests/typecheck/build/Firestore/Playwright remain NOT TESTED. GitHub Actions exact-head run #43391729769 attempt 2 fails with missing steps/logs and BlobNotFound; Vercel preview is rate-limited. Main and production remain unchanged and aligned at `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. PR #372 remains Draft. See CONTINUE_HERE.md and CHANGE_CONTROL.md for full details.

## Latest verified continuation — 2026-11-13

See [CONTINUE_HERE.md](./CONTINUE_HERE.md) for the current PR matrix and full handoff. Main remains `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Vercel Production is READY on the same SHA. No merge, deploy, code, workflow, lockfile, secret, Rules, or runtime configuration change occurred in this continuation. The package-only Bun check confirms a stale committed lock and a split Bun/npm CI graph; full-source validation is still blocked. The current Quality Gate failures on #363/#371 expose no job steps/logs and are classified BLOCKED. Engine Plans migration remains HOLD pending complete indirect-consumer/test inventory and atomic archive/journal design. Documentation updates are on PR #363 only.

# CURRENT DEVELOPMENT CHECKPOINT — 2026-11-13

> Current operational evidence is in [CONTINUE_HERE.md](./CONTINUE_HERE.md). This dated section supersedes older SHA, PR, CI, Vercel, environment, and release-status claims below. Historical entries are preserved as history only.

## Exact source and Production parity
- GitHub `main`: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Vercel Production deployment: `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, `READY`, target `production`, branch `main`, exact source SHA equals main, alias `wird-app.vercel.app`.
- Vercel SSO protection is enabled for all non-custom domains. Only the verified Vercel domain is listed; anonymous public access is not established.
- Production sync flags are currently both `true`. This is observed runtime configuration, not release certification. Do not change them without specific owner approval.
- `ISLAMICAPI_API_KEY` is present for Preview and Production as a sensitive variable; no secret value was read.
- GitHub main protection is disabled and required-check enforcement is off.
- Current main combined status exposes a Vercel success context, but no recent main-branch Quality Gate run was returned. Production parity is not CI proof.

## CI and open PR state
- Recent PR Quality Gate failures have no recorded steps and logs return `BlobNotFound`; classify as BLOCKED observability/runner evidence, not code failure or pass.
- Open PRs and exact heads are listed in [CONTINUE_HERE.md](./CONTINUE_HERE.md). Shared-path overlaps exist in `src/tests/runAllTests.ts` across #365/#367/#368/#369/#371 and in `PlanningEngineWizard.tsx` across #367/#369.
- #358/#359 are superseded by #368; #2 is stale/non-mergeable.
- No PR merged and no new Production deployment was created in this audit.

## Current engineering boundaries
- Engine Plans IndexedDB archive remains design-only; main still uses localStorage and a 100-plan limit.
- PR #367's 800 KB sync cap is an unmerged temporary payload budget, not adaptive storage/chunking. PR #371 is codec-only.
- PR #368 has additional Offline Audio components on its branch but is not in main/Production; full offline download/playback is not complete.
- CI's Bun/npm dual-install differs from Vercel's Bun lockfile graph. In an isolated Bun 1.4.4 probe, the committed lock failed frozen install due stale package override/workspace metadata; a regenerated sandbox lock passed frozen install and Bun audit (0 advisories / 360 packages). The regenerated lock was not committed and full app tests/build were NOT TESTED. Correct the lock and workflow together after full-source validation.
- Firebase Rules Production deployment and Google AI Studio sync remain NOT TESTED in this audit.

## Owner-only actions
See [OWNER_ACTIONS.md](./OWNER_ACTIONS.md). No production settings, protection, secrets, Firebase Rules/data, sync flags, merge, or deploy were changed.

---

# 2026-11-12 — Offline-first checkpoint overlay

## Current workstream checkpoint — 2026-11-12 14:35 +02:00

- Main SHA: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- #365 head `d0fc6753c32e231bcfe4396e0808963ed5c6978f`; bookmark persistence + saved list + accessible storage failure + Playwright reload/remove/scene-list coverage. Run `43211160493` / job `131158819288`: failure without steps/logs.
- #368 head `4e3a192ee766108ff580cebed32699a70fb7f5ab`; unified offline audio metadata store with jobs/files/jobItems and recoverable orphan deletion. Run `43210985755` / job `131158220859`: failure without steps/logs.
- #358/#359 are superseded by #368; keep Draft and do not merge independently.
- #367 head `fd417faaa96a11920ef3a8e4f1038f567c36a731`; docs overlap removed. Still only interim 800 KB payload budget, not chunks.
- #366 head `b289bba34a93d730ca4fd06a08220d75067bf8c7`; no new implementation in this phase.
- #363 documentation branch receives this checkpoint and must be re-fetched after updates; no overlapping files with #367/#368.
- All listed Quality Gate runs have null steps/logs. Vercel Preview blocked by Free build-rate. No merge/deploy/Production settings/rules/data/secrets/flags changed.


## Seerah / PR coordination checkpoint — 2026-11-12 14:05 +02:00

- PR #365 new head `16048985de1df2e17fb0c45afbafa8d16acd7933`: local persistent bookmarks by bookVersion/part/chapter/scene/anchor, deduplication, version isolation, saved-bookmark list, and service tests added. No narrative content or cloud sync.
- PR #365 run `43209263032` / job `131152309833`: failed before steps/logs (`steps=null`, `logs_url=null`); no test-level result. Exact-head Vercel blocked by Free build-rate.
- PR #367 docs overlap was removed by restoring `docs/sync/ARCHITECTURE.md` and `docs/engineering/progress/WORK_LOG.md` to main versions. Current code-only head `fd417faaa96a11920ef3a8e4f1038f567c36a731`; run `43209066503` / job `131151602011` also failed before steps/logs.
- PR #363 docs branch updated with latest findings; its head changed during the update sequence and must be re-fetched before any merge/check decision.
- PR #366 unchanged; quota-aware optional media cache remains source-level only, not real-device Offline proof.
- No merge, deploy, main change, Production configuration, Firestore Rules/data, credentials, sync flags, or user data changed.


## Live checkpoint overlay — 2026-11-12 13:40 +02:00

- Verified main ref: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Active PR heads: #363 `5f336a31687bc534fb729c56a9c49dabf0416c18`; #365 `ea9d578855424bcadf08cd7f29d6f14c11b90d06`; #366 `b289bba34a93d730ca4fd06a08220d75067bf8c7`; #367 `cf88ac83de8706c20a01cf3b00827e8fe6e71473`.
- Exact-head workflows: #363 run 43203107824/job 131131326627; #365 run 43186044298/job 131073336535; #366 run 43202600366/job 131129580249; #367 run 43200705034/job 131123069674. All concluded failure with `steps=null` and `logs_url=null`; no test-level result is available.
- Vercel: #365 and #367 show successful Preview status; #363 and #366 are blocked by the Free build-rate limit. None is Production evidence.
- #367 overlaps with #363 in two documentation files; canonical documentation belongs in #363. Remove the overlapping documentation edits from #367 before code review.
- No code, main branch, Production settings, rules, credentials, sync flags, or user data changed in this checkpoint update.


- الهدف: وِرد يعمل عمليًا دون إنترنت بعد إعداد أولي، ويُجهز كتطبيق مستقبلي مع إبقاء PWA هو الأساس.
- الموجود: PWA/Service Worker، shell cache، Vite manifest، حزمة lazy assets قابلة للاستكمال، بيانات قرآن/عبادات محلية، local-first progress، فحص quota/persistence، audio cache انتهازي محدود، Mushaf page cache، وتخزين بعض التفسير/الأحاديث التي سبق عرضها والتحقق منها.
- غير المثبت: كل المسارات بعد restart/airplane mode، اكتمال public assets، الخطوط الخارجية، AuthGate offline restore، كل الأفعال المحلية، offline audio library، والتزامن بعد انقطاع الشبكة على جهازين.
- الخطة: راجع مصفوفة القدرات وخارطة جاهزية التطبيق في docs/offline. لا تعتبر package status وحده دليلًا على توفر كل ميزة.
- المسار البرمجي #366 مستقل عن مسار الوثائق #363 لتجنب تعارض الملفات. أعد جلب exact head قبل أي قرار.
- لا Production settings أو secrets أو Firebase Rules/data أو sync flags أو بيانات مستخدمين تغيرت.

---

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


## Plan archive architecture checkpoint — 2026-11-12

- Verified current main still stores the full Engine Plans JSON in localStorage and rejects more than 100 records.
- PR #367's 800,000-byte shared mutation budget is interim only; it does not solve localStorage quota, the count cap, or large archive persistence.
- The Outbox has a 1.5 MB aggregate cap; Firestore writer duplicates the payload into state and immutable event documents.
- The remote projector expects the old `{ records }` shape. Manifest payloads require receiver-side chunk materialization and old-client capability negotiation.
- Added the full local-first / chunked-Firestore architecture and release gates to `docs/sync/ARCHITECTURE.md`.
- Next safe implementation: inventory all Engine Plans read/write call sites and tests, then implement a lossless IndexedDB archive/migration/hydration layer. Do not remove the 100-plan guard or raise more byte limits before that.
- Future audio Cache Storage keys must include immutable `cacheGenerationId` so stale orphan cleanup cannot delete a newer download.


## 2026-11-12 — استكمال تدقيق المسارات المتوازية وتحديث الرؤوس الفعلية

### مرجع المستودع
- تم التحقق مباشرة من `refs/heads/main`: SHA الحالي ما زال `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. لا توجد تغييرات على main في هذه الجلسة.
- جميع طلبات السحب أدناه OPEN / DRAFT / mergeable، ولا يوجد دمج أو نشر أو تغيير إعدادات إنتاجية.

### رؤوس PR الفعلية وCI
| PR | Exact head | Quality Gate run / job | النتيجة المرصودة |
|---|---|---|---|
| #363 docs | `3c697f64f5a1f736ffc5533d98a574598b64c5c2` | `43211736907 / 131160797846` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #365 Seerah | `d0fc6753c32e231bcfe4396e0808963ed5c6978f` | `43211160493 / 131158819288` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #366 Offline/PWA | `b289bba34a93d730ca4fd06a08220d75067bf8c7` | `43202600366 / 131129580249` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #367 plan payload budget | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | `43209066503 / 131151602011` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |
| #368 offline audio metadata | `58c9d0cee27e4dd999955d92362247862d76f4dd` | `43214640907 / 131170651663` | failure قبل تسجيل الخطوات؛ `steps=null`, `logs_url=null` |

- هذه النتائج لا تثبت فشل الاختبارات/TypeScript/build، ولا تثبت نجاحها. تعامل معها كحالة runner/log observability غير محسومة، ولا تضعف Quality Gate ولا تعلن CI pass.
- Combined Vercel status على الرؤوس الخمسة = failure مع رابط `build-rate-limit`. لا يوجد Preview مطابق مثبت للرؤوس الحالية، ولا تحقق Production/live.

### تدقيق تداخل الملفات
- #363 يملك ملفات docs فقط.
- #365 يغيّر 11 ملفًا في مسار السيرة والراوتر والاختبارات؛ لا تداخل مع docs.
- #366 يغيّر 7 ملفات PWA/Offline؛ لا تداخل مع docs.
- #367 يغيّر 9 ملفات runtime/tests فقط بعد إعادة ملفات `docs/sync/ARCHITECTURE.md` و`docs/engineering/progress/WORK_LOG.md` إلى main؛ لا تداخل مع #363.
- #368 يغيّر 3 ملفات صوتيات/اختبارات فقط؛ لا تداخل مع docs.

### مراجعة #368 وإصلاح إضافي
- تمت مراجعة `offlineQuranAudioLibrary.ts` وملف الاختبارات على رأس PR.
- اكتُشفت فجوة تحقق: `setJobStatus` و`markItemDownloading` كانا يقبلان `NaN`/Infinity كطابع زمني، وقد يحفظان قيمة غير صالحة تفسد سجل المهمة.
- أضيف تحقق `Number.isSafeInteger(nowMs) && nowMs >= 0` قبل فتح المعاملة في الدالتين، واختبار regression يمرر `NaN` و`Infinity` ويتأكد من رفضهما وبقاء المهمة سليمة.
- أصبح رأس #368 `58c9d0cee27e4dd999955d92362247862d76f4dd`. Quality Gate run `43214640907` / job `131170651663` انتهى failure بلا steps/logs؛ لم يُثبت تشغيل الاختبار الجديد بعد.
- يظل #368 أساس metadata فقط: لا downloader ولا Cache Storage adapter ولا Service Worker protocol ولا UI ولا playback. كل الصوتيات المحفوظة محليًا تبقى خارج Firebase sync/backup.

### جرد تخزين الخطط على main
- تم تأكيد `src/services/storageService.ts` على main، 2265 سطرًا.
- داخل الخدمة: `getEnginePlans` عند السطر 1161، و`saveEnginePlans` عند 1165، وحد العدد 100 عند 1167، وكتابة JSON كاملة إلى مفتاح `ENGINE_PLANS` عند 1179.
- يوجد تحقق/ترحيل/إسقاط إضافي في نفس الخدمة عند الأسطر 946 و1503 و1540–1588 و1672–1674 و2000 و2089 و2133 و2177؛ يجب مراجعة هذه المسارات قبل نقل الأرشيف.
- `src/tests/storageReliability.test.ts` يحتوي فحصًا مباشرًا عامًا لـ get/save عند السطر 73، و`src/components/plans/PlanningEngineWizard.tsx` يستقبل قائمة الخطط ويستدعي `onUpdateEnginePlans` في عمليات الإضافة/الحذف/التحديث (الأسطر 194–243).
- بحث GitHub code-search لم يعرض نتائج قابلة للاستخدام، لذلك **لم يكتمل بعد جرد جميع المستهلكين** عبر المستودع. لا تعتبر هذه القائمة شاملة ولا تبدأ migration قبل إتمام inventory لكل call sites والاختبارات وbackup/import/export وsync projection.
- لا تغيّر حد 100 أو byte budgets. الخطوة التالية هي تصميم IndexedDB archive versioned مع migration lossless وhydration، مع إبقاء localStorage القديم حتى التحقق وإمكانية rollback.

### ما لم يتغير
- لا merge أو deploy أو Google AI Studio sync.
- لا Firestore Rules/schema/data، ولا production flags أو secrets أو sync activation.
- لا حذف بيانات أو تقليل حدود أو تغيير entitlements.

### الخطوة التالية الإلزامية
1. أكمل جرد call sites لـ `getEnginePlans/saveEnginePlans` وعمليات backup/restore/import/export والـ sync receiver/projection، مع مسارات الاستهلاك والاختبارات.
2. راجع migration/hydration lifecycle وتصميم rollback على مستوى IndexedDB قبل التنفيذ.
3. تابع #368 باختبارات generation/deletion/cache contract، ثم أضف downloader وCache Storage adapter في PR منفصل بعد مراجعة البروتوكول.
4. تابع #365 و#366 بشكل مستقل دون دمج؛ محتوى السيرة يبقى placeholder حتى الاعتماد العلمي، وOffline الحقيقي يحتاج اختبار جهاز/airplane mode.
5. لا دمج لأي PR قبل Quality Gate قابل للفحص وناجح على exact head، ومراجعة diff كاملة. لا تعاود rerun لنفس runner بلا دليل على تغير ظروفه.


## 2026-11-12 — تحديث بعد مراجعة #368 وجرد تخزين الخطط
- #368 latest head: `08851241bff289e04b13568188e0b2103a1d02e3`. أضيفت حواجز للطوابع الزمنية غير الصالحة في `setJobStatus/markItemDownloading`، والتحقق من علاقات job-item قبل حذف المهمة، مع اختبارات regression لـ NaN/Infinity والعلاقة الفاسدة. لا workflow run ظهر لهذا الرأس عند آخر استعلام؛ لا يوجد CI pass مثبت.
- #363 docs head عند آخر تحقق قبل هذا الإلحاق: `af510f58596c9fef3b930b7604ee3fbbb63e58ca`; run `43214783526` / job `131171122148` failure مع `steps=null` و`logs_url=null`. إعادة تحديث الوثائق ستنشئ رأسًا جديدًا؛ أعد جلبه قبل أي قرار.
- استُكمل جرد حدود خطة المحرك: `StorageService.saveEnginePlans` يكتب JSON كاملًا إلى localStorage ويحد العدد بـ100؛ `validateBackupPayload` يحد enginePlans بـ100؛ `sessionPersistence` يرفض snapshot فوق 100؛ `journaledSnapshotService.persistEnginePlansSnapshot` يمرر الكتابة إلى `StorageService.saveEnginePlans`؛ `backupPersistence.buildBackupImportOperations` ينشئ snapshot operation؛ و`StorageService.applyJournalProjection/matchesJournalProjection` يعيدان قراءة/كتابة نفس archive. `exportBackup/importBackup` يتعاملان مع نفس المفتاح مباشرة.
- في App: التهيئة الأولية وعمليات refresh وdaily-session selection وprogress refresh تقرأ `StorageService.getEnginePlans`؛ الحفظ المعتاد يمر عبر `persistEnginePlansSnapshot`، وإكمال الجلسة يمر عبر `persistJournaledSessionCompletion` مع enginePlans snapshot اختياري.
- التخزين السحابي: IndexedDB journal له حد 450,000 bytes على main، وlocal outbox حد إجمالي 1,500,000 bytes، وremote projection يستخدم `applyJournalProjection`. PR #367 يغيّر حد الوثيقة مؤقتًا فقط إلى 800,000 bytes؛ لا chunks/manifest ولا ترحيل local archive.
- ما زال inventory غير مكتمل لكل المستهلكين غير المباشرين/الشاشات ونسخ الاختبارات بسبب أن code search لم يعرض نتائج؛ لا تبدأ IndexedDB migration قبل إنهاء فحص كل مستهلك/backup/import/export/projection والتهيئة.
- لا تغيّر حد 100 أو budgets، ولا تفعل remote flags/Firestore Rules أو أي Production setting. الخطوة التالية: إكمال inventory ثم تصميم IndexedDB archive + lossless migration + startup hydration + rollback.


## 2026-11-12 — أحدث نتيجة بعد التحقق من رؤوس PR
- #363 docs head: `e805f5c30606b7ae77412c78f8bdf80fcba5923c`. لم يظهر PR-triggered workflow run لهذا الرأس عند آخر استعلام؛ Vercel ما زال محجوبًا بـ `build-rate-limit`. لا Preview/CI/Production pass مثبت.
- #368 head: `08851241bff289e04b13568188e0b2103a1d02e3`. أحدث Quality Gate run `43215055425` / job `131172059517` = failure مع `steps=null` و`logs_url=null`; لا يمكن معرفة هل بدأت الاختبارات أو البناء.
- #365/#366/#367 ما زالت على الرؤوس المسجلة في جدول التدقيق السابق، وQuality Gate لكل منها فشل قبل تسجيل الخطوات. جميع PRs تبقى OPEN / DRAFT / HOLD.
- لم يتغير main، ولا توجد عمليات دمج أو نشر أو تعديلات Production/Rules/secrets/flags.


## 2026-11-12 — استكمال جرد Engine Plans ومسارات الاستيراد/المزامنة

### مرجع الحالة
- main ما زال `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- PR #363 head ما زال `08f52548e0e5dbe235e06c9b51395893ff2e563a` عند بدء هذا التدقيق. بقية الرؤوس: #365 `d0fc6753c32e231bcfe4396e0808963ed5c6978f`; #366 `b289bba34a93d730ca4fd06a08220d75067bf8c7`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #368 `08851241bff289e04b13568188e0b2103a1d02e3`.
- جميع PRs OPEN / DRAFT. لا merge ولا نشر ولا تعديل إنتاجي.

### جرد الكود الذي تم التحقق منه على main
1. **مصدر التخزين:** `src/services/storageService.ts` (2265 سطرًا): مفتاح `wird_engine_plans`، القراءة عبر `getEnginePlans()` و`readJsonArrayArchive`، الكتابة عبر `saveEnginePlans()` بعد validation وحد 100، ثم `localStorage.setItem` عبر `setItem`.
2. **App consumers:** `src/App.tsx`: تهيئة state (سطر 111)، reload/refresh (225، 527، 673)، selection/completion paths (308–364)، وحفظ التعديلات عبر `persistEnginePlansSnapshot` (400). إكمال جلسة مع snapshot اختياري يمر عبر `persistJournaledSessionCompletion` (357–364).
3. **UI:** `MemorizationPlansView` يمرر `enginePlans` إلى `PlanningEngineWizard`. الـ Wizard لا يقرأ التخزين بنفسه؛ يحدّث القائمة عبر `onUpdateEnginePlans` عند إنشاء/حذف/تعديل الخطة (194–243).
4. **Journal service:** `journaledSnapshotService.persistEnginePlansSnapshot` يصدر عملية `enginePlans/snapshot` بحمولة `{ records: plans }`؛ ثم مسار journal-first يطبق projection محليًا. `sessionPersistence` يقبل `enginePlansSnapshot` اختياريًا ويرفضه إن لم يكن array أو تجاوز 100.
5. **Backup:** `validateBackupPayload` يفرض 100 على `enginePlans`; `buildBackupImportOperations` يحولها إلى journal operation `enginePlans/snapshot`; `importBackupFile/importBackupJournaled` هما المسار journal-first. `StorageService.exportBackup/importBackup` ما زالتا API legacy داخل StorageService وتتعاملان مباشرة مع المفتاح؛ direct import API يجب أن يظل ضمن جرد التوافق ولا يُحذف قبل إثبات كل callers.
6. **Reset:** `resetAllDataJournaled` ينشئ snapshot فارغًا لمجموعة enginePlans ضمن event واحد. يجب أن يظل هذا السلوك متوافقًا مع archive backend الجديد.
7. **Projection:** `applyJournalProjection('enginePlans')` يكتب عبر `saveEnginePlans`; `matchesJournalProjection` يقرأ مفتاح localStorage مباشرة في فرع enginePlans. `clearJournalProjection` وعمليات reset/restore ذات الصلة تتضمن مفتاح `ENGINE_PLANS` ضمن مفاتيح التصفير.
8. **Cloud sync:** `cloudSyncCoordinator` يسمح بمجموعة `enginePlans`; `revisionedRemoteMutation` يقبلها كـ collection مدعومة؛ `remoteInboxProjector` يدرجها في allowlist. `indexedDbSyncJournal` يطبق/يتحقق من projection عبر `StorageService.matchesJournalProjection/applyJournalProjection`، وله budget مخصص للـ enginePlans. `localSyncOutbox` يعرف collection نفسها وله حد إجمالي مستقل.
9. **Tests:** `storageReliability.test.ts` يغطي get/save؛ `backupValidation.test.ts` يغطي schema/validation/import؛ `journaledSnapshotService.test.ts` يغطي journaled session/enginePlans snapshots/projection؛ `backupPersistence.test.ts` يغطي الاستيراد journal-first؛ `sessionPersistence.test.ts` يغطي projection semantics؛ `indexedDbSyncJournal.test.ts` و`localSyncOutbox.test.ts` يغطيان حدود journal/outbox. لم يُستكمل بعد جرد كل fixture/consumer داخل كل هذه suites.
10. **بحث المستودع:** GitHub code search أعاد نتائج فارغة لهذا المستودع، لذلك تم تأكيد المسارات أعلاه بقراءة الملفات المعروفة/المترابطة مباشرة، وليس بادعاء scan شامل لكل 159 ملف TS/TSX. يجب استكمال البحث عن كل استدعاءات legacy `exportBackup/importBackup` وأي مستهلك غير مباشر قبل migration.

### الاستنتاج المعماري — لا يبدأ الترحيل قبل هذه العقود
- لا يكفي تبديل `getEnginePlans/saveEnginePlans`: يلزم backend async لأن IndexedDB غير متزامن، وبالتالي يلزم startup hydration gate قبل أي consumer يقرأ state، أو adapter متزامن فوق نسخة hydrated في الذاكرة مع كتابة async موثوقة. لا يجوز ترك UI تقرأ localStorage كأنها canonical بعد cutover.
- يجب أن تكون واجهة archive واحدة ذات versioned envelope (schemaVersion, revision/generation, records, integrity metadata) وتوفّر read/prepareMigration/commit/verify/rollback؛ لا تخزن blob واحدًا ضخمًا في Firestore.
- migration: اقرأ legacy دون تعديل، validate كل record والهوية/التكرار، اكتب archive إلى IndexedDB في transaction، أعد قراءته وتحقق من count + stable fingerprint + record IDs، ثم سجّل migration marker. لا تحذف أو تستبدل legacy localStorage في نفس الإصدار؛ احتفظ به read-only حتى مرور دورة تشغيل/إعادة فتح ناجحة وإثبات rollback.
- الكتابات بعد الترحيل يجب أن تكون atomic بين archive revision والـ journal/outbox reference قدر الإمكان، مع idempotency key وexpected base revision. عند فشل quota أو transaction لا تعلن النجاح ولا تحرك sync cursors.
- projection/remote inbox يجب أن ي materialize archive بالكامل ويتحقق من manifest/chunks قبل تحديث cursor. لا تقبل `{ records }` كحمولة واحدة إذا تعدت حد المستند؛ manifest يشير إلى immutable chunks، ثم publish pointer أخيرًا بعد تحقق كل chunk.
- backup export/import يجب أن يبقى متوافقًا: export يجمع نسخة snapshot كاملة خارج حدود التخزين؛ import يتحقق ثم يكتب transactionally مع rollback، دون partially applied archive.
- توافق العملاء: لا يتم تفعيل manifest/chunks في Firestore قبل capability negotiation وقراءة/كتابة آمنة للعملاء الأقدم. لا تعدل Rules أو remote flags دون موافقة.

### التالي
1. استكمال inventory على كل ملفات TS/TSX المتبقية، خاصة أي استدعاءات `exportBackup/importBackup` وlegacy direct storage APIs وsettings/backup UI.
2. رسم تدفق sequence من UI → App state → journal → outbox → remote mutation → inbox projector → archive hydration، وتحديد نقطة واحدة canonical للقراءة والكتابة.
3. إعداد RFC/ADR منفصل للـ IndexedDB archive يحدد envelope, migration, rollback, quota, backup, sync manifest, client compatibility واختبارات crash/restart.
4. لا تنفذ migration أو ترفع حد 100 أو byte budgets قبل مراجعة واعتماد هذا التصميم واختبار كل consumers.

### حدود التحقق
- لا يوجد local test runner متاح من خلال GitHub connector؛ لا نعلن tests pass من قراءة المصدر.
- Quality Gate على الرؤوس السابقة ما زال غير قابل للتشخيص بسبب jobs بلا steps/logs. يلزم exact-head run قابل للفحص.
- Vercel Free build-rate-limit blocker قائم في السجل السابق؛ لا Preview/live verification.
- لا تغيير main أو production rules/schema/data/secrets/flags.


## 2026-11-12 — Auth scope + backup UI audit addendum
- `AuthGate` is the actual startup barrier: it sets a storage scope, replays journal projection for verified users, runs legacy portion migration, and only then mounts `App` after `readyScope` matches. Guest mode also passes through scoped-storage setup/migration. This is the safest integration point for awaiting Engine Plans archive hydration, but the order must be explicit: resolve scope → initialize per-scope IndexedDB archive → copy/verify legacy enginePlans → replay journal using archive-aware projection → migrate portions → mount App.
- `StorageService.setStorageScope` is synchronous today. It resolves legacy unscoped localStorage keys, copies each key to a UID-prefixed destination, verifies copies, removes legacy source keys, and writes ownership marker with rollback. A future IndexedDB archive is not copied by this routine automatically; account/guest ownership choice and first-account migration must be extended to include the archive without making the existing synchronous scope switch falsely report success.
- Per-account archive identity must use the resolved storage scope (e.g. `guest` or `user:<uid>`), never a global singleton store without UID partitioning. Account switching must invalidate stale in-memory hydrated snapshots and abort old-scope writes before mounting the new account.
- Settings backup export is `SettingsView.handleExportBackup → StorageService.exportFullBackup()`; it is currently synchronous and reads `ENGINE_PLANS` directly from localStorage. After IndexedDB becomes canonical, export must become async or use an explicit verified archive snapshot API, and the UI must await it and show failure rather than exporting a stale compatibility copy.
- Settings backup import already uses `importBackupFile → importBackupJournaled`; it validates and commits through the journal. Keep this as the primary UI import path. `StorageService.importBackup` remains a legacy direct-write API with rollback and is not the Settings UI path; search for all non-test callers before deprecating it.
- Reset in Settings delegates to App's journaled reset path; preserve one logical transaction across Engine Plans archive and the other collections. The low-level `StorageService.resetAllData` is a legacy direct key deletion path and must not become the new canonical reset path.
- Updated migration sequence: scope/ownership resolution → per-scope archive hydration/migration → journal replay/materialization → legacy portions migration → App mount. Backup export must read the canonical archive; backup import and reset must commit a new archive revision with journal/outbox consistency and rollback.


## 2026-11-12 — UI consumer scan correction
- Expanded the UI scan beyond `App.tsx`: `src/components/dashboard/DashboardView.tsx` calls `StorageService.getEnginePlans()` directly inside daily-session selection (line 73). This must be replaced by a hydrated `enginePlans` prop/state from App (or a shared async-ready store); otherwise the Dashboard could read a stale/empty compatibility key after IndexedDB cutover.
- There are **two** UI backup-export entrypoints: `SettingsView.handleExportBackup` (line 165) and `ProgressAnalyticsView.handleExportBackup` (line 166). Both call synchronous `StorageService.exportFullBackup()`; both must switch to one async verified export API and handle errors/loading. This correction supersedes any earlier implication that Settings was the only export surface.
- Both Settings and Progress Analytics import through `importBackupFile` (journal-first); Settings export is not journal-aware today. `StorageService.importBackup` remains the legacy direct localStorage writer and is covered by tests, but its full production caller scan is still required before deprecation.
- App state is initialized from `getEnginePlans()`; Dashboard independently reads it; Planning UI consumes props and sends updates. These three paths need one hydrated source of truth and no synchronous fallback-to-empty during archive startup.
- This is still a targeted source audit, not a claim that every one of the 159 TS/TSX files was exhaustively scanned. Continue checking the remaining UI/services for direct backup API calls and legacy archive access before implementation.


## 2026-11-12 18:15 +02:00 — Engine Plans archive audit checkpoint
- Verified main + Production exact SHA: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` READY on same SHA.
- Active Draft heads: #363 `9a5eb9579b474c50bc192a4f0dac2001d3aa7afb`; #365 `d0fc6753c32e231bcfe4396e0808963ed5c6978f`; #366 `b289bba34a93d730ca4fd06a08220d75067bf8c7`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #368 `08851241bff289e04b13568188e0b2103a1d02e3`.
- Latest exact-head Quality Gates: #363 run `43217043348`; #365 `43211160493`; #366 `43202600366`; #367 `43209066503`; #368 `43215055425`. All failed with no recorded steps/logs; no test-level diagnosis and no pass.
- Engine Plans inventory remains IN PROGRESS. Verified direct consumers: App, Dashboard, Settings export, Progress Analytics export, backup validation/import, session completion, journal projection/replay, remote inbox projector, reset. AuthGate is the existing startup barrier but archive hydration is absent. Scope transfer remains synchronous localStorage copy/verify/delete. Known test suites are listed in CONTINUE_HERE; all fixtures/callers are not yet exhaustively scanned.
- No migration/RFC implementation started. Do not change 100-record limit or byte budgets. Continue caller/fixture and conflict/sync lifecycle inventory before ADR and implementation.
- Documentation commits on docs branch: continuation update `bb32f9352fd94e4d9ad6dd5d06d90936c10306cc`; work-log update `f46d615844cf7605d6221a13cd457fb87a694b55`. This checkpoint update itself creates a new docs branch head; re-fetch PR #363 before any CI/merge decision.
- No tests were run locally. No merge/deploy/Production setting/Rules/secrets/sync flag changes.


## 2026-11-12 18:25 +02:00 — Engine Plans inventory complete / RFC gate
- Scan completed over 100 `src/**/*.ts(x)` files and 78 test/spec files at main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. No local tests executed.
- Direct UI: App state/write paths and Dashboard direct read; MemorizationPlansView/PlanningEngineWizard are prop-based. Additional journal writer: demoDataPersistence.
- Backup exports: Settings + Progress Analytics synchronous. Imports: both UI paths journal-first. Low-level legacy import/reset remain test/compatibility APIs pending caller scan result and deprecation policy.
- Projection and conflict contracts still use localStorage: apply/matches/isEmpty/local snapshot; conflict resolver use-remote/keep-local validates those snapshots. Remote inbox and journal replay depend on them.
- Test matrix references: planningEngine, dailySessionSelection, backupValidation, backupPersistence, journaledSnapshotService, sessionPersistence, storageReliability, storageScope, indexedDbSyncJournal, localSyncOutbox, cloudSyncCoordinator, Firestore Rules. Add explicit AuthGate archive hydration/restart/scope-switch tests.
- Cross-database atomicity is unresolved: archive IDB separate from journal IDB cannot be transactionally atomic by assumption. RFC must specify same-database stores or an idempotent two-phase intent/recovery protocol, including conflict resolution and cursor invariants.
- Documentation commits: consumer/test inventory `ed9ea1b57adac6c0900361f44c8f679f7df48f4f`; work-log update `131a828c810f8dae21177acffe6a4150c9ccb4c0`. This checkpoint update creates a new documentation PR head; re-fetch it before check/merge decisions.
- No RFC implementation or migration yet. No byte/record limits changed. No merge/deploy/Production/Rules/secrets/sync flags changed.


## 2026-11-12 18:35 +02:00 — RFC archive proposal
- Added `docs/sync/ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md` as a proposed design only.
- Proposed same-database IndexedDB stores (journal schema v10) so archive revision + event + outbox reference can commit in one local transaction; remote manifest/chunks remain a later separately gated stage.
- No code migration, tests, merge, deployment, Rules, Production settings, secrets or sync flags changed.


# مراجعة المسارات المستقلة — 2026-11-12 18:50 +02:00

## تعديلات مراجعة مضافة إلى فروع PR (لم تُدمج)
- PR #365: عزل موضع قراءة السيرة والعلامات محليًا حسب StorageService scope (`guest` / `user:<uid>`) بدل مفتاح localStorage عالمي. أضيف اختبار تمييز المفاتيح بين guest ومستخدمين. آخر head: `a2e7ac38677466a7976f759dfc890aeb2fe05fda`.
- PR #366: إزالة نمط delete-then-put عند cache hit في Service Worker؛ كان فشل إعادة الكتابة بعد الحذف قد يحرم الطلب الحالي من ملف offline موجود. أصبحت الاستجابة المحفوظة تُعاد أولًا ويُجرّب trimming مع معالجة الفشل. أضيف guard ثابت للاختبار. آخر head: `cade1b630bb429d6a4106de5bf12713df18f3491`.
- PR #368: جعل `finalizeOrphanDeletion` يتطلب `expectedCacheGenerationId` ويرفض إنهاء metadata لجيل أحدث؛ ومنع worker متأخر من مهمة terminal من استبدال cache generation أحدث. أضيف اختباران للسباقات. آخر head: `b5ed5c9bead88835da751c7d6eb5ff7de76d56b2`.
- PR #367 لم يتغير: 800,000 bytes حد ثابت مؤقت فقط؛ لا chunks ولا archive.

## الحالة الفعلية بعد التعديلات
- PR #363 docs head قبل هذا التحديث: `d41096af17fbac98297efe39514d7ebe74cfd0fd`.
- PR #365 head `a2e7ac38677466a7976f759dfc890aeb2fe05fda`.
- PR #366 head `cade1b630bb429d6a4106de5bf12713df18f3491`.
- PR #367 head `fd417faaa96a11920ef3a8e4f1038f567c36a731`.
- PR #368 head `b5ed5c9bead88835da751c7d6eb5ff7de76d56b2`.
- Quality Gate runs الحالية للرؤوس #363/#365/#366/#367/#368: `43258266345`, `43258645058`, `43258830250`, `43209066503`, `43258983666` على الترتيب. كلها failure، وjob steps/logs_url غير متاحة؛ لا نستنتج منها code failure ولا pass.
- كل PRs ما زالت OPEN/DRAFT وmergeable=true عند آخر قراءة. لم يحدث merge.
- لا اختبارات محلية شُغلت في هذه الجلسة. التعديلات أضيفت مع اختبارات/guards مصدرية، لكن يلزم runner صالح ونتائج exact-head قابلة للفحص قبل أي merge.
- main وProduction كما هما؛ deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` ما زال آخر ما تحقق READY على main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. لم يُجرَ deploy جديد.

---


# 2026-11-12 — Current continuation checkpoint

## Main and PR heads
- Main remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b; no merge/deploy.
- #363 docs: c58bcfeafb53277a3535b70df43a644c4b754bc5 OPEN/DRAFT.
- #365 Seerah: 113f12c43b9b075541b7d28f58fa89cd71ef73d4 OPEN/DRAFT.
- #366 Offline/PWA: cade1b630bb429d6a4106de5bf12713df18f3491 OPEN/DRAFT.
- #367 sync payload interim cap: fd417faaa96a11920ef3a8e4f1038f567c36a731 OPEN/DRAFT.
- #368 Offline Audio metadata: b5ed5c9bead88835da751c7d6eb5ff7de76d56b2 OPEN/DRAFT.
- #369 memorized range selection: 7ac00ef32f3b3c2b1158f165ed141e6f332ab88e OPEN/DRAFT.
- #370 session display disclosure: 2bbb54da778ab3eb2ac863e2b12c4e31fbe39dfb OPEN/DRAFT.

## New implementation checkpoints
- #369: searchable touch-friendly multi-Surah checkbox selection; full Juz expansion via generated canonical Quran Juz starts; custom per-Surah ayah ranges; sorted overlap/adjacency normalization; service + UI test suites registered. No local tests run.
- #370: collapsed-by-default accessible display-settings disclosure; page width/UI scale/font/density/view controls retained; line spacing + page padding added and applied; device-local migration defaults tested. No local tests run.
- #365: fixed scoped bookmark deletion writing to a global key; added UID-scope regression test. Seerah reader remains an explicit shell/prototype, not approved historical content.
- #363: requirements and initial source/licensing review added. Dorar API has manual approval and restrictive attribution/cache/no-bulk/republication terms; OpenITI CC BY-NC-SA; ACO public-domain collection with per-edition rights verification still required.

## Adaptive Engine Plans capacity
- No subscription/entitlement/billing service or tier model was found in the inspected main source. Do not invent tiers or quota values.
- Separate local IndexedDB/browser quota from server-verified account entitlement. Chunked sync must be immutable, resumable and SHA-256 verified; manifest publication last; materialize before cursor advancement. Downgrades must not delete existing data.
- Continue archive consumer/fixture audit and entitlement contract design before migration. Do not raise 100-plan limit or 800 KB interim payload cap as a substitute.

## Exact-head CI
- #365 run 43273958209 / job 131377298902; #369 run 43274079781 / job 131377722661; #370 run 43274209101 / job 131378172561.
- All completed failure with steps=null and logs_url=null. This is runner/telemetry evidence only; no code failure diagnosis and no successful test/build evidence.
- No local tests/build/typecheck executed in this session. No PR merged. No Vercel/Firebase Production settings, Rules, secrets, or sync flags changed.

## Next exact actions
1. Continue Engine Plans inventory for remaining direct/indirect export/import, conflict, inbox, journal replay, reset, and fixtures. Then Stage A contract review; no migration before audit closure.
2. Run #369 and #370 through a functioning, inspectable CI runner and fix any confirmed source/test failures. Add keyboard/screen-reader/mobile manual review before merge.
3. Continue Seerah at highest parallel priority: improve continuous reader shell and editorial source traceability. Research/rights approval precedes content ingestion; never publish prototype scenes or unverified reports.
4. Continue Offline Audio and PWA independent test work.
5. Re-fetch exact PR heads and record evidence at every checkpoint.

# Latest checkpoint — 2026-11-12 18:05 UTC

## Active exact heads
- Main: 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.
- #363 docs: 6031431ee1b72b91f51f69fa90a3a79a15b360bb.
- #365 Seerah: 0856e6a1e215a74324358173bee9a55924e6a5ad.
- #366 PWA: cade1b630bb429d6a4106de5bf12713df18f3491.
- #367 interim sync budget: fd417faaa96a11920ef3a8e4f1038f567c36a731.
- #368 Offline Audio: ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710.
- #369 memorized range selector: 7ac00ef32f3b3c2b1158f165ed141e6f332ab88e.
- #370 session display settings: 2bbb54da778ab3eb2ac863e2b12c4e31fbe39dfb.
All PRs remain OPEN/DRAFT; none merged.

## Latest code work
- #365: bookmark UID-scope deletion fixed; reader context now has a source citation panel; publication contract requires rightsStatus + rightsNotes and enforces link-only/no-quote behavior; tests registered. No real content ingested.
- #368: Cache Storage adapter + bounded downloader + pause/cancel/resume + missing-cache reconciliation + completed-job retry after eviction. Metadata only commits after cache verification. Service Worker, UI and playback integration still missing.
- #369: multi-Surah checkboxes/search, complete Juz, custom ayah ranges, normalization and tests.
- #370: collapsible page settings, line spacing and page padding, local persistence and tests.
- #363: adaptive entitlement/chunk design, Seerah source/license research and updated continuation records.

## Engine Plans inventory — verified facts still to cover
- StorageService localStorage get/save with 100 cap; backup validator also 100.
- exportFullBackup synchronous and directly reads localStorage; Settings + Progress Analytics still call it.
- StorageService.importBackup and resetAllData remain legacy direct-write paths; canonical UI import/reset are journal-first.
- setStorageScope remains synchronous and may copy/verify/delete localStorage keys; it must not delete Engine Plans before archive copy verification.
- sessionPersistence enginePlansSnapshot cap remains 100; journaledSnapshotService persists through StorageService.saveEnginePlans.
- DashboardView reads StorageService.getEnginePlans directly.
- backupPersistence import/reset, cloudSyncCoordinator, remoteInboxProjector, indexedDbSyncJournal and LocalSyncOutbox are additional projection/sync consumers.
- localStorage legacy outbox has 1.5 MB cap; current journal/outbox is IndexedDB.
- Audit of all indirect callers, test fixtures and E2E remains open. Do not start archive migration until closure.

## Adaptive plan capacity
- No account subscription/entitlement system found in main. No tier names or quota values may be invented.
- Proposed server-verified entitlement fields: maxSinglePlanBytes, maxArchiveBytes, maxActivePlans; chunk size remains transport-only.
- Local IndexedDB/browser quota is separate and cannot be promised by navigator.storage.estimate().
- Downgrade preserves existing records and read/export access; no silent truncation/deletion.
- Full entitlement and chunk contract is in docs/sync/ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md.

## CI status
- #365 run 43275942614 / job 131384235586: failure, steps=null, logs_url=null.
- #368 run 43275594933 / job 131383003139: failure, steps=null, logs_url=null.
- #369 run 43274079781 / job 131377722661: failure, steps=null, logs_url=null.
- #370 run 43274209101 / job 131378172561: failure, steps=null, logs_url=null.
- These are not diagnosed code failures and are not passes. No local build/test/typecheck run in this session.
- Vercel Free deployment quota remains a separate blocker; no production deploy/live verification claimed.

## Rerun result — 2026-11-12
Latest exact-head Quality Gate jobs were rerun:
- #365: run 43275942614 / job 131384235586 — failure, steps/logs absent.
- #368: run 43275594933 / job 131383003139 — failure, steps/logs absent.
- #369: run 43274079781 / job 131377722661 — failure, steps/logs absent.
- #370: run 43274209101 / job 131378172561 — failure, steps/logs absent.
No test/build stage is inspectable. This is not evidence of code failure or success.

# Final continuation update — 2026-11-12

## Active branches / exact heads
- Main: 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.
- #363 docs: latest before this checkpoint b85797aa091c4f20ed3685cc23494ab55c8defff (fetch current PR head before continuing).
- #365 Seerah: 15963abc5dc45268a1129e872d10e41fd7779d05.
- #366 Offline/PWA: cade1b630bb429d6a4106de5bf12713df18f3491.
- #367 interim sync budget: fd417faaa96a11920ef3a8e4f1038f567c36a731.
- #368 Offline Audio: ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710.
- #369 memorized ranges: 814bb8788449ebe3d07d46f00a596a1a7b398a5a.
- #370 display settings: 32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c.
- #371 archive chunk codec: 597344a5f95a261df5301da4de992850d4a3f5b5.
All PRs OPEN/DRAFT. No merge.

## New implementation
- #371 pure archive chunk codec: canonical JSON, record fragments, stable IDs, SHA-256 at chunk/record/archive level, manifest binding to schema/revision/ordered record IDs/optional entitlement revision, strict full reconstruction. Default chunk ceiling 192,000 raw bytes. No migration or Firestore integration.
- #365 source rights gate and citation panel, UID bookmark deletion fix, E2E empty-source state. No historical content ingested.
- #368 Cache Storage adapter and bounded downloader, retry/pause/cancel/resume, cache eviction recovery. Service Worker/UI/playback still missing.
- #369 touch-friendly multi-Surah checkboxes/search, complete Juz and custom ayah range; browser E2E added.
- #370 collapsed accessible display settings, line spacing and page padding; browser E2E added.

## Inventory
- Main at SHA 8e98aa3 contains 159 src TS/TSX files and 78 test/spec files (59 src, 18 e2e, 1 scripts).
- Key storage consumers and tests reviewed, but semantic scan of all 159 source files and all indirect fixtures is not complete. No Engine Plans migration until closure.
- Confirmed main facts: localStorage plan archive; 100-plan cap in save and backup validation; sync exportFullBackup; legacy direct import/reset APIs; synchronous storage-scope copy/verify/delete; journal-first UI import/reset; Dashboard direct read; journal/outbox/inbox/conflict consumers; localStorage legacy outbox 1.5 MB cap.

## Adaptive plan capacity + chunks
- Main has no entitlement/billing/tier source. Do not invent tiers or quotas.
- Contract in RFC separates per-plan bytes, account archive bytes, active plan count, local browser quota, and transport chunk size.
- Downgrade preserves existing data; block new writes over limit; no truncation/deletion.
- PR #371 is only the pure codec. Remote chunk uploads/manifests/Inbox materialization remain future stages after archive migration and security review.

## Latest CI evidence
- #365 run 43277331896 / job 131389114054: failure, steps/logs null.
- #368 run 43275594933 / job 131383003139: failure, steps/logs null.
- #369 run 43277201392 / job 131388649297: failure, steps/logs null.
- #370 run 43277107786 / job 131388317808: failure, steps/logs null.
- #371 run 43278092246 / job 131391785241: failure, steps/logs null.
No source-level failure or successful tests/build/typecheck can be inferred. No local runner used.

## Next work
1. Complete semantic scan of all main source callers, all fixtures and E2E before Engine Plans migration.
2. Review and typecheck/test #371; then connect chunk codec only after archive Stage B and approved transaction boundaries.
3. Continue Seerah reader and source provenance at highest priority; no content until rights and historical claim reviews pass.
4. Continue Offline Audio SW protocol, download UI, local-first playback, orphan cleanup and browser/device tests.
5. Recheck all exact heads and Quality Gate logs before any merge. Keep Production/Firebase/Secrets/Sync flags untouched.

## PR #371 latest exact head
- Current head 260df95c620cd534337e39d6707b044eb404139a.
- Quality Gate run 43278752980 / job 131394096177 failed with steps/logs null. No source-level diagnosis or pass.
- Codec still pure; no archive migration or remote sync integration.

## Seerah API and rights evidence
- Dorar: manual token approval, per-encyclopedia permission, visible source attribution + reference URL, no bulk scraping/full DB storage/redistribution, 24–48h cache, server-side token, 60 requests/minute; keep hadith text with its grade.
- Sunnah.com: API key requested through GitHub; no scraping or mass reproduction of collections; individual educational selections permitted; some numbering/grading remains in progress.
- ACO: describes its corpus as public domain and documents the 1955 Tahdhib Ibn Hisham edition, but WIRD still verifies item-level and jurisdiction rights before reuse.
- OpenITI license sources include CC BY-NC-SA 4.0 documentation and a Terms page with different CC BY-SA wording; both state non-commercial restrictions. Verify per release/contributor.
- No Seerah narrative content was ingested or published.

## Seerah exact checkpoint — 2026-11-12
- #365 exact head: adc1ef01b7a0c5eb7e280395520108c94788af5d.
- Reader now restores saved scene only after hydration barrier; reload E2E added.
- New versioned Book Manifest index drives prototype scene navigation; stable anchors derive from book/part/chapter/scene IDs and do not depend on titles or array positions.
- Manifest validation + tests cover schema, IDs, ordering, anchors, malformed nested records and empty published sections.
- Publication contract rejects malformed source/claim/scene/body-block structures; tests added.
- Quality Gate run 43289471345 initial job 131431547175 had no steps/logs (BlobNotFound); rerun job 131431824753 queued at checkpoint time. Vercel status is build-rate-limit. No local tests/typecheck/build pass claimed.
- No historical corpus/content ingested or published. All Seerah content remains blocked pending source-rights and specialist review.


## 2026-11-13 — Engine Plans consumer/test inventory update

Main SHA remains `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. The second-pass source sweep inspected all 183 TS/TSX/JS files in the repository tree (159 src, 18 e2e, 1 scripts, 5 api). The complete call-site-to-test matrix is in `docs/sync/ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md` section 17.

Newly verified indirect consumers include daily session selection, cloud sync coordinator, demo-data transaction, revisioned remote mutation, PlanningEngineWizard, and Firestore Rules tests. Exact locations: `dailySessionSelection.ts:83-87`, `cloudSyncCoordinator.ts:22`, `demoDataPersistence.ts:34`, `revisionedRemoteMutation.ts:66`, `PlanningEngineWizard.tsx:194-243`, `scripts/firestoreRules.test.ts:1317`.

Important unresolved design risks:
- AuthGate does not hydrate an Engine Plans archive before App mounts; Dashboard independently reads StorageService.
- `setStorageScope` currently removes legacy source keys after copying/verifying scoped keys; archive migration must preserve the original bytes through copy→verify→mark.
- Settings and Progress Analytics still export synchronously.
- 100-plan cap remains in storage/backup/session paths; do not raise it as a substitute for archive.
- Journal mutation budget is 450 KB for Engine Plans, but conflict intent/use-remote/keep-local payload checks remain 128 KB; legacy localStorage Outbox parsing also uses 128 KB.

Missing dedicated coverage includes AuthGate hydration, archive migration/crash/quota, Engine Plans scope switching, demo-data grouped transaction, session Engine Plans snapshot, remote Inbox archive materialization/cursor, and Engine Plans conflict resolution. Source review only: no tests were run and no code changed. Keep migration HOLD.

### PR #372 exact-head refresh
- HEAD: `950640ea78d29e87d426a89d8887c15e4de2abac`, OPEN/DRAFT.
- Run `43391729769`, job `131773203535`: completed failure with null steps/logs; log retrieval returned BlobNotFound. BLOCKED observability, not a code-level diagnosis.
- Vercel combined status remains blocked by the Free-plan build-rate limit. Full-source test/typecheck/build/emulator/Playwright remain NOT TESTED.
- No merge/deploy/production/Firebase/secrets/sync-flag changes.
