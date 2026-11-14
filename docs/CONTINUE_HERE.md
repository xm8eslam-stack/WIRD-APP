# LATEST EXECUTION UPDATE — 2026-11-14 09:00 local

**Current main / Production source SHA:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`  
**Production deployment:** `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` — READY  
**PR count:** 16 OPEN / DRAFT; exact heads in [MASTER_PROJECT_STATE.md](./engineering/MASTER_PROJECT_STATE.md).

## New evidence

- PR #375 advanced to `495b9ccada1bb327abeee469af16faa52ddc9707`. Its failed Quality Gate run `43570354110` was retried; latest job `132373650377` again has `steps=null`, `logs_url=null`. Runner initialization/telemetry remains BLOCKED, not an application-test diagnosis.
- #373 run `43568676649`, #363 run `43570268180`, and #372 run `43391729769` show the same failure before any steps/logs.
- Production sync flags remain `true`. No Production settings changed; owner approval is required before disabling them. No sync-related Production actions.
- Ruqyah fix remains Preview-only until exact-head CI passes, PR is safely merged, and post-deploy live smoke verifies short/medium/long.
- The canonical Work Log is append-only; the previous `progress/WORK_LOG.md` path remains a pointer.

**Next execution:** diagnose GitHub Actions runner provisioning/telemetry outside application code; do not weaken tests or workflow gates. In parallel, continue reviewing #373 and plans/offline PR diffs, but do not merge any PR without inspectable exact-head gates.
---
# CURRENT VERIFIED UPDATE — 2026-11-14

**Main SHA:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`  
**Production deployment:** READY on the same SHA (`DKfbfqsBHqzS95CoTdYZCtPPPZwu`).  
**Current PR count:** 16 open PRs; re-fetch exact head SHAs before every action.

## Current blockers and next execution

1. **Production sync safety — FAIL/BLOCKED:** both `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are currently `true` in Vercel Production. No values were changed. Wait for explicit owner authorization before disabling them; do not perform sync-related Production actions meanwhile.
2. **GitHub Actions — BLOCKED:** recent PR jobs fail before recording steps/logs (`steps=null`, `logs_url=null`). A safe retry of PR #373 repeated the same failure. Do not call this an application test failure or a pass.
3. **Ruqyah — PR #373:** latest verified feature commit `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca`; Preview READY. 20 API proxy tests + 14 view/audio-lock tests PASS in isolated Node 26; full 171-entry long-program handler fixture PASS. Production long index previously returned HTTP 502 and remains NOT VERIFIED fixed until gated merge/deploy and post-deploy smoke.
4. **Advisor — PR #364:** latest verified feature commit `ad33875b0304020f930c7b606ef8782d36148707`; client-supplied assistant history roles are no longer trusted. Five targeted source assertions PASS; Preview READY; GitHub CI BLOCKED.
5. **Plans:** #369 multi-range logic reviewed; #371 codec tests 6/6 PASS but codec is not integrated into actual persistence; #367's 800 KB single-payload limit is not a complete chunking solution.
6. **Offline/PWA:** #368 has an IndexedDB job library, downloader and Cache Storage adapter, but cross-tab ownership, complete orphan cleanup, quota UX, reader playback integration and device recovery remain BLOCKED/NOT VERIFIED. Do not merge #358/#359 as competing stores.
7. **Seerah:** #365 is a reader shell/prototype with no publishable verified narrative. Source and rights review remain NOT VERIFIED.
8. **Documentation:** original 537-line main work log has been restored before the newer reconciliation entries (589 lines total) and copied to canonical `docs/engineering/WORK_LOG.md`; the old path is a compatibility pointer.

See [MASTER_PROJECT_STATE.md](./engineering/MASTER_PROJECT_STATE.md), [RELEASE_CHECKLIST.md](./engineering/RELEASE_CHECKLIST.md), and [engineering/README.md](./engineering/README.md) for evidence.

**The sections below are historical snapshots. Do not treat their SHA values, PR statuses, or test results as current.**


---



# Latest continuation — 2026-11-13 (follow-up audit)

## Exact state
- GitHub main: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` (unchanged).
- Production Vercel deployment: `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, READY, target production, source SHA matches main, alias `wird-app.vercel.app`. SSO remains enabled for non-custom domains. No deploy or settings change.
- Open PR heads: #372 `950640ea78d29e87d426a89d8887c15e4de2abac`; #371 `260df95c620cd534337e39d6707b044eb404139a`; #370 `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c`; #369 `814bb8788449ebe3d07d46f00a596a1a7b398a5a`; #368 `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #366 `cade1b630bb429d6a4106de5bf12713df18f3491`; #365 `adc1ef01b7a0c5eb7e280395520108c94788af5d`; #364 `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`; PR #363 documentation remains OPEN/DRAFT; fetch its live head before each continuation rather than storing a self-referential SHA here.. All OPEN/DRAFT.

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
## PR #372 isolation note

#372 modifies only `package.json`, `bun.lock`, `.github/workflows/ci.yml`, and `playwright.config.ts`. A fresh path comparison against #363–#371, #358, #359 and #2 found no overlaps. It can be tested independently of shared product/test registry files.

`vercel.json` disables Vercel deployments on all refs except `main` (`* = false`, `main = true`); therefore no feature preview is expected. The Vercel status also explicitly reports the build rate limit. Do not change deployment policy or production settings to force a preview.

# Latest operational checkpoint — 2026-11-13 (refreshed after PR #372)



## Bun / CI repair candidate

- New PR #372: `https://github.com/xm8eslam-stack/WIRD-APP/pull/372`

- Branch: `fix/bun-single-graph-ci-clean-20261113`

- Exact HEAD: `950640ea78d29e87d426a89d8887c15e4de2abac` (one commit; four files; OPEN/DRAFT; not merged).

- Isolated Bun 1.4.4 package validation: `bun install --force` PASS; `bun install --frozen-lockfile` PASS; `bun audit --audit-level=high` PASS (0 advisories / 360 packages); `bunx playwright --version` = 1.56.1; `bunx firebase-tools@15.0.0 --version` = 15.0.0. Full app source tests/typecheck/build/Firestore/browser tests NOT TESTED in sandbox.

- CI run `43391729769`, attempt 2 job `131773203535`: immediate failure with no job steps and no logs URL; logs endpoint returned `BlobNotFound`. Classification BLOCKED runner/log observability, not code FAIL or PASS.

- Vercel status for this PR SHA: `Deployment rate limited — retry in 24 hours`; no preview deployment created.

- The proposed workflow removes npm install/audit and uses one Bun app graph; Firebase CLI remains a pinned `bunx` tool because putting it in devDependencies produced high advisory findings in its CLI graph.



## Repository and production

- Main remains `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.

- Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` remains READY, target production, source SHA exactly main, alias `wird-app.vercel.app`.

- PR #363 docs remains OPEN/DRAFT, head `8ad512d3e74d549bb20c9c4769198c9152ad9fd9`, not merged.

- Open draft PRs: #372 `950640ea78d29e87d426a89d8887c15e4de2abac`; #371 `260df95c620cd534337e39d6707b044eb404139a`; #370 `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c`; #369 `814bb8788449ebe3d07d46f00a596a1a7b398a5a`; #368 `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #366 `cade1b630bb429d6a4106de5bf12713df18f3491`; #365 `adc1ef01b7a0c5eb7e280395520108c94788af5d`; #364 `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`; #363 docs `8ad512d3e74d549bb20c9c4769198c9152ad9fd9`; #359 `7d31af20fe9cdc69aee4855acaf02e278fbf8b70`; #358 `4970b87d6ba712d3899093f4e8dd297bef17985e`; #2 `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d`.



## Next actions

1. Restore GitHub Actions runner/log visibility or run the exact PR head in a trusted full-source runner; then diagnose any real code/test failures.

2. Re-run the exact frozen Bun install and complete Quality Gate on the full source. Keep PR #372 Draft until every step is inspectable and green.

3. Continue the Engine Plans IndexedDB archive indirect-consumer/test inventory; do not migrate until complete.

4. Keep PR overlap sequencing from CHANGE_CONTROL.md; no parallel merges on shared files.

5. Do not change production settings, secrets, Firebase Rules, or sync flags; do not merge or deploy without required release gates.

## آخر جرد تعارضات الملفات — 2026-11-13

تم جلب changed filenames كاملة ومقسمة الصفحات لكل PR مفتوح. التعارضات الفعلية:
- `src/tests/runAllTests.ts`: #365 و#367 و#368 و#369 و#371 و#358 و#359 و#2 — يجب تسلسل تعديل registry وإعادة تطبيق كل patch على base الجديد.
- `PlanningEngineWizard.tsx`: #367 و#369 و#2 — تعارض مباشر بين الميزانية واختيار نطاق الحفظ؛ لا دمج متزامن.
- #365 مع #2: `App.tsx` و`Sidebar.tsx`.
- #366 مع #2: `SettingsView.tsx`.
- #370 مع #2: `MemorizationSessionView.tsx`.
- #364 مع #2: `api/advisor.ts` و`advisorService.ts` و`geminiSecurity.test.ts`.
- #363 مع #2: `DEVELOPMENT_CHECKPOINT.md` و`FIRESTORE_SYNC_DESIGN.md`؛ #363 مع #359: `OFFLINE_AUDIO_DOWNLOAD_PLAN.md`.

#2 branch قديم، 37 ملفًا، non-mergeable ومتداخل مع غالبية المسارات الحالية؛ لا يُدمج wholesale. #358/#359 قديمان ويُعاملان كـ superseded by #368، ولا يكتب #359 فوق خطة الصوت التي يملكها #363. كل التفاصيل في [CHANGE_CONTROL.md](./CHANGE_CONTROL.md).

# أحدث استكمال تشغيلي — 2026-11-13

> هذا التحديث يعلو على أي جداول أو حالات تاريخية أدناه. تمت المصالحة من GitHub وVercel قبل التسجيل.

## الحالة الحالية
- `main` ما زال `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` = READY، target production، alias `wird-app.vercel.app`، ومصدره نفس SHA تمامًا. لم يحدث deploy أو تغيير إعدادات.
- PR #363 مفتوح/Draft/mergeable، head `7c299743ab17f6add6966715fec9ebaff51dceef`، 254 commits و36 ملفًا؛ لا merge. metadata يعرض merge_commit_sha غير فارغ مع merged=false؛ نعتمد state/merged=false، ولا نفسر الحقل وحده كدمج.
- PR heads الحالية: #364 `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`; #365 `adc1ef01b7a0c5eb7e280395520108c94788af5d`; #366 `cade1b630bb429d6a4106de5bf12713df18f3491`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #368 `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710`; #369 `814bb8788449ebe3d07d46f00a596a1a7b398a5a`; #370 `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c`; #371 `260df95c620cd534337e39d6707b044eb404139a`. كلها OPEN/DRAFT في آخر قراءة.
- #358/#359 قديمان وعلى base مختلف، ومُستبدلان عمليًا بمسار #368؛ لا تدمجهما منفصلين. #2 قديم وغير mergeable.
- PRs #365/#367/#368/#369/#371 تتشارك `src/tests/runAllTests.ts`؛ #367/#369 يتشاركان أيضًا `PlanningEngineWizard.tsx`. تسلسل إلزامي، ولا merge متزامن لهذه المسارات.

