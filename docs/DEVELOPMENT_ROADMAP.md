# مسار منتجي جديد — Offline-first والتطبيق المستقبلي

## قرار التخزين التالي — 2026-11-12 14:55 +02:00

لا ترفع byte limits أو تزيل حد 100 خطة من `StorageService` قبل نقل أرشيف enginePlans من localStorage إلى IndexedDB. #367 يظل حلًا انتقاليًا 800 KB لكل mutation، وليس تخزينًا مرنًا.

التسلسل: جرد كل call sites والاختبارات → local IndexedDB archive + migration lossless + hydration gate → journal/outbox snapshot references atomic → Firestore immutable chunks + manifest → receiver materialization + capability negotiation → two-device/offline gates.

لا يوجد entitlement source موثق؛ لا تخترع user tiers. لا GC للإصدارات السابقة قبل device acknowledgements موثوقة.


## تحديث مسارات التنفيذ — 2026-11-12 14:35 +02:00

- **Flexible Storage/Sync:** لا يوجد chunked sync implementation. #367 ما زال 800 KB interim per-payload budget؛ يلزم تصميم end-to-end مع local IndexedDB payload refs وmanifest/chunks وFirestore version compatibility قبل التنفيذ.
- **Offline Audio:** #368 يقدم metadata-only store موحدًا من #358/#359: jobs/files/jobItems، shared file references، pinned retention، available/deletionPending، وtwo-phase orphan cleanup. لا يوجد downloader/Cache Storage adapter/SW protocol/UI بعد.
- **Seerah:** #365 أضاف persistent bookmarks وقائمة رجوع واختبار Playwright بعد reload؛ لا يوجد محتوى تاريخي معتمد بعد.
- **Quality:** أحدث workflows على exact heads #365/#368 فشلت دون steps/logs؛ لا يمكن اعتبارها فشل اختبار برمجي أو نجاحًا. Vercel Preview blocked by Free build-rate.
- **Merge gate:** لا دمج قبل CI قابل للفحص وناجح، ومراجعة diff كاملة. لا تغيير إنتاجي دون موافقة.


## تحديث التنفيذ — 2026-11-12 14:05 +02:00

- قارئ السيرة #365 أصبح يدعم bookmarks محلية مرتبطة بإصدار الكتاب والفصل والمشهد والـ anchor، مع قائمة رجوع داخل الفهرس. لا مزامنة ولا محتوى تاريخي معتمد بعد.
- PR #367 أصبح منفصلًا عن الوثائق بعد إزالة تعديلاته على ملفي architecture/work log المتداخلين مع #363.
- لا تزال CI exact-head runs للرؤوس الجديدة تنتهي قبل تسجيل أي steps/logs؛ لا pass ولا فشل اختبار كودي مثبت.
- الخطوة التالية للسيرة: اختبار UI فعلي، ثم anchors ثابتة مرتبطة بمحتوى معتمد ونسخة محتوى؛ لا كتابة سرد تاريخي دون claim-level sourcing ومراجعة.
- الخطوة التالية للتخزين: تدقيق سلسلة المزامنة كاملة قبل chunked sync؛ لا تعتبر 800 KB سعة إجمالية.
- الخطوة التالية Offline: التحقق من route/data/action matrix ثم browser restart/airplane-mode، مع عدم المساس بالتقدم أو Outbox عند ضغط الكاش.


## حالة التنفيذ الحية — 2026-11-12 13:40 +02:00

