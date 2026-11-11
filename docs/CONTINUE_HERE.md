# WIRD — نقطة الاستكمال الحالية (مصدر الحقيقة)

**آخر مراجعة مباشرة:** 2026-11-11  
**المستودع:** `xm8eslam-stack/WIRD-APP` | **الفرع المرجعي:** `main`  
**آخر SHA لـ main تمت قراءته:** `8dd21522430cc014db4eb5da8437f89c42f190f9`  
**آخر commit:** دمج تحسين إتاحة نوافذ المراجعة PR #353.

## 1) الحالة الحالية — أدلة GitHub
| البند | الحالة | ما نعرفه |
|---|---|---|
| PR #353 | MERGED | دمج commit `8dd2152`; Quality Gate run `43028294037` ناجح على رأس PR |
| Vercel status على main SHA | SUCCESS | GitHub status أخضر؛ لا يثبت وحده أن Production نشر نفس SHA أو أن live smoke نجح |
| Production source SHA | NOT VERIFIED | لا يوجد في هذه المراجعة دليل كافٍ يطابق Production مع `8dd2152` |
| Google AI Studio sync | NOT VERIFIED | يحتاج تحققًا مستقلًا من اتصال المشروع بفرع main |
| PR #360 | IN PROGRESS | فحص WIRD Quality Gate run `43029173230` كان جاريًا؛ فرعه مبني على main أقدم `4b29904` |
| PR #358 | IN PROGRESS | Quality Gate run `43028986222` جارٍ؛ تنفيذ تخزين وظائف/عناصر التنزيل في IndexedDB |
| PR #359 | IN PROGRESS | Quality Gate run `43029617572` جارٍ؛ تنفيذ manifest بيانات الملفات الموثقة |
| PR #356 | IN PROGRESS | Quality Gate run `43029328133` جارٍ؛ تحديث وثائق المزامنة، وقاعدة PR أقدم من main |
| PR #357 | CLOSED | لا تستكمل هذا الفرع؛ قارن ما بقي فيه مع #358/#359 قبل إعادة استخدام أي كود |

GitHub Vercel status ليس دليلًا كافيًا على Production. CI وPreview وProduction وGoogle AI Studio أنظمة منفصلة.

## 2) طابور PR الحالي
| PR | المجال | الخطوة الآمنة التالية |
|---|---|---|
| #360 | مركز الوثائق والخطة | استكمال فحص exact-head؛ تحديث الحالة إلى SHA الحالي؛ مراجعة التداخل مع #356 |
| #358 | تخزين وظائف التنزيل وعناصر الآيات | مراجعة الذرية، idempotency، الإلغاء، إعادة الفتح، والتحقق من URL/الإحداثيات |
| #359 | manifest بيانات الصوت الموثق | مراجعة التكامل مع Cache Storage و#358؛ لا تدمج تنفيذين متداخلين دون تصميم موحد |
| #356 | سجل وتصميم المزامنة | مراجعة فروق الوثائق بعد تحديث المركز الموحد؛ إعادة تقييم قاعدة PR القديمة |
| #353 | إتاحة نوافذ المراجعة | مدمج؛ لا تكرر تنفيذه |

### ملاحظة مهمة حول #358 و#359
الفرعان يضيفان طبقة IndexedDB متداخلة لمعلومات تنزيل الصوت، لكنهما ليسا متطابقين:
- #358 يخزن jobs وحالاتها وعناصر الآيات والتقدم.
- #359 يخزن metadata للملفات التي تم التحقق منها، ويذكر أن bytes في Cache Storage.
يجب اختيار نموذج تخزين واحد متكامل أو توحيدهما بواجهات واضحة، مع قاعدة بيانات/مخطط إصدار متوافق. لا تدمج كليهما كما هما لمجرد نجاح CI.

## 3) ترتيب التنفيذ
1. إنهاء فحوص PRs المفتوحة ومراجعة exact SHA؛ إصلاح فشل حقيقي فقط وإعادة تشغيل الفحص المتأثر.
2. حسم تصميم offline audio manifest/jobs/cache قبل إضافة downloader أو UI.
3. بناء تنزيل محدود بطلب المستخدم، تحقق فعلي من الملف، إلغاء/استئناف، إدارة quota والمساحة، ثم playback offline.
4. إعادة اختبار الرقية: فهرس الآيات و500/502، نص الآيات من corpus المحلي فقط، ومراجعة حقوق التسجيلات القصيرة/المتوسطة/الطويلة.
5. مواصلة المصحف والصوت: التشغيل المتصل، السرعة والتكرار والتنقل ومنع تعدد المشغلات.
6. المزامنة: activity events، tombstones وanti-resurrection وgrouped syncMeta؛ إبقاء المسارات غير المدعومة fail-closed.
7. UX صفحة صفحة وفق `UX_PAGE_AND_TOOL_MAP.md`.
8. الأذكار والورد اليومي بعد بحث المصادر والتراخيص والتكلفة والخصوصية وoffline.

## 4) ثوابت وقيود لا تتغير
- القرآن المحلي الموثق هو المرجع؛ لا توليد أو تصحيح أو استبدال بنص API.
- التفسير والحديث والرقية بمصادر معروفة وإسناد واضح.
- المنتج قرآن وورد يومي، لا بوابة إسلامية عامة.
- Local-first وحماية البيانات أولوية.
- لا دمج قبل مراجعة diff ونجاح Quality Gate على exact SHA، مع التأكد من عدم وجود تعارضات أو مراجعات مانعة.
- لا Force push ولا تعديل مباشر على main.
- لا نشر يدوي أو تغيير Firebase/Vercel/Secrets/Production flags أو بيانات حقيقية دون تفويض صريح.
- اشتغل على المسارات المستقلة بالتوازي؛ لا توقف العمل لمجرد انتظار CI، لكن لا تدّع اجتيازه قبل ظهور النتيجة.

## 5) ملفات كل مسار
- Sync: `docs/sync/ARCHITECTURE.md`, `RELEASE-GATES.md`, `TEST-MATRIX.md`, `ACTIVITY_EVENT_PROJECTION_DESIGN.md`.
- Ruqyah: `docs/ruqyah/ENGINEERING_CHECKPOINT.md`, `RELEASE_CHECKLIST.md`, `SUNNI_SOURCE_POLICY.md`.
- Mushaf/UX: `docs/QURAN_DISPLAY_ENGINEERING.md`, `docs/UX_PAGE_AND_TOOL_MAP.md`.
- Offline audio: `docs/offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md`, `OFFLINE_FIRST_ARCHITECTURE.md`.
- Documentation: `docs/README.md`, `docs/DOCUMENTATION_CATALOG.md`.
- History: `docs/engineering/progress/WORK_LOG.md`.

## 6) مهام المالك المؤجلة
راجع `OWNER_ACTIONS.md`. لا تطلب تدخل المالك في خطوات يمكن أتمتتها أو التحقق منها آليًا. لا تغيّر إعدادات الإنتاج أو الأسرار أثناء انتظار أي خطوة.

## 7) عند بدء الجلسة التالية
- [ ] أعد جلب main SHA وPRs المفتوحة؛ لا تعتمد على هذه اللقطة وحدها.
- [ ] افحص حالة Quality Gate لكل رأس PR على حدة.
- [ ] تأكد من نتيجة post-merge على main بعد دمج #353.
- [ ] تحقق من Production source SHA وlive smoke بشكل منفصل.
- [ ] حدّث هذا الملف والخطة بعد كل دفعة، وسجّل SHA/run الفعليين.
