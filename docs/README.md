# وِرد | WIRD — دليل المستودع والوثائق

**آخر مراجعة مباشرة:** 2026-11-14  
**المستودع:** `xm8eslam-stack/WIRD-APP`  
**الفرع المرجعي:** `main`

## ابدأ من هنا

1. [CONTINUE_HERE.md](./CONTINUE_HERE.md) — طابور التنفيذ الحالي والخطوة التالية.
2. [engineering/MASTER_PROJECT_STATE.md](./engineering/MASTER_PROJECT_STATE.md) — الحالة المثبتة من GitHub وVercel وFirebase.
3. [engineering/RELEASE_CHECKLIST.md](./engineering/RELEASE_CHECKLIST.md) — بوابات الإصدار وحالة كل دليل.
4. [engineering/README.md](./engineering/README.md) — فهرس الهندسة والوثائق التخصصية.
5. [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) — خارطة المنتج والميزات.
6. [engineering/WORK_LOG.md](./engineering/WORK_LOG.md) — سجل العمل التاريخي append-only.
7. [agent-handoffs/LATEST-GOOGLE-STUDIO.md](./agent-handoffs/LATEST-GOOGLE-STUDIO.md) — تعليمات تسليم Google AI Studio.

## مصدر الحقيقة

- الحالة المثبتة: `docs/engineering/MASTER_PROJECT_STATE.md`.
- طابور العمل الحي: `docs/CONTINUE_HERE.md`.
- بوابات الإصدار: `docs/engineering/RELEASE_CHECKLIST.md`.
- التاريخ: `docs/engineering/WORK_LOG.md`.
- قواعد العمل: `AGENTS.md` ثم `GEMINI.md`.
- التصميم التخصصي: `docs/sync/`, `docs/offline/`, `docs/ruqyah/`.

## خريطة المجلدات

| المسار | المحتوى |
|---|---|
| `docs/engineering/` | الحالة، المعمارية، الأمان، سجل العمل، بوابات الإصدار |
| `docs/sync/` | تصميم المزامنة والتعارضات والاسترداد والاختبارات |
| `docs/ruqyah/` | مصادر الرقية والتكامل والاختبارات |
| `docs/offline/` | العمل دون اتصال وتنزيل الصوت |
| `docs/agent-handoffs/` | تسليمات الوكلاء وGoogle AI Studio |
| `docs/UX_*.md` | خريطة الصفحات وتجربة الاستخدام |
| `docs/DEVELOPMENT_*.md` | خارطة المنتج ونقاط الاستكمال |

## اصطلاحات الحالة

استخدم فقط: `PASS`, `FAIL`, `BLOCKED`, `NOT VERIFIED`.  
لا تخلط بين MERGED وCI PASS وVercel READY وProduction READY وlive smoke وGoogle AI Studio sync.

## قبل كل جلسة

اقرأ `AGENTS.md` ثم `docs/engineering/MASTER_PROJECT_STATE.md` و`docs/engineering/RELEASE_CHECKLIST.md`. أعد جلب main SHA وPRs وCI وVercel. لا تعتمد على أرقام أو حالات تاريخية دون إعادة التحقق. لا تحذف التاريخ؛ أضف تصحيحًا مؤرخًا أو تحديثًا جديدًا.