المصدر الحي: `docs/CONTINUE_HERE.md`. main هو `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. PRs #363/#365/#366/#367 ما زالت Draft؛ كل Quality Gate على الرؤوس الحالية انتهى دون تسجيل steps/logs، فلا يوجد pass ولا فشل اختبار برمجي مُشخّص.

- **Storage/Sync:** #367 يثبت حد 800 KB لمستند enginePlans فقط. المطلوب التالي هو versioned chunks + manifest integrity + atomic publication بعد تدقيق كامل لسلسلة المزامنة. لا توجد حصة اشتراك/entitlement موثقة؛ لا تخترع tiers أو حصص.
- **Offline:** #366 يضيف تضمين public assets وfallback عند 5xx وسياسة LRU تكيفية لكاش الوسائط. لا يثبت ذلك Offline readiness؛ يلزم matrix route/data/action واختبار restart/airplane-mode.
- **Seerah:** #365 قارئ shell وعقد claims/sources/reviews وتقدم قراءة محلي. لا يوجد محتوى تاريخي حقيقي للنشر. التالي bookmarks وanchors ونسخة المحتوى بعد فحص القارئ، ثم محتوى بمراجع ومراجعات بشرية.
- **تنسيق PRs:** ملفات docs المشتركة تظل في #363 فقط؛ لا تجعل #367 يعدّل `docs/sync/ARCHITECTURE.md` أو `docs/engineering/progress/WORK_LOG.md` بالتوازي.
- **بوابة الدمج:** لا دمج حتى Quality Gate exact-head قابل للفحص وناجح ومراجعة كاملة؛ Preview لا يعوض CI ولا يثبت Production.


يُنفذ بالتوازي مع القرآن والعبادات والسيرة والـ UX والمزامنة. الأولوية ليست إعادة كتابة البنية بل إكمال ما هو موجود وإثباته.

1. OF0: جرد جميع المسارات والـ lazy chunks والملفات العامة والخطوط والبيانات والأفعال ومصادرها وحقوقها وسياسة cache.
2. OF1: دورة حياة PWA/Service Worker، أول زيارة، التحديث، navigation fallback، وإعادة الفتح دون شبكة.
3. OF2: حزمة Offline كاملة ومحدودة وقابلة للاستكمال تشمل lazy chunks والـ public assets المطلوبة؛ استثناء worker نفسه.
4. OF3: بيانات محلية آمنة مع guest/UID isolation واسترجاع بعد restart؛ لا ترحيل شامل دون خطة توافق واستعادة.
5. OF4: القرآن الموثق والعبادات الأساسية محليًا؛ التفسير/الحديث المحفوظ فقط؛ APIs الحية تبقى شبكية.
6. OF5: تنزيلات صوت مثبتة من مصادر مرخصة فقط، منفصلة عن cache الانتهازي وعن cloud sync.
7. OF6: مركز Offline واضح للمساحة والحزمة والتنزيلات وحالة الميزات الشبكية.
8. OF7: تثبيت PWA واختبار Android/iOS/Desktop؛ مقارنة Capacitor/TWA/native بعد نجاح web gates فقط.
9. OF8: اختبارات browser حقيقية ثم أجهزة فعلية: airplane mode، restart، storage pressure، update، واسترداد المزامنة.

بوابة الاكتمال: لا إعلان Offline-ready قبل نجاح المسارات الأساسية بعد restart دون اتصال، وعدم تسريب البيانات الخاصة، واسترداد التقدم المحلي، واختبار المزامنة بعد عودة الشبكة. CI وVercel وbrowser/device smoke أدلة منفصلة.

---

## سياسة التخزين التكيفية — إضافة 2026-11-12

- **محليًا:** كاش الوسائط الاختياري يتكيف مع quota/usage للجهاز، يترك احتياطيًا للتطبيق وبيانات المستخدم، ويستخدم LRU وسقوفًا قصوى. لا يحذف تقدم المستخدم أو سجل المزامنة عند ضغط التخزين. التنفيذ الأولي في PR #366، Draft/HOLD وغير مثبت على متصفح فعلي.
- **سحابيًا:** لا تتغير حدود Firestore التقنية بحسب خطة المستخدم. حد 800 KB الحالي في PR #367 هو حد آمن للمستند الواحد فقط. الأحجام الأكبر تعالج عبر chunked/versioned storage مع manifest وhash واكتمال upload قبل نشر الإصدار الجديد.
- **الحصص حسب الاشتراك:** لا تُحدد إلا بعد اعتماد tiers/entitlements حقيقية. قبل ذلك، تُحسب الحاجة بحسب حجم البيانات الفعلي وتُرفض العمليات بأمان عند تجاوز الحدود المعروفة؛ لا نفترض حصصًا غير موجودة.
- **بوابة الإصدار:** اختبارات انقطاع/استئناف، partial upload، hash mismatch، تعارض أجهزة، quota exhaustion، واسترداد النسخة السابقة. لا تغيير لقواعد Firestore أو الإنتاج دون موافقة.

---

# خارطة تطوير وِرد — الخطة الرئيسية الموحدة

**آخر مراجعة:** 2026-11-12 01:31 +02:00؛ هذه خطة مستقبلية وليست ادعاءً بأن كل البنود منفذة. الحالة الحية في `CONTINUE_HERE.md` وتُعاد مطابقتها مع GitHub/Vercel قبل كل قرار.

## Live repository checkpoint — 2026-11-12 01:31 +02:00

- main: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`; Vercel Production READY on the exact same SHA. No live browser or sync smoke is claimed.
- Main Quality Gate run `43079260528` failed before steps/logs (`BlobNotFound`); no test-level diagnosis or pass.
- PR #363 last checked head `acdfeef4e4baf99251e4768bbbc808fabab4f130`, exact-head run `43120106137` failed before steps/logs (`BlobNotFound`); Preview deployment `dpl_CcBtjR4TRcqJd9pNwSZTvkgS2LHA` READY on that SHA. This documentation update creates a new head; re-fetch its checks.
- PR #361/#362/#354 are merged and included in main. PR #358/#359 remain overlapping Draft proposals; #362 fixed their shared guest-entry helper. PR #364 is Draft/HOLD with unresolved no-steps run.
- Both Production sync flags were observed true; owner approval is required before changing either.

