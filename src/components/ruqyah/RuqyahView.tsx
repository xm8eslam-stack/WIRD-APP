import React, { useState, useEffect, useRef } from 'react';
import { getRuqyahDisplayText } from '../../services/ruqyahContentService';
import { loadRuqyahProgress } from '../../services/ruqyahProgressService';
import { persistRuqyahProgressSnapshot } from '../../services/journaledSnapshotService';
import { STORAGE_KEYS, StorageService } from '../../services/storageService';
import { RuqyahApiLibrary } from './RuqyahApiLibrary';
import { 
  ShieldCheck, 
  Volume2,
  Headphones,
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  BookOpen, 
  Heart, 
  Info,
} from 'lucide-react';
import { getRuqyahItemsByCategory } from '../../data/ruqyahData';
import type { RuqyahCategory, RuqyahItem } from '../../data/ruqyahData';

interface RuqyahViewProps {
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

const CATEGORY_TABS: { id: RuqyahCategory; label: string; iconName: string; duration: string }[] = [
  { id: 'brief', label: 'الرقية المختصرة', iconName: 'Sparkles', duration: 'مختصر' },
  { id: 'medium', label: 'الرقية المتوسطة', iconName: 'BookOpen', duration: 'متوسط' },
  { id: 'full', label: 'الرقية المطولة الكاملة', iconName: 'ShieldCheck', duration: 'مطول' },
  { id: 'eye_envy', label: 'رقية العين والحسد', iconName: 'Heart', duration: 'حسب المحتوى' },
  { id: 'illness', label: 'رقية المرض والألم', iconName: 'Sparkles', duration: 'حسب المحتوى' },
  { id: 'guidelines', label: 'آداب وإرشادات الرقية', iconName: 'Info', duration: 'إرشادات' },
];

export const RuqyahView: React.FC<RuqyahViewProps> = ({ onToast }) => {
  const currentStorageScope = StorageService.getStorageScope();
  const [activeCategory, setActiveCategory] = useState<RuqyahCategory>('brief');
  const [viewMode, setViewMode] = useState<'interactive' | 'api_library'>('interactive');
  
  // Counter states per item (itemId -> current count)
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [progressDirty, setProgressDirty] = useState(false);
  const [progressScope, setProgressScope] = useState(currentStorageScope);
  const [progressCorrupt, setProgressCorrupt] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);

  const currentItems = getRuqyahItemsByCategory(activeCategory);

  // External reciter catalogue and audio host are intentionally not loaded
  // until their recitation provenance and usage permissions are reviewed.