## CI وBun — عطل مثبت يحتاج إصلاحًا
- main `package.json` يعلن Bun 1.4.4 وNode >=24.12 <27، override لـ `@grpc/grpc-js@1.14.6`.
- `bun.lock` لا يطابق manifest: dependency maps قديمة، `esbuild` فيه ^0.25.0 مقابل ^0.28.2 في manifest، وoverride/dependency additions غير منعكسة.
- `.github/workflows/ci.yml` يحدّث Bun lock بـ `bun install --force` ثم يثبت التطبيق مرة ثانية عبر npm، ويثبت Playwright مؤقتًا بـ npm. هذا يخالف مبدأ dependency graph واحد.
- التحقق المعزول السابق: frozen install يفشل على lock الحالي؛ بعد regenerate في sandbox للحزم فقط، frozen install وBun audit high نجحا (0 advisory / 360 packages). لم يكن المصدر الخاص موجودًا في sandbox، لذلك tests/build/typecheck/browser لم تُختبر. لا lock جديد ملتزم ولا كود CI معدل.
- خطة الإصلاح مثبتة في [CHANGE_CONTROL.md](./CHANGE_CONTROL.md). لا تعتمد lock regenerated قبل full-source checkout والاختبارات الكاملة.

## آخر CI evidence
- main SHA: لم يظهر له PR-triggered workflow run في الاستعلام الحالي.
- #371 run 43278752980 / job 131394096177: failure مع steps=null وlogs_url=null.
- #368 run 43275594933: failure سابق غير قابل للفحص؛ #363 run 43387141521 / job 131758165310 كذلك steps=null/logs_url=null. تصنيفها BLOCKED/observability، لا code FAIL ولا PASS.
- لا Vercel Preview جديد مثبت على رؤوس PRs أعلاه. Production parity فقط مؤكدة.

## الاستكمال التالي
1. حل مشكلة الحصول على full-source checkout في بيئة معزولة مخولة، ثم أصلح Bun lock/CI وفق CHANGE_CONTROL.
2. واصل مراجعة overlap/changed files لكل PR؛ لا تدمج.
3. أبقِ Engine Plans IndexedDB migration متوقفة حتى يكتمل تدقيق المستهلكين غير المباشرين والاختبارات ونقاط atomicity/recovery؛ #371 codec فقط وليس migration.
4. استمر في مسارات الصوت/PWA/السيرة/تجربة الخطط على مسارات غير متداخلة، مع exact-head evidence.
5. لا تغيّر Production flags أو SSO أو branch protection أو Firebase Rules أو secrets ولا تنشر/تدمج دون الموافقات المحددة.

# نقطة المصالحة التشغيلية — 2026-11-13

> **هذه هي أحدث طبقة تشغيلية.** أي حالة أقدم أدناه سجل تاريخي فقط. اقرأ أيضًا [سياسة ضبط التغيير](./CHANGE_CONTROL.md) قبل أي تعديل.

## الحالة المثبتة من GitHub وVercel

- Repository: `xm8eslam-stack/WIRD-APP`.
- `main`: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Production: deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` = `READY`, target `production`, branch `main`, source SHA مطابق تمامًا لـ main، alias `https://wird-app.vercel.app`.
- Vercel project protection: SSO enabled for `all_except_custom_domains`; only `wird-app.vercel.app` is listed and verified. Domain verification is not proof of anonymous public access. Owner decision required; unchanged.
- Production flags: `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true`. هذه حقيقة إعدادات حالية، وليست شهادة اكتمال مزامنة. لا تبديل دون موافقة محددة.
- `ISLAMICAPI_API_KEY` is present as a sensitive variable for both Preview and Production. Any note claiming only `ISLAMICAPI_API_KEY1` exists in Production is stale. No value was read.
- `main` branch protection is disabled; required status enforcement is off; repository rulesets list is empty. No setting was changed.
- GitHub combined status for current main exposes a Vercel success context only. No recent main-branch Quality Gate run was returned by the current workflow-run query.
- Firebase Rules: Emulator tests exist, but latest deployed Production Rules source/blob was not independently confirmed in this audit.
- Google AI Studio: configured to use `main`; actual sync/build state was not observed.

## CI observability

Recent PR Quality Gate runs completed in approximately 3–4 seconds with no recorded job steps. `fetch_workflow_job_steps` returned empty arrays, and log retrieval returned GitHub `BlobNotFound`. Classify these runs as **BLOCKED / runner-or-log observability unavailable**, not code failure and not pass. The earlier PR #358/#359 Playwright failures had actual failed test steps and remain historical evidence for those superseded branches only.

## PR coordination — current heads at audit time

| PR | Head SHA | State | Coordination |
|---|---|---|---|
| #363 docs | `2eb392a5b3aec8576a2b1a45dbdc1a6abf3978cf` قبل هذه الجولة | OPEN / DRAFT | This branch carries the documentation reconciliation; this update advances its head and triggers a new exact-head run |
| #364 Advisor security | `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98` | OPEN / DRAFT | Distinct API/service paths |
| #365 Seerah | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | OPEN / DRAFT | Shares test aggregator |
| #366 Offline/PWA | `cade1b630bb429d6a4106de5bf12713df18f3491` | OPEN / DRAFT | Service Worker/offline paths |
| #367 Sync budget | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | OPEN / DRAFT | Shares test aggregator and PlanningEngineWizard with #369 |
| #368 Offline Audio | `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710` | OPEN / DRAFT | Shares test aggregator; newer unified implementation |
| #369 memorized ranges | `814bb8788449ebe3d07d46f00a596a1a7b398a5a` | OPEN / DRAFT | Shares test aggregator and PlanningEngineWizard with #367 |
| #370 session display | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | OPEN / DRAFT | Distinct session paths |
| #371 archive codec | `260df95c620cd534337e39d6707b044eb404139a` | OPEN / DRAFT | Shares test aggregator |
| #358 / #359 | `4970b87d...` / `7d31af20...` | OPEN / DRAFT | Older base SHA; superseded by #368; do not merge independently |
| #2 | `9e6d7a11...` | OPEN / DRAFT | Very stale base and non-mergeable; do not merge wholesale |

**Path-overlap rule:** #365, #367, #368, #369, and #371 all modify `src/tests/runAllTests.ts`. #367 and #369 both modify `src/components/plans/PlanningEngineWizard.tsx`. These changes must be serialized/reapplied after each preceding merge; do not merge them in parallel. #363 owns documentation paths; do not let feature PRs independently rewrite the same docs.



**PR #363 history note:** GitHub compare reports 251 commits ahead of main but only 36 changed files. This does not itself prove a merge conflict; it makes history review noisy. Keep the PR Draft, review the complete diff and commit history, and prefer squash/clean-history handling only after exact-head gates and owner-approved merge planning.

## Engineering truth and release boundaries

- Engine Plans remain on localStorage in main, with the 100-plan validation limit. PR #367's 800,000-byte cap is only a temporary unmerged payload budget, not adaptive storage or chunks. PR #371 adds a codec only; no IndexedDB archive integration/migration.
- PR #368 contains a more advanced unified local audio download implementation on its branch, but it is not in main/Production. Do not claim complete offline audio until Service Worker protocol, UI, offline playback, and real browser/device verification are done.
- Bun is declared in `package.json` (`bun@1.4.4`), `bun.lock` is committed, and Vercel detects Bun. CI currently refreshes Bun lock then uses a separate `npm install`/audit/test/build graph. Isolated Bun 1.4.4 verification confirmed the committed lock fails `bun install --frozen-lockfile` because the package override and workspace dependency maps are stale; a regenerated sandbox lock passes frozen install and `bun audit --audit-level=high` (0 advisories / 360 packages). The regenerated lock was not committed and full app tests/build were not run. Fix the lock and CI graph together after full-source validation.
- No merge, deploy, Production setting/protection change, Firebase Rules change, secret change, or sync-flag change occurred during this audit.

## Owner actions still open

1. Decide whether to keep or disable the two Production sync flags while full release gates remain incomplete.
2. Decide whether the Vercel domain must be publicly accessible without SSO; authorize a protection/domain change separately if needed.
3. Authorize GitHub branch protection/ruleset changes and define required checks/reviewers.
4. Verify Google AI Studio sync from the connected `main` branch.
5. Approve a controlled real-device A↔B/offline recovery test after exact-SHA deployment and release gates.
6. Confirm the current Production Firebase Rules deployment evidence if any rule changes are planned.

## Immediate next engineering steps

1. Restore GitHub Actions runner/log observability and run a fresh exact-main Quality Gate.
2. Reconcile CI to the Bun lockfile and audit the exact locked dependency graph; add/lock Playwright as a reproducible test dependency.
3. Serialize shared-file PR work and reconcile stale/superseded branches.
4. Finish the Engine Plans consumer/test inventory and RFC before any migration.
5. Continue independent offline/audio/Seerah work only on disjoint paths and with exact-head tests.
6. Update this section after every meaningful change; never let a historical section below override it.

---

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

# إغلاق جرد المستهلكين والاختبارات — 2026-11-12 18:25 +02:00

**RFC المقترح:** [ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md](./sync/ENGINE_PLANS_INDEXEDDB_ARCHIVE_RFC.md). الحالة: تصميم فقط؛ لم يبدأ التنفيذ أو migration.