## الرؤية
وِرد تطبيق قرآن كريم يساعد على القراءة والاستماع والحفظ والمراجعة، مع الورد اليومي وأدوات عبادة مساندة. لا يتحول إلى بوابة إسلامية عامة. مسار السيرة النبوية والصحابة إضافة تعليمية متخصصة تخدم معرفة المستخدم بالرسول ﷺ والجيل الأول، دون تشتيت جوهر التطبيق.

### ثوابت
1. النص القرآني من corpus محلي موثوق؛ لا AI ولا API يكتب أو يصحح الآيات.
2. التفسير والحديث والرقية والسيرة بمصادر معروفة وتخريج/إحالة وترخيص واضح.
3. Local-first؛ القراءة والحفظ الأساسيان يعملان دون اتصال.
4. افحص الموجود والاختبارات قبل إعادة بناء أي ميزة.
5. تصميم عربي RTL هادئ وفاخر ومتجاوب وقابل للوصول.
6. لا API مدفوعة كشرط أساسي؛ راجع التكلفة والخصوصية والحدود والترخيص.
7. ميّز بين منفذ/مدمج/CI/Production/تحقق حي.
8. لا نشر تلقائي لمادة دينية أو تاريخية من API أو نموذج ذكاء اصطناعي.
9. كل معلومة/سؤال في السيرة له مصدر محدد وحالة مراجعة؛ الخلاف والتاريخ التقريبي يعلنان بوضوح.