  // Hydrate progress whenever WIRD switches guest/account storage namespaces.
  useEffect(() => {
    setProgressHydrated(false);
    setProgressCorrupt(false);
    setProgressDirty(false);
    const saved = loadRuqyahProgress();
    if (saved.status === 'corrupt') {
      setCounts({});
      setProgressCorrupt(true);
      if (onToast) onToast('تعذر قراءة تقدم الرقية المحفوظ؛ احتفظنا بالبيانات الأصلية ولم نستبدلها.', 'warn');
    } else {
      setCounts(saved.counts);
    }
    setProgressScope(currentStorageScope);
    setProgressHydrated(true);
  }, [currentStorageScope]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const progressStorageKey = currentStorageScope === 'legacy' || currentStorageScope === 'guest'
      ? STORAGE_KEYS.RUQYAH_PROGRESS
      : `wird_scope_v1:${currentStorageScope}:${STORAGE_KEYS.RUQYAH_PROGRESS}`;
    const refreshProgress = (event?: Event) => {
      if (event && 'key' in event) {
        const changedKey = (event as StorageEvent).key;
        if (changedKey !== null && changedKey !== progressStorageKey) return;
      }
      if (StorageService.getStorageScope() !== currentStorageScope) return;
      const saved = loadRuqyahProgress();
      if (saved.status === 'corrupt') {
        setCounts({});
        setProgressCorrupt(true);
        return;
      }
      setCounts(saved.counts);
      setProgressDirty(false);
    };
    window.addEventListener('wird:ruqyah-progress-updated', refreshProgress);
    window.addEventListener('storage', refreshProgress);
    return () => {
      window.removeEventListener('wird:ruqyah-progress-updated', refreshProgress);
      window.removeEventListener('storage', refreshProgress);
    };
  }, [currentStorageScope]);

  useEffect(() => {
    if (!progressHydrated || !progressDirty || progressCorrupt || progressScope !== currentStorageScope) return;
    let active = true;
    const snapshot = { schemaVersion: 1 as const, updatedAtMs: Date.now(), counts: { ...counts } };
    void persistRuqyahProgressSnapshot(snapshot, { expectedStorageScope: currentStorageScope })
      .then(result => {
        if (active && !result.success && onToast) {
          onToast(result.error || 'تعذر حفظ تقدم الرقية ومزامنته.', 'error');
        }
      })
      .catch(() => {
        if (active && onToast) onToast('تعذر حفظ تقدم الرقية ومزامنته.', 'error');
      });
    return () => { active = false; };
  }, [counts, progressHydrated, progressDirty, progressCorrupt, progressScope, currentStorageScope, onToast]);

  const handleRecoverProgress = () => {
    try {
      setCounts({});
      setProgressCorrupt(false);
      setProgressDirty(true);
      setProgressHydrated(true);
      if (onToast) onToast('جارٍ حفظ إعادة ضبط سجل تقدم الرقية...', 'info');
    } catch {
      if (onToast) onToast('تعذر إعادة ضبط بيانات تقدم الرقية.', 'error');
    }
  };

  // Click counter handler
  const handleItemClick = (item: RuqyahItem) => {
    const current = counts[item.id] || 0;
    if (item.type === 'guideline' || current >= 1000 || (item.repeatTarget !== null && current >= item.repeatTarget)) return;

    const next = current + 1;
    setCounts(prev => ({ ...prev, [item.id]: next }));
    setProgressDirty(true);

    // Haptic feedback if available
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (_) {}
    }

    // Auto-scroll to next card when target reached
    if (item.repeatTarget !== null && next === item.repeatTarget && autoAdvance) {
      const currentIndex = currentItems.findIndex(i => i.id === item.id);
      if (currentIndex !== -1 && currentIndex < currentItems.length - 1) {
        const nextId = currentItems[currentIndex + 1].id;
        setTimeout(() => {
          const el = document.getElementById(`ruqyah-card-${nextId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  };

  const closeResetConfirmation = () => {
    setShowResetConfirmation(false);
    resetTriggerRef.current?.focus();
  };

  // Reset counters for current active category
  const handleResetCategoryCounts = () => {
    if (!progressHydrated || progressCorrupt) return;
    const updated = { ...counts };
    currentItems.forEach(item => {
      delete updated[item.id];
    });
    setCounts(updated);
    setProgressDirty(true);
    closeResetConfirmation();
    if (onToast) onToast('تم إعادة ضبط العدادات لهذه القائمة.', 'info');
  };

  // Calculate section progress
  const trackedItems = currentItems.filter(item => item.type !== 'guideline');
  const completedCount = trackedItems.filter(item => item.repeatTarget === null ? (counts[item.id] || 0) > 0 : (counts[item.id] || 0) >= item.repeatTarget).length;
  const progressPercent = trackedItems.length > 0 ? Math.round((completedCount / trackedItems.length) * 100) : 0;

  return (
    <div className="space-y-8 pb-24 max-w-7xl mx-auto" dir="rtl">
      {progressCorrupt && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            تعذر قراءة تقدم الرقية المحفوظ. احتفظنا بالبيانات الأصلية دون استبدالها؛ يمكنك متابعة القراءة دون حفظ حتى تختار إعادة ضبط هذا السجل.
          </p>
          <button type="button" onClick={handleRecoverProgress} className="shrink-0 rounded-xl bg-amber-200 dark:bg-amber-900 px-3 py-2 text-xs font-bold text-amber-950 dark:text-amber-100">
            إعادة ضبط سجل الرقية
          </button>
        </div>
      )}
      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-emerald-700/50">
        <div className="absolute top-0 left-0 translate-x-[-20%] translate-y-[-20%] w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded-full text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>الرقية من القرآن والسنة</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-quran leading-relaxed">
              الرقية الشرعية الكاملة من القرآن والسنة
            </h1>

            <p className="text-xs md:text-sm text-stone-200/90 leading-relaxed font-sans">
              آيات من القرآن وأدعية ثابتة من السنة. التقسيمات المختصرة والمتوسطة والمطولة تنظيمية للتيسير، وليست ترتيبًا نبويًا أو عددًا لازمًا.
            </p>
          </div>

          {/* Mode Switch Controls */}
          <div role="group" aria-label="طرق استخدام الرقية" className="flex flex-wrap items-center gap-2 p-1 bg-emerald-950/80 rounded-2xl border border-emerald-700/60 shadow-inner self-stretch md:self-auto justify-center">
            <button
              type="button"
              aria-pressed={viewMode === 'interactive'}
              onClick={() => { setShowResetConfirmation(false); setViewMode('interactive'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                viewMode === 'interactive'
                  ? 'bg-amber-400 text-emerald-950 shadow-md scale-[1.02]'
                  : 'text-stone-300 hover:text-white hover:bg-emerald-900/60 '
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>القراءة مع العداد</span>
            </button>

            <button
              type="button"
              disabled
              aria-disabled="true"
              title="سيُتاح بعد التحقق من التسجيل كاملًا ومراجعة مصدره ومحتواه"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-stone-400/70 cursor-not-allowed opacity-60"
            >
              <Headphones className="w-4 h-4" />
              <span>التسجيل الكامل (قيد التحقق)</span>
            </button>

            <button
              type="button"
              aria-pressed={viewMode === 'api_library'}
              onClick={() => { setShowResetConfirmation(false); setViewMode('api_library'); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                viewMode === 'api_library'
                  ? 'bg-amber-400 text-emerald-950 shadow-md scale-[1.02]'
                  : 'text-stone-300 hover:text-white hover:bg-emerald-900/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>المكتبة الموسعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Mode 1: Interactive Reading with Counter */}
      {viewMode === 'interactive' && (
        <div className="space-y-6" onKeyDown={(event) => { if (showResetConfirmation && event.key === 'Escape') { event.preventDefault(); closeResetConfirmation(); } }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
            <div>
              <p className="text-sm font-bold text-stone-800 dark:text-stone-200">التحقق من نص الآيات</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">تُعرض الآيات من مصحف وِرد المعتمد. تشغيل الصوت موقوف حتى اعتماد مصدر موثوق.</p>
            </div>
            <div className="min-w-52 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs text-stone-500 dark:text-stone-400" role="status">
              التلاوة الصوتية قيد التحقق من مصدر التسجيل ونسبته للقارئ
            </div>
          </div>

          {/* Category Tabs Bar */}
          <div role="group" aria-label="تصنيفات الرقية" className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORY_TABS.map(tab => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => { setShowResetConfirmation(false); setActiveCategory(tab.id); }}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isActive
                      ? 'bg-emerald-800 text-amber-200 border-emerald-700 shadow-sm'
                      : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200/80 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.duration !== 'إرشادات' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-amber-400/20 text-amber-200' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                    }`}>
                      {tab.duration}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress Header & Settings Control */}
          {activeCategory !== 'guidelines' && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                  {progressPercent}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                    <span>نسبة إنجاز رقية القسم الحالي</span>
                    <span className="text-stone-500 font-mono tabular-nums">{completedCount} من {trackedItems.length} عناصر</span>
                  </div>
                  <div role="progressbar" aria-label="نسبة إنجاز رقية القسم الحالي" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-700 dark:bg-emerald-500 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 dark:bg-stone-800 dark:border-stone-700"
                  />
                  <span>الانتقال التلقائي للبطاقة التالية عند الإكمال</span>
                </label>

                <button
                  type="button"
                  ref={resetTriggerRef}
                  onClick={() => setShowResetConfirmation(true)}
                  disabled={!progressHydrated || progressCorrupt}
                  aria-expanded={showResetConfirmation}
                  aria-controls="ruqyah-reset-confirmation"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  title={progressCorrupt ? "أعد ضبط سجل الرقية التالف من رسالة الاسترداد أعلاه" : "إعادة ضبط عداد القسم"}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة الضبط</span>
                </button>
              </div>
            </div>
          )}

          {showResetConfirmation && (
            <div id="ruqyah-reset-confirmation" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4" role="group" aria-labelledby="ruqyah-reset-confirmation-title" aria-describedby="ruqyah-reset-confirmation-description" aria-live="polite">
              <div className="min-w-0">
                <p id="ruqyah-reset-confirmation-title" className="text-sm font-bold text-amber-950 dark:text-amber-100">تأكيد إعادة ضبط القسم</p>
                <p id="ruqyah-reset-confirmation-description" className="mt-1 text-xs leading-relaxed text-amber-900 dark:text-amber-200">سيتم تصفير عدادات هذا القسم فقط. لن تتغير نصوص القرآن أو الأدعية أو بيانات الأقسام الأخرى.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={closeResetConfirmation} className="rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-bold text-stone-700 dark:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">إلغاء</button>
                <button type="button" onClick={handleResetCategoryCounts} disabled={!progressHydrated || progressCorrupt} className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">تأكيد إعادة الضبط</button>
              </div>
            </div>
          )}

          {/* Cards List */}
          <div className="space-y-4">
            {currentItems.map((item, idx) => {
              const currentCount = counts[item.id] || 0;
              const isCompleted = item.type !== 'guideline' && (item.repeatTarget === null ? currentCount > 0 : currentCount >= item.repeatTarget);

              return (
                <article
                  key={item.id}
                  id={`ruqyah-card-${item.id}`}
                  className={`group relative bg-white dark:bg-stone-900 rounded-3xl p-6 md:p-7 border transition-all duration-300 ${
                    isCompleted
                      ? 'border-emerald-500/60 dark:border-emerald-700/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs'
                      : 'border-stone-200/90 dark:border-stone-800 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md'
                  }`}
                >
                  {/* Card Top Row: Number, Type badge, Title, Audio Button */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold text-xs flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                            {item.title}
                          </h3>
                          {item.surahName && (
                            <span className="text-[11px] text-emerald-800 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md font-semibold">
                              سورة {item.surahName} [{item.verseRange}]
                            </span>
                          )}
                        </div>
                        {item.source && (
                          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                            المصدر: {item.source}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Audio Play Button for Verse */}
                    {item.type === 'quran' && (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        aria-label={'التلاوة الصوتية قيد التحقق: ' + item.title}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-400 bg-stone-100 dark:bg-stone-800 cursor-not-allowed opacity-70"
                        title="لن يُفعّل التشغيل حتى يتم التحقق من مصدر التسجيل ونسبته للقارئ"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>الصوت قيد التحقق</span>
                      </button>
                    )}
                  </div>

                  {/* Text Content */}
                  <div className="my-4 p-4 rounded-2xl bg-[#faf8f5] dark:bg-stone-950/70 border border-stone-200/50 dark:border-stone-800/80">
                    <p className={`text-base md:text-xl text-stone-800 dark:text-stone-100 leading-loose text-center font-quran ${
                      item.type === 'quran' ? 'tracking-normal' : 'font-sans font-medium'
                    }`}>
                      {getRuqyahDisplayText(item)}
                    </p>
                  </div>

                  {/* Explanation Note */}
                  {item.explanation && (
                    <div className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-100 dark:border-stone-800 mb-4">
                      <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{item.explanation}</p>
                    </div>
                  )}

                  {/* Card Bottom Row: Counter Controls */}
                  {item.type !== 'guideline' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/80 px-3 py-1 rounded-xl">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{item.repeatTarget === null ? 'تم تسجيل القراءة' : `اكتمل التكرار المحدد (${item.repeatTarget})`}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500 font-medium">
                            {item.repeatTarget === null ? 'لا يوجد عدد ثابت؛ سجّل كل قراءة على حدة' : 'سجّل القراءة بعد إتمامها'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        disabled={currentCount >= 1000 || (item.repeatTarget !== null && currentCount >= item.repeatTarget)}
                        aria-label={item.repeatTarget === null
                          ? `تسجيل قراءة جديدة لـ ${item.title}. العدد الحالي ${currentCount}`
                          : `تسجيل قراءة ${item.title}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-500 dark:disabled:bg-stone-800 text-white px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{item.repeatTarget !== null && isCompleted ? 'اكتمل' : currentCount > 0 ? 'تسجيل قراءة أخرى' : 'سجل قراءة'}</span>
                      </button>

                      {/* Repetition Counter Badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-500">{item.repeatTarget === null ? 'عدد القراءات:' : 'المتبقي:'}</span>
                        <div
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          aria-label={item.repeatTarget === null
                            ? `عدد القراءات: ${currentCount}`
                            : `المتبقي: ${Math.max(0, item.repeatTarget - currentCount)} من ${item.repeatTarget}`}
                          className={`px-4 py-2 rounded-2xl font-mono text-sm font-bold transition-all ${
                          isCompleted
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 group-hover:scale-105'
                        }`}>
                          {item.repeatTarget === null ? currentCount + ' قراءة' : Math.max(0, item.repeatTarget - currentCount) + ' / ' + item.repeatTarget}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'api_library' && <RuqyahApiLibrary />}
    </div>
  );
};
