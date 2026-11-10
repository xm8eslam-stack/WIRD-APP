import React, { useState } from 'react';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  Edit3, 
  Info, 
  TrendingUp, 
  BookOpen, 
  Layers, 
  Check, 
  X,
  AlertTriangle,
  Trash2,
  Eye
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { PlanningEngine, PlanGenerationInput, EngineGeneratedPlan, ScheduledDayPlan } from '../../services/planningEngine';
import { PlanLifecycle } from '../../services/planLifecycle';
import { QuranMath } from '../../services/quranMath';

interface PlanningEngineWizardProps {
  enginePlans: EngineGeneratedPlan[];
  onUpdateEnginePlans: (plans: EngineGeneratedPlan[]) => boolean | Promise<boolean>;
  onStartSession: (surahNumber: number, startAyah: number, endAyah: number) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

const WEEK_DAYS = [
  { id: 6, label: 'السبت' },
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الإثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
];

export const PlanningEngineWizard: React.FC<PlanningEngineWizardProps> = ({
  enginePlans,
  onUpdateEnginePlans,
  onStartSession,
  onToast
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(enginePlans[0]?.id || '');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'daily' | 'weekly' | 'all'>('weekly');
  const [editingTask, setEditingTask] = useState<ScheduledDayPlan | null>(null);
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<EngineGeneratedPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  // Active selected plan
  const activePlan = enginePlans.find(p => p.id === selectedPlanId) || enginePlans[0];

  // Form State for new Plan Generation
  const [planTitle, setPlanTitle] = useState('');
  const [startSurah, setStartSurah] = useState<number>(67); // Al-Mulk
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endSurah, setEndSurah] = useState<number>(67);
  const [endAyah, setEndAyah] = useState<number>(30);
  const [startDate, setStartDate] = useState(PlanningEngine.formatDate(new Date()));
  const [targetEndDate, setTargetEndDate] = useState('');
  const [level, setLevel] = useState<PlanGenerationInput['level']>('intermediate');
  const [dailyAvailableMinutes, setDailyAvailableMinutes] = useState<number>(30);
  const [dailyRevisionMinutes, setDailyRevisionMinutes] = useState<number>(15);
  const [paceType, setPaceType] = useState<PlanGenerationInput['paceType']>('verses_per_day');
  const [paceQuantity, setPaceQuantity] = useState<number>(5);
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 6]); // Sun-Thu + Sat
  const [restDays, setRestDays] = useState<number[]>([5]); // Friday
  const [schedulePref, setSchedulePref] = useState<'single_session' | 'morning_evening'>('single_session');
  
  // Selected existing memorized portions for major revision
  const [selectedExistingSurahs, setSelectedExistingSurahs] = useState<number[]>([]);
  const [surahToAdd, setSurahToAdd] = useState<number>(1);

  // Max verses for current start & end surah
  const startSurahMeta = ALL_SURAHS.find(s => s.number === startSurah);
  const endSurahMeta = ALL_SURAHS.find(s => s.number === endSurah);

  // Live total verses count
  const liveTotalVerses = QuranMath.countVersesBetween(
    { surahNumber: startSurah, ayahNumber: startAyah },
    { surahNumber: endSurah, ayahNumber: endAyah }
  );

  // Keep the feasibility indicator aligned with the selected pacing strategy.
  const liveDailyPaceVerses = paceType === 'pages_per_day'
    ? Math.max(1, Math.round(paceQuantity * 15))
    : paceType === 'by_target_date'
      ? Math.max(1, Math.ceil(
          liveTotalVerses / Math.max(1, PlanningEngine.countActiveDaysBetween(
            startDate, targetEndDate && targetEndDate > startDate ? targetEndDate : startDate,
            activeDays, restDays
          ))
        ))
      : paceQuantity;

  const liveFeasibility = PlanningEngine.assessFeasibility(
    liveDailyPaceVerses,
    level,
    dailyAvailableMinutes,
    dailyRevisionMinutes
  );

  // Toggle active days
  const handleToggleActiveDay = (dayId: number) => {
    if (activeDays.includes(dayId)) {
      if (activeDays.length > 1) {
        setActiveDays(activeDays.filter(d => d !== dayId));
        if (!restDays.includes(dayId)) {
          setRestDays([...restDays, dayId]);
        }
      }
    } else {
      setActiveDays([...activeDays, dayId]);
      setRestDays(restDays.filter(d => d !== dayId));
    }
  };

  // Build generation input
  const buildPlanInput = (): PlanGenerationInput => {
    const existingPortions = selectedExistingSurahs.map(sNum => {
      const s = ALL_SURAHS.find(item => item.number === sNum);
      return {
        surahNumber: sNum,
        startAyah: 1,
        endAyah: s ? s.versesCount : 10
      };
    });

    const safeTargetEndDate = (paceType === 'by_target_date' && targetEndDate && targetEndDate.trim())
      ? targetEndDate.trim()
      : undefined;

    return {
      title: planTitle.trim() || `خطة حفظ سورة ${startSurahMeta?.name || 'القرآن'}`,
      startSurah,
      startAyah,
      endSurah,
      endAyah,
      startDate,
      targetEndDate: safeTargetEndDate,
      level,
      dailyAvailableMinutes,
      dailyRevisionMinutes,
      paceType,
      paceQuantity: paceType === 'by_target_date' ? (paceQuantity || 1) : paceQuantity,
      activeDays,
      restDays,
      schedulePreference: schedulePref,
      existingMemorized: existingPortions
    };
  };

  // Preview plan before final save
  const handlePreviewPlan = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (paceType === 'by_target_date') {
        if (!targetEndDate || !targetEndDate.trim()) {
          onToast?.('يرجى تحديد تاريخ الختم المستهدف أولاً.', 'error');
          return;
        }
        if (targetEndDate.trim() <= startDate) {
          onToast?.('تاريخ الختم المستهدف يجب أن يكون بعد تاريخ البداية.', 'error');
          return;
        }
      }
      const input = buildPlanInput();
      const generated = PlanningEngine.generatePlan(input);
      setPreviewPlan(generated);
      onToast?.('تم إعداد المعاينة للجدول الزمني. يمكنك مراجعتها قبل التأكيد.', 'info');
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر إعداد المعاينة. راجع المدخلات وحاول مجدداً.',
        'error'
      );
    }
  };

  // Submit and save plan permanently
  const handleSaveConfirmedPlan = async (planToSave: EngineGeneratedPlan) => {
    if (isGeneratingPlan) return;
    setIsGeneratingPlan(true);

    try {
      const updated = [planToSave, ...enginePlans.filter(plan => plan.id !== planToSave.id)];
      const serializedSnapshot = JSON.stringify({ records: updated });
      const snapshotBytes = new TextEncoder().encode(serializedSnapshot).length;
      if (snapshotBytes > 450_000) {
        onToast?.('هذه الخطة أكبر من الحد الآمن للمزامنة (450 كيلوبايت). قلّل نطاق الخطة أو زد مقدار الحفظ اليومي قبل اعتمادها؛ لم نفقد أي بيانات.', 'error');
        return;
      }
      if (!await onUpdateEnginePlans(updated)) return;
      setSelectedPlanId(planToSave.id);
      setIsCreatingNew(false);
      setPreviewPlan(null);
      onToast?.('تم حفظ الخطة الذكية وتفعيلها بنجاح.', 'success');
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر حفظ الخطة. حاول مجدداً.',
        'error'
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Delete engine plan
  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return;
    const remaining = enginePlans.filter(p => p.id !== planToDelete);
    if (!await onUpdateEnginePlans(remaining)) return;
    setSelectedPlanId(remaining[0]?.id || '');
    setPlanToDelete(null);
    onToast?.('تم حذف الخطة من قائمتك بنجاح.', 'info');
  };

  // Plan Pause / Resume toggle
  const handleTogglePause = async () => {
    if (!activePlan) return;
    let updated: EngineGeneratedPlan;
    if (activePlan.isPaused) {
      updated = PlanLifecycle.resumePlan(activePlan);
    } else {
      updated = PlanLifecycle.pausePlan(activePlan);
    }
    if (!await onUpdateEnginePlans(enginePlans.map(p => p.id === activePlan.id ? updated : p))) return;
    onToast?.(activePlan.isPaused ? "تم استئناف الخطة بنجاح" : "تم إيقاف الخطة مؤقتاً", activePlan.isPaused ? "success" : "info");
  };

  // Plan Recalculate without window.alert/confirm
  const handleConfirmRecalculate = async () => {
    if (!activePlan) return;
    const updated = PlanLifecycle.recalculatePlan(activePlan);
    if (!await onUpdateEnginePlans(enginePlans.map(p => p.id === activePlan.id ? updated : p))) return;
    setShowRecalculateConfirm(false);
    if (onToast) {
      onToast("تمت إعادة جدولة المهام القادمة بنجاح مع الاحتفاظ بكامل سجلاتك المنجزة.", "success");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar & Goal Switcher */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              المحرك الرياضي المتقدم
            </span>
            <span className="text-stone-400">·</span>
            <span className="text-xs text-stone-500">خوارزمية الجدولة والتكرار المتباعد</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran mt-1">
            <Sparkles className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            محرك تخطيط الحفظ القرآني الذكي (WIRD Planning Engine)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Multiple simultaneous goals selector pills */}
          {enginePlans.length > 0 && !isCreatingNew && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
              {enginePlans.map(p => {
                const isSelected = p.id === (activePlan?.id || selectedPlanId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    <span>{p.title}</span>
                    {p.isPaused && <span className="text-[10px] opacity-75">(موقفة)</span>}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              setIsCreatingNew(!isCreatingNew);
              setPreviewPlan(null);
            }}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
          >
            {isCreatingNew ? 'إلغاء والعودة للخطة' : '+ إنشاء خطة ذكية جديدة'}
          </button>
        </div>
      </div>

      {/* 2. Plan Generation Wizard Form */}
      {isCreatingNew && (
        <form onSubmit={handlePreviewPlan} className="bg-white dark:bg-stone-800/90 rounded-3xl p-6 md:p-8 border border-emerald-500/40 shadow-sm space-y-6 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-700">
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                إعداد مدخلات الخطة القرآنية
              </h3>
              <p className="text-stone-500">
                يقوم المحرك بحساب الآيات الحقيقية وجدولتها وفق طاقتك الاستيعابية لمنع الإجهاد والتفلت
              </p>
            </div>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-sm">
              إجمالي الآيات: {liveTotalVerses} آية
            </span>
          </div>

          {/* Section A: Title & Verse Bounds */}
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                عنوان الخطة:
              </label>
              <input
                type="text"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="مثال: خطة حفظ سورة الكهف بتثبيت أسبوعي..."
                className="w-full px-3.5 py-2.5 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#faf8f5] dark:bg-stone-900/60 p-4 rounded-2xl border border-stone-200/60 dark:border-stone-700/60">
              {/* Start Coordinates */}
              <div className="space-y-2">
                <span className="font-bold text-stone-800 dark:text-stone-200">نقطة البداية:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-0.5">السورة:</label>
                    <select
                      value={startSurah}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        setStartSurah(s);
                        setStartAyah(1);
                        if (s > endSurah) {
                          setEndSurah(s);
                          const adjustedEndSurah = ALL_SURAHS.find(item => item.number === s);
                          setEndAyah(Math.min(endAyah, adjustedEndSurah?.versesCount || 1));
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg font-semibold"
                    >
                      {ALL_SURAHS.map(s => (
                        <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-0.5">من الآية:</label>
                    <input
                      type="number"
                      min="1"
                      max={startSurahMeta?.versesCount || 30}
                      value={startAyah}
                      onChange={(e) => setStartAyah(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* End Coordinates */}
              <div className="space-y-2">
                <span className="font-bold text-stone-800 dark:text-stone-200">نقطة النهاية:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-0.5">السورة:</label>
                    <select
                      value={endSurah}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        setEndSurah(s);
                        const targetS = ALL_SURAHS.find(item => item.number === s);
                        setEndAyah(targetS ? targetS.versesCount : 10);
                      }}
                      className="w-full px-2.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg font-semibold"
                    >
                      {ALL_SURAHS.map(s => (
                        <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-0.5">إلى الآية:</label>
                    <input
                      type="number"
                      min="1"
                      max={endSurahMeta?.versesCount || 30}
                      value={endAyah}
                      onChange={(e) => setEndAyah(Number(e.target.value))}
                      className="w-full px-2.5 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Level & Time Budgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                المستوى القرآني:
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold"
              >
                <option value="beginner">مبتدئ (تكرار مكثف وتأنٍ)</option>
                <option value="intermediate">متوسط (حفظ مستمر منتظم)</option>
                <option value="advanced">متقدم (سرعة استيعاب عالية)</option>
                <option value="hafiz">حافظ (تثبيت وضبط متقن)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                وقت الحفظ الجديد يومياً:
              </label>
              <select
                value={dailyAvailableMinutes}
                onChange={(e) => setDailyAvailableMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold"
              >
                <option value="15">15 دقيقة</option>
                <option value="30">30 دقيقة (الموصى به)</option>
                <option value="45">45 دقيقة</option>
                <option value="60">ساعة كاملة</option>
                <option value="90">ساعة ونصف</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                وقت المراجعة اليومي:
              </label>
              <select
                value={dailyRevisionMinutes}
                onChange={(e) => setDailyRevisionMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-semibold"
              >
                <option value="10">10 دقائق (صغرى فقط)</option>
                <option value="15">15 دقيقة (الموصى به)</option>
                <option value="25">25 دقيقة (صغرى وكبرى)</option>
                <option value="40">40 دقيقة (تثبيت مكثف)</option>
              </select>
            </div>
          </div>

          {/* Section C: Pacing & Workload Strategy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                طريقة تحديد وتيرة الحفظ:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {([
                  { id: 'verses_per_day' as const, title: 'عدد آيات ثابت', detail: 'تحدد مقداراً واضحاً في كل يوم حفظ' },
                  { id: 'pages_per_day' as const, title: 'عدد صفحات ثابت', detail: 'تقدير تقريبي؛ يعتمد حالياً متوسط 15 آية للصفحة' },
                  { id: 'by_target_date' as const, title: 'موعد ختم مستهدف', detail: 'يوزع المقدار تلقائياً على أيامك النشطة' }
                ]).map(option => {
                  const selected = paceType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPaceType(option.id)}
                      className={`flex items-center justify-between gap-3 text-right rounded-xl border p-3 transition-colors ${
                        selected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-900 dark:text-emerald-200'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{option.title}</span>
                        <span className="block text-[11px] opacity-75 mt-0.5">{option.detail}</span>
                      </span>
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-emerald-700' : 'border-stone-400'}`}>
                        {selected && <span className="w-2 h-2 rounded-full bg-emerald-700" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              {paceType === 'verses_per_day' && (
                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    عدد الآيات في كل يوم دراسة:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={paceQuantity}
                    onChange={(e) => setPaceQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-mono font-bold"
                  />
                </div>
              )}

              {paceType === 'pages_per_day' && (
                <div>
                  <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    عدد الصفحات يومياً (تقديري):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    value={paceQuantity}
                    onChange={(e) => setPaceQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-mono font-bold"
                  />
                </div>
              )}

              {paceType === 'by_target_date' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-stone-700 dark:text-stone-300">
                      تاريخ الختم المستهدف:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const rec = PlanningEngine.estimateRecommendedEndDate(
                          startDate,
                          liveTotalVerses,
                          level,
                          activeDays,
                          restDays
                        );
                        setTargetEndDate(rec);
                        onToast?.('تم ضبط تاريخ الختم الموصى به تلقائياً بما يضمن استقرار الحفظ.', 'info');
                      }}
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                    >
                      اقتراح موعد ملائم لطاقتك
                    </button>
                  </div>
                  <input
                    type="date"
                    required
                    value={targetEndDate}
                    onChange={(e) => setTargetEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section D: Active Days & Rest Days */}
          <div>
            <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              أيام الدراسة النشطة أسبوعياً (انقر لتعيين يوم الاستراحة):
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map(day => {
                const isActive = activeDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleToggleActiveDay(day.id)}
                    className={`py-2 px-3 rounded-xl border font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {day.label} {isActive ? '✓' : '(راحة)'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section E: Existing memorized portions for major revision */}
          <div>
            <label className="block font-semibold text-stone-700 dark:text-stone-300 mb-1">
              أجزاء وسور محفوظة مسبقاً (لتضمينها تلقائياً في دورة المراجعة الكبرى):
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              أضف كل سورة حفظتها بالفعل؛ يمكنك اختيار أي سورة من القرآن، وإزالتها لاحقاً. لن نفترض سوراً محفوظة نيابةً عنك.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select
                value={surahToAdd}
                onChange={(e) => setSurahToAdd(Number(e.target.value))}
                aria-label="اختر سورة محفوظة لإضافتها"
                className="flex-1 min-w-0 px-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-sm"
              >
                {ALL_SURAHS.map(surah => (
                  <option key={surah.number} value={surah.number}>
                    {surah.number}. سورة {surah.name} ({surah.versesCount} آية)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selectedExistingSurahs.includes(surahToAdd)}
                onClick={() => setSelectedExistingSurahs(current =>
                  current.includes(surahToAdd) ? current : [...current, surahToAdd].sort((a, b) => a - b)
                )}
                className="px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-sm font-bold disabled:opacity-40"
              >
                + إضافة السورة
              </button>
            </div>
            {selectedExistingSurahs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedExistingSurahs.map(sNum => {
                  const surah = ALL_SURAHS.find(item => item.number === sNum);
                  return (
                    <button
                      key={sNum}
                      type="button"
                      aria-label={`إزالة سورة ${surah?.name || sNum} من المحفوظ`}
                      onClick={() => setSelectedExistingSurahs(current => current.filter(x => x !== sNum))}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-xs font-semibold"
                    >
                      سورة {surah?.name || sNum}
                      <X className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-xs text-stone-500">
                لم تضف سوراً محفوظة بعد. أضف السور التي تريد إدراجها في المراجعة الكبرى.
              </div>
            )}
          </div>

          {/* Feasibility & Advisory Gauge */}
          <div className={`p-4 rounded-2xl border ${
            liveFeasibility.cognitiveLoadScore === 'impossible'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-300 text-red-900 dark:text-red-200'
              : liveFeasibility.cognitiveLoadScore === 'strenuous'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-900 dark:text-emerald-200'
          }`}>
            <div className="flex items-center gap-2 font-bold mb-1">
              {liveFeasibility.cognitiveLoadScore === 'impossible' && <AlertTriangle className="w-4 h-4 text-red-600" />}
              {liveFeasibility.cognitiveLoadScore === 'strenuous' && <Info className="w-4 h-4 text-amber-600" />}
              {liveFeasibility.cognitiveLoadScore === 'optimal' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
              <span>
                تقييم المحرك الرياضي للجدوى الذهنية: {
                  liveFeasibility.cognitiveLoadScore === 'optimal' ? 'مثالي ومتوازن' :
                  liveFeasibility.cognitiveLoadScore === 'light' ? 'خفيف وميسر' :
                  liveFeasibility.cognitiveLoadScore === 'strenuous' ? 'مكثف ويتطلب التزاماً' : 'غير واقعي ومجهد'
                }
              </span>
            </div>
            {liveFeasibility.warningMessage && (
              <p className="text-[11px] leading-relaxed mt-1">
                {liveFeasibility.warningMessage}
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-700">
            <button
              type="button"
              onClick={() => {
                setIsCreatingNew(false);
                setPreviewPlan(null);
              }}
              className="px-4 py-2.5 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl font-semibold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={liveTotalVerses <= 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span>معاينة الجدول الزمني المقترح</span>
            </button>
          </div>

          {/* Interactive Live Preview Card */}
          {previewPlan && (
            <div className="mt-6 pt-6 border-t-2 border-dashed border-emerald-500/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800">
                <div>
                  <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                    معاينة الخطة المقترحة: {previewPlan.title}
                  </h4>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                    إجمالي {previewPlan.meta.totalVerses} آية · {previewPlan.meta.activeStudyDaysCount} يوماً نشطاً · {previewPlan.meta.restDaysCount} يوم استراحة · الختم المتوقع: {previewPlan.meta.projectedEndDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveConfirmedPlan(previewPlan)}
                  disabled={isGeneratingPlan}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition-all whitespace-nowrap self-stretch sm:self-auto"
                >
                  {isGeneratingPlan ? 'جارٍ الحفظ والتفعيل...' : '✓ اعتماد وحفظ الخطة نهائياً'}
                </button>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-stone-800 dark:text-stone-200 block text-xs">
                  توزيع الأيام الأولى في الجدول:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {previewPlan.schedule.slice(0, 6).map((day) => (
                    <div
                      key={day.id}
                      className={`p-3 rounded-xl border text-xs ${
                        day.isRestDay
                          ? 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-400'
                          : 'bg-white dark:bg-stone-800 border-emerald-200 dark:border-emerald-800/60 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span>{day.dayNameAr} ({day.date})</span>
                        {day.isRestDay ? (
                          <span className="text-[10px] text-stone-400">استراحة</span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            {day.memorizationTask?.versesCount} آيات
                          </span>
                        )}
                      </div>
                      {day.memorizationTask && (
                        <p className="text-[11px] text-stone-700 dark:text-stone-300">
                          {day.memorizationTask.surahName} ({day.memorizationTask.startAyah}-{day.memorizationTask.endAyah})
                        </p>
                      )}
                      {day.minorRevisionTask && (
                        <p className="text-[10px] text-stone-500 mt-1">
                          {day.minorRevisionTask.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>
      )}

      {/* 3. Active Plan Dashboard & Schedule Execution */}
      {activePlan && !isCreatingNew && (
        <div className="space-y-6">
          {/* Plan Header Card */}
          <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold font-quran text-stone-900 dark:text-stone-100">
                    {activePlan.title}
                  </h3>
                  {activePlan.isPaused ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      متوقفة مؤقتاً
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                      نشطة وتعمل
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  تاريخ البدء: <span className="font-mono">{activePlan.input.startDate}</span> · الختم المتوقع: <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{activePlan.meta.projectedEndDate}</span>
                </p>
              </div>

              {/* Plan Lifecycle Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePause}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    activePlan.isPaused
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-800 dark:text-stone-200'
                  }`}
                >
                  {activePlan.isPaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{activePlan.isPaused ? 'استئناف الخطة' : 'إيقاف مؤقت'}</span>
                </button>

                <button
                  onClick={() => setShowRecalculateConfirm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors"
                  title="إعادة جدولة المهام القادمة بناءً على التقدم الفعلي"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط المتبقي</span>
                </button>

                <button
                  onClick={() => setPlanToDelete(activePlan.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-semibold transition-colors"
                  title="حذف هذه الخطة الذكية"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pedagogical Rationale Card */}
            <div className="p-4 bg-[#fcfbf7] dark:bg-stone-900/60 rounded-2xl border border-stone-200/70 dark:border-stone-700/60 text-xs space-y-1.5">
              <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-700" />
                <span>لماذا تم توليد هذه الخطة بهذا الشكل؟ (الأساس العلمي)</span>
              </div>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-[11px]">
                {activePlan.rationale}
              </p>
            </div>

            {/* Planned vs Actual Variance Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3 bg-[#faf8f5] dark:bg-stone-900/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                <span className="text-stone-400">إجمالي الآيات:</span>
                <div className="text-lg font-bold font-mono text-stone-900 dark:text-stone-100">
                  {activePlan.meta.totalVerses} آية
                </div>
              </div>

              <div className="p-3 bg-[#faf8f5] dark:bg-stone-900/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                <span className="text-stone-400">المستهدف حتى اليوم:</span>
                <div className="text-lg font-bold font-mono text-stone-900 dark:text-stone-100">
                  {activePlan.actualVsPlanned.plannedVersesToDate} آية
                </div>
              </div>

              <div className="p-3 bg-[#faf8f5] dark:bg-stone-900/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                <span className="text-stone-400">المحفوظ الفعلي:</span>
                <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {activePlan.actualVsPlanned.actualVersesMemorized} آية
                </div>
              </div>

              <div className="p-3 bg-[#faf8f5] dark:bg-stone-900/50 rounded-xl border border-stone-200/60 dark:border-stone-700/60 flex flex-col justify-between">
                <span className="text-stone-400">حالة المسار:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  {activePlan.actualVsPlanned.status === 'on_track' && <Check className="w-4 h-4 text-emerald-600" />}
                  {activePlan.actualVsPlanned.status === 'ahead' && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                  {activePlan.actualVsPlanned.status === 'behind' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  <span className={
                    activePlan.actualVsPlanned.status === 'ahead' ? 'text-emerald-600' :
                    activePlan.actualVsPlanned.status === 'behind' ? 'text-amber-600' : 'text-emerald-700'
                  }>
                    {activePlan.actualVsPlanned.status === 'ahead' ? 'متقدم على الخطة' :
                     activePlan.actualVsPlanned.status === 'behind' ? 'متأخر قليلاً' : 'منضبط مع الخطة'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Schedule View Modes & Task List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-800 dark:text-stone-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>جدول المهام اليومية الموزعة ({activePlan.schedule.length} يوماً)</span>
              </h3>

              <div className="flex items-center bg-white dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold">
                <button
                  onClick={() => setScheduleViewMode('weekly')}
                  className={`px-3 py-1 rounded-lg ${scheduleViewMode === 'weekly' ? 'bg-emerald-800 text-white' : 'text-stone-600 dark:text-stone-400'}`}
                >
                  أول أسبوعين
                </button>
                <button
                  onClick={() => setScheduleViewMode('all')}
                  className={`px-3 py-1 rounded-lg ${scheduleViewMode === 'all' ? 'bg-emerald-800 text-white' : 'text-stone-600 dark:text-stone-400'}`}
                >
                  الجدول كاملاً
                </button>
              </div>
            </div>

            {/* Tasks Calendar Stream */}
            <div className="space-y-3">
              {activePlan.schedule
                .slice(0, scheduleViewMode === 'weekly' ? 14 : activePlan.schedule.length)
                .map((day) => {
                  const isDone = day.memorizationTask?.completed;

                  if (day.isRestDay) {
                    return (
                      <div
                        key={day.id}
                        className="p-4 rounded-2xl border border-stone-200/60 dark:border-stone-800 bg-[#faf8f5]/40 dark:bg-stone-900/30 flex items-center justify-between text-xs text-stone-400"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono">{day.date}</span>
                          <span className="font-bold text-stone-600 dark:text-stone-400">({day.dayNameAr})</span>
                          <span>{day.notes || 'استراحة أسبوعية'}</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                          راحة الذاكرة
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={day.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isDone
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-xs'
                          : 'bg-white dark:bg-stone-800/90 border-stone-200/80 dark:border-stone-700/80 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-stone-400">{day.date}</span>
                          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">({day.dayNameAr})</span>
                          
                          {isDone ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> تم الحفظ
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                              قيد الإنجاز
                            </span>
                          )}
                        </div>

                        {/* Memorization Task */}
                        {day.memorizationTask && (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base font-quran text-emerald-900 dark:text-emerald-200">
                              سورة {day.memorizationTask.surahName} • الآيات ({day.memorizationTask.startAyah} - {day.memorizationTask.endAyah})
                            </span>
                            <span className="text-xs text-stone-500 font-mono">
                              ({day.memorizationTask.versesCount} آيات · ~{day.memorizationTask.estimatedMinutes}د)
                            </span>
                          </div>
                        )}

                        {/* Minor Revision */}
                        {day.minorRevisionTask && (
                          <div className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            <span>المراجعة الصغرى: {day.minorRevisionTask.description}</span>
                          </div>
                        )}

                        {/* Major Revision */}
                        {day.majorRevisionTask && (
                          <div className="text-[11px] text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                            <span>المراجعة الكبرى: {day.majorRevisionTask.description}</span>
                          </div>
                        )}
                      </div>

                      {/* Task Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {day.memorizationTask && !isDone && (
                          <button
                            onClick={() => onStartSession(
                              day.memorizationTask!.surahNumber,
                              day.memorizationTask!.startAyah,
                              day.memorizationTask!.endAyah
                            )}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>تدريب</span>
                          </button>
                        )}

                        {day.memorizationTask && isDone && (
                          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            ✓ مكتملة في الجدول
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* In-app Recalculate Confirmation Modal */}
      {showRecalculateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  إعادة جدولة المهام القادمة
                </h3>
                <p className="text-xs text-stone-500">
                  خوارزمية إعادة الموازنة التلقائية
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
              سيقوم المحرك بإعادة توزيع المهام المتبقية بناءً على تاريخ اليوم ومعدل تقدمك، مع <strong>الحفاظ الكامل على جميع الأوراد المكتملة وسجل إنجازك دون أي مساس</strong>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRecalculateConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRecalculate}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs transition-colors"
              >
                تأكيد إعادة الجدولة
              </button>
            </div>
          </div>
        </div>
      )}
      {/* In-app Plan Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  حذف الخطة الذكية
                </h3>
                <p className="text-xs text-stone-500">
                  تأكيد إزالة الخطة من قائمة الأهداف
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
              هل أنت متأكد من حذف هذه الخطة؟ <strong>لن يؤثر الحذف إطلاقاً على الآيات والمقاطع التي أتممت حفظها في المصحف وسجل التكرار والمراجعة</strong>؛ سيتم فقط حذف جدول الخطة المستقبلي.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePlan}
                className="px-5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-xs transition-colors"
              >
                تأكيد حذف الخطة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