## ترتيب الأولويات
| الأولوية | المسار | الهدف | الحالة |
|---|---|---|---|
| P0 | PR queue | إغلاق الفروع الحالية باختبارات exact SHA | #361/#362/#354 merged؛ #363 Draft/HOLD على آخر head مفحوص `acdfeef4`، run `43120106137` بلا steps/logs؛ #364 Draft/HOLD بلا تشخيص اختبار؛ #358/#359 overlapping Drafts؛ #2 diverged 115 ahead / 469 behind |
| P0 | صوت القرآن offline | تنزيل اختياري محدود وتخزين محلي وتشغيل offline | planner #355 وحقوق EveryAyah في #361 مدمجان؛ لا manifest/downloader/UI؛ #358/#359 لم يدمجا، والعقد الموحد مرجع التنفيذ |
| P0 | الرقية | إصلاح فهرس الآيات و500/502 والتحقق من الصوت | #354 أضاف JSON 502 آمنًا؛ سبب 500 الأصلي وفهرس الآيات يحتاجان تحققًا حيًا مستقلًا |
| P1-1 | الحفظ والمراجعة | جلسات دقيقة وتكرار وتسميع وتقدم موثوق | أساس واسع موجود؛ أولوية المنتج الأولى |
| P1-2 | السيرة النبوية والصحابة | كتاب تاريخي تفاعلي متصل بأجزاء وفصول ومشاهد، مع سياق وشخصيات وخرائط واختبارات اختيارية | **خطة بحث وتصميم موثقة؛ لم يبدأ التنفيذ** |
| P1 | المصحف والصوت | قارئ مرن، تفسير، تنقل وتشغيل متصل | أساس موجود؛ تحسين مستمر |
| P1 | المزامنة | أحداث وتعارضات وحذف آمن واختبارات متعددة العملاء | جزئي؛ بوابات متبقية |
| P1 | UX الصفحات | مراجعة كل صفحة وأداة وتحسين الاتساق | مستمر |
| P2 | الأذكار والورد | أذكار موثقة حسب الوقت والمناسبة | بحث مصادر أولًا |
| P2 | الصلاة والعادات | متابعة اختيارية غير حُكمية وخاصة | لم تُحسم |
| P2 | مواقيت/قبلة/هجري | مصادر مجانية موثوقة وoffline fallback | بحث أولًا |
| P3 | ذكاء مساعد | اقتراحات مرتبطة بسجل المستخدم لا نصوص شرعية مولدة | بعد استقرار الأساس |

## المرحلة 0 — تنظيم العمل
- [x] اعتماد main مصدرًا لـ Google AI Studio.
- [x] توحيد دليل الوثائق ونقطة الاستكمال والخطة.
- [x] ربط الحالة الحية بـ SHA وPR وrun حقيقي عند توفر الدليل.
- [ ] تحديث الملاحظات التخصصية عند تغيير الكود.
- [ ] حفظ التاريخ مع وضع إشعار للملفات القديمة بدل حذفها.

معيار القبول: وكيل جديد يعرف الحالة والخطوة التالية من ملفي CONTINUE_HERE وDEVELOPMENT_ROADMAP.

## المرحلة 1 — طابور PR الحالي
أعد جلب PRs وCI قبل أي قرار؛ حالات هذا الملف ليست live.
- #363: مركز الوثائق؛ لا تدمج إلا بعد نجاح كل خطوات Quality Gate على exact head.
- #358/#359: تنفيذان متداخلان لمسؤوليات manifest؛ راجع الفروق وحدد عقدًا موحدًا قبل دمج أي منهما.
- لا تعِد تنفيذ أعمال #361/#362 المدمجة.
- لا تعتمد على أرقام SHA أو نتائج CI قديمة؛ راجع الحالة من GitHub عند الاستكمال.

## المرحلة 2 — تنزيل صوت القرآن offline
1. Range planner — مدمج: نطاق الآيات من metadata المحلية وقائمة قراء معتمدة.
2. Manifest store — تصميم موحد مقترح في `offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md`: jobs + files + jobItems في IndexedDB واحد، وCache Storage للبايتات فقط. لا تدمج #358/#359 كما هما.
3. Downloader — تنزيل محدود بعد اختيار المستخدم، مع حجم/عدد/توازي محدود وtimeout/retry.
4. Integrity — تحقق من HTTP/content type/الحجم وعدم إعلان الاكتمال قبل تحقق كل ملف.
5. Lifecycle — pause/resume/cancel، إعادة فتح، تنظيف الملفات الجزئية.
6. Storage UX — تقدير الحجم والمساحة وquota والحذف الانتقائي.
7. Playback — تشغيل الملف المحلي عند offline مع fallback واضح ومنع مطابقة خاطئة للإحداثيات.
8. QA — قطع الشبكة، انقطاع التنزيل، quota، تكرار المهمة وتغيير الحساب.

