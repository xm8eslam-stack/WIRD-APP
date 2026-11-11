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
| #363 | OPEN / DRAFT | مركز الوثائق وخطة التطوير؛ آخر SHA `204c6738f5fb14845efbcf580d051e97405e3257`؛ أول run `43039009676` وrerun attempt 2 فشلا قبل تسجيل أي job steps؛ لا تدمج قبل exact-head Quality Gate ناجح |
| #356 | CLOSED / SUPERSEDED | planner موجود في main من #355؛ أُخذت منه ملاحظة cutover الفريدة إلى `sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md` |
| #358 | OPEN / DRAFT | store للمهام والعناصر؛ تداخل manifest مع #359؛ Quality Gate على الرأس المرصود فشل في Playwright |
| #359 | OPEN / DRAFT | manifest metadata فقط؛ لا job lifecycle؛ Quality Gate على الرأس المرصود فشل في Playwright |
| #299/#273/#272/#2 | STALE | لا دمج مباشر؛ افحص التغييرات الفريدة فقط |

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