## نتيجة scan موسع على main
- فُحصت ملفات المصدر الـ100 من نوع TS/TSX تحت `src/` بحثًا عن `getEnginePlans/saveEnginePlans/ENGINE_PLANS/enginePlans/exportFullBackup/importBackup/resetAllData` وواجهات التخزين ذات الصلة.
- فُحصت ملفات الاختبار وE2E الـ78 (test/spec) بحثًا عن نفس العقود.
- هذا scan للمستودع عند main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`، وليس تشغيلًا للاختبارات.

## خريطة المستهلكين بعد الإكمال
- **UI المباشر:** `App.tsx` مصدر state والقراءة والحفظ؛ `DashboardView.tsx` يقرأ Engine Plans مباشرة لاختيار الجلسة؛ `MemorizationPlansView.tsx` يمرر القائمة إلى `PlanningEngineWizard` عبر props/callback فقط؛ لا مستهلك تخزين مباشر إضافي ظهر في بقية ملفات UI بعد scan.
- **مصادر كتابة إضافية:** `demoDataPersistence.ts` ينشئ خطة تجريبية داخل grouped journal transaction؛ `journaledSnapshotService.ts` هو snapshot writer؛ `sessionPersistence.ts` يضمّن الخطة اختياريًا مع إكمال الجلسة.
- **Backup/reset:** Settings وProgress Analytics هما مسارا export المتزامنان؛ كلا UI import يستخدم `importBackupFile` journal-first؛ `StorageService.importBackup` بقي legacy direct writer ولم يظهر مستهلك UI له في المسح؛ reset في التطبيق journal-first، والـ low-level `StorageService.resetAllData` ظهر في fixtures/tests.
- **Projection/bootstrap:** `applyJournalProjection`, `matchesJournalProjection`, `isLocalProjectionEmpty`, و`getLocalProjectionSnapshot` كلها تقرأ/تكتب/تلتقط `ENGINE_PLANS` من localStorage. `journalProjectionReplayer` يعيد الإسقاط قبل تركيب App. `remoteInboxProjector` و`IndexedDbSyncJournal` يستخدمان واجهات StorageService لتطبيق النسخ المستوردة.
- **Conflict resolution:** `syncConflictResolutionService` يستخدم `getLocalProjectionSnapshot` و`matchesJournalProjection` عند use-remote وkeep-local؛ و`IndexedDbSyncJournal.commitUseRemoteConflictResolution` يستدعي projection داخل معاملة journal IndexedDB. يجب نقل هذه العقود كلها مع archive backend، لا get/save فقط.
- **Cloud path:** `cloudSyncCoordinator`, `LocalSyncOutbox`, `IndexedDbSyncJournal`, `revisionedRemoteMutation`, و`remoteInboxProjector` تسمح بمجموعة enginePlans وتتعامل مع payloads/snapshots والـ revisions/cursors. على main الحد الحالي في journal هو 450,000 bytes، والـ outbox له budget إجمالي منفصل 1,500,000 bytes؛ #367 فقط يغيّر الميزانية إلى 800,000 مؤقتًا على فرعه.
- **اختبارات/fixtures ذات صلة:** `planningEngine.test.ts`, `dailySessionSelection.test.ts`, `backupValidation.test.ts`, `backupPersistence.test.ts`, `journaledSnapshotService.test.ts`, `sessionPersistence.test.ts`, `storageReliability.test.ts`, `storageScope.test.ts`, `indexedDbSyncJournal.test.ts`, `localSyncOutbox.test.ts`, `cloudSyncCoordinator.test.ts`, و`scripts/firestoreRules.test.ts`. `journaledSnapshotService.test.ts` يختبر تحميل demo data مع enginePlans؛ `cloudSyncCoordinator.test.ts` يختبر enqueue/delete/recovery؛ `firestoreRules.test.ts` يتضمن حالات تعارض Engine Plans.
- لا توجد واجهة مستقلة لـ AuthGate tests في شجرة الاختبارات الحالية؛ تهيئة الحساب/النطاق مغطاة جزئيًا في `storageScope.test.ts` و`firebaseAuth.test.ts`، ويجب إضافة اختبارات startup hydration صريحة.

## قيد ذرية جديد يجب حله في RFC
المسار الحالي يثبت journal/outbox داخل IndexedDB ثم يعيد الإسقاط إلى localStorage مع recovery markers/cursors. كما أن `commitUseRemoteConflictResolution` ينفذ `StorageService.applyJournalProjection` أثناء معاملة IndexedDB الخاصة بالـ journal. إذا كان Engine Plans archive في قاعدة IndexedDB منفصلة، فلن تكون كتابته ذرية تلقائيًا مع journal/outbox/conflict/cursor. يجب أن يختار RFC أحد تصميمين واضحين:
1. archive + journal/outbox في نفس قاعدة IndexedDB ومعاملة متعددة stores واحدة حيث يمكن ضمانها، أو
2. بروتوكول prepare/commit intent idempotent عبر قاعدتين، مع revision/fingerprint/record IDs، وrecovery عند كل نقطة crash، وعدم تحريك أي cursor قبل تحقق materialization.
لا يكفي وعد "atomic" دون تعريف transaction boundary الفعلية. ويجب أن تتعامل conflict snapshots مع archive revision/fingerprint بدل الاعتماد على localStorage raw bytes وحدها.

## حالة الجرد
اكتمل scan ملفات المصدر والاختبارات المعروفة عند SHA المحدد، لكن لم يبدأ RFC أو migration أو تغيير حدود. التالي: توثيق sequence diagrams والعقود/نقاط crash، ثم كتابة RFC/ADR واختبار تصميمه قبل تنفيذ adapter. لا تغييرات Production/Rules/secrets/flags أو merge/deploy.
---

# مراجعة متابعة جديدة — 2026-11-12 18:15 +02:00

## الحالة الحية المعاد التحقق منها
- `main`: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Production deployment: `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` = READY، target production، branch `main`، و`githubCommitSha` مطابق تمامًا لـ main؛ alias `wird-app.vercel.app`. لا يعني ذلك تنفيذ live browser/sync smoke.
- PR #363: OPEN / DRAFT / mergeable، head `9a5eb9579b474c50bc192a4f0dac2001d3aa7afb`، run `43217043348` / job `131178813698`: failure مع `steps=null` و`logs_url=null`؛ لا تشخيص اختبار ولا pass.
- PR #365: OPEN / DRAFT، head `d0fc6753c32e231bcfe4396e0808963ed5c6978f`، run `43211160493` / job `131158819288`: failure بلا steps/logs.
- PR #366: OPEN / DRAFT، head `b289bba34a93d730ca4fd06a08220d75067bf8c7`، run `43202600366` / job `131129580249`: failure بلا steps/logs.
- PR #367: OPEN / DRAFT، head `fd417faaa96a11920ef3a8e4f1038f567c36a731`، run `43209066503` / job `131151602011`: failure بلا steps/logs.
- PR #368: OPEN / DRAFT، head `08851241bff289e04b13568188e0b2103a1d02e3`، run `43215055425` / job `131172059517`: failure بلا steps/logs.
- جميع رؤوس PRs أعلاه تستهدف main SHA المذكور. لا يوجد دليل قابل للفحص على نجاح الاختبارات لهذه الرؤوس، ولا نعد فشل الـ runner فشلًا برمجيًا مثبتًا.

## جرد Engine Plans — تقدم مثبت، وليس مكتملًا بعد
1. `StorageService.getEnginePlans/saveEnginePlans` يقرآن/يكتبان JSON في localStorage؛ حد الحفظ 100. `validateBackupPayload` يفرض 100 أيضًا.
2. `App.tsx` يهيئ الحالة عبر getEnginePlans ويعيد القراءة في refresh/session/dashboard/progress flows؛ الحفظ العادي عبر `persistEnginePlansSnapshot`، وإكمال الجلسة قد يضمّن snapshot في grouped journal transaction.
3. `DashboardView.tsx` يقرأ `StorageService.getEnginePlans()` مباشرة عند اختيار الجلسة اليومية؛ يجب تحويله إلى مصدر hydrated موحد (prop/store) قبل cutover.
4. `PlanningEngineWizard` يتعامل عبر props و`onUpdateEnginePlans`، ولا ينبغي أن يفتح backend التخزين بنفسه.
5. `journaledSnapshotService` يكتب `enginePlans/snapshot` عبر `StorageService.saveEnginePlans`. `sessionPersistence` يرفض أكثر من 100.
6. `StorageService.applyJournalProjection` يكتب Engine Plans إلى localStorage، و`matchesJournalProjection` يقرأ المفتاح مباشرة ويفرض 100؛ journal replay يعتمد على هذه الواجهات قبل cursor advancement.
7. `remoteInboxProjector` يمرر الحدث إلى `StorageService.applyJournalEvent` داخل finalize transaction؛ لا يتحرك remote projection cursor إلا بعد نجاح materialization/finalization.
8. مسارا export المؤكدان هما SettingsView وProgressAnalyticsView، وكلاهما يستدعي `StorageService.exportFullBackup()` المتزامنة. يجب تحويل كليهما إلى async verified archive export مع loading/error handling.
9. مسارا UI للاستيراد يستخدمان `importBackupFile → importBackupJournaled → persistJournaledTransaction`. أما `StorageService.importBackup` فيظل legacy direct localStorage writer، ويجب استكمال مسح جميع callers قبل إهماله.
10. واجهة reset في التطبيق journal-first عبر `resetAllDataJournaled`; `StorageService.resetAllData` low-level legacy direct deletion ولا يجوز جعله المسار canonical.
11. اختبارات موجودة ومتصلة بالمسار: `storageScope.test.ts`, `storageReliability.test.ts`, `backupValidation.test.ts`, `backupPersistence.test.ts`, `journaledSnapshotService.test.ts`, `sessionPersistence.test.ts`, `journalProjectionReplayer.test.ts`, `indexedDbSyncJournal.test.ts`, `localSyncOutbox.test.ts`. هذا جرد suites المعروفة وليس بعد inventory لكل fixtures/callers غير المباشرين.

## ما لم يكتمل — يمنع بدء migration
- إكمال scan لكل استدعاءات `getEnginePlans/saveEnginePlans/exportFullBackup/importBackup/resetAllData` وكل fixtures والـ test harnesses. GitHub code search لم يقدم نتائج موثوقة (0 مع incomplete_results)، لذا لا ندّعي grep شاملًا.
- توثيق sequence كامل من App/UI → archive → journal/outbox → remote writer/Firestore → inbox/projector → archive materialization/conflicts.
- تحديد atomic boundary بين archive revision وjournal/outbox references، بما يشمل rollback بعد crash/quota/account switch.
- فحص conflict-resolution flows والـ backup validation fixtures وحدود payload والـ grouped transactions والعملاء الأقدم.
- لا تبدأ migration أو تغيّر حد 100 أو byte budgets قبل إغلاق هذه البنود واعتماد RFC/ADR واختبارات crash/restart/UID isolation.

## القرار التالي
أكمل الجرد على main والاختبارات والـ fixtures، ثم اكتب RFC للأرشيف المحلي versioned IndexedDB وhydration barrier وcopy-verify-mark migration وrollback، مع الاحتفاظ بنسخة localStorage القديمة read-only. بعد ذلك فقط يبدأ تنفيذ adapter في فرع مستقل. لا merge/deploy أو تغيير Production/Rules/secrets/sync flags.

لم تُجرَ اختبارات محلية في هذه المراجعة؛ تم فحص ملفات المصدر والاختبارات عبر GitHub فقط. لم تتغير main أو Production أو Firebase Rules أو البيانات أو الأسرار أو sync flags.

---

# أحدث ملحق متابعة — 2026-11-12 12:37 +02:00

## قرار معماري إضافي — 2026-11-12 14:55 +02:00

### التخزين المرن: لا ترفع الحدود مرة أخرى قبل إصلاح الطبقة المحلية

تتبع المسار الحي أثبت أن `StorageService.saveEnginePlans` ما زال يرفض أكثر من 100 سجل ويكتب JSON كاملًا إلى localStorage. PR #367 يوحّد ميزانية payload إلى 800,000 بايت، لكنه لا يزيل حد العدد ولا ينقل الأرشيف من localStorage ولا يقسم الخطة إلى مستندات Firestore.

أضفت التصميم التفصيلي في `docs/sync/ARCHITECTURE.md`:
- أرشيف محلي versioned في IndexedDB.
- migration lossless من localStorage، مع إبقاء النسخة القديمة حتى تحقق SHA.
- تخزين snapshot chunks ومرجع Manifest صغير في journal/outbox بمعاملة ذرية.
- رفع Firestore chunks immutable ثم نشر manifest pointer بعد التحقق الكامل.
- استرجاع chunks قبل local projection دون تحريك cursors عند الفشل.
- توافق إصدارات/قدرات العملاء القديمة قبل إرسال manifest.
- تأجيل garbage collection حتى توجد device acknowledgements موثوقة.
- عدم اختراع حصص خطط أو وصف السعة بأنها غير محدودة حرفيًا.

**الخطوة التالية المحددة:** حصر جميع مستهلكي `StorageService.getEnginePlans/saveEnginePlans` واختباراتهم، ثم تصميم خدمة IndexedDB محلية وهيدرشن قبل العرض. لا تحذف حد 100 أو تغير شكل payload قبل اكتمال هذه المرحلة.

### تنزيل الصوت Offline — قيد مهم

أُضيف في PR #368 حقل `cacheGenerationId` لكل نسخة ملف. يجب أن يستخدم Cache Storage adapter مفتاحًا يتضمن generation ID، لا URL ثابتًا فقط؛ حتى لا يحذف تنظيف قديم ملفًا جديدًا أُعيد تنزيله لنفس الآية. يظل #368 metadata-only ولا ينفذ Cache Storage بعد.



## متابعة التنفيذ الحية — 2026-11-12 14:35 +02:00

### التخزين/المزامنة
- main ما زال `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- PR #367 head `fd417faaa96a11920ef3a8e4f1038f567c36a731`: بعد إزالة ملفي الوثائق المتداخلين أصبح كودًا فقط، ولا يزال حد 800 KB مؤقتًا لكل payload وليس chunked sync. run `43209066503` / job `131151602011` فشل دون steps/logs؛ Vercel blocked by Free build-rate.
- لا يبدأ chunked sync قبل مراجعة localStorage/IndexedDB، Outbox, coordinator, writer, event ledger, inbox/projector, Firestore Rules، وتوافق الإصدارات القديمة. لا يوجد تنفيذ chunks حتى الآن.

