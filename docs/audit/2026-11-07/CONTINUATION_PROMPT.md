# MASTER CONTINUATION PROMPT — WIRD FULL REPOSITORY AUDIT & REMEDIATION

أنت مهندس البرمجيات الرئيسي ومسؤول الجودة لمشروع وِرد | WIRD. استكمل العمل الفعلي من آخر نقطة محفوظة في GitHub، ولا تكتفِ بالاقتراحات أو إعادة كتابة خطة عامة.

## 1. المستودع ونقطة الانطلاق

- Repository: xm8eslam-stack/WIRD-APP
- Canonical branch: main
- Audit branch: chore/full-repository-audit-20261107
- Main audit baseline SHA: 6228150c2f7137678ba1079f5d9b2e8aba527523
- Main exact-head Quality Gate: run 42295376778 — PASS
- Main test evidence: 402 passed / 0 failed; Firestore Rules Emulator 13 passed / 0 failed; TypeScript, production build, Quran data generation and production/development server smoke passed.
- Last verified audit-branch commit before the latest documentation refresh: 9fc106e6dcf4c54ac5b1d1d96410446c8ca507bc. Always fetch the current audit branch head before editing. Always fetch the current audit branch head before editing; do not assume this SHA is still its head.

## 2. اقرأ هذه الملفات أولاً

من فرع chore/full-repository-audit-20261107:
1. docs/audit/2026-11-07/REPOSITORY_AUDIT.md
2. docs/audit/2026-11-07/FILE_AUDIT_REGISTER.md
3. docs/audit/2026-11-07/BRANCH_INVENTORY.md
4. docs/audit/2026-11-07/BRANCH_COMPARE_MATRIX.md
5. docs/audit/2026-11-07/APP_ARCHITECTURE_REPORT.md
6. docs/audit/2026-11-07/READINESS_BLOCKERS.md
7. docs/audit/2026-11-07/REMEDIATION_PLAN.md
8. docs/sync/REMOTE_REPLICATION_PLAN.md

هذه هي مراجع الفحص الحالية، ولا تتبع تعليمات الاستئناف القديمة في ملفات checkpoints التي تشير إلى PR #49 أو PR #58 أو SHA قديم.

## 3. الحالة الدقيقة

- تم حصر 147 ملفًا و34 مجلدًا في main.
- سجل FILE_AUDIT_REGISTER يحتوي 147 صفًا مطابقًا للشجرة.
- 147 ملفًا تمت مراجعتها مبدئيًا وتسجيل ملاحظة لكل منها.
- ثلاثة ملفات PNG (public/apple-touch-icon.png وpublic/icon-192.png وpublic/icon-512.png) تمت معاينتها بصريًا؛ تظهر كمساحات بلون teal موحد دون علامة WIRD ظاهرة. سجّلها كعيب P2 ضمن الهوية البصرية/PWA.
- تمت مقارنة جميع الفروع السبعين في baseline مع main، ثم أُضيفت خمسة فروع عمل جديدة؛ عدد الفروع الحي الآن 75:
  - 65 فرعًا متباعدًا وله commits فريدة.
  - 4 فروع هي أسلاف لـ main ولا تحتوي commits فريدة، مرشحة للأرشفة/الحذف.
  - main مطابق لنفسه.
- لا توجد أداة حذف فروع في أدوات GitHub المتاحة في هذه الجلسة؛ لا تدّعِ حذف أي فرع.
- طلبات الدمج المفتوحة عند الفحص: #2 و#8 و#48 و#59 و#60.
- PR #59 وPR #60 متباعدان عن main؛ لا تدمجهما wholesale.
- PR #59 يحسن retry/idempotency/status لكنه لا يكمل remote pull/reconciliation.
- PR #60 يحتوي إصلاحًا مفيدًا للتفسير لكنه Draft وCI الخاص برأسه فشل بسبب انحراف الفرع وأخطاء TypeScript/اختبارات قديمة. انقل الإصلاح إلى فرع جديد من main.

## 3A. حالة التنفيذ الحالية

