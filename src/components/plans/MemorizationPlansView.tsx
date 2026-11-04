import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  BookOpen, 
  Trash2, 
  Play, 
  AlertCircle,
  X
} from 'lucide-react';
import { MemorizationPlan } from '../../types/quran';
import { ALL_SURAHS, JUZ_NAMES } from '../../data/quranMeta';

interface MemorizationPlansViewProps {
  plans: MemorizationPlan[];
  onUpdatePlans: (plans: MemorizationPlan[]) => void;
  onStartSession: (surahNumber?: number) => void;
}

export const MemorizationPlansView: React.FC<MemorizationPlansViewProps> = ({
  plans,
  onUpdatePlans,
  onStartSession
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'presets'>('active');

  // Form states for new plan
  const [planTitle, setPlanTitle] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [targetType, setTargetType] = useState<'whole_quran' | 'juz' | 'surahs' | 'custom'>('surahs');
  const [selectedSurah, setSelectedSurah] = useState<number>(67); // Al-Mulk
  const [selectedJuz, setSelectedJuz] = useState<number>(30);
  const [unitType, setUnitType] = useState<'ayah' | 'page'>('ayah');
  const [dailyTarget, setDailyTarget] = useState<number>(5);
  const [memorizationDays, setMemorizationDays] = useState<number>(5);
  const [revisionDays, setRevisionDays] = useState<number>(2);

  // Toggle active plan
  const handleToggleActive = (planId: string) => {
    const updated = plans.map(p => ({
      ...p,
      isActive: p.id === planId
    }));
    onUpdatePlans(updated);
  };

  // Delete plan
  const handleDeletePlan = (planId: string) => {
    if (confirm("هل تريد حذف هذه الخطة من قائمتك؟")) {
      const updated = plans.filter(p => p.id !== planId);
      // Ensure at least one is active if available
      if (updated.length > 0 && !updated.some(p => p.isActive)) {
        updated[0].isActive = true;
      }
      onUpdatePlans(updated);
    }
  };

  // Create new plan handler
  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim()) return;

    let totalUnits = 30;
    if (targetType === 'whole_quran') {
      totalUnits = unitType === 'page' ? 604 : 6236;
    } else if (targetType === 'juz') {
      totalUnits = unitType === 'page' ? 20 : 564;
    } else if (targetType === 'surahs') {
      const s = ALL_SURAHS.find(item => item.number === selectedSurah);
      totalUnits = s ? s.versesCount : 30;
    }

    const calculatedDays = Math.ceil(totalUnits / dailyTarget);
    const weeksNeeded = Math.ceil(calculatedDays / memorizationDays);
    const totalCalendarDays = weeksNeeded * 7;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + totalCalendarDays);

    const newPlan: MemorizationPlan = {
      id: `plan-${Date.now()}`,
      title: planTitle,
      description: planDesc || `خطة لحفظ ${planTitle} بمعدل ${dailyTarget} ${unitType === 'page' ? 'صفحة' : 'آية'} يومياً.`,
      type: targetType,
      targetSurahs: targetType === 'surahs' ? [selectedSurah] : undefined,
      targetJuz: targetType === 'juz' ? [selectedJuz] : undefined,
      totalUnits,
      completedUnits: 0,
      unitType,
      dailyTarget,
      memorizationDaysPerWeek: memorizationDays,
      revisionDaysPerWeek: revisionDays,
      startDate: startDate.toISOString().split('T')[0],
      targetEndDate: endDate.toISOString().split('T')[0],
      isActive: true,
      color: "#059669"
    };

    // Set new plan as active and others as inactive
    const updated = plans.map(p => ({ ...p, isActive: false }));
    updated.unshift(newPlan);
    onUpdatePlans(updated);

    setIsModalOpen(false);
    setPlanTitle('');
    setPlanDesc('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
            <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            خطط حفظ وتثبيت القرآن الكريم
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            اختر خطة معتمدة أو ابنِ خطتك الشخصية بما يناسب وقتك وقدرتك على الاستيعاب
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء خطة مخصصة جديدة</span>
        </button>
      </div>

      {/* 2. Active Plans List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
            خطط الحفظ المتاحة ({plans.length})
          </h3>
          <span className="text-xs text-stone-500">
            يمكن تفعيل خطة واحدة رئيسية للورد اليومي
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((plan) => {
            const percent = Math.min(100, Math.round((plan.completedUnits / plan.totalUnits) * 100));

            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 border transition-all flex flex-col justify-between ${
                  plan.isActive
                    ? 'bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-stone-800/90 border-emerald-500 dark:border-emerald-600 shadow-sm ring-1 ring-emerald-500/20'
                    : 'bg-white dark:bg-stone-800/90 border-stone-200/80 dark:border-stone-700/80 hover:border-stone-300 dark:hover:border-stone-600 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-stone-900 dark:text-stone-100 font-quran">
                          {plan.title}
                        </h4>
                        {plan.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                            الخطة النشطة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                      title="حذف الخطة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress Info */}
                  <div className="space-y-2 mt-4 pt-3 border-t border-stone-100 dark:border-stone-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 dark:text-stone-400">نسبة الإنجاز:</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                        {plan.completedUnits} / {plan.totalUnits} {plan.unitType === 'page' ? 'صفحة' : 'آية'} ({percent}%)
                      </span>
                    </div>

                    <div className="w-full bg-stone-100 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Plan Specs */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-stone-600 dark:text-stone-400 bg-[#faf8f5] dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                    <div>
                      المستهدف اليومي: <strong className="text-stone-800 dark:text-stone-200">{plan.dailyTarget} {plan.unitType === 'page' ? 'صفحة' : 'آيات'}</strong>
                    </div>
                    <div>
                      أيام الحفظ / المراجعة: <strong className="text-stone-800 dark:text-stone-200">{plan.memorizationDaysPerWeek} / {plan.revisionDaysPerWeek}</strong>
                    </div>
                    <div>
                      تاريخ البدء: <span className="font-mono">{plan.startDate}</span>
                    </div>
                    <div>
                      الختم المتوقع: <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{plan.targetEndDate}</span>
                    </div>
                  </div>
                </div>

                {/* Plan Card Actions */}
                <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-stone-100 dark:border-stone-700">
                  {plan.isActive ? (
                    <button
                      onClick={() => onStartSession(plan.targetSurahs?.[0])}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>متابعة جلسة اليوم</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleActive(plan.id)}
                      className="flex-1 py-2 px-4 bg-stone-100 hover:bg-emerald-100 dark:bg-stone-700 dark:hover:bg-emerald-950 text-stone-800 hover:text-emerald-900 dark:text-stone-200 dark:hover:text-emerald-300 rounded-xl text-xs font-semibold transition-colors"
                    >
                      تفعيل هذه الخطة كورد رئيسي
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-stone-800 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-8 space-y-3">
            <Calendar className="w-10 h-10 text-stone-400 mx-auto" />
            <h4 className="font-bold text-stone-800 dark:text-stone-200 text-base">لا توجد خطط حفظ نشطة حالياً</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              ابدأ بإنشاء خطة مخصصة تناسب وقتك ومستواك، لكي يرتب لك تطبيق وِرد جلسات الحفظ والمراجعة تلقائياً.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              إنشاء خطتك الأولى الآن
            </button>
          </div>
        )}
      </div>

      {/* 3. Modal: Create Custom Plan Wizard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative z-10 bg-white dark:bg-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-700 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-700 pb-3">
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                إنشاء خطة حفظ قرآنية مخصصة
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              {/* Plan Title */}
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  عنوان الخطة:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خطة حفظ سورة الكهف، خطة جزء تبارك..."
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl focus:outline-none focus:border-emerald-600 text-stone-900 dark:text-stone-100"
                />
              </div>

              {/* Target Type */}
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  نطاق ومستهدف الحفظ:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('surahs')}
                    className={`py-2 px-3 rounded-lg border font-medium ${
                      targetType === 'surahs' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold' 
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    سورة محددة
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('juz')}
                    className={`py-2 px-3 rounded-lg border font-medium ${
                      targetType === 'juz' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold' 
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    جزء كامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('whole_quran')}
                    className={`py-2 px-3 rounded-lg border font-medium ${
                      targetType === 'whole_quran' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold' 
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    القرآن كاملاً
                  </button>
                </div>
              </div>

              {/* Conditional dropdown based on target */}
              {targetType === 'surahs' && (
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    اختر السورة:
                  </label>
                  <select
                    value={selectedSurah}
                    onChange={(e) => setSelectedSurah(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl"
                  >
                    {ALL_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>
                        {s.number}. سورة {s.name} ({s.versesCount} آية)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'juz' && (
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    اختر الجزء:
                  </label>
                  <select
                    value={selectedJuz}
                    onChange={(e) => setSelectedJuz(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl"
                  >
                    {JUZ_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pace & Units */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    وحدة الحفظ:
                  </label>
                  <select
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value as 'ayah' | 'page')}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl"
                  >
                    <option value="ayah">بالآيات</option>
                    <option value="page">بالصفحات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    المستهدف اليومي:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={dailyTarget}
                    onChange={(e) => setDailyTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Weekly Schedule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    أيام الحفظ أسبوعياً:
                  </label>
                  <select
                    value={memorizationDays}
                    onChange={(e) => setMemorizationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl"
                  >
                    <option value="4">4 أيام</option>
                    <option value="5">5 أيام (الموصى به)</option>
                    <option value="6">6 أيام</option>
                    <option value="7">يومياً (7 أيام)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    أيام المراجعة أسبوعياً:
                  </label>
                  <select
                    value={revisionDays}
                    onChange={(e) => setRevisionDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl"
                  >
                    <option value="1">يوم واحد</option>
                    <option value="2">يومان (الموصى به للتثبيت)</option>
                    <option value="3">3 أيام</option>
                  </select>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                💡 قاعدة الحفاظ: «قليلٌ دائم خيرٌ من كثيرٍ منقطع». الالتزام بـ 5 آيات يومياً يضمن رسوخ الحفظ دون تفلت.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-xs"
                >
                  حفظ وتفعيل الخطة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
