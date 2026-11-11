# WIRD — نقطة الاستكمال الحالية (مصدر الحقيقة)

**آخر مراجعة توثيقية:** 2026-11-11  
**المستودع:** `xm8eslam-stack/WIRD-APP`  
**الفرع المرجعي للتطبيق:** `main`  
**فرع مركز الوثائق الجاري:** `docs/wird-docs-roadmap-reconciled-20261111`  
**حالة فرع الوثائق:** أعد جلب أحدث head من PR #363 قبل أي فحص أو قرار؛ لا تثبّت SHA للفرع داخل هذه اللقطة لأن التوثيق نفسه يتغير.

> لا تعتمد على أي SHA أو PR أو CI أو Production status في هذه اللقطة قبل إعادة جلبه من GitHub. فرع PR #363 هو مكان تعديلات الوثائق؛ لم يتم الدمج إلى main.

## 1. الحالة التشغيلية والبوابات

- **PR #363:** OPEN / DRAFT حسب آخر مراجعة؛ يوحد مركز الوثائق وخطة التطوير. CI شوهد يفشل في job قبل تسجيل خطوات/سجلات، ولذلك الحالة BLOCKED/UNRESOLVED وليست فشل اختبار معروفًا ولا نجاحًا. أعد جلب head وcheck-runs، ولا تدمج قبل نجاح Quality Gate كامل على exact head.
- **PR #361 و#362:** MERGED حسب السجل السابق؛ لا تكرر أعمالهما. تحقق من الحالة الحية قبل أي عمل مرتبط.
- **PR #358 و#359:** تنفيذان متداخلان لتخزين صوت القرآن offline؛ لا تدمجهما كما هما. اتبع `offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md` واجمع jobs/files/jobItems في عقد موحد مع Cache Storage للبايتات.
- **PR #2:** فرع Phase 5 قديم جدًا؛ لا دمج مباشر. استخرج الفروقات الفريدة فقط عند عودة الأولوية.
- **Production source SHA / live smoke / Google AI Studio sync:** NOT VERIFIED في آخر دليل موثق. فشل Vercel بسبب حد النشر اليومي سُجل سابقًا؛ لا تكرر محاولات مكلفة بلا داعٍ.

## 2. ترتيب التنفيذ العملي

1. **مركز الوثائق #363:** افحص أحدث head وكل check run. أكمل مراجعة الوثائق، ثم لا تدمج حتى ينجح exact-head Quality Gate ويُراجع diff.
2. **صوت القرآن offline:** نفذ عقد التخزين الموحد أولًا، ثم downloader محدود، الاسترداد عبر Cache/IndexedDB، UX المساحة، التشغيل offline واختبارات أجهزة/شبكات مستقلة.
3. **الرقية:** أعد اختبار فهرس الآيات وأخطاء 500/502 وHTML بدل JSON. المصدر الخارجي للإحداثيات فقط؛ نص الآيات من corpus وِرد المحلي. لا تسجيلات غير متحقق من مصدرها وحقوقها.
4. **المصحف والصوت:** راجع صفحة صفحة؛ تشغيل متصل بلا توقف بين الآيات، سرعة وتكرار وتنقل ومشغل واحد. لا ادعاء بمطابقة الأسطر المطبوعة دون بيانات تخطيط موثقة.
5. **الحفظ والمراجعة والتسميع:** افصل الحفظ الجديد والمراجعة والتسميع وختمة القراءة؛ لا تحتسب الاستماع حفظًا أو قراءة.
6. **السيرة النبوية والصحابة — ثاني أهم ميزة بعد الحفظ:** ابدأ ببحث API والمصادر والحقوق، لا بالكود الإنتاجي. المرجع التخصصي: `docs/SEERAH_LEARNING_PLAN_AR.md`. الميزة المطلوبة مسار تفاعلي بالدروس والشخصيات والأحداث والخط الزمني والاختبارات بعد كل درس/مرحلة ومركز مراجعة أخطاء، مع محتوى عربي موثق يعمل offline. لا اعتماد تلقائي لأي API ولا توليد AI لنصوص دينية/تاريخية أو أسئلة منشورة.
7. **المزامنة:** أكمل activity events وtombstones وanti-resurrection وgrouped syncMeta واختبارات offline/cross-tab/account/two-device. عقد cutover في `sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. أبقِ غير المكتمل fail-closed.
8. **UX والورد اليومي:** راجع الصفحات بالتتابع؛ الأذكار والصلاة والقبلة والهجري تبدأ بمراجعة المصادر والتراخيص والتكلفة والخصوصية.

## 3. خطة السيرة — قرارات يجب عدم نسيانها

- SeerahBook مرشح POC من حيث الأشخاص والأحداث والأماكن والعلاقات، لكنه مبني بحسب تعريفه على سلسلة دروس محددة، ولا يُعتمد وحده.
- الدرر السنية تقدم API للموسوعة التاريخية، لكن الوصول يتطلب طلبًا ومراجعة وموافقة وتوكن؛ لا تفترض توفر الاعتماد.
- Islamic Network People/Events APIs مرشحة للتجربة فقط؛ People API معلنة Early Access، ويجب التحقق من العربية والمراجع والحقوق.
- لا API مختارة نهائيًا. قارن عينة من الأحداث والشخصيات مع المراجع الأصلية، وافحص الترخيص والخصوصية والحدود قبل قرار التكامل.
- كل claim/lesson/question له source reference وحالة مراجعة وcontent version.
- الخلاف والتواريخ التقريبية معلنة؛ لا تحويل رواية مختلف فيها إلى حقيقة قطعية.
- لا تجسيد بصري للنبي ﷺ أو الصحابة؛ استخدم خرائط ومناظر وزخارف ورسومًا مجردة.
- لا تنسخ كتبًا أو نصوصًا حديثة أو ترجمة محمية دون ترخيص.
- تقدم السيرة مستقل عن حفظ القرآن وقراءته، ومحتوى الدروس لا يوضع في Firestore لكل مستخدم.

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