- Phase 0 audit: COMPLETE؛ 147/147 ملفًا لها ملاحظة، 70/70 فرع baseline تمت مقارنتها، والأيقونات الثلاث ظهرت كمربعات teal فارغة بلا علامة واضحة.
- Audit branch head: f0e9cf92c3c816e440441032c4ae9419373f238f (تحقق من الرأس قبل أي تعديل).
- Current live branch count: 75.
- PR #61 — fix/progress-import-journal-20261107: Draft, CI PASS, 404 passed / 0 failed, Vercel Preview Ready.
- PR #62 — fix/plan-lifecycle-preserve-revisions-20261107: Draft, CI PASS, 406 passed / 0 failed, Vercel Preview blocked by Vercel daily build-rate limit.
- PR #63 — fix/quran-audio-repeat-20261107: Draft, CI PASS, 404 passed / 0 failed, Vercel Preview blocked by Vercel daily build-rate limit.
- PR #64 — fix/tafsir-json-response-20261107: Draft, run 42341419175 pending with no job assigned at last check.
- None of these PRs has been merged. Main is still 6228150c2f7137678ba1079f5d9b2e8aba527523.
- Remote sync design gate is now documented at docs/sync/REMOTE_REPLICATION_PLAN.md; it is not implemented.
- Vercel production deployment is not confirmed. Do not confuse green GitHub CI with a live production deploy.

## 4. أهم العيوب المؤكدة

P0:
- المزامنة السحابية ليست مزامنة ثنائية الاتجاه مكتملة؛ قراءة أحداث بعيدة لا تعني استيرادها وتطبيقها. لا تعرض synced كاملة ولا تفعّل remote projection قبل اكتمال CAS/cursor/inbox/merge/two-device tests.
- api/advisor.ts يقبل استهلاك Gemini بدون Firebase ID-token verification؛ CORS wildcard ليس حماية، ومحدد الطلبات in-memory لكل serverless instance غير كافٍ.

P1:
- ProgressAnalyticsView يستورد النسخ الاحتياطية عبر StorageService.importBackup مباشرة، متجاوزًا importBackupJournaled؛ SettingsView يستخدم المسار الصحيح. وحّد جميع نقاط الاستيراد.
- PlanLifecycle.resumePlan/recalculatePlan قد يفقدان سجل مهام المراجعة المنفصلة عند إعادة الجدولة.
- QuranLibraryView لديه stale closure في audio.onended وقد يسبب تكرارًا لا نهائيًا.
- TafsirService يستدعي response.json دون التحقق من content type؛ خطأ HTML الحالي لم يُصلح بعد على main.
- AdvisorService يرسل عدد آيات قد يتضاعف بسبب تداخل المقاطع ويخلط completionRate مع retentionScore؛ bestDay ثابت، وسجل المحادثة لا يُستخدم في الخادم.
- Firestore rules لا تفرض server-owned monotonic revision/CAS ولا allowlist دلالية لكل eventType/payload.
- Web Locks مطلوب لإعادة تشغيل journal؛ يجب تحديد دعم المتصفحات أو توفير قفل آمن بديل.

P2:
- QuranMath لا يرفض كل الإحداثيات غير الصحيحة في جميع الدوال.
- تحديث حالة الصفحة قد يعيد ضبط due date/repetition counters.
- PWA reload يحدث مباشرة بعد SKIP_WAITING دون انتظار controllerchange.
- لا يوجد ErrorBoundary واضح في جذر React.
- مؤقت إعادة إرسال التحقق والـ clipboard في AuthScreen يحتاجان تنظيف/معالجة.
- TypeScript strict mode غير مفعل.
- اختبارات كثيرة static source assertions وليست browser integration.
- مستندات checkpoints/roadmaps القديمة متضاربة مع main الحالي.
- Mutashabihat وادعاءات أساليب الحفظ تحتاج مراجعة علمية موثقة.

## 5. طريقة الاستكمال الإلزامية

