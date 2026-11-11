# WIRD — نقطة الاستكمال الحالية (مصدر الحقيقة)

**آخر مراجعة توثيقية:** 2026-11-12 00:55 +02:00  
**المستودع:** `xm8eslam-stack/WIRD-APP`  
**الفرع المرجعي للتطبيق:** `main`  
**فرع مركز الوثائق الجاري:** `docs/wird-docs-roadmap-reconciled-20261111`  
**حالة فرع الوثائق:** تمت مصالحة PR #363 مع main في merge commit `bd383b2733af8dd95ce519d8867a256ef1cf8628`؛ أُضيف main كأب ثانٍ وحالة GitHub أصبحت mergeable=true. تعديل إصلاح الروابط سيغيّر head مرة أخرى؛ أعد جلب exact head قبل أي قرار.

> لا تعتمد على أي SHA أو PR أو CI أو Production status في هذه اللقطة قبل إعادة جلبه من GitHub. فرع PR #363 هو مكان تعديلات الوثائق؛ لم يتم الدمج إلى main.

## أحدث حالة حية — 2026-11-12 00:55 +02:00

- **main:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- **Production:** Vercel deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` هو `READY` على SHA نفسه، والـ alias `wird-app.vercel.app`. هذا لا يثبت live smoke أو عمل Firebase/المزامنة.
- **main Quality Gate:** run `43079260528` انتهى بفشل job `130727161970` قبل تسجيل أي steps؛ تنزيل السجل أعاد `BlobNotFound`. لا يوجد دليل على فشل اختبار فعلي ولا على نجاح Quality Gate.
- **PR #363:** OPEN / DRAFT / HOLD. الرأس السابق `7e1f3e4b...` كان مبنيًا على base قديم؛ تمت مصالحة الفرع مع main في merge commit `bd383b2733af8dd95ce519d8867a256ef1cf8628`، وأصبحت حالة PR `mergeable=true` وbase SHA هو main الحالي. على هذا الرأس ظهرت Vercel Preview Comments = success وVercel deployment = pending. ثم بدأ GitHub Quality Gate run `43117295374` على SHA `d79805b44b26f4ea73e77ffac21503255983b9c1` وانتهى بفشل job `130848449010` قبل steps؛ logs أعادت `BlobNotFound`، فلا يوجد تشخيص اختبار. أُصلح الرابطان النسبيان في `CURRENT_STATUS.md` وأكدت إعادة فحص 28 ملفًا عدم وجود روابط نسبية مكسورة. هذا التحديث التوثيقي ينشئ head جديدًا؛ أعد جلبه قبل أي قرار.
- **PR #361/#362:** مدمجان، وmain الحالي descendant من merge commits لكليهما. لا تكرر أعمال EveryAyah stream-only أو إصلاح guest-entry hydration.
- **PR #358/#359:** ما زالا OPEN / DRAFT وغير مدمجين، وقاعدتهما القديمة `4b299042...`. فشل Playwright كان لأن اختبار المراجعة لم يدخل وضع الضيف وبقي ينتظر زر إضافة المقطع؛ بقية الاختبارات/TypeScript/Emulator/build نجحت في الرؤوس المرصودة. إصلاح helper في #362 مدمج؛ أعد بناء تنفيذ موحد على main، ولا تدمج أيًا منهما منفردًا.
- **PR #354:** مدمج وmain يحتويه؛ hardening للـ proxy فقط، ولا يثبت زوال سبب 500 الأصلي.
- **PR #364:** OPEN / DRAFT / HOLD، head `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`، مستخرج محدود من PR #2 لتحسين تحقق history وحدود المدخلات وتعليمات المستشار. Exact-head run `43117641418` / job `130849645262` فشل قبل steps، وlogs أعادت `BlobNotFound`؛ لا يوجد فشل اختبار مثبت. Vercel Preview deployment نجح، لكن هذا ليس Quality Gate. لا دمج قبل فحص exact-head كامل.
- **PR #2:** OPEN / DRAFT، متباعد 115 commit ahead و469 behind؛ لا دمج مباشر. تم تحديد تحسينات فريدة محتملة لمسار Advisor security/chat فقط، بينما التغييرات المرئية الأخرى تحتاج إعادة تصميم على مكونات main الحالية.
- **بوابتا المزامنة في Production:** متغيرا `VITE_WIRD_REVISIONED_SYNC_ENABLED` و`VITE_WIRD_REMOTE_PROJECTION_ENABLED` ظاهران بقيمة `true` في Production عند قراءة أسماء/حالة المتغيرات دون فك أسرار. لم يتم تغييرهما؛ يلزم قرار المالك بشأن تعطيلهما حتى اجتياز بوابات الإطلاق.
- **Google AI Studio / live smoke / اختبار جهازين فعليين:** NOT VERIFIED.

---
## 1. الحالة التشغيلية والبوابات

- **PR #363:** OPEN / DRAFT / HOLD؛ تمت المصالحة مع main وأصبحت mergeable، لكن Quality Gate للرأس النهائي ما زال غير محسوم.
- **PR #361 و#362:** MERGED حسب السجل السابق؛ لا تكرر أعمالهما. تحقق من الحالة الحية قبل أي عمل مرتبط.
- **PR #358 و#359:** مقترحان متداخلان، وفشل Playwright المرصود كان بسبب عدم الوصول لصفحة المراجعة في الاختبار. #362 أصلح helper؛ لا تدمج أيًا منهما كما هو، وابنِ عقد jobs/files/jobItems موحدًا فوق main.
- **PR #2:** فرع Phase 5 قديم جدًا (115 ahead / 469 behind)؛ لا دمج مباشر. استخراج محدود لتحسين Advisor security/chat فقط بعد مراجعة مستقلة.
- **Production:** READY على main SHA الحالي؛ **live smoke وGoogle AI Studio sync:** NOT VERIFIED. PR preview status قد يتأثر بحد النشر اليومي.

## 2. ترتيب التنفيذ العملي

1. **مركز الوثائق #363:** افحص أحدث head وكل check run. أكمل مراجعة الوثائق، ثم لا تدمج حتى ينجح exact-head Quality Gate ويُراجع diff.
2. **Advisor #364:** افحص exact-head checks ثم دمج فقط بعد اجتياز Quality Gate؛ لا تضف alias لأن `vercel.json` يعيد توجيه المسارات الفرعية.
3. **صوت القرآن offline:** نفذ عقد التخزين الموحد أولًا، ثم downloader محدود، الاسترداد عبر Cache/IndexedDB، UX المساحة، التشغيل offline واختبارات أجهزة/شبكات مستقلة.
4. **الرقية:** أعد اختبار فهرس الآيات وأخطاء 500/502 وHTML بدل JSON. المصدر الخارجي للإحداثيات فقط؛ نص الآيات من corpus وِرد المحلي. لا تسجيلات غير متحقق من مصدرها وحقوقها.
5. **المصحف والصوت:** راجع صفحة صفحة؛ تشغيل متصل بلا توقف بين الآيات، سرعة وتكرار وتنقل ومشغل واحد. لا ادعاء بمطابقة الأسطر المطبوعة دون بيانات تخطيط موثقة.
6. **الحفظ والمراجعة والتسميع:** افصل الحفظ الجديد والمراجعة والتسميع وختمة القراءة؛ لا تحتسب الاستماع حفظًا أو قراءة.
7. **السيرة النبوية والصحابة — ثاني أهم ميزة بعد الحفظ:** ابدأ ببحث API والمصادر والحقوق، لا بالكود الإنتاجي. المرجع التخصصي: `docs/SEERAH_LEARNING_PLAN_AR.md`. الميزة المطلوبة كتاب تاريخي تفاعلي متصل بأجزاء وفصول ومشاهد سردية؛ القراءة هي الأساس، والتفاعلات والاختبارات اختيارية ولا تقطع الحكاية. راجع خطة السيرة §16–17: تجربة القارئ، مخطط المحتوى، دورة اعتماد الفصل، وهيكل الفصل التجريبي. لا تكفي قائمة دروس أو اختبارات. لا اعتماد تلقائي لأي API ولا توليد AI لنصوص دينية/تاريخية أو أسئلة منشورة.
8. **المزامنة:** أكمل activity events وtombstones وanti-resurrection وgrouped syncMeta واختبارات offline/cross-tab/account/two-device. عقد cutover في `sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. أبقِ غير المكتمل fail-closed.
9. **UX والورد اليومي:** راجع الصفحات بالتتابع؛ الأذكار والصلاة والقبلة والهجري تبدأ بمراجعة المصادر والتراخيص والتكلفة والخصوصية.

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
