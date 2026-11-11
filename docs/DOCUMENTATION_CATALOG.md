# WIRD — فهرس الوثائق التفصيلي

> جرد للوثائق التي تمت مراجعتها في فرع مركز الوثائق بتاريخ 2026-11-11. أضيفت خطة السيرة كوثيقة تخصصية جديدة. هذا الفهرس يشرح وظيفة الملفات ولا يعني أن كل تفاصيلها أعيد تدقيقها تقنيًا. الحالة التنفيذية الحديثة تؤخذ من `CONTINUE_HERE.md` بعد إعادة جلب GitHub.

## مراجع البدء
- [README.md](./README.md) — خريطة الوثائق.
- [CONTINUE_HERE.md](./CONTINUE_HERE.md) — نقطة الاستكمال.
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) — الخطة الرئيسية.
- [SEERAH_LEARNING_PLAN_AR.md](./SEERAH_LEARNING_PLAN_AR.md) — خطة السيرة النبوية والصحابة وبحث API والمنهج التعليمي.
- [DEVELOPMENT_CHECKPOINT.md](./DEVELOPMENT_CHECKPOINT.md) — أدلة ونقاط التوقف.
- [OWNER_ACTIONS.md](./OWNER_ACTIONS.md) — تدخلات المالك المؤجلة.

## المنتج والمصحف وتجربة الاستخدام
| الملف | الغرض |
|---|---|
| `QURAN_DISPLAY_ENGINEERING.md` | بنية عرض نص القرآن وخيارات المحرك ومراجعة العرض |
| `THIRD_PARTY_QURAN_FACSIMILE.md` | حدود دمج صور/تخطيط المصحف المطبوع ومصدرها وحقوقها |
| `UX_PAGE_AND_TOOL_MAP.md` | خريطة الصفحات والأدوات وتدفقات الاستخدام |
| `UX_PRODUCT_ROADMAP_AR.md` | اتجاه تجربة المنتج بالعربية ومبادئها |
| `SEERAH_LEARNING_PLAN_AR.md` | تصميم مسار السيرة والصحابة، مصادر API، الدروس التفاعلية والاختبارات والمراجعة |

## الهندسة والبحث والأمان
| الملف | الغرض |
|---|---|
| `engineering/AUDIO_SOURCE_ATTRIBUTION.md` | نسب مصادر الصوت وحقوقها |
| `engineering/FIRESTORE_SYNC_DESIGN.md` | تصميم المزامنة السحابية وقيودها |
| `engineering/OPEN_SOURCE_RESEARCH.md` | بحث المشاريع والمكتبات مفتوحة المصدر |
| `engineering/SECURITY_AUDIT.md` | مراجعة الأمان وسلامة البيانات |
| `engineering/IMPLEMENTATION_ROADMAP.md` | خطة هندسية تاريخية تفصيلية؛ الخطة الموحدة الحالية أعلى أولوية |
| `engineering/PROGRESS.md` | سجل تقدم هندسي تاريخي |
| `engineering/WORK_SESSION_CHECKPOINT.md` | نقاط جلسات العمل التاريخية |

## الحالة والسجل والإصدار
| الملف | الغرض |
|---|---|
| `engineering/progress/CONTINUATION_CHECKPOINT_2026-11-06.md` | لقطة استكمال مؤرخة؛ مرجع تاريخي |
| `engineering/progress/CURRENT_STATUS.md` | سجل حالة تاريخي؛ لا تعتمد أرقامه دون إعادة تحقق |
| `engineering/progress/EXTERNAL_SOURCES.md` | سجل المصادر الخارجية والتراخيص |
| `engineering/progress/MASTER_ROADMAP.md` | خارطة هندسية تاريخية |
| `engineering/progress/RELEASE_CHECKLIST.md` | قائمة تحقق الإصدار |
| `engineering/progress/RESUME_HERE.md` | نقطة استكمال تاريخية؛ استخدم `CONTINUE_HERE.md` الحالي |
| `engineering/progress/WORK_LOG.md` | سجل التغييرات والقرارات التاريخي |

## العمل دون اتصال
| الملف | الغرض |
|---|---|
| `offline/OFFLINE_FIRST_ARCHITECTURE.md` | ضمانات العمل دون إنترنت وحدود التخزين المحلي |
| `offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md` | مراحل تنزيل صوت القرآن وتخزينه وتشغيله دون اتصال |
| `offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md` | العقد الموحد المقترح للـ IndexedDB وCache Storage والمهام والملفات والاسترداد |

## الرقية
| الملف | الغرض |
|---|---|
| `ruqyah/ENGINEERING_CHECKPOINT.md` | الحالة الهندسية وتاريخ تنفيذ الرقية |
| `ruqyah/INTEGRATION_SETUP.md` | إعداد التكاملات ومفاتيحها دون نشر الأسرار |
| `ruqyah/RELEASE_CHECKLIST.md` | بوابات إصدار الرقية والتحقق من الصوت والمحتوى |
| `ruqyah/SUNNI_SOURCE_POLICY.md` | سياسة المصادر والمحتوى الشرعي والتحقق |

## المزامنة السحابية
| الملف | الغرض |
|---|---|
| `sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md` | تصميم سجل أحداث النشاط وإسقاطه |
| `sync/ARCHITECTURE.md` | البنية المعمارية للمزامنة |
| `sync/CLOUD_SYNC_AUDIT_2026-11-09.md` | تدقيق المزامنة ونتائج التشغيل المؤرخة |
| `sync/CLOUD_SYNC_WORKLOG.md` | سجل أعمال المزامنة |
| `sync/CONFLICT-RESOLUTION.md` | سياسة فض التعارضات |
| `sync/ENGINEERING-CONTINUITY-2026-11-10.md` | نقطة استمرارية هندسة المزامنة |
| `sync/FAILURE-RECOVERY.md` | الاسترداد من فشل الإسقاط/المزامنة |
| `sync/RELEASE-GATES.md` | شروط اعتماد المزامنة للإصدار |
| `sync/STATE-MACHINE.md` | حالات المزامنة والانتقالات |
| `sync/TEST-MATRIX.md` | مصفوفة الاختبارات والتغطية |

## قواعد استخدام الوثائق
1. عند بدء جلسة جديدة: اقرأ `AGENTS.md` ثم `CONTINUE_HERE.md` ثم الخطة الموحدة.
2. استخدم الملفات التخصصية للمسار الجاري فقط؛ لا تنسخ تفاصيلها إلى ملف جديد دون حاجة.
3. أي ادعاء عن SHA أو PR أو CI أو Production يجب أن يتضمن مرجعًا حديثًا قابلًا للتحقق.
4. عند تحديث تنفيذ ميزة، حدّث ملفها التخصصي وسجل العمل ونقطة الاستكمال؛ لا تترك حالة قديمة تبدو حاضرة.
5. لا تحذف السجلات التاريخية؛ أضف تنبيهًا وروابط للمرجع الموحد عند الحاجة.
6. لا تخزن أسرارًا أو بيانات مستخدمين أو قيم إعدادات حساسة في الوثائق.
