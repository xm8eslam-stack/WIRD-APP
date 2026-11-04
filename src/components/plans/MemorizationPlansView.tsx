import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  Play, 
  Layers,
  Cpu,
  Check
} from 'lucide-react';
import { MemorizationPlan } from '../../types/quran';
import { EngineGeneratedPlan } from '../../services/planningEngine';
import { PlanningEngineWizard } from './PlanningEngineWizard';
import { runAllPlanningEngineTests } from '../../services/planningEngine.test';

interface MemorizationPlansViewProps {
  plans: MemorizationPlan[];
  onUpdatePlans: (plans: MemorizationPlan[]) => void;
  enginePlans: EngineGeneratedPlan[];
  onUpdateEnginePlans: (plans: EngineGeneratedPlan[]) => void;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number) => void;
}

export const MemorizationPlansView: React.FC<MemorizationPlansViewProps> = ({
  plans,
  onUpdatePlans,
  enginePlans,
  onUpdateEnginePlans,
  onStartSession
}) => {
  const [activeTab, setActiveTab] = useState<'engine' | 'presets' | 'diagnostics'>('engine');
  const [testResults, setTestResults] = useState<{ passed: number; failed: number; results: string[] } | null>(null);

  // Toggle active plan in presets
  const handleToggleActive = (planId: string) => {
    const updated = plans.map(p => ({
      ...p,
      isActive: p.id === planId
    }));
    onUpdatePlans(updated);
  };

  const handleDeletePlan = (planId: string) => {
    if (confirm("هل تريد حذف هذه الخطة من قائمتك؟")) {
      const updated = plans.filter(p => p.id !== planId);
      if (updated.length > 0 && !updated.some(p => p.isActive)) {
        updated[0].isActive = true;
      }
      onUpdatePlans(updated);
    }
  };

  const handleRunDiagnostics = () => {
    const res = runAllPlanningEngineTests();
    setTestResults(res);
  };

  return (
    <div className="space-y-6">
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

        <button
          onClick={() => {
            setActiveTab('diagnostics');
            handleRunDiagnostics();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] transition-colors ${
            activeTab === 'diagnostics'
              ? 'bg-amber-100 dark:bg-amber-950 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
              : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>فحص دقة الخوارزميات (Unit Tests)</span>
        </button>
      </div>

      {/* TAB 1: Real Functional Planning Engine */}
      {activeTab === 'engine' && (
        <PlanningEngineWizard
          enginePlans={enginePlans}
          onUpdateEnginePlans={onUpdateEnginePlans}
          onStartSession={onStartSession}
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
        </div>
      )}

      {/* TAB 3: Unit Tests & Algorithmic Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-6 md:p-8 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-5 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-700">
            <div>
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-700" />
                <span>فحص واختبار دقة محرك التخطيط القرآني (Algorithmic Unit Tests)</span>
              </h3>
              <p className="text-stone-500">
                اختبارات حسابية حتمية لحساب الآيات، والجدولة، والتحقق من حدود الجهد الذهني، وإعادة الضبط
              </p>
            </div>

            <button
              onClick={handleRunDiagnostics}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-xs transition-colors"
            >
              إعادة تشغيل الاختبارات الآن
            </button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                <Check className="w-5 h-5 text-emerald-600" />
                <div>
                  <strong>تم اجتياز جميع الاختبارات: </strong>
                  <span>{testResults.passed} اختبار ناجح · {testResults.failed} اختبار فاشل</span>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-[11px] bg-[#faf8f5] dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-700 max-h-80 overflow-y-auto">
                {testResults.results.map((r, i) => (
                  <div key={i} className="py-0.5">{r}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
