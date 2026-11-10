import React, { useEffect, useState } from 'react';
import { 
  Play, 
  Repeat, 
  CheckCircle, 
  Flame, 
  Calendar, 
  ArrowLeft, 
  BookOpen, 
  Check, 
  Compass,
  Clock
} from 'lucide-react';
import { 
  UserProfile, 
  MemorizationPlan, 
  RevisionItem, 
  DailyLog 
} from '../../types/quran';
import { TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES, ALL_SURAHS } from '../../data/quranMeta';
import { NavTabId } from '../layout/Sidebar';
import { RetentionService } from '../../services/retentionService';
import { StorageService } from '../../services/storageService';
import { loadAyahByCoordinate, getAyahDisplayText } from '../../data/quranDataLoader';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { getDailySessionSelection } from '../../services/dailySessionSelection';
import { getPagesForAyahRange } from '../../services/pageProgressService';
import { QuranText } from '../shared/QuranText';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import { WirdSymbol } from '../brand/WirdLogo';

interface DashboardViewProps {
  profile: UserProfile;
  plans: MemorizationPlan[];
  revisionItems: RevisionItem[];
  logs: DailyLog[];
  onNavigate: (tab: NavTabId) => void;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number, mode?: 'memorize' | 'review') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  plans,
  revisionItems,
  logs,
  onNavigate,
  onStartSession
}) => {
  const [dailyPreviewText, setDailyPreviewText] = useState('جارٍ تحميل نص الآية...');
  // Choose one truthful task from the active plan, due revisions, or next uncovered range.
  const todayStr = getLocalDateString();
  const queueDetails = RetentionService.getDailyRevisionQueueDetails(todayStr);
  const queuePortions = queueDetails.queue;
  const totalDueCount = queueDetails.totalDueCount;
  const minorRevisionsCount = queuePortions.filter(p => (p.revisionType || 'minor') === 'minor').length;
  const majorRevisionsCount = queuePortions.filter(p => p.revisionType === 'major').length;

  // 1. Truthful overall statistics (computed from real memorized portions)
  const retentionMetrics = RetentionService.getRetentionDashboardMetrics();
  const totalMemorizedAyahs = retentionMetrics.totalMemorizedAyahs;
  const totalMemorizedPages = retentionMetrics.totalMemorizedPages;
  const versesPercentage = TOTAL_QURAN_VERSES > 0 ? ((totalMemorizedAyahs / TOTAL_QURAN_VERSES) * 100).toFixed(1) : '0.0';
  const pagesPercentage = TOTAL_QURAN_PAGES > 0 ? ((totalMemorizedPages / TOTAL_QURAN_PAGES) * 100).toFixed(1) : '0.0';
  const retentionScore = retentionMetrics.retentionScorePercentage;
  const retentionStatusLabel = retentionScore >= 80
    ? `ممتاز (${retentionScore}%)`
    : retentionScore >= 50
      ? `جيد (${retentionScore}%)`
      : `قيد البناء (${retentionScore}%)`;

  const selection = getDailySessionSelection(
    plans,
    StorageService.getEnginePlans(),
    RetentionService.getPortions(),
    todayStr
  );

  const selectedPages = selection.kind === 'session'
    ? getPagesForAyahRange(selection.surahNumber, selection.startAyah, selection.endAyah)
    : [];
  const dailyTask = selection.kind === 'session'
    ? {
        ...selection,
        surahName: ALL_SURAHS.find(surah => surah.number === selection.surahNumber)?.name || `سورة ${selection.surahNumber}`,
        versesCount: selection.endAyah - selection.startAyah + 1,
        pageNumber: selectedPages[0] || 1,
        pagesCount: selectedPages.length
      }
    : {
        kind: 'blocked' as const,
        mode: 'memorize' as const,
        source: 'blocked' as const,
        surahNumber: 1,
        surahName: '—',
        startAyah: 1,
        endAyah: 1,
        versesCount: 0,
        pageNumber: 0,
        pagesCount: 0,
        label: selection.messageAr
      };

  // The selected review is already shown as today's primary task; avoid listing it twice.
  const displayedQueuePortions = dailyTask.source === 'revision'
    ? queuePortions.filter(item => !(
        item.surahNumber === dailyTask.surahNumber &&
        item.startAyah === dailyTask.startAyah &&
        item.endAyah === dailyTask.endAyah
      ))
    : queuePortions;

  useEffect(() => {
    let cancelled = false;
    if (dailyTask.source === 'blocked') {
      setDailyPreviewText(dailyTask.label);
      return () => { cancelled = true; };
    }
    setDailyPreviewText('جارٍ تحميل نص الآية...');
    loadAyahByCoordinate(dailyTask.surahNumber, dailyTask.startAyah)
      .then(ayah => {
        if (cancelled) return;
        if (!ayah?.text) { setDailyPreviewText('تعذر تحميل معاينة الآية حالياً.'); return; }
        getAyahDisplayText(ayah)
          .then(simpleText => { if (!cancelled) setDailyPreviewText('«' + simpleText + '»'); })
          .catch(() => { if (!cancelled) setDailyPreviewText('تعذر تحميل النص الإملائي المعتمد حالياً.'); });
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('[WIRD Dashboard] Could not load ayah preview:', error);
          setDailyPreviewText('تعذر تحميل معاينة الآية حالياً.');
        }
      });
    return () => { cancelled = true; };
  }, [dailyTask.source, dailyTask.surahNumber, dailyTask.startAyah, dailyTask.endAyah, dailyTask.label]);

  // Weekly stats
  const last7Logs = logs.slice(-7);
  const totalWeeklyMinutes = last7Logs.reduce((acc, curr) => acc + curr.minutesSpent, 0);
  const totalWeeklyAyahs = last7Logs.reduce((acc, curr) => acc + curr.memorizedAyahsCount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Personalized Welcome & Daily Ayah Banner with Master Visual Identity */}
      <section className="relative bg-gradient-to-l from-[#0B132B] via-[#0E1E38] to-[#1C4E46] text-white rounded-3xl p-6 md:p-8 shadow-md overflow-hidden border border-[#C59B27]/35">
        {/* Authentic Islamic geometric watermark */}
        <WirdIslamicPattern opacity={0.06} variant="gold" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl text-right">
            <div className="flex items-center gap-2 text-[#F2EDE2] text-xs font-semibold">
              <span className="w-6 h-6 rounded-lg bg-[#C59B27]/20 border border-[#C59B27]/30 flex items-center justify-center shrink-0">
                <WirdSymbol size={16} variant="gold" />
              </span>
              <span>وِردك القرآني اليومي رِفعةٌ لدرجاتك في الجنة</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight font-quran text-[#F5F1E8] leading-tight">
              السلام عليكم ورحمة الله، {profile.name}
            </h2>
            <p className="text-[#F2EDE2]/90 text-sm md:text-base leading-relaxed font-quran pt-1">
              «وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ» — استعن بالله وابدأ وِردك ليظل كتاب الله غضاً طرياً في صدرك.
            </p>
          </div>


        </div>
      </section>

      {/* 2. Primary Focus: Clear Distinction Between New Memorization vs. Revision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NEW MEMORIZATION CARD (الحفظ الجديد) */}
        <div className="bg-white dark:bg-[#122723] rounded-2xl p-6 border border-[#102D29]/10 dark:border-[#E8DFC9]/10 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#102D29]/8 dark:border-[#E8DFC9]/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#102D29]/10 dark:bg-[#1D4940] text-[#102D29] dark:text-[#E8DFC9] flex items-center justify-center border border-[#B99B62]/20">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#29332F] dark:text-[#F6F3EA]">
                    {dailyTask.source === 'blocked' ? 'تحتاج خطتك إلى نطاق محدد' : dailyTask.mode === 'review' ? 'المراجعة المستحقة' : 'الحفظ الجديد (الورد اليومي)'}
                  </h3>
                  <p className="text-xs text-[#62726B] dark:text-[#9BB0A7]">
                    {dailyTask.label}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 bg-[#E8DFC9]/50 dark:bg-[#18332E] text-[#102D29] dark:text-[#E8DFC9] rounded-lg border border-[#B99B62]/30">
                مستهدف اليوم
              </span>
            </div>

            <div className="bg-[#F6F3EA] dark:bg-[#0D1C19]/80 rounded-xl p-4 border border-[#B99B62]/25 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#62726B] dark:text-[#9BB0A7]">السورة والآيات:</div>
                  <div className="text-lg font-bold text-[#102D29] dark:text-[#E8DFC9] font-quran">
                    {dailyTask.source === 'blocked' ? dailyTask.label : `سورة ${dailyTask.surahName} • الآيات (${dailyTask.startAyah} - ${dailyTask.endAyah})`}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs text-[#62726B] dark:text-[#9BB0A7]">الكمية المقررة:</div>
                  <div className="text-sm font-bold text-[#29332F] dark:text-[#F6F3EA] font-mono tabular-nums">
                    {dailyTask.source === 'blocked' ? '—' : dailyTask.mode === 'review' ? `${dailyTask.versesCount} آيات • ${dailyTask.pagesCount} صفحات` : `${dailyTask.versesCount} آيات (صفحة ${dailyTask.pageNumber})`}
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#29332F] dark:text-[#F6F3EA] font-quran text-base leading-loose bg-white dark:bg-[#122723] p-3.5 rounded-lg border border-[#B99B62]/20 text-right shadow-2xs">
                <QuranText>{dailyPreviewText}</QuranText>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#62726B] dark:text-[#9BB0A7]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#B99B62]" />
                <span>المدة: <strong className="text-[#29332F] dark:text-[#F6F3EA]">تختلف حسب مقدار الورد وسرعة التسميع</strong></span>
              </div>
              <div>
                <span>طريقة الجلسة: <strong className="text-[#102D29] dark:text-[#E8DFC9]">{dailyTask.source === 'blocked' ? 'لا توجد جلسة تلقائية' : dailyTask.mode === 'review' ? 'مراجعة وتسميع وتثبيت' : `التكرار ${profile.repetitionTarget} مرات مع الإخفاء`}</strong></span>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#102D29]/8 dark:border-[#E8DFC9]/8 flex flex-col sm:flex-row items-center gap-3">
            <button
              disabled={dailyTask.source === 'blocked'}
              onClick={() => onStartSession(dailyTask.surahNumber, dailyTask.startAyah, dailyTask.endAyah, dailyTask.mode)}
              className="flex-1 w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#102D29] hover:bg-[#1D4940] text-white font-bold text-xs md:text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-[#B99B62]/30"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{dailyTask.source === 'blocked' ? 'اختر نطاق الخطة' : dailyTask.mode === 'review' ? 'بدء جلسة المراجعة التفاعلية' : 'بدء جلسة الحفظ التفاعلية'}</span>
            </button>
            <button
              onClick={() => onNavigate('library')}
              className="w-full sm:w-auto px-4 py-3 bg-[#E8DFC9]/40 hover:bg-[#E8DFC9]/80 dark:bg-[#18332E] dark:hover:bg-[#20403a] text-[#29332F] dark:text-[#F6F3EA] font-semibold text-xs md:text-sm rounded-xl transition-colors border border-[#102D29]/10 dark:border-[#E8DFC9]/10"
              title="تصفح المصحف واختيار سورة أخرى يدوياً"
            >
              سورة أخرى
            </button>
          </div>
        </div>

        {/* REVISION CARD (المراجعة والتثبيت) */}
        <div className="bg-white dark:bg-[#122723] rounded-2xl p-6 border border-[#102D29]/10 dark:border-[#E8DFC9]/10 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#102D29]/8 dark:border-[#E8DFC9]/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#B99B62]/20 dark:bg-[#B99B62]/20 text-[#B99B62] flex items-center justify-center border border-[#B99B62]/30">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#29332F] dark:text-[#F6F3EA]">
                    المراجعة والتثبيت (التكرار المتباعد)
                  </h3>
                  <p className="text-xs text-[#62726B] dark:text-[#9BB0A7]">
                    المراجعة الصغرى (الحديثة) والكبرى (التراكمية)
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 bg-[#B99B62]/15 text-[#102D29] dark:text-[#E8DFC9] rounded-lg border border-[#B99B62]/35">
                {totalDueCount} مهام مستحقة
              </span>
            </div>

            <div className="space-y-2.5">
              {displayedQueuePortions.slice(0, 3).map((item) => (
                <div 
                  key={item.id}
                  className="p-3.5 bg-[#faf8f5] dark:bg-stone-900/60 rounded-xl border border-stone-200/60 dark:border-stone-700/60 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 text-right">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 dark:text-stone-100 text-sm font-quran">
                        سورة {item.surahName}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        item.revisionType === 'major' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' 
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}>
                        {item.revisionType === 'major' ? 'مراجعة كبرى' : 'مراجعة صغرى'}
                      </span>
                    </div>
                    <div className="text-stone-500 dark:text-stone-400">
                      الآيات ({item.startAyah} - {item.endAyah}) {item.pageNumber && `· صفحة ${item.pageNumber}`}
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('revision')}
                    className="px-3.5 py-1.5 bg-stone-100 dark:bg-stone-700 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-stone-800 dark:text-stone-200 hover:text-emerald-900 dark:hover:text-emerald-300 rounded-lg font-semibold transition-colors"
                  >
                    مراجعة
                  </button>
                </div>
              ))}

              {displayedQueuePortions.length === 0 && (
                <div className="text-center py-6 text-stone-500 text-xs space-y-1">
                  <Check className="w-6 h-6 text-emerald-600 mx-auto" />
                  <p>{totalDueCount > 0 ? 'جلسة اليوم تعرض المراجعة ذات الأولوية؛ لا توجد مهام أخرى في القائمة.' : 'أتممت جميع مهام المراجعة لليوم، بارك الله فيك!'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-xs">
            <span className="text-stone-500 dark:text-stone-400">
              صغرى: {minorRevisionsCount} · كبرى: {majorRevisionsCount}
            </span>
            <button
              onClick={() => onNavigate('revision')}
              className="text-amber-700 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>فتح مركز المراجعة الكامل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Overall Quran Progress & Active Plan Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Verses */}
        <div className="bg-white dark:bg-[#122723] rounded-2xl p-5 border border-[#102D29]/10 dark:border-[#E8DFC9]/10 shadow-xs">
          <div className="text-xs text-[#62726B] dark:text-[#9BB0A7] mb-1">الآيات المحفوظة</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#29332F] dark:text-[#F6F3EA] tabular-nums font-mono">
              {totalMemorizedAyahs}
            </span>
            <span className="text-xs text-[#62726B] dark:text-[#9BB0A7] tabular-nums font-mono">من {TOTAL_QURAN_VERSES}</span>
          </div>
          <div className="w-full bg-[#E8DFC9]/40 dark:bg-[#18332E] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#102D29] dark:bg-[#1D4940] h-full rounded-full" style={{ width: `${versesPercentage}%` }} />
          </div>
          <div className="text-[11px] text-[#1D4940] dark:text-[#C8AD73] mt-1.5 font-medium">
            {versesPercentage}% من مجموع آيات القرآن
          </div>
        </div>

        {/* Metric 2: Pages */}
        <div className="bg-white dark:bg-[#122723] rounded-2xl p-5 border border-[#102D29]/10 dark:border-[#E8DFC9]/10 shadow-xs">
          <div className="text-xs text-[#62726B] dark:text-[#9BB0A7] mb-1">الصفحات المحفوظة بالكامل</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#29332F] dark:text-[#F6F3EA] tabular-nums font-mono">
              {totalMemorizedPages}
            </span>
            <span className="text-xs text-[#62726B] dark:text-[#9BB0A7] tabular-nums font-mono">من {TOTAL_QURAN_PAGES} صفحة</span>
          </div>
          <div className="w-full bg-[#E8DFC9]/40 dark:bg-[#18332E] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#B99B62] h-full rounded-full" style={{ width: `${pagesPercentage}%` }} />
          </div>
          <div className="text-[11px] text-[#B99B62] dark:text-[#C8AD73] mt-1.5 font-medium">
            {pagesPercentage}% إنجاز المصحف الشريف
          </div>
        </div>

        {/* Metric 3: Weekly Activity */}
        <div className="bg-white dark:bg-[#122723] rounded-2xl p-5 border border-[#102D29]/10 dark:border-[#E8DFC9]/10 shadow-xs">
          <div className="text-xs text-[#62726B] dark:text-[#9BB0A7] mb-1">نشاط هذا الأسبوع</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#29332F] dark:text-[#F6F3EA] tabular-nums font-mono">
              {totalWeeklyMinutes}
            </span>
            <span className="text-xs text-[#62726B] dark:text-[#9BB0A7]">دقيقة حفظ ومراجعة</span>
          </div>
          <div className="text-[11px] text-[#62726B] dark:text-[#9BB0A7] mt-3 font-medium">
            تم حفظ <strong className="text-[#102D29] dark:text-[#E8DFC9]">{totalWeeklyAyahs} آية</strong> جديدة
          </div>
        </div>

        {/* Metric 4: Streak */}
        <div className="bg-white dark:bg-[#122723] rounded-2xl p-5 border border-[#102D29]/10 dark:border-[#E8DFC9]/10 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-[#62726B] dark:text-[#9BB0A7] mb-1 flex items-center justify-between">
              <span>سلسلة الالتزام</span>
              <Flame className="w-4 h-4 text-[#B99B62] fill-[#B99B62]/30" />
            </div>
            <div className="text-2xl font-bold text-[#B99B62] dark:text-[#C8AD73] tabular-nums font-mono">
              {profile.streakDays} يوماً متواصلاً
            </div>
          </div>
          <div className="text-[11px] text-[#62726B] dark:text-[#9BB0A7] mt-2">
            مستوى التثبيت الحالي: <strong className="text-[#102D29] dark:text-[#E8DFC9]">{retentionStatusLabel}</strong>
          </div>
        </div>
      </div>

      {/* 4. Weekly Activity Chart & Quick Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                سجل النشاط الأسبوعي (الدقائق والآيات)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                انتظامك اليومي هو سر رسوخ المحفوظ في الصدر
              </p>
            </div>
            <span className="text-xs text-stone-500 font-mono">آخر 7 أيام</span>
          </div>

          <div className="flex items-end justify-between gap-3 h-40 pt-4 border-b border-stone-100 dark:border-stone-700">
            {last7Logs.map((log, idx) => {
              const maxMinutes = 50;
              const heightPercent = Math.min(100, Math.round((log.minutesSpent / maxMinutes) * 100));
              const dayName = new Date(log.date).toLocaleDateString('ar-SA', { weekday: 'short' });

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-stone-900 text-white text-[10px] py-1 px-2 rounded-md whitespace-nowrap pointer-events-none z-20 font-mono">
                    {log.minutesSpent}د · {log.memorizedAyahsCount} آيات
                  </div>

                  <div className="text-[10px] text-stone-400 font-mono tabular-nums">
                    {log.minutesSpent}د
                  </div>
                  <div className="w-full max-w-[32px] bg-stone-100 dark:bg-stone-700 rounded-t-lg overflow-hidden h-full flex items-end">
                    <div 
                      className="w-full bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-t-lg transition-all duration-300"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                    {dayName}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 text-xs text-stone-500">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700 inline-block" />
              <span>جلسات الحفظ والمراجعة (بالدقائق)</span>
            </div>
            <button
              onClick={() => onNavigate('progress')}
              className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>عرض تفاصيل المصحف والتقارير</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Actions Hub */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100 mb-1">
              إجراءات سريعة
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
              أدوات تفاعلية لدعم رحلة حفظك
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => onNavigate('tests')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#faf8f5] dark:bg-stone-900/50 hover:bg-stone-100 dark:hover:bg-stone-700/60 border border-stone-200/70 dark:border-stone-700/60 transition-colors text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">اختبر حفظك الآن</div>
                    <div className="text-[11px] text-stone-500">أكمل الآية، المتشابهات اللفظية</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => onNavigate('library')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#faf8f5] dark:bg-stone-900/50 hover:bg-stone-100 dark:hover:bg-stone-700/60 border border-stone-200/70 dark:border-stone-700/60 transition-colors text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">تصفح المصحف والمكتبة</div>
                    <div className="text-[11px] text-stone-500">114 سورة مع الاستماع والتفسير</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => onNavigate('plans')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#faf8f5] dark:bg-stone-900/50 hover:bg-stone-100 dark:hover:bg-stone-700/60 border border-stone-200/70 dark:border-stone-700/60 transition-colors text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">إدارة خطط الحفظ</div>
                    <div className="text-[11px] text-stone-500">إنشاء خطة مخصصة أو تفعيل نموذج</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => onNavigate('advisor')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#faf8f5] dark:bg-stone-900/50 hover:bg-stone-100 dark:hover:bg-stone-700/60 border border-stone-200/70 dark:border-stone-700/60 transition-colors text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">المستشار القرآني</div>
                    <div className="text-[11px] text-stone-500">نصائح التثبيت وعلاج التفلت</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-stone-400" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