### Offline / تنزيلات القرآن
- PR #368 head `4e3a192ee766108ff580cebed32699a70fb7f5ab` يضيف أساس metadata موحدًا: IndexedDB stores `jobs`, `files`, `jobItems`، مشاركة الملفات بين المهام، pin retention، حالة `available`، وعلامة `deletionPending` مع finalize بعد حذف Cache Storage بنجاح.
- اختبارات fake-indexeddb أضيفت لـ idempotency، مشاركة الملف، الحذف الآمن، pin/unpin، cache eviction، stale scan، quota rollback، واستعادة قاعدة البيانات.
- run `43210985755` / job `131158220859` انتهى failure دون steps/logs؛ لا توجد نتيجة اختبار قابلة للتشخيص. Vercel blocked by Free build-rate.
- PR #358 و#359 ما زالا Draft لكن وُسما بأنهما superseded؛ لا تدمج أيًا منهما منفردًا. #368 لا ينفذ تنزيل HTTP أو Cache Storage adapter أو Service Worker protocol أو UI أو offline playback بعد.
- EveryAyah يظل streaming فقط. الصوت المحفوظ يبقى محليًا ولا يدخل Firebase sync أو backup.

### السيرة
- PR #365 head `d0fc6753c32e231bcfe4396e0808963ed5c6978f`: علامات مرجعية محلية مرتبطة بإصدار الكتاب/الجزء/الفصل/المشهد/anchor، مع قائمة رجوع، معالجة فشل التخزين، واختبار Playwright للحفظ بعد reload والإزالة والرجوع للمشهد.
- run `43211160493` / job `131158819288` انتهى failure دون steps/logs؛ لا يمكن إعلان نجاح الاختبارات. Vercel blocked by Free build-rate.
- القارئ ما زال shell تجريبيًا ولا يحتوي سردًا تاريخيًا معتمدًا؛ لا cloud sync للعلامات.

### التوثيق وتداخل PRs
- PR #363 هو المالك الوحيد للوثائق.
- لا يوجد تداخل ملفات بين #363 و#367 أو #368.
- #363 head عند بدء هذه الإضافة `268e814772a73d98a456ef13e2ded2dfafd5510e`؛ run `43209499439` / job `131153164362` فشل دون steps/logs. هذه الإضافة ستغير head؛ أعد جلبه قبل أي قرار.
- #366 ما زال head `b289bba34a93d730ca4fd06a08220d75067bf8c7`؛ run `43202600366` / job `131129580249` دون steps/logs.

**الحدود:** لا merge ولا deploy ولا تغييرات على main أو Firestore Rules/production schema/data/secrets/flags أو بيانات المستخدمين. كل Quality Gates الحديثة غير قابلة للتشخيص بسبب عدم وجود steps/logs. لا تدّعِ نجاحًا ولا تكرر rerun دون سبب جديد.


## متابعة تنفيذ جديدة — 2026-11-12 14:05 +02:00

### تغييرات منذ آخر checkpoint

- **السيرة PR #365:** أضيف حفظ علامات مرجعية محليًا حسب `bookVersion/part/chapter/scene/anchor`، مع إزالة علامة محددة، منع التكرار، عزل نسخ المحتوى، وقائمة علامات قابلة للعودة إلى المشهد. اختبارات الخدمة أضيفت للحالات الطبيعية والتالف وفشل quota. هذا لا يضيف محتوى تاريخيًا أو مزامنة سحابية.
  - head الجديد: `16048985de1df2e17fb0c45afbafa8d16acd7933`
  - Quality Gate run `43209263032`, job `131152309833`: failure مع `steps=null` و`logs_url=null`. لا يمكن إعلان نجاح الاختبارات أو تشخيص فشل كودي.
  - Vercel exact-head status محجوب بحد Free build-rate؛ نجاح Preview السابق كان على SHA أقدم ولا ينطبق على هذا الرأس.
- **تنظيف تداخل PR #367:** أُعيد ملفا `docs/sync/ARCHITECTURE.md` و`docs/engineering/progress/WORK_LOG.md` إلى نسخة main داخل فرع #367؛ أصبحت قائمة ملفات #367 لا تتداخل مع #363.
  - head الجديد: `fd417faaa96a11920ef3a8e4f1038f567c36a731`
  - Quality Gate run `43209066503`, job `131151602011`: failure دون steps/logs.
  - Vercel exact-head status محجوب بحد Free build-rate.
- **PR #363 docs:** head عند بدء هذا التحديث `0de075630acc92bddeda72402bfe5b37c1f3633d`، run `43209044601`, job `131151525550`، فشل قبل steps/logs. التعديلات التوثيقية الحالية ستنشئ head جديدًا؛ أعد جلبه قبل أي قرار.
- **PR #366 Offline:** لا تغيير كود في هذه المرحلة؛ head `b289bba34a93d730ca4fd06a08220d75067bf8c7`، run `43202600366` بلا steps/logs. يظل كاش الصوت/المصحف تكيفيًا وانتهازيًا، وليس مكتبة تنزيل كاملة أو إثبات Offline بعد restart.

### نتيجة مراجعة LRU في Service Worker

تم فحص `public/sw.js` في فرع #366: تشغيل الصوت من Cache Storage يعيد ترتيب الإدخال عبر delete/put قبل trimming، وصفحات المصحف تفعل ذلك أيضًا. تنزيل الصوت المسبق يتجاوز العنصر الموجود؛ الاستخدام الفعلي أثناء playback هو الذي يحدث recency. لم يظهر خلل واضح يستدعي تعديلًا تخمينيًا في هذا الجزء.

### الحدود

لا merge ولا نشر ولا تغيير main أو قواعد Firestore أو Production flags/secrets أو بيانات المستخدم. جميع Quality Gates الحديثة ما زالت غير قابلة للتشخيص بسبب عدم وجود steps/logs؛ لا تكرر rerun دون تغير ظروف الـ runner.


## مراجعة الاستكمال الحية — 2026-11-12 13:40 +02:00

