import React, { useEffect, useRef, useState } from 'react';
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
import { RetentionService } from '../../services/retentionService';
import { getNextPresetMemorizationRange, isPresetAutoStartSupported } from '../../services/dailySessionSelection';

interface MemorizationPlansViewProps {
  plans: MemorizationPlan[];
  onUpdatePlans: (plans: MemorizationPlan[]) => boolean | Promise<boolean>;
  enginePlans: EngineGeneratedPlan[];
  onUpdateEnginePlans: (plans: EngineGeneratedPlan[]) => boolean | Promise<boolean>;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number, mode?: 'memorize' | 'review') => void;
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
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const presetsTabRef = useRef<HTMLButtonElement | null>(null);
  const wasDeleteDialogOpenRef = useRef(false);

  useEffect(() => {
    if (!planToDelete) {
      if (wasDeleteDialogOpenRef.current) {
        wasDeleteDialogOpenRef.current = false;
        presetsTabRef.current?.focus();
      }
      return;
    }

    wasDeleteDialogOpenRef.current = true;
    cancelDeleteButtonRef.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isDeleting) setPlanToDelete(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = deleteDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [planToDelete, isDeleting]);

  // Toggle active plan in presets
  const handleToggleActive = async (planId: string) => {
    const updated = plans.map(p => ({
      ...p,
      isActive: p.id === planId
    }));
    if (!await onUpdatePlans(updated)) return;
    if (onToast) {
      onToast("تم تفعيل الخطة المحددة بنجاح", "success");
    }
  };

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;
    const updated = plans.filter(p => p.id !== planToDelete);
    if (updated.length > 0 && !updated.some(p => p.isActive)) {
      updated[0].isActive = true;
    }
    if (!await onUpdatePlans(updated)) return;
    setPlanToDelete(null);
    if (onToast) {
      onToast("تم حذف الخطة من قائمتك بنجاح", "info");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Segmented Control */}
      <div role="group" aria-label="طرق إدارة خطط الحفظ" className="bg-white dark:bg-stone-800/90 p-2 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('engine')}
            aria-pressed={activeTab === 'engine'}
            className={`flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'engine'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>محرك التخطيط الذكي (WIRD Engine)</span>
          </button>

          <button
            ref={presetsTabRef}
            type="button"
            onClick={() => setActiveTab('presets')}
            aria-pressed={activeTab === 'presets'}
            className={`flex min-h-11 items-center gap-2 px-4 py-2 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
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

          {plans.length === 0 ? (
            <div role="status" className="rounded-2xl border border-dashed border-stone-300 bg-white/80 px-5 py-10 text-center dark:border-stone-700 dark:bg-stone-900/50">
              <Calendar className="mx-auto mb-3 h-8 w-8 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">لا توجد خطط جاهزة محفوظة حالياً</h4>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-stone-500 dark:text-stone-400">
                يمكنك إنشاء خطة شخصية من محرك التخطيط الذكي، أو استيراد نسخة احتياطية تحتوي على خططك السابقة.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('engine')}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                فتح محرك التخطيط الذكي
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plans.map((plan) => {
              const percent = plan.totalUnits > 0
                ? Math.min(100, Math.max(0, Math.round((plan.completedUnits / plan.totalUnits) * 100)))
                : 0;
              const nextRange = getNextPresetMemorizationRange(plan, RetentionService.getPortions(), plan.dailyTarget);
              const quickStartSupported = isPresetAutoStartSupported(plan);

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
                        type="button"
                        onClick={() => setPlanToDelete(plan.id)}
                        aria-label={`حذف الخطة ${plan.title}`}
                        className="min-h-11 min-w-11 text-stone-400 hover:text-red-500 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
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

                      <div role="progressbar" aria-label={`نسبة إنجاز خطة ${plan.title}`} aria-valuemin={0} aria-valuemax={Math.max(1, plan.totalUnits)} aria-valuenow={Math.min(Math.max(0, plan.completedUnits), Math.max(1, plan.totalUnits))} aria-valuetext={`${percent}%`} className="w-full bg-stone-100 dark:bg-stone-700 h-2 rounded-full overflow-hidden">
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
                        type="button"
                        disabled={!nextRange}
                        onClick={() => {
                          if (nextRange) onStartSession(nextRange.surahNumber, nextRange.startAyah, nextRange.endAyah, 'memorize');
                        }}
                        title={!quickStartSupported
                          ? 'البدء السريع غير متاح لخطط الصفحات والأجزاء حتى يتوفر تحديد آيات دقيق.'
                          : !nextRange ? 'اكتملت نطاقات الحفظ المحددة في هذه الخطة.' : 'ابدأ من أول آية غير مسجلة في نطاق الخطة'}
                        className="flex-1 flex min-h-11 items-center justify-center gap-2 py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{nextRange ? 'متابعة جلسة اليوم' : quickStartSupported ? 'اكتملت نطاقات الخطة' : 'البدء السريع غير متاح'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(plan.id)}
                        className="flex-1 min-h-11 py-2 px-4 bg-stone-100 hover:bg-emerald-100 dark:bg-stone-700 dark:hover:bg-emerald-950 text-stone-800 hover:text-emerald-900 dark:text-stone-200 dark:hover:text-emerald-300 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        تفعيل هذه الخطة كورد رئيسي
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* In-app Plan Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div ref={deleteDialogRef} role="dialog" aria-modal="true" aria-labelledby="wird-plan-delete-title" className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="wird-plan-delete-title" className="font-bold text-stone-900 dark:text-stone-100 text-base">
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
                ref={cancelDeleteButtonRef}
                type="button"
                disabled={isDeleting}
                onClick={() => setPlanToDelete(null)}
                className="min-h-11 px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-11 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {isDeleting ? 'جارٍ حذف الخطة...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