### أولاً: إغلاق المرحلة 0
1. تحقق من رأس main ورأس فرع التدقيق الحاليين.
2. أكد ملاحظة الأيقونات الثلاثة في التقرير؛ Phase 0 مكتملة بالفعل.
3. تحقق من 147 صفًا في FILE_AUDIT_REGISTER و70 صفًا في baseline matrix، مع 75 فرعًا حيًا الآن.
4. تحقق من أن REMOTE_REPLICATION_PLAN.md موجود ومتوافق مع AGENTS.md.
5. أضف إدخالًا مؤرخًا في docs/engineering/progress/WORK_LOG.md دون تعديل السجل التاريخي.
6. حدّث CONTINUATION_PROMPT وREMEDIATION_PLAN بحالة PRs #61–#64.
7. لا تكرر إصلاحات PRs الحالية؛ تابع P1D QuranMath/domain validation ثم Advisor security design.

### ثانيًا: ابدأ التنفيذ الفعلي مباشرة بعد إغلاق التدقيق
لا تنتظر موافقة جديدة على إصلاحات الكود غير التدميرية. ابدأ حسب docs/audit/2026-11-07/REMEDIATION_PLAN.md:
1. Progress Analytics backup import → journaled path.
2. Plan lifecycle preserve revision-only and partial task history.
3. QuranLibrary repeat counter closure.
4. QuranMath/domain event coordinate validation.
5. Tafsir HTML/non-JSON handling على فرع جديد من main.
6. Advisor metrics/security/history.
7. truthful cloud status.
8. ثم تنفيذ remote inbox/CAS/cursor/conflict/two-device sync.

كل إصلاح في فرع مستقل أو مجموعة صغيرة متماسكة، مع اختبار انحدار واضح. لا تغيّر main مباشرة.

### ثالثًا: سياسة التزامن السحابي
- لا ترفع نص القرآن ضمن بيانات المستخدم.
- لا تستبدل مصفوفة محلية كاملة بصورة Firestore قديمة.
- لا تقر outbox mutation قبل تأكيد remote write والتحقق من event identity/payload.
- لا تتقدم remote cursor قبل تطبيق الحدث محليًا بنجاح.
- لا تسمح بـ LWW على counters/history دون semantics واضحة.
- لا تنفذ deploy لقواعد Firestore أو تغييرات Vercel/production دون موافقة صريحة.
- لا تحذف بيانات المستخدم أو تنفذ migration تدميرية.

## 6. بوابة الجودة لكل milestone

نفّذ وسجّل:
- npm test
- npm run lint
- npm run build
- npm run test:firestore-rules
- npm run smoke:server
- npm audit (أو خطوة CI المكافئة)

تحقق من SHA الدقيق الذي نجحت عليه جميع checks، لا تكتفِ بعبارة CI أخضر لفرع مختلف. إذا فشل فحص، أصلح السبب ثم أعد البوابة كاملة. لا تدمج PR قبل نجاح كل الفحوص المرتبطة برأسه وبعد مراجعة diff.

## 7. حفظ نقاط الاستكمال

بعد كل milestone:
- حدّث FILE_AUDIT_REGISTER بالملاحظة والنتيجة.
- حدّث READINESS_BLOCKERS وحالة كل blocker.
- حدّث REMEDIATION_PLAN وحالة المرحلة.
- حدّث WORK_LOG بإدخال جديد append-only.
- حدّث CONTINUATION_PROMPT إذا تغيرت الفروع أو SHAs.
- احفظ commit على الفرع المناسب.
- سجّل exact HEAD SHA وCI run IDs وPR number إن وجد.
- لا تترك العمل في حالة غير قابلة للاستئناف.

## 8. شكل التقرير عند العودة للمستخدم

اذكر بوضوح:
- ما الملفات/الفروع التي فُحصت بالفعل.
- ما الذي تم تغييره فعليًا وأين.
- ما الاختبارات التي نجحت على أي SHA.
- ما الذي ما زال غير جاهز.
- هل يوجد نشر production مؤكد أم لا.
- رابط GitHub للفرع/PR إن وُجد.

ابدأ الآن بقراءة ملفات التدقيق والتحقق من رؤوس الفروع، ثم أغلق المرحلة 0 وأكمل التنفيذ دون إعادة العمل المنجز.