**المستودع:** `xm8eslam-stack/WIRD-APP` — **main:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` (تم التحقق مباشرة من refs/heads/main).

### حالة مسارات العمل ونتائج الفحص على exact head

| المسار | PR / head الحالي | الحالة | CI الدقيق | Vercel |
|---|---|---|---|---|
| التوثيق والصفحة المرجعية | #363 — `5f336a31687bc534fb729c56a9c49dabf0416c18` | OPEN / DRAFT / mergeable | run `43203107824`, job `131131326627`: failure مع `steps=null` و`logs_url=null`؛ لا نتيجة اختبار قابلة للتشخيص | محجوب بحد Free build-rate |
| السيرة | #365 — `ea9d578855424bcadf08cd7f29d6f14c11b90d06` | OPEN / DRAFT / mergeable | run `43186044298`, job `131073336535`: failure قبل تسجيل steps/logs | Vercel status success على Preview؛ لا browser smoke موثق |
| Offline/PWA | #366 — `b289bba34a93d730ca4fd06a08220d75067bf8c7` | OPEN / DRAFT / mergeable | run `43202600366`, job `131129580249`: failure قبل تسجيل steps/logs | محجوب بحد Free build-rate |
| ميزانية مزامنة الخطط | #367 — `cf88ac83de8706c20a01cf3b00827e8fe6e71473` | OPEN / DRAFT / mergeable | run `43200705034`, job `131123069674`: failure قبل تسجيل steps/logs | Vercel status success على Preview؛ لا دليل Production |

جميع الوظائف الأربع أعادت `steps=null` و`logs_url=null`. لذلك لا نعدّها نجاحًا ولا فشل اختبار برمجيًا؛ إنها حالات فشل Workflow غير قابلة للتشخيص من الأدلة المتاحة. لا تكرر rerun دون تغير ظروف الـ runner أو توفر logs قابلة للفحص.

### نتائج مراجعة الملفات والتداخل

- تم فحص قائمة الملفات الفعلية لكل PR.
- **تصحيح مهم:** PR #367 ليس code-only حاليًا؛ فهو يعدّل أيضًا `docs/sync/ARCHITECTURE.md` و`docs/engineering/progress/WORK_LOG.md`، وهما ملفان يتداخلان مع PR #363. يجب إبقاء الوثائق المرجعية في #363 وإزالة هذين التعديلين من #367 حتى يصبح PR الكود منفصلًا فعلًا.
- #366 يغيّر سبعة ملفات كود/اختبار ولا يتداخل في الملفات مع #363.
- #365 يضيف shell للقارئ وعقد المحتوى والتقدم؛ لا يحتوي محتوى تاريخيًا حقيقيًا معتمدًا.
- PR #367 يحل عدم اتساق 450 KB/128 KB ويرفع الحد إلى 800,000 byte لمسار الخطة، لكنه **لا** ينفذ chunks أو manifest أو سعة سحابية إجمالية مرنة.
- لا توجد أدلة على اختبار متصفح/جهاز حقيقي لوضع الطيران بعد restart في #366، ولا على اختبار نشر/مراجعة محتوى تاريخي في #365.

### الخطوة التنفيذية الآمنة التالية

1. إبقاء PR #363 مرجع التوثيق الوحيد، وPR #367 كودًا فقط بعد إزالة ملفي التوثيق المتداخلين.
2. عدم دمج أي من PRs الأربعة قبل Quality Gate قابل للفحص وناجح على exact head، ومراجعة diff نهائية.
3. تصميم chunked engine-plan storage على المسار الحالي: رفع أجزاء immutable/idempotent، التحقق من الطول وSHA-256، نشر manifest pointer بعد اكتمال الأجزاء، وإبقاء آخر نسخة سليمة؛ لكن لا يبدأ التنفيذ قبل تتبع كامل لمسارات enqueue → outbox → writer → Firestore Rules → event → inbox/projector → local storage.
4. استكمال offline capability matrix والتحقق من أن كاش الوسائط فقط هو الذي يُقلص، لا تقدم المستخدم أو journal.
5. استكمال واجهة السيرة دون نشر نص تاريخي غير موثق؛ إضافة bookmarks/anchors/progress على contentVersion بعد مراجعة القارئ الحالي.

**حدود هذه المراجعة:** لم يتغير main، ولم يتم دمج أو نشر أي شيء، ولم تُمس Firestore Rules أو بيانات المستخدمين أو الأسرار أو متغيرات الإنتاج أو sync flags أو إعدادات Vercel. لا يوجد Google AI Studio sync أو live Production smoke جديد مثبت.


## مسارات التخزين التكيفية

- PR #366 — Offline/PWA: آخر head `b289bba34a93d730ca4fd06a08220d75067bf8c7`، Draft/HOLD. أضيفت سياسة تكيفية لكاش الصوت وصفحات المصحف تعتمد على `navigator.storage.estimate()`، وتحتفظ باحتياطي للتخزين وتخفض الكاش الاختياري حسب المساحة المتاحة مع LRU وسقوف قصوى. لا تمس التقدم أو الحساب أو سجل المزامنة.
- فحص PR #366: Quality Gate run `43202600366`، job `131129580249` انتهى failure مع `steps=null` و`logs_url=null`؛ لا يمكن معرفة نتيجة الاختبارات أو TypeScript أو build. Vercel Preview محجوب بحد الخطة المجانية. لا يوجد اختبار طيران/متصفح فعلي على هذا الرأس.
- PR #367 — engine-plan sync: آخر head `cf88ac83de8706c20a01cf3b00827e8fe6e71473`، Draft/HOLD. الحد الحالي 800 KB لكل مستند Firestore واحد، وليس حد الحجم الكلي لكل خطة. لا ترفعه إلى 1.35–1.8 MB؛ الخطط الأكبر تحتاج chunks/versioned manifests مع integrity check ونشر pointer ذري بعد اكتمال كل الأجزاء.
- لا توجد حاليًا entitlements موثقة لخطط اشتراك مدفوعة؛ لا تخترع حصص Free/Pro. عند تعريف الخطط مستقبلًا، تُربط الحصة الإجمالية بسياسة server-side موثوقة، بينما يظل حجم المستند الواحد تحت حد Firestore.
- لا تغيير لقواعد Firestore أو إعدادات الإنتاج أو مفاتيح/أسرار أو sync flags أو بيانات المستخدم. لا دمج حتى Quality Gate قابل للفحص وناجح على exact head؛ ولا ادعاء باكتمال Offline دون اختبار حقيقي.

## استكمال العمل
1. أكمل مراجعة سياسة الكاش التكيفية واختبارها على المتصفحات؛ تأكد من أن التخزين الاختياري فقط هو الذي ينكمش.
2. صمم ونفذ chunked engine-plan sync في PR مستقل بعد تدقيق قواعد Firestore ومسارات projection/conflict/outbox؛ لا تلمس قواعد الإنتاج دون موافقة صريحة.
3. أعد جلب exact SHA/CI/Vercel لكل PR قبل أي قرار؛ لا تكرر rerun إذا ظل runner لا يسجل steps/logs.
4. أبقِ اختبارات airplane-mode وإعادة التشغيل والضغط على التخزين ضمن OWNER_ACTIONS حتى تتوفر بيئة جهاز فعلية.

---

# أولوية تنفيذ جديدة — Offline-first وجاهزية التطبيق (2026-11-12)

اجعل إتاحة وِرد دون إنترنت مسارًا أساسيًا متوازيًا مع القرآن والعبادات والسيرة وتجربة المستخدم والمزامنة. الهدف أن يظل التطبيق مفيدًا بعد تجهيز أولي صريح، ثم يكون قابلًا للتغليف كتطبيق مستقبلي دون إعادة كتابة مبكرة.

- اقرأ docs/offline/OFFLINE_FIRST_ARCHITECTURE.md وdocs/offline/APP_READINESS_ROADMAP_AR.md وdocs/offline/OFFLINE_CAPABILITY_MATRIX_AR.md.
- لا تعِد بناء PWA الموجود؛ راجع Service Worker وmanifest وحزمة lazy chunks والتخزين المحلي والصوت والبيانات الموثقة أولًا.
- ابنِ مصفوفة لكل route × asset × data × action وصنّفها: bundled / prepared / previously cached / opportunistic / network-required.
- سد فجوة public assets في allAssets، واختبر الحزمة الفعلية بعد build، وراجع الخطوط والملفات الخارجية.
- اختبر فتح التطبيق بعد restart وفي وضع الطيران، وحفظ التقدم محليًا، والتعامل مع quota/eviction، ثم الاسترداد والمزامنة عند عودة الشبكة.
- Auth/Firebase والـ APIs الحية والمحتوى غير المحفوظ لا تُعلن Offline. لا cache للبيانات الخاصة أو الرموز أو ردود API الخاصة.
- الصوت المثبت منفصل عن cache الانتهازي؛ EveryAyah يبقى stream-only حتى وجود حق واضح، ولا مزامنة للصوت.
- PWA هو الأساس؛ لا اختيار Capacitor/TWA/native أو إضافة plugins قبل اجتياز بوابات Offline web.
- PR #366 مسار كود منفصل عن PR #363 الوثائقي. أعد جلب SHA/CI/Vercel على exact head. لا تدمج أيًا منهما لمجرد نجاح Vercel.
- ضع اختبار الأجهزة الفعلية وقرار المنصات المستقبلية في OWNER_ACTIONS.md ولا توقف المهام المستقلة بسببه.

---

# WIRD — نقطة الاستكمال الحالية (مصدر الحقيقة)

**آخر تحقق حي:** 2026-11-12 01:31 +02:00  
**المستودع:** `xm8eslam-stack/WIRD-APP` — الفرع الأساسي `main`  
**فرع الوثائق:** `docs/wird-docs-roadmap-reconciled-20261111`

> هذه اللقطة توثق آخر رأس فُحص قبل تحديث الوثائق الحالي. هذا التحديث نفسه سينشئ head جديدًا؛ أعد جلب head وchecks بعده قبل أي قرار.

## أحدث حالة حية — 2026-11-12 01:31 +02:00

- **main:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- **Production:** Vercel deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` هو `READY` على SHA نفسه، والـ alias `wird-app.vercel.app`. لا live browser smoke أو A↔B sync smoke.
- **main Quality Gate:** run `43079260528` انتهى قبل تسجيل steps؛ logs `BlobNotFound`. لا تشخيص test-level ولا pass مثبت.
- **PR #363:** OPEN / DRAFT / HOLD، base `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`، آخر head تم فحصه `acdfeef4e4baf99251e4768bbbc808fabab4f130`، و`mergeable=true`. 28 ملفًا توثيقيًا فقط (1,892 إضافة و8 حذف). Exact-head run `43120106137`, job `130858118105`, انتهى failure بعد نحو ثانيتين مع `steps=null`؛ logs `BlobNotFound`، وannotation واحدة غير متاحة. لا يوجد فشل اختبار مُشخّص ولا نجاح Quality Gate. Vercel Preview deployment `dpl_CcBtjR4TRcqJd9pNwSZTvkgS2LHA` هو `READY` على هذا الرأس؛ هذا لا يثبت Production ولا يعوض CI.
- **PR #361/#362/#354:** MERGED، وGitHub compare يؤكد أن main descendant من commits الثلاثة. #361 أبقى EveryAyah stream-only؛ #362 أصلح guest-entry helper؛ #354 أضاف hardening آمنًا للـ Ruqyah proxy دون إثبات زوال 500 الأصلي.
- **PR #358:** OPEN / DRAFT؛ run `43030195498`: 159 Playwright passed و1 failed و2 skipped؛ فشل desktop لأن helper لم يصل إلى شاشة المراجعة، فلم يظهر زر إضافة المقطع. باقي suites/Emulator/TypeScript/build نجحت.
- **PR #359:** OPEN / DRAFT؛ run `43029617572`: 158 Playwright passed و2 failed و2 skipped؛ نفس مشكلة guest-entry على desktop/mobile. #362 أصلح helper لكن هذين الرأسين القديمين لم يعادا الفحص بعده. لا تدمج أيًا منهما منفردًا؛ manifest responsibilities متداخلة.
- **PR #364:** OPEN / DRAFT؛ run `43117641418` فشل قبل steps/logs (`BlobNotFound`)، وPreview نجح. لا Quality Gate pass مثبت.
- **PR #2:** OPEN / DRAFT وغير قابل للدمج حاليًا؛ 115 ahead / 469 behind. لا دمج wholesale.
- **Production sync flags:** `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` و`VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` بحسب الجرد غير المفكوك. لم يتم تغييرهما؛ قرار المالك مطلوب.
- **Google AI Studio / live browser smoke / جهازان حقيقيان / offline audio playback:** NOT VERIFIED.

## التنفيذ التالي

1. بعد هذا التحديث، أعد جلب head الجديد وcheck runs على exact SHA؛ أبقِ #363 Draft/HOLD حتى تنجح جميع خطوات Quality Gate المسجلة.
2. نفّذ offline audio كمسار موحد فقط على أحدث main؛ لا تدمج #358/#359 منفصلين.
3. واصل تشخيص Ruqyah index/500 وsync cutover دون تغيير إعدادات الإنتاج أو البيانات.
4. قبل بناء السيرة، افحص مكونات القارئ والتوجيه والتخزين القابلة لإعادة الاستخدام؛ المنتج كتاب متصل متعدد المشاهد، وليس قائمة دروس.

---

## 3. خطة السيرة — قرارات يجب عدم نسيانها

- SeerahBook مرشح POC من حيث الأشخاص والأحداث والأماكن والعلاقات، لكنه مبني بحسب تعريفه على سلسلة دروس محددة، ولا يُعتمد وحده.
- الدرر السنية تقدم API للموسوعة التاريخية، لكن الوصول يتطلب طلبًا ومراجعة وموافقة وتوكن؛ لا تفترض توفر الاعتماد.
- Islamic Network People/Events APIs مرشحة للتجربة فقط؛ People API معلنة Early Access، ويجب التحقق من العربية والمراجع والحقوق.
- لا API مختارة نهائيًا. قارن عينة من الأحداث والشخصيات مع المراجع الأصلية، وافحص الترخيص والخصوصية والحدود قبل قرار التكامل.
- كل claim/chapter/scene/question له source reference وحالة مراجعة وcontent version.
- الخلاف والتواريخ التقريبية معلنة؛ لا تحويل رواية مختلف فيها إلى حقيقة قطعية.
- لا تجسيد بصري للنبي ﷺ أو الصحابة؛ استخدم خرائط ومناظر وزخارف ورسومًا مجردة.
- لا تنسخ كتبًا أو نصوصًا حديثة أو ترجمة محمية دون ترخيص.
- تقدم السيرة مستقل عن حفظ القرآن وقراءته، ومحتوى الكتاب لا يوضع في Firestore لكل مستخدم.

## 4. قواعد منع التعارض

- `main` هو المصدر المرجعي؛ افحص SHA والـ PRs وexact-head checks قبل كل دفعة.
- فرع واحد لكل مسار؛ لا تعدّل نفس الملف من فرعين بالتزامن.
- لا تكرر عملًا مدمجًا؛ قارن diff قبل إعادة التنفيذ.
- عند فشل CI، سجّل SHA وrun ID وjob والسبب؛ واصل المهام المستقلة ثم ارجع للعطل.
- لا تخلط بين MERGED وCI PASS وVercel status وProduction READY وlive smoke وAI Studio sync.
- بعد كل دفعة، حدّث هذا الملف والخطة وسجل العمل والوثيقة التخصصية.
- أي عمل يتطلب المالك أو Production أو جهازًا حقيقيًا يذهب إلى `OWNER_ACTIONS.md` ولا يوقف الأعمال المستقلة.

## 5. ثوابت المنتج والسلامة

