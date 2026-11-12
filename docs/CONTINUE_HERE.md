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