حقوق Al Quran Cloud الموثقة لا تعمم على EveryAyah أو مزود آخر ولا تعني حق إعادة الاستضافة. لا تنزيل كامل تلقائي.

## المرحلة 3 — الرقية
- مراجعة `api/ruqyah.ts` وخدمات API/content/audio والواجهة والاختبارات.
- تشخيص 500/502 وHTML بدل JSON وtimeout و429 والبيانات الناقصة.
- المصدر الخارجي للإحداثيات فقط؛ نص الآيات من corpus وِرد المحلي.
- حالات تحميل/فشل/retry واضحة بلا fallback ديني غير موثوق.
- مجموعات قصيرة/متوسطة/طويلة من آيات محددة فقط بعد مراجعة التسجيل والحقوق والمصدر؛ لا تسجيلات كاملة غير متحقق منها.
- اختبار بداية/وسط/نهاية المجموعة، التنقل والتكرار وإيقاف الصوت وضعف الشبكة.
- اتباع `docs/ruqyah/SUNNI_SOURCE_POLICY.md`.

## المرحلة 4 — المصحف والقراءة
- مراجعة من فتح المصحف حتى تغيير السورة/الصفحة/الجزء والعودة.
- إبقاء عرض الآيات في صفحة مرنة؛ لا ادعاء مطابقة أسطر المصحف المطبوع بلا بيانات تخطيط.
- فهرس موسع وبحث وانتقال مباشر وعلامات وموضع قراءة.
- تشغيل متصل دون توقف بين الآيات، قارئ وسرعة وتكرار وتنقل.
- توحيد حالة المشغل ومنع تعدد المشغلات وتنظيفها عند الخروج.
- تفسير موثق المصدر وحالات تحميل وفشل.
- لا تحتسب الاستماع حفظًا أو قراءة تلقائيًا.

## المرحلة 5 — الحفظ والمراجعة والتسميع (أولوية المنتج الأولى)
- فصل الحفظ الجديد عن المراجعة وعن ختمة القراءة.
- فتح المقطع المختار مباشرة ووضوح النطاق والهدف والتقدم.
- تحسين التكرار وإخفاء الآية والتسميع عند توفره بأمان.
- ربط موضع الخطأ بالآية والتفسير.
- عدم تغيير خوارزمية المراجعة أو التقدم دون اختبارات بيانات.
- اختبار الجلسة الطويلة والاستئناف وتغيير النطاق والتنقل وفشل الصوت.

## المرحلة 6 — السيرة النبوية والصحابة (ثاني أهم ميزة بعد الحفظ)
**المرجع التخصصي الوحيد:** `docs/SEERAH_LEARNING_PLAN_AR.md`.

### الرؤية التعليمية
كتاب سيرة عربي تفاعلي متكامل، يقرأه المستخدم كحكاية تاريخية متصلة بأجزاء وفصول ومشاهد مترابطة. السرد هو المنتج الأساسي، وتدعمه إحالات الشخصيات والأماكن والخط الزمني ووقفات فهم واختبارات اختيارية في نهاية الفصول والأجزاء، مع حفظ موضع القراءة ومراجعة الأخطاء.