- وِرد تطبيق قرآن وعبادة يومية وليس بوابة إسلامية عامة.
- النص القرآني من corpus محلي موثوق؛ لا AI ولا API يكتب أو يصحح الآيات.
- التفسير والحديث والرقية والسيرة من مصادر موثوقة وإحالات قابلة للتتبع.
- Local-first؛ القراءة والحفظ الأساسيان يعملان دون اتصال.
- لا API مدفوعة كشرط أساسي؛ راجع الترخيص والخصوصية والتكلفة.
- EveryAyah stream-only حتى إثبات حقوق التخزين. لا أسرار أو بيانات مستخدمين في المستودع.
- لا تغيير Production أو Firebase Rules/data أو secrets أو sync flags أو نشر يدوي دون موافقة صريحة.

## 6. بدء الجلسة التالية

اقرأ `AGENTS.md` ثم هذا الملف ثم `DEVELOPMENT_ROADMAP.md` و`DOCUMENTATION_CATALOG.md`. أعد جلب حالة GitHub الحية، ثم ابدأ بأول خطوة غير مكتملة. للسيرة اقرأ `SEERAH_LEARNING_PLAN_AR.md` و`UX_PRODUCT_ROADMAP_AR.md` قبل أي تنفيذ.


## 2026-11-11 17:52 +02:00 — متابعة CI وبحث API

- PR #363 current reviewed head before this documentation update: `fc20a4f485f47f5ae7b94567bf521885a67ed284`; OPEN / DRAFT / mergeable. Re-fetch after this update.
- Exact-head Quality Gate run `43051925917` failed. Job `130631077198` ("Tests, TypeScript, and production build") completed failure but returned `steps: []`; log download returned `BlobNotFound`. Retried only the failed job; retry job `130632989788` failed the same way with no steps and no downloadable logs. This is unresolved job/runner evidence, not a diagnosed test failure. Do not merge or weaken checks.
- Vercel combined status remains failure due to free deployment rate limit. The PR timeline separately shows a READY Preview deployment `DaCNAppQni39XbMag8PkLxGbNQ9k`; preview readiness does not prove Production or live smoke.
- Seerah research now includes the actual Islamic Network People and Events OpenAPI schemas. People has multilingual biographies, year fields, event/quote/story links, and relationships; Arabic may be absent per record. Events uses Hijri month/day anniversaries separately from historical year, so it is not a complete chronological Seerah syllabus. Both are Early Access.
- SeerahBook docs confirm read-only entity graph, per-IP limits, and provenance; About page distinguishes approximate/disputed/weak reports and possible dramatized reconstructions. Never turn reconstructed wording into a direct quote.
- Dorar terms and API docs were re-opened: manual approval, bearer token, server-side calls, visible attribution/source URL, no bulk download/republication, cache max 24–48 hours, 60 req/min, preview review. Not suitable as offline corpus.
- Updated `SEERAH_LEARNING_PLAN_AR.md` and `DEVELOPMENT_ROADMAP.md` with these schema-level decisions. No API calls were made to production endpoints; no content ingested, no runtime code changed.
- Next: exact-head gate on the new documentation head; if the workflow again fails before steps/logs, retain BLOCKED status and proceed only with independent documentation QA. Then do a tiny schema/provenance POC (10–15 records max) only if it can be fetched safely without bulk scraping; no production integration or stored content until reuse rights are clarified.


## 2026-11-11 17:55 +02:00 — أحدث فحص لرأس PR #363

- PR #363 head بعد آخر تحديث توثيقي: `835881de9d6f9719e2afe3acd4bd737bd73d2cf1`; OPEN / DRAFT / mergeable.
- Quality Gate run `43052636315` على هذا الرأس انتهى failure. Job `130633602897` لا يحتوي steps مسجلة، وتنزيل السجلات غير متاح من المحاولة السابقة؛ لا يوجد دليل على تنفيذ TypeScript أو الاختبارات أو build أصلًا. الحالة BLOCKED/UNRESOLVED وليست test failure معروفة.
- Combined status: Vercel failure بسبب حد النشر المجاني. Preview READY الذي ظهر في timeline سابق يخص مراجعة سابقة ولا يثبت أن آخر SHA منشور أو جاهز على Production.
- لا تكرر rerun بلا تغير في ظروف runner؛ محاولة rerun على run السابق أعادت نفس الفشل قبل steps. لا دمج حتى يوجد Quality Gate قابل للفحص وناجح على exact head.


## متابعة بعد توثيق بوابة CI — 2026-11-11

- بعد تحديث سجل العمل ونقطة التحقق أصبح رأس PR #363 هو `701ce918a16e6f831897788395f6f93b078799bb`. لم يُرجع GitHub أي PR-triggered workflow run لهذا الرأس حتى آخر استعلام.
- Vercel combined status ما زال `failure` بسبب `build-rate-limit`; لا تستخدمه كدليل على فشل اختبارات التطبيق.
- الحالة: PR مفتوح وDraft، لا دمج. لا تغييرات تطبيقية أو نشر أو مزامنة Google AI Studio مثبتة.
- عند الاستكمال: أعد جلب head وworkflow runs/status. إذا لم يظهر Quality Gate قابل للفحص، لا تكرر rerun؛ استمر فقط في تدقيق الوثائق والمهام المستقلة. اترك الدمج متوقفًا حتى نجاح gate واضح على exact SHA.


## استكمال بحث السيرة — بوابة provenance

- راجعت مخططات OpenAPI للحقول نفسها: Islamic Network People لا يضع مصدرًا claim-level لفقرة biography أو تواريخ الميلاد/الوفاة أو العلاقات؛ وEvents يعرض source نصيًا عامًا فقط. لذلك People/Events فهارس استكشاف وليست مصادر نشر كافية بمفردها.
- SeerahBook يعلن provenance لكل claim، لكن يلزم فتح المصدر الأصلي ومراجعته، ولا يجوز تقديم صياغة درامية/معاد بناؤها كاقتباس حرفي.
- أصبح الشرط الأساسي: كل معلومة في corpus وِرد لها مرجع مستقل قابل للتدقيق على مستوى المعلومة، مع الطبعة/الجزء/الصفحة أو رابط المصدر وتاريخ المراجعة وحالة الرواية.
- تم تحديث `SEERAH_LEARNING_PLAN_AR.md` القسم 15 و`DEVELOPMENT_ROADMAP.md` وسجل العمل.
- بعد هذه التحديثات الوثائقية، أعد جلب PR #363 head والـ exact-head checks؛ لا تعتمد أي SHA سابق لأن هذه الإضافات أنشأت commits جديدة.


## 2026-11-11 — توجيه منتج جديد: السيرة كحكاية متكاملة
- طلب المالك أن تكون السيرة حكاية متكاملة جذابة ذات تفاصيل وأجزاء وفصول، لا دروسًا منفصلة.
- أضيف قرار منتج في خطة السيرة §16: كتاب تفاعلي متسلسل، سرد عربي جذاب منضبط بالمصادر، قارئ متصل، تفاعلات سياقية اختيارية، تقدم القراءة، واختبارات في نهاية الفصل/الجزء دون قطع الحكاية.
- فهرس تأسيسي من العالم قبل البعثة إلى عصر الخلفاء الراشدين، قابل للمراجعة العلمية وليس جدولًا زمنيًا قطعيًا.
- ضوابط ثابتة: لا حوار مختلق أو مشاعر/نوايا غير مثبتة أو اقتباس غير محقق؛ لا خلط روايات؛ لا اعتماد API وحده؛ توثيق كل claim؛ لا AI ينشئ محتوى تاريخيًا منشورًا.
- معيار القبول: نموذج جزء افتتاحي وفصل متعدد المشاهد وقارئ متصل مع حفظ الموضع ومصادر داخل السياق؛ قائمة دروس واختبارات وحدها لا تحقق الطلب.
- لم يحدث تعديل runtime أو API ingestion أو Firebase أو production.

## 2026-11-11 — تحديث بعد توجيه «حكاية السيرة» وفحص CI
- تم تحديث خطة السيرة §16، مراحل S1/S2، خارطة التطوير، handoff، وسجل العمل لتكون التجربة كتابًا تفاعليًا متصلًا لا دروسًا منفصلة.
- آخر commit موثق على فرع الوثائق بعد هذه الدفعة: 7a5e6a9bb17b47404e9e0d4153b7a594d8bfce95. استعلام workflow runs لهذا الـSHA لم يُرجع أي PR-triggered run حتى وقت الفحص.
- آخر run مرئي سابقًا على SHA أقدم `b7ca97f6fa93c715d408adc88ba9b180c7800017`: run 43052961502 انتهى failure؛ job 130634757053 انتهى failure مع steps=null ولا logs متاحة. هذا لا يثبت فشل اختبارات أو build؛ يظل runner/job failure غير مشخص. لا دمج دون Quality Gate قابل للفحص وناجح على exact head.
- لا runtime changes أو API ingestion أو Firebase/Production settings أو نشر. Vercel rate-limit منفصل عن CI ولا يعد دليل فشل اختبارات.

## 2026-11-11 — توسيع مواصفات إنتاج السيرة
- أضيفت خطة إنتاج الفصل ومخطط البيانات ودورة الاعتماد وهيكل فصل تجريبي غير منشور إلى `SEERAH_LEARNING_PLAN_AR.md` §17.
- تم تثبيت أن كل body block في الفصل يربط claims ومراجعها، وأن مراجعة الاستمرارية السردية شرط مستقل عن مراجعة صحة الادعاءات.
- آخر فحص Quality Gate مرئي: run 43055256668 على commit 12bf1a8c9ff3c4421459dd05e950d9b3e7cedd40 انتهى failure. job 130642874675 فشل مع steps=null وlogs_url=null؛ لا يمكن تشخيصه كفشل tests/build ولا إثبات نجاح الاختبارات.
- لم يرد PR-triggered workflow run للـcommit الأحدث 12bf1a8... وقت المراجعة؛ أعد جلب الحالة بعد التحديث. لا دمج دون exact-head gate ناجح وقابل للفحص.
- لا تغييرات runtime أو API ingestion أو Firebase/Production أو secrets أو sync flags أو deployment.

## 2026-11-11 — قارئ «حكاية السيرة»
- أزيل التعارض القديم الذي كان يصف السيرة كدروس قصيرة من `docs/UX_PRODUCT_ROADMAP_AR.md`؛ المرجع الآن كتاب متصل بأجزاء وفصول ومشاهد، والقراءة المتصلة هي الوضع الافتراضي.
- مواصفات القارئ وتجربة التنقل والسياق وحفظ الموضع ومعايير MVP في `docs/UX_PRODUCT_ROADMAP_AR.md` §§6–7. خطة المحتوى والتحرير والمصادر في `docs/SEERAH_LEARNING_PLAN_AR.md` §§16–17.
- الخطوة التالية: فحص الكود الحالي لتحديد نقاط إعادة الاستخدام قبل إنشاء مكونات جديدة؛ ابدأ بنموذج UI ببيانات placeholder معلّمة، ولا تدخل أي محتوى تاريخي أو API قبل الاعتماد العلمي والحقوقي.
- لا runtime implementation أو production changes حتى الآن. PR #363 يحتاج إعادة فحص exact-head CI بعد آخر commits؛ لا merge قبل بوابة قابلة للتحقق.


