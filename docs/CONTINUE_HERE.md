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
# WIRD — نقطة الاستكمال الحالية (مصدر الحقيقة)

آخر تحقق من GitHub: 2026-11-11 16:30 +02:00
المستودع: `xm8eslam-stack/WIRD-APP` — الفرع المرجعي `main`.
آخر main: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.

## الحالة الحية

| PR / المسار | الحالة | الإجراء التالي |
|---|---|---|
| #362 | MERGED | إصلاح guest-entry hydration؛ merge SHA `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd`؛ Quality Gate PASS |
| #361 | MERGED | EveryAyah stream-only وتنظيف cache قديم؛ merge SHA `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`؛ Quality Gate PASS |
| #360 | CLOSED / SUPERSEDED | استبدل بـ #363 بعد فشل CI غير المشخّص |
| #363 | OPEN / DRAFT | مركز الوثائق وخطة التطوير؛ آخر SHA وقت المراجعة `5f613c3754b4d0aabc6aa09741a6d9914a0720ca`؛ بعد أي تحديث جديد أعد جلب head من PR #363.؛ runs `43039009676` و`43039794349` و`43039853668` انتهت كلها بفشل job واحد دون تسجيل أي job steps أو logs؛ CI غير محسوم ولا تدمج قبل exact-head Quality Gate ناجح |
| #356 | CLOSED / SUPERSEDED | planner موجود في main من #355؛ أُخذت منه ملاحظة cutover الفريدة إلى `sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md` |
| #2 | OPEN / VERY STALE | فرع Phase 5 قديم، 115 ahead / 467 behind في آخر compare؛ لا دمج مباشر. يحتاج جردًا للميزات الفريدة فقط إذا عادت الأولوية |\n| #358 | OPEN / DRAFT | store للمهام والعناصر؛ تداخل manifest مع #359؛ Quality Gate على الرأس المرصود فشل في Playwright |
| #359 | OPEN / DRAFT | manifest metadata فقط؛ لا job lifecycle؛ Quality Gate على الرأس المرصود فشل في Playwright |
| #299/#273/#272 | CLOSED / SUPERSEDED | لقطات حالة قديمة وخريطة UX مكررة؛ المحتوى الحالي محفوظ في مركز الوثائق والملفات المرجعية |

Production source SHA وlive smoke وGoogle AI Studio sync: **NOT VERIFIED**. نجاح GitHub status أو CI لا يثبت النشر الفعلي.

## ترتيب التنفيذ

1. **PR #363:** افحص آخر head وcheck-runs. لا تدمج إلا بعد ظهور كل خطوات Quality Gate ونجاحها على SHA النهائي. إذا تكرر فشل job بلا خطوات/logs، سجّلها كعائق بنية CI ولا تضعف الاختبارات.
2. **تنزيل صوت القرآن:** اتبع `offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md`. لا تدمج #358 و#359 كما هما؛ نفّذ نموذجًا موحدًا `jobs` + `files` + `jobItems`، مع Cache Storage للبايتات فقط، واختبارات cross-store recovery قبل downloader/UI.
3. **PR #356:** مغلق لأنه قديم؛ لا تعِد فتحه. ملاحظة cutover لكل جهاز تم إنقاذها في ملف تصميم النشاط.
4. **الرقية:** أعد اختبار فهرس الآيات وأخطاء 500/502 وHTML بدل JSON. API الخارجي للإحداثيات فقط؛ نص الآيات من corpus وِرد المحلي. لا تسجيلات غير متحقق من مصدرها وحقوقها.
5. **المصحف والصوت:** تحسين صفحة صفحة؛ تشغيل متصل بلا توقف بين الآيات، سرعة وتكرار وتنقل ومشغل واحد. لا ادعاء بمطابقة الأسطر المطبوعة دون بيانات تخطيط موثقة.
6. **الحفظ والمراجعة والخطط:** افصل تدفقات الحفظ الجديد والمراجعة والتسميع والختمة؛ لا تحتسب الاستماع حفظًا أو قراءة.
7. **المزامنة:** أكمل activity events وtombstones وanti-resurrection وgrouped syncMeta واختبارات offline/cross-tab/account/two-device. عقد cutover في `sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. أبقِ غير المكتمل fail-closed.
8. **UX والأذكار والأدوات:** راجع الصفحات بالتتابع؛ الأذكار والصلاة والقبلة والهجري تبدأ بمراجعة المصادر والتراخيص والتكلفة والخصوصية.

## قواعد منع التعارض

- `main` هو المصدر المرجعي؛ افحص SHA والـ PRs وexact-head checks قبل كل دفعة.
- فرع واحد لكل مسار؛ لا تعدّل نفس الملف من فرعين بالتزامن.
- لا تكرر عملًا مدمجًا؛ قارن diff قبل إعادة التنفيذ.
- عند فشل CI، سجّل SHA وrun ID وjob والسبب؛ واصل المهام المستقلة ثم ارجع للعطل.
- لا تخلط بين MERGED وCI PASS وVercel status وProduction READY وlive smoke وAI Studio sync.
- بعد كل دفعة، حدّث هذا الملف والخطة وسجل العمل والوثيقة التخصصية.

## ثوابت المنتج والسلامة

- وِرد تطبيق قرآن وعبادة يومية وليس بوابة إسلامية عامة.
- النص القرآني من corpus محلي موثوق؛ لا AI ولا API يكتب أو يصحح الآيات.
- التفسير والحديث والرقية من مصادر موثوقة ومرجعية واضحة.
- Local-first؛ القراءة والحفظ الأساسيان يعملان دون اتصال.
- لا API مدفوعة كشرط أساسي؛ راجع الترخيص والخصوصية والتكلفة.
- EveryAyah stream-only حتى إثبات حقوق التخزين. لا أسرار أو بيانات مستخدمين في المستودع.

## تدخلات المالك

راجع `OWNER_ACTIONS.md`. لا توقف الأعمال الآلية بسبب تدخلات المالك. لا تغيّر إعدادات Production أو الأسرار أو sync flags أو قواعد/بيانات Firebase دون موافقة صريحة.

## بدء الجلسة التالية

اقرأ `AGENTS.md` ثم هذا الملف ثم `DEVELOPMENT_ROADMAP.md`. أعد جلب الحالة الحية من GitHub، ثم ابدأ بأول خطوة غير مكتملة.