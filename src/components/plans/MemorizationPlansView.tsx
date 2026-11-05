import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  Play, 
  Layers,
  Check
} from 'lucide-react';
import { MemorizationPlan } from '../../types/quran';
import { EngineGeneratedPlan } from '../../services/planningEngine';
import { PlanningEngineWizard } from './PlanningEngineWizard';

interface MemorizationPlansViewProps {
  plans: MemorizationPlan[];
  onUpdatePlans: (plans: MemorizationPlan[]) => void;
  enginePlans: EngineGeneratedPlan[];
  onUpdateEnginePlans: (plans: EngineGeneratedPlan[]) => void;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const MemorizationPlansView: React.FC<MemorizationPlansViewProps> = ({
  plans,
  onUpdatePlans,
  enginePlans,
  onUpdateEnginePlans,
  onStartSession,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<'engine' | 'presets'>('engine');
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  // Toggle active plan in presets
  const handleToggleActive = (planId: string) => {
    const updated = plans.map(p => ({
      ...p,
      isActive: p.id === planId
    }));
    onUpdatePlans(updated);
    if (onToast) {
      onToast("تم تفعيل الخطة المحددة بنجاح", "success");
    }
  };

  const handleConfirmDelete = () => {
    if (!planToDelete) return;
    const updated = plans.filter(p => p.id !== planToDelete);
    if (updated.length > 0 && !updated.some(p => p.isActive)) {
      updated[0].isActive = true;
    }
    onUpdatePlans(updated);
    setPlanToDelete(null);
    if (onToast) {
      onToast("تم حذف الخطة من قائمتك بنجاح", "info");
    }
  };

  return (
    <div className="wird-plans space-y-6">
      {/* Top Segmented Control */}
      <div className="bg-white dark:bg-stone-800/90 p-2 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('engine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'engine'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>محرك التخطيط الذكي (WIRD Engine)</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'presets'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>النماذج والخطط المعتمدة ({plans.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Real Functional Planning Engine */}
      {activeTab === 'engine' && (
        <PlanningEngineWizard
          enginePlans={enginePlans}
          onUpdateEnginePlans={onUpdateEnginePlans}
          onStartSession={onStartSession}
          onToast={onToast}
        />
      )}

      {/* TAB 2: Preset Plans */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              النماذج المنهجية الجاهزة ({plans.length})
            </h3>
            <span className="text-xs text-stone-500">
              خطط دور التحفيظ المعتمدة
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
                        onClick={() => setPlanToDelete(plan.id)}
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
        </div>
      )}

      {/* In-app Plan Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  تأكيد حذف الخطة
                </h3>
                <p className="text-xs text-stone-500">
                  هل تريد إزالة هذه الخطة من قائمتك؟
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
              سيتم حذف بطاقة الخطة المحددة. لن يؤثر ذلك على سجلات الأوراد التي أنجزتها سابقاً.
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
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