## 2026-11-12 — تنفيذ قارئ السيرة وعقد المحتوى
- PR #365: https://github.com/xm8eslam-stack/WIRD-APP/pull/365 — OPEN / DRAFT / HOLD. الفرع `feat/seerah-continuous-reader-shell-20261112` بدأ من main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- التنفيذ الأولي في `src/components/seerah/SeerahReaderView.tsx`، `src/services/seerahReadingProgress.ts`، و`src/services/seerahContentContract.ts` مع اختبارات خدمة واختبار route. كل محتوى العرض placeholder موسوم؛ لا روايات تاريخية أو مصادر مزيفة.
- آخر SHA تم فحصه: `5f0f5cb3fb7342dee9dcd5935849cb329bece986`. Vercel Preview `dpl_ArPB9Pj4QGeCmUAzdYh1EKypAmus` READY وبناء Vite ناجح. لم يجرِ browser/device smoke.
- GitHub run `43184272681` / job `131067466738` فشل بلا steps أو logs (`BlobNotFound`). لا يمكن إثبات فشل tests أو typecheck، ولا يوجد CI pass. لا merge قبل exact-head Quality Gate ناجحة وقابلة للفحص.
- التالي: إصلاح/استيضاح runner/CI عبر دليل جديد، ثم استكمال قارئ بمحتوى معتمد فقط: anchors حقيقية، علامات مرجعية دائمة، progress model على contentVersion، ولوحة مصادر/مراجعات؛ لا API ingestion أو مزامنة سحابية قبل مراجعة الحقوق والخصوصية.
- لا runtime deployment إلى production أو Firebase/Firestore أو secrets أو sync flags أو بيانات مستخدمين تغيرت.


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


## 2026-11-12 — final refresh before handoff
- #368 exact head `08851241bff289e04b13568188e0b2103a1d02e3`: latest Quality Gate run `43215055425` / job `131172059517` انتهى failure بعد نحو 4 ثوانٍ، مع `steps=[]` و`logs_url=null`، وسحب logs أعاد `BlobNotFound`. لم يبدأ أي step مسجل؛ لا test/build diagnosis ولا pass.
- #363 docs latest head قبل هذا التحديث كان `754b291c7b77c7521cc6676c5dcb2c9ab01c7fc8`; لا workflow run ظهر لهذا الرأس. هذا التحديث سيولد رأسًا جديدًا، ويجب إعادة جلبه قبل أي قرار.
- تمت مراجعة `.github/workflows/ci.yml`: Quality Gate مصمم لتشغيل npm tests، npm audit، Rules Emulator، lint، build، server smoke وPlaywright؛ لكن لا توجد أي steps مسجلة في الوظائف الفاشلة، لذلك لا نعرف أي مرحلة وصلت إليها. لا تغيّر workflow أو تضعف gate دون تشخيص من سجل قابل للقراءة.
- لم يحدث merge/deploy أو تعديل main أو Production أو Rules أو secrets أو flags.


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


## 2026-11-12 — PR #367 remote payload patch review
- Reviewed the actual #367 patch (not just its title): it introduces `syncPayloadLimits.ts` and routes IndexedDB journal validation, local outbox validation, and `writeRevisionedRemoteMutation` through the same `getSyncMutationPayloadLimit` helper. Engine Plans and grouped transactions containing Engine Plans receive an 800,000-byte payload ceiling; ordinary collections retain 128,000 bytes.
- The same patch updates conflict resolution payload checks and conflict snapshot retention sizing (`MAX_CONFLICT_SNAPSHOT_BYTES=1,700,000`, conflict count 29) to keep the aggregate conflict archive near the previous ceiling. It adds tests that exercise 700 KB local journal/outbox/conflict paths and pre-network Firestore writer rejection above the shared cap.
- This is a fixed interim per-mutation cap, not adaptive storage entitlement, not archive chunking, and not a solution for the 100-plan guard or localStorage archive. Current main still has its older 128,000-byte remote writer validation; only the unmerged #367 branch contains the shared 800 KB implementation.
- Do not raise the 800 KB value further. The long-term path remains local IndexedDB archive + verified manifest/chunks + receiver materialization/capability negotiation. Per-document envelope headroom and Firestore limits must be tested with actual serialized records, not only synthetic filler.
- CI for #367's exact head remains unverified/failing without inspectable job steps from the prior audit; do not merge based on source review alone.


# User requirements added — 2026-11-12

Authoritative detailed requirements: [USER_REQUIREMENTS_2026-11-12.md](./product/USER_REQUIREMENTS_2026-11-12.md).

New owner requirements accepted into the queue:
- Engine Plans capacity must adapt to the user's actual server-verified account entitlement; local browser quota remains a separate constraint. Cloud sync must use immutable verified chunks/manifests and preserve all records across interruption, upgrade/downgrade and mixed client versions. Do not invent tiers/quotas or treat PR #367's 800 KB interim payload cap as capacity.
- Previously memorized selection must support multi-Surah selection, complete Juz selection, and custom ayah ranges within a Surah, with canonical coordinate validation and confirmation before progress mutation.
- Memorization session page settings must become a collapsible disclosure panel (tap to open/close), initially compact, with expanded detailed width/scale/font/typography/density/view/margin controls and reset-to-defaults; preserve reading position and local preference isolation.
- Seerah is explicitly elevated to a high-priority parallel workstream. Continue the continuous book reader, anchors/bookmarks/source context and versioned editorial corpus. No unverified or invented historical content may be published.

Parallel tracks: (A) Engine Plans IndexedDB archive + entitlement/chunk protocol; (B) memorized ranges UI; (C) collapsible session display settings; (D) Seerah reader/content research; (E) offline audio; (F) PWA. Keep shared docs changes in this PR only; code tracks use separate branches. No merge/deploy/Production settings/Rules/secrets/sync flags without explicit approval.


## Latest code-track checkpoint — 2026-11-12
- #365 Seerah branch head: 113f12c43b9b075541b7d28f58fa89cd71ef73d4. Fixed bookmark deletion to use active guest/UID-scoped key; regression test added. Reader remains a prototype shell; no verified history is published.
- #369 memorized-range branch head: 7ac00ef32f3b3c2b1158f165ed141e6f332ab88e. Touch-friendly searchable multi-Surah checkboxes, full Juz expansion from generated canonical Quran Juz boundaries, custom ayah ranges, normalization and tests added.
- #370 display-settings branch head: 2bbb54da778ab3eb2ac863e2b12c4e31fbe39dfb. Collapsed-by-default accessible settings panel, line spacing and page padding options, device-local compatibility tests added.
- #369/#370 remain OPEN/DRAFT and are not merged. Quality Gate runs 43274079781 and 43274209101 failed before recording steps/logs; no source-level failure or pass can be inferred. #365 run 43273958209 has the same telemetry gap.
- Main remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.

## Seerah source research checkpoint
- Dorar Historical Encyclopedia offers a search API, but access is manually reviewed and its published API terms require attribution and visible source links, prohibit bulk scraping/republication, limit cache to 24–48 hours, keep tokens server-side, and require a review environment before publication. No application/access request was sent.
- Sunnah.com API covers only part of hadith data and requires an API key request; it is not a full Seerah corpus.
- Arabic Collections Online includes public-domain Arabic book holdings and a record for Tahdhib Sirat Ibn Hisham; verify rights at the individual edition/file level before ingestion.
- OpenITI release text is under CC BY-NC-SA 4.0 per its documentation; do not embed it in a potentially commercial product without license review.
- Research references and source-specific decisions are in docs/SEERAH_LEARNING_PLAN_AR.md. No historical content was ingested or approved.

## Adaptive entitlement checkpoint
- No subscription/billing/entitlement service or account plan tier was found in the inspected main code. Do not invent tiers or limits. Local browser/IndexedDB capacity and server-verified account entitlement are separate. Keep implementing archive/chunk transport independently while owner-defined plan entitlements are pending.

## Latest 2026-11-12 implementation delta
- #365 head 0856e6a1e215a74324358173bee9a55924e6a5ad: scoped bookmark deletion regression fixed; source citation panel added; Seerah source rights are now mandatory in the publication contract. No historical text/content was ingested or approved.
- #368 head ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710: Cache Storage adapter and bounded downloader added; retryable item failure, pause/cancel/resume and cache-eviction recovery added. Still no Service Worker protocol, download UI, playback integration or device verification.
- #369 head 7ac00ef32f3b3c2b1158f165ed141e6f332ab88e: multi-Surah/Juz/custom ayah selector and tests.
- #370 head 2bbb54da778ab3eb2ac863e2b12c4e31fbe39dfb: collapsed page settings with line-spacing and page-padding controls.
- Latest #365 and #368 Quality Gate runs failed without steps/logs (43275942614 and 43275594933); no code-level failure or pass can be inferred.
- Main remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b. No merge/deploy/Production setting/Rules/secrets/sync flag changes.
- Engine Plans inventory reconfirmed the 100-plan cap, synchronous localStorage export, legacy direct import/reset, synchronous scope copy/verify/delete, journal-first import/reset, session snapshot cap, Dashboard direct read and sync projection consumers. Remaining indirect caller/fixture/E2E audit is open; do not begin migration.
- Adaptive entitlement/chunk contract and Seerah rights research are documented in the RFC and Seerah plan.

## Final rerun audit — 2026-11-12
- Re-ran the latest failed Quality Gate jobs for #365, #368, #369 and #370.
- #365 run 43275942614 / job 131384235586: still failed with steps=null and logs_url=null.
- #368 run 43275594933 / job 131383003139: still failed with steps=null and logs_url=null.
- #369 run 43274079781 / job 131377722661: still failed with steps=null and logs_url=null.
- #370 run 43274209101 / job 131378172561: completed failure with steps=null and logs_url=null.
- Re-run attempts did not expose any test/build stage or source-level failure. Do not call these passes or code failures.
- All PRs #363/#365/#366/#367/#368/#369/#370 remain OPEN/DRAFT. Main base SHA remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.

## Latest code and CI checkpoint — 2026-11-12
- #371 branch feat/engine-plan-archive-chunk-codec-20261112 head 597344a5f95a261df5301da4de992850d4a3f5b5 adds a pure lossless chunk codec with stable canonical records and SHA-256 verification. It is not connected to archive migration or Firestore.
- #365 head 15963abc5dc45268a1129e872d10e41fd7779d05 includes Seerah source-rights publication gate, citation panel, bookmark UID-scope fix and E2E empty-source state.
- #368 head ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710 includes Cache Storage adapter, bounded downloader, pause/cancel/resume and cache-eviction recovery; UI/SW/playback/device tests remain.
- #369 head 814bb8788449ebe3d07d46f00a596a1a7b398a5a includes multi-Surah/Juz/custom ayah selection and browser E2E.
- #370 head 32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c includes collapsible display settings, line spacing/page padding and browser E2E.
- Main tree inventory: 159 src TS/TSX files, 78 test/spec files (59 src, 18 e2e, 1 script). Relevant storage tests reviewed, but all 159 source files and every indirect fixture have not yet been semantically audited. Do not begin Engine Plans migration.
- Quality Gate exact-head runs #365 43277331896, #368 43275594933, #369 43277201392, #370 43277107786, #371 43278092246 all failed with steps/logs null. No test/build pass or source failure can be inferred.
- Main remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b. No PR merged/deployed, no Production/Firebase Rules/Secrets/Sync flag changes.

## PR #371 latest
- Exact head 260df95c620cd534337e39d6707b044eb404139a. Pure chunk codec now rejects sparse ordered IDs, hidden array properties and tampered total bytes, and binds the manifest fingerprint to entitlement revision.
- Quality Gate run 43278752980 / job 131394096177 failed with no steps/logs; no test/build pass or code-level failure diagnosis.
- No migration or Firestore integration.

## Seerah latest continuation — 2026-11-12