### بوابات العمل
1. **بحث المصادر والحقوق:** اختبار SeerahBook وIslamic Network People/Events، وطلب الوصول للدرر السنية عند الحاجة. لا اعتماد نهائي قبل مراجعة تغطية العربية، المراجع لكل معلومة، الترخيص، التخزين، التكلفة، الخصوصية، الحدود والاستقرار.
2. **المنهج التحريري:** اعتماد مخطط بيانات للأجزاء والفصول والمشاهد والأحداث والشخصيات والادعاءات والمصادر والأسئلة وحالات المراجعة. لا تاريخ قطعي لمسألة مختلف فيها.
3. **MVP:** كتاب افتتاحي بفهرس أجزاء وفصول، فصل سردي متعدد المشاهد، قارئ متصل، ملفات شخصية مرتبطة، مراجع ظاهرة، وقفة/اختبار اختياري، وحفظ موضع القراءة محليًا.
4. **الاختبارات:** ترتيب أحداث، مطابقة أشخاص/أحداث/أماكن، اختيار متعدد، استرجاع نشط، اختبار مرحلة واختبار تراكمي، مركز أخطاء ومراجعة متباعدة.
5. **الاستكشاف:** خط زمني وخريطة للمواقع الموثقة وروابط شبكة الشخصيات والأحداث.
6. **التوسع:** تغطية تراجم الصحابة تدريجيًا وبمؤشر تغطية حقيقي؛ لا ادعاء «كاملة» قبل معيار نطاق ومراجعة.
7. **Offline/sync:** حزم محتوى معتمدة محليًا ومزامنة تقدم المستخدم فقط، دون وضع نصوص الكتب في Firestore.

### معايير القبول غير القابلة للتجاوز
- كل claim في السرد وكل سؤال وإجابة وتاريخ واقتباس مرتبط بمصدر واضح ونسخة محتوى.
- كل معلومة لها حالة مراجعة؛ المواد pending/disputed لا تظهر كحقائق قطعية.
- لا AI يؤلف نصًا أو حديثًا أو حوارًا أو سؤالًا دينيًا منشورًا.
- لا صور تجسيدية للنبي ﷺ أو الصحابة.
- لا مزود خارجي مطلوب لتشغيل المحتوى المعتمد بعد تنزيله.
- تقدم السيرة مستقل تمامًا عن إحصاءات الحفظ والقراءة.
- اجتياز اختبارات المحتوى، API، الأمان، التخزين، RTL، الوصول، الأجهزة المختلفة وexact-SHA CI.

## المرحلة 7 — المزامنة وسلامة البيانات
الموجود: Auth، local journal/outbox، remote projection foundations، revision/CAS guards، بعض تعارضات upsert، Ruqyah V2 PN-counter، اختبارات قواعد وcross-tab/account/offline.

المتبقي:
- سجل أحداث activity مع baseline DailyLog القديم دون double count.
- tombstones لكل collection مع delete/replay/restore/revision/anti-resurrection.
- grouped `syncMeta` ذريًا؛ لا partial writes.
- إبقاء تعارضات Ruqyah V1 القديمة محفوظة ومغلقة بدل التخمين.
- اختبارات crash/restart، offline طويل، quota داخل transaction، IndexedDB blocked/versionchange، cross-tab، account lifecycle وpopulated multi-domain.
- مطابقة قواعد Firebase المنشورة والتحقق من flags دون تغيير.
- لا تدّع اكتمال المزامنة بناء على تجربة محدودة.

## المرحلة 8 — UX صفحة صفحة
اتبع `UX_PAGE_AND_TOOL_MAP.md`:
1. الرئيسية: ورد اليوم والمراجعات والقراءة والختمة والنشاط الحقيقي.
2. المكتبة والمصحف: فهرس وبحث وصفحات ونص وتفسير وصوت وعلامات.
3. جلسة الحفظ: تركيز وتكرار وتسميع وتنقل وتقدم.
4. المراجعة: المستحق وفتح المقطع ونتيجة المراجعة.
5. الخطط: إنشاء وتعديل وإيقاف وفصل الحفظ عن الختمة.
6. الاختبارات: النطاق والأنماط والنتيجة ومواضع الخطأ.
7. التقدم: أرقام حقيقية بلا تكرار.
8. المستشار: نصيحة مرتبطة بالسجل لا مصدر شرعي مولد.
9. الرقية: المصدر والقراءة والصوت والتقدم والأخطاء.
10. الإعدادات والحساب: الخط والصوت والخصوصية والنسخ الاحتياطي والمزامنة.
11. السيرة: كتاب السيرة: الأجزاء والفصول والمشاهد والقارئ المتصل والشخصيات والخط الزمني والاختبارات الاختيارية والمراجعة.

