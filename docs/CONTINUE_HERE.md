# WIRD — نقطة الاستكمال الحالية (مصدر الحقيقة)

**آخر تحقق حي:** 2026-11-12 01:23 +02:00  
**المستودع:** `xm8eslam-stack/WIRD-APP`  
**الفرع المرجعي للتطبيق:** `main`  
**فرع الوثائق:** `docs/wird-docs-roadmap-reconciled-20261111`

> هذه لقطة تشغيلية وليست بديلًا عن إعادة جلب GitHub/Vercel قبل كل قرار. لا تعتمد SHAs أو الحالات القديمة أدناه بعد تغيرها.

## أحدث حالة حية — 2026-11-12 01:23 +02:00

- **main:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- **Production:** Vercel deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` هو `READY` على SHA نفسه، والـ alias `wird-app.vercel.app`. هذا دليل نشر فقط؛ live browser smoke وFirebase sync غير متحققين.
- **main Quality Gate:** run `43079260528` انتهى بفشل job قبل تسجيل أي steps؛ سجل التشغيل غير متاح (`BlobNotFound`). لا يوجد تشخيص لفشل اختبار فعلي، ولا يوجد Quality Gate ناجح مثبت لهذا الرأس.
- **PR #363:** OPEN / DRAFT / HOLD، base `main` على `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`، head الحالي `484fc70e9b4fbcb7f938be944122b931bfcdd3ee`، وGitHub reports `mergeable=true`. التغيير 28 ملفًا توثيقيًا فقط (1,871 إضافة و8 حذف)، بلا runtime code. Exact-head Quality Gate run `43118098080` انتهى `failure` بعد نحو ثانيتين؛ job `130851207499` يعيد `steps=null`، وتنزيل السجل يعيد `BlobNotFound`. توجد annotation واحدة لكن endpoint الخاص بها لم يكن متاحًا؛ لا يوجد تشخيص step/test ولا يجوز وصفه بفشل اختبار. `Vercel Preview Comments` = success، وظهر Preview Ready في تعليق Vercel؛ هذا لا يعوض Quality Gate ولا يثبت Production.
- **PR #361:** MERGED كـ `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`، وmain descendant منه؛ EveryAyah يظل stream-only لحين إثبات حقوق التخزين.
- **PR #362:** MERGED كـ `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd`، وmain descendant منه؛ أصلح انتظار guest-entry في Playwright. لا تكرر إصلاح helper.
- **PR #354:** MERGED كـ `8c49f716726e329189a1141c28a69059543ea5ba`، وmain descendant منه؛ proxy hardening يعيد JSON آمنًا، لكنه لا يثبت زوال السبب الأصلي لخطأ 500 في الرقية.
- **PR #358:** OPEN / DRAFT وغير مدمج، head `4970b87d6ba712d3899093f4e8dd297bef17985e`، run `43030195498`. الاختبارات الآلية وEmulator وTypeScript والبناء نجحت؛ Playwright فشل في desktop لأن helper لم يصل إلى شاشة المراجعة ولم يظهر زر `إضافة مقطع متابعة جديد`؛ 159 passed و1 failed و2 skipped.
- **PR #359:** OPEN / DRAFT وغير مدمج، head `7d31af20fe9cdc69aee4855acaf02e278fbf8b70`، run `43029617572`. الاختبارات الآلية وEmulator وTypeScript والبناء نجحت؛ Playwright فشل في desktop/mobile لنفس غياب زر المراجعة بعد عدم اكتمال guest-entry؛ 158 passed و2 failed و2 skipped. هذه إخفاقات browser setup موثقة، وليست دليلًا على فساد manifest.
- **#358/#359:** كلاهما مبني على main قديم ويتداخلان في ملكية manifest. #362 أصلح helper لكن الرأسيْن القديميْن لم يعيدا الفحص بعده. لا تدمج أيًا منهما منفردًا؛ التنفيذ الموحد ما زال غير منفذ.
- **PR #364:** OPEN / DRAFT، head `3a4e79c03d405d05aa9ca39c47c9c9276f1f0a98`. run `43117641418` فشل قبل steps؛ logs `BlobNotFound`، فلا يوجد test-level diagnosis. Vercel Preview نجح؛ لا دمج قبل Quality Gate كامل على exact head.
- **PR #2:** OPEN / DRAFT وغير قابل للدمج حاليًا؛ مقارنة head `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` مع main: 115 ahead و469 behind. لا دمج wholesale؛ استخرج التغييرات الفريدة فقط عبر PR ضيق مثل #364.
- **بوابتا المزامنة في Production:** `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` و`VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` بحسب الجرد غير المفكوك السابق. لم يتم تغييرهما؛ قرار المالك مطلوب. لا تُفعّل أو تُعطّل أي إعداد إنتاجي هنا.
- **Google AI Studio / live smoke / اختبار A↔B على جهازين / offline audio فعلي:** NOT VERIFIED.

## التنفيذ التالي

1. إبقاء #363 Draft/HOLD؛ مراجعة التناقضات الوثائقية المصححة في هذا التحديث، ثم انتظار Quality Gate قابل للفحص وناجح على exact head جديد. لا rerun عشوائيًا؛ فشل التشغيل السابق كان قبل steps والسجلات غير متاحة.
2. إبقاء #358/#359 منفصلين كمرجعين فقط، وتصميم تنفيذ موحد على main وفق عقد `jobs/files/jobItems` قبل أي كود تنزيل.
3. متابعة تشخيص فهرس الرقية و500/502 عبر أدلة آمنة، دون كشف أسرار أو اعتبار JSON 502 وحده حلًا للسبب.
4. مواصلة اختبارات مزامنة tombstones/cutover دون تغيير Rules أو flags أو بيانات الإنتاج.
5. بدء أي تنفيذ للسيرة بعد فحص المكونات الحالية؛ المطلوب قارئ كتاب متصل متعدد المشاهد، وليس قائمة دروس.

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