- PR #365 branch `feat/seerah-continuous-reader-shell-20261112`, exact head `6e174575226cae0a25e82742e8bf6d7fb631de21`.
- Fixed saved reading-position hydration race with a barrier and added reload E2E for restoring the second scene.
- Hardened publication validation against malformed imported chapter/source/claim/scene/body-block structures, unknown block types, invalid claim confidence/review status and invalid rights status.
- Added malformed-content tests; not run locally.
- No Actions run yet for this exact head; combined status shows only Vercel build-rate-limit failure. Do not claim code failure or CI pass.
- Reader is still a shell with placeholder scenes. No historical material is published. S0 source rights research remains incomplete; Dorar API access requires manual approval, ACO item rights require checking, OpenITI NC restrictions prohibit assuming reuse.
- Next: persistent reading preferences and stable anchors across content versions; add a versioned book/part/chapter manifest + measurable coverage matrix; then a human-review workflow for source capture and atomic claims. Keep real narrative ingestion blocked until source/rights and specialist review gates pass.


## Seerah manifest and reader hardening — 2026-11-12 21:xx +02:00

- PR #365 latest code head: `adc1ef01b7a0c5eb7e280395520108c94788af5d`.
- Added a versioned `SeerahBookManifest` index for book → parts → chapters → scenes. Explicit order values control reading order; stable scene anchors derive from immutable internal IDs rather than titles or array positions.
- The prototype reader now derives its navigation scene list from a draft manifest fixture. It remains explicitly non-publishable and contains no historical narrative.
- Manifest validation rejects unsupported schema, unsafe/duplicate IDs, duplicate order values, unstable/duplicate anchors, malformed nested arrays, and empty published parts/chapters. Tests cover stable anchors across title/version edits and invalid manifests.
- Fixed saved reading-position hydration race and added reload E2E. Publication contract now fails closed for malformed imported records; malformed-content tests registered.
- Quality Gate run 43289471345 on exact head initially failed with job 131431547175 but no steps/logs (BlobNotFound). A rerun was requested; latest attempt job 131431824753 is queued at checkpoint time. Vercel reports build-rate-limit only. No local tests/typecheck/build run and no pass claimed.
- No real historical corpus or content ingested/published. Source S0 rights review remains a hard gate.


## 2026-11-13 — Engine Plans second-pass source audit

- Refreshed main: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` (unchanged). PR #363–#372 remain OPEN/DRAFT at the latest observed heads: #363 documentation branch head: fetch live from PR metadata (do not pin its self-referential SHA here); #364 `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`; #365 `adc1ef01b7a0c5eb7e280395520108c94788af5d`; #366 `cade1b630bb429d6a4106de5bf12713df18f3491`; #367 `fd417faaa96a11920ef3a8e4f1038f567c36a731`; #368 `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710`; #369 `814bb8788449ebe3d07d46f00a596a1a7b398a5a`; #370 `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c`; #371 `260df95c620cd534337e39d6707b044eb404139a`; #372 `950640ea78d29e87d426a89d8887c15e4de2abac`.
- Completed lexical scan of 183 TS/TSX/JS files (159 src, 18 e2e, 1 script, 5 api). Literal key `wird_engine_plans` appears at `src/services/storageService.ts:36`; the complete call-site/test matrix and exact line references are in RFC section 17.
- Newly mapped indirect consumers: `dailySessionSelection.ts:83-87`, `cloudSyncCoordinator.ts:22`, `demoDataPersistence.ts:34`, `revisionedRemoteMutation.ts:66`, `PlanningEngineWizard.tsx:194-243`, and Firestore Rules test `scripts/firestoreRules.test.ts:1317`.
- Critical future-cutover requirements: AuthGate has no archive hydration barrier; Dashboard reads the store independently; setStorageScope removes legacy source after scoped copy/verify; Settings and Progress Analytics export synchronously; session persistence and backup validation retain the 100-plan cap.
- Additional payload risk: normal journal Engine Plans mutations allow 450,000 bytes, while generic conflict intent/use-remote/keep-local checks remain 128,000 bytes (`indexedDbSyncJournal.ts:2449,2687`). Legacy localStorage Outbox validation is also 128,000 bytes per mutation. Keep chunk references small and test conflict behavior before supporting large plan revisions.
- Missing tests identified: AuthGate archive hydration, archive migration/rollback/quota, Engine Plans scope switch, demo transaction, session Engine Plans snapshot, remote Inbox archive materialization/cursor, and Engine Plans conflict resolution. Existing coverage and exact paths are recorded in RFC section 17.
- CI #372: run `43391729769`, job `131773203535`, completed failure with `steps=null`, `logs_url=null`; a fresh log fetch returned BlobNotFound at 2026-11-13T09:03:58Z. Classify BLOCKED observability, not source FAIL/PASS. Vercel combined status for #372 head is failure at the Free-plan `build-rate-limit` URL. Full-source tests/typecheck/build/emulator/Playwright remain NOT TESTED.
- No code changes, tests, merges, deployments, Production/Firebase/Secrets/Sync flag changes, or schema changes in this audit. Keep #372 Draft and Engine Plans migration HOLD.

### Next action
Review the complete archive transaction/cursor/conflict protocol against RFC section 17, then prepare only the missing focused test plan and a separate migration-stage branch after path ownership is rechecked. Do not implement the IndexedDB migration until that review and test matrix are accepted.


## Additional corruption-safety finding — 2026-11-13

`StorageService.getEnginePlans()` delegates to `readJsonArrayArchive` (`src/services/storageService.ts:378-395`), which filters malformed records or returns `[]` on corrupt/non-array input while preserving the original bytes. This is non-destructive but can expose a partial/empty UI view. IndexedDB migration must strictly read and validate the exact scoped raw bytes, distinguish inaccessible storage from absent data, and fail closed; never migrate from the filtered/empty getter result.



## Next checkpoint — remote transaction review complete (2026-11-13)

Read RFC section 18 before archive implementation. Key decisions:
- Keep `remoteCursor` (durable Inbox ingestion) separate from `remoteProjectionCursor` (verified local materialization/reconciliation). Import commits page rows + received cursor atomically; projection commits archive head/revision + projection cursor + Inbox deletion + conflict closure atomically.
- Existing callbacks update localStorage inside IndexedDB transactions; that is not cross-store atomicity. IndexedDB archive becomes canonical, localStorage rebuildable only.
- 450 KB Engine Plans events can enter Inbox but 128 KB conflict-intent/use-remote/keep-local caps prevent resolving large conflicts. Use immutable archive revision references and hashes in conflict records, not inline arrays or global cap increases.
- Stage B remains HOLD. Next: design the archive-reference data model and API contract, then author isolated focused tests before schema migration. Recheck PR path ownership first; do not touch shared journal/StorageService files while #367/#371 remain active unless a separate branch is explicitly coordinated.
- No code changes or tests in this review.



## PR #371 codec review — 2026-11-13

Reviewed exact PR #371 HEAD 260df95c620cd534337e39d6707b044eb404139a. The pure codec provides canonical records, 192 KB fragments, SHA-256 fragment/record/archive fingerprints and malformed/missing/corrupt chunk rejection. It does not provide paged manifests, streaming, IndexedDB repository, Firestore transport, journal/outbox/inbox references, domain plan validation, conflict integration or crash/quota recovery. A large descriptor manifest can exceed Firestore's 1 MiB document limit; add bounded manifest pages plus a small root digest before remote integration. Details are in RFC section 19.

PR #371 Quality Gate run 43278752980 / job 131394096177 and PR #372 run 43391729769 / job 131773203535 both report failure with steps=null and logs_url=null. Classify BLOCKED observability; no code-level diagnosis and no Quality Gate PASS. Keep both Draft. Main remains unchanged; no tests or runtime code changed in this review.


## Latest docs-head CI refresh — 2026-11-13 09:21 UTC

PR #363 exact head c08186440e28ec53a6e7434c5212c7bed61b81e2 produced Quality Gate run 43400615632 / job 131802241149. Job completed failure with steps=null and logs_url=null; log retrieval returned BlobNotFound. Classify BLOCKED observability; no code-level failure or pass is diagnosed. Keep PR #363 Draft. Main remains 8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b.


## Continuation checkpoint — 2026-11-13 (archive repository design + CI observability)

Current verified baseline remains main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY and points to that same main SHA with alias `wird-app.vercel.app`.

PR refresh:
- #363 docs branch latest head before this checkpoint was `b4ab45c2f1e55b8b7b8fd1948e20855b11057b3a`; this continuation update adds archive repository contracts to its branch.
- #367 latest head `fd417faaa96a11920ef3a8e4f1038f567c36a731`; 9 changed files, including shared 800,000-byte enginePlans/syncMeta budget and 1.7 MB conflict evidence ceiling.
- #371 latest head `260df95c620cd534337e39d6707b044eb404139a`; pure codec only, no IndexedDB repository or transport.
- #372 latest head `950640ea78d29e87d426a89d8887c15e4de2abac`; changes CI to a single Bun 1.4.4 locked dependency graph and uses Bun for test/audit/build/Playwright commands.
- Other active Draft PRs remain #364–#370. #358/#359 remain superseded by #368; do not merge them independently.

Exact-head CI observability refresh:
- #363 run `43400687488`, job `131802482654`: completed failure, steps=null, logs_url=null; log download returns BlobNotFound.
- #372 run `43391729769`, job `131773203535`: same missing steps/logs and BlobNotFound.
- #371 run `43278752980`, job `131394096177`: same missing steps/logs and BlobNotFound.
- Classify these as BLOCKED — CI observability. They are not source-level failures and not passes. Do not merge any affected PR.

PR #367 / #371 coordination:
- #367 aligns all current inline Engine Plans mutation paths to 800 KB, keeps ordinary payloads 128 KB, and allows conflict evidence up to 1.7 MB. This is an interim single-document ceiling only; it does not implement archive chunks or entitlement-based capacity.
- #371's 192 KB fragment codec remains a pure builder/materializer. Its all-descriptors single manifest, in-memory materialization, missing repository/transport, and absent Journal/Outbox/Inbox/conflict integration remain blockers.
- Do not combine or merge these PRs as a substitute for archive protocol. The future event should carry a bounded immutable archive reference, not an inline Engine Plans array.

Documentation update:
- Added RFC section 20: executable repository contract, proposed extension of existing IndexedDB v9 to v10, scope/revision keys, bounded hierarchical manifest pages, repository API, atomic local/remote publish, migration state machine, fencing, GC reachability and Stage B test families.
- Section 20 is design only. No runtime code, IndexedDB schema, Firestore, Rules, production settings, secrets, sync flags, merge or deployment changed.

Next required work:
1. Complete the full Engine Plans call-site inventory across every source file, fixtures, test helpers, E2E, migration scripts and any raw localStorage/backup APIs; create an exact call-site → required test matrix.
2. Inspect #367 and #371 at exact heads for semantic overlap and ensure #367's 800 KB cap is not mistaken for adaptive storage or chunk transport.
3. Review #372's full CI patch and obtain inspectable exact-head CI. If job logs remain unavailable, preserve Draft/HOLD and diagnose runner/log artifact retention separately; do not rerun workflows without approval.
4. Only after the complete inventory and design tests are specified should an isolated archive-repository implementation branch be opened. Do not start migration or bump IndexedDB schema before that gate.
5. Continue to preserve main/Production and all user data. No PR merge, deploy, environment, Rules, secrets, or sync-flag change without explicit owner approval.