لكل صفحة: جرد الأدوات → تدفق الاستخدام → إزالة التكرار → responsive → keyboard/screen reader → اختبارات → تحقق.

## المرحلة 9 — الورد اليومي والميزات المساندة
- أذكار الصباح والمساء والصلاة والنوم والاستيقاظ مع النص والمصدر والتصنيف.
- عداد ذكر/استغفار بسيط اختياري.
- متابعة الصلاة خاصة وغير حُكمية.
- تذكيرات وخطة يومية خفيفة.
- مواقيت وقبلة وهجري بمصادر مجانية موثوقة وoffline fallback حيث يمكن.
- مقارنة كل مصدر: الصحة/الترخيص/التكلفة/الخصوصية/الحدود/الصيانة/offline.
- لا AI ينشئ آية أو حديثًا أو فتوى أو ذكرًا.

## بوابات الجودة
Unit/integration، Rules Emulator عند الحاجة، TypeScript/lint/build، Quran data integrity، Playwright desktop/mobile، مراجعة diff والأمان والمصدر والترخيص والأداء، Quality Gate على exact SHA، ثم تحقق post-merge. النشر الحي منفصل عن CI.

الإجراءات التي تحتاج المالك: `OWNER_ACTIONS.md`.


### نتيجة بحث مواصفات API — 2026-11-11
- **Islamic Network People:** OpenAPI يحدد سجل شخص متعدد اللغات مع biography وbirth/death وhonorific وعلاقات وروابط إلى الأحداث/القصص/الاقتباسات. لا يفترض وجود العربية لكل سجل، ولا يعتبر وجود biography تخريجًا لكل دعوى.
- **Islamic Network Events:** OpenAPI يحدد قائمة أحداث وتقويمًا هجريًا. حقل date هو ذكرى سنوية (شهر/يوم)، بينما year سنة الحدث عند توفرها؛ لذلك لا يعامل تاريخ الذكرى كتاريخ وقوع مؤكد. هذا المصدر تقويمي مساعد لا يغني عن خط زمني محرر للسيرة.
- **SeerahBook:** REST read-only وعلاقات متعددة ومصادر لكل claim بحسب صفحة About؛ لكنه مبني على سلسلة محاضرات محددة، ومعدل الطلب حسب IP يمنع السحب الجماعي. صفحة About تميز أيضًا بين الاقتباس الحرفي والصياغة الدرامية؛ لا تنسب أي صياغة معاد بناؤها إلى النبي ﷺ أو صحابي.
- **Dorar:** الوصول بموافقة يدوية وتوكن؛ الشروط تمنع bulk download وإعادة النشر/التجميع، وتحدد cache بـ24–48 ساعة مع attribution ورابط قابل للنقر وخادم وسيط ومراجعة قبل النشر. ليس مصدر offline corpus.
- **قرار البنية:** لا يوجد API وحيد يحقق «السيرة كاملة». WIRD Seerah Content Registry هو مصدر المحتوى المنشور، والمزودون أدوات اكتشاف/تحقق فقط إلى أن تتضح الحقوق. التفاصيل في `SEERAH_LEARNING_PLAN_AR.md`.


### بوابة provenance الإضافية لمصادر السيرة
- Islamic Network People schema لا يضع مرجعًا مستقلًا لكل فقرة في biography أو لكل تاريخ/علاقة؛ لذلك هو فهرس اكتشاف وروابط، وليس مصدرًا كافيًا لنشر claim.
- Islamic Network Events لديه `source` نصي عام، لا يثبت وحده الكتاب/الجزء/الصفحة؛ يلزم فتح المرجع والتحقق منه.
- SeerahBook يعلن provenance لكل claim، لكن يجب فتح المرجع الأصلي ومراجعة اللفظ، ورفض الصياغات الدرامية كاقتباسات حرفية.
- كل معلومة في corpus وِرد يجب أن تحمل إحالة قابلة للتدقيق على مستوى المعلومة، لا مجرد رابط للشخص أو الصفحة.
- لا تعتمد أيًا من المرشحين مصدرًا أساسيًا لحزمة offline قبل استيفاء هذه البوابة وحقوق إعادة العرض/التخزين.


### قرار تجربة السيرة — «حكاية السيرة» لا قائمة دروس (2026-11-11)
- الميزة كتاب تاريخي تفاعلي متصل: أجزاء كبرى ثم فصول مترابطة ثم مشاهد سردية، مع مقدمة سياقية وخاتمة تربط كل مرحلة بما بعدها.
- القراءة والسرد هما القلب؛ الاختبارات والبطاقات والخرائط أدوات مساندة اختيارية لا تقطع القراءة.
- يلزم وضع قراءة متصلة ووضع قراءة وتعلم، وفهرس، وحفظ آخر موضع، وإحالات داخلية للشخصيات والأماكن والأحداث، وخطوط زمنية وخرائط بدقة معلنة.
- السرد جذاب ومنضبط: لا حوار مختلق أو مشاعر/نوايا غير مثبتة أو اقتباس غير محقق، ولا دمج روايات متعارضة. التشويق من تسلسل الوقائع والنتائج لا من اختلاق cliffhangers.
- كل claim في السرد له مصدر مستقل وحالة مراجعة؛ ومراجعة الفصل تشمل سلامة المعنى الناتج عن ترتيب الجمل.
- فهرس الأجزاء من العالم قبل البعثة إلى عصر الخلفاء الراشدين، قابل للمراجعة العلمية، موثق بالتفصيل في خطة السيرة §16.
- معيار MVP: نموذج جزء وفصل متعدد المشاهد، قارئ متصل، حفظ موضع، بطاقات سياقية، ومراجعة مصدرية/علمية؛ قائمة دروس واختبارات وحدها لا تحقق الطلب.
- ترتيب التنفيذ: تجربة تحريرية وUX نموذجية، ثم سجل المحتوى والمراجع، ثم قارئ وتقدم، ثم تفاعلات واختبارات.

### توحيد طريقة إنتاج «حكاية السيرة» — 2026-11-11
- المرجع التحريري: `docs/SEERAH_LEARNING_PLAN_AR.md` §16–17.
- وحدة المنتج فصل سردي متعدد المشاهد، لا درس قصير؛ لكل مشهد body blocks تربط claim IDs بمصادرها، ولكل فصل مدخل سياقي وخاتمة تربط المرحلة بما يليها.
- دورة النشر الإلزامية: بحث مصادر ← claims ذرية ← مراجعة التسلسل والروايات ← مسودة سردية ← ربط كل فقرة/كتلة بالـclaims ← مراجعة علمية ولغوية واستمرارية ← مراجعة UX/accessibility ← نشر.
- مخطط البيانات التفصيلي يشمل parts/chapters/scenes/bodyBlocks/claims/sourceReferences/editorialReviews/readerProgress/questions. الأسئلة تابعة للسرد وليست المنتج.
- نموذج الفصل الافتتاحي المقترح في §17.4 هيكل بحث فقط، وليس محتوى تاريخيًا معتمدًا. لا تكتب أو تنشر نصه قبل استكمال مراجع claims.
- لا API ingestion أو نشر تلقائي؛ أي claim بلا مصدر/حقوق/مراجعة يبقى pending ولا يظهر للمستخدم.


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
