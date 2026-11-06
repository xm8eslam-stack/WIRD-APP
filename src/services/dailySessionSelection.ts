import { ALL_SURAHS } from '../data/quranMeta';
import type { MemorizationPlan, WirdPortion } from '../types/quran';
import type { EngineGeneratedPlan, ScheduledTaskUnit } from './planningEngine';
import { findNextUnmemorizedRange, getPrioritizedRevisionQueue } from './unifiedPortionService';

export interface DailyMemorizationRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

export type DailySessionSelection =
  | {
      kind: 'session';
      mode: 'memorize' | 'review';
      source: 'engine_plan' | 'preset_plan' | 'revision' | 'default';
      surahNumber: number;
      startAyah: number;
      endAyah: number;
      label: string;
    }
  | {
      kind: 'blocked';
      mode: 'memorize';
      source: 'blocked';
      messageAr: string;
    };

/**
 * Return only an engine-plan task due today or overdue.
 * Future tasks must never be started early by the dashboard quick-start.
 */
export function getNextDueEngineTask(
  plan: EngineGeneratedPlan | null | undefined,
  todayStr: string
): ScheduledTaskUnit | null {
  if (!plan || !plan.isActive || plan.isPaused) return null;

  const dueDay = plan.schedule
    .filter(day =>
      typeof day.date === 'string' &&
      day.date <= todayStr &&
      Boolean(day.memorizationTask) &&
      !day.memorizationTask?.completed
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return dueDay?.memorizationTask || null;
}

/**
 * Automatic quick-start is safe only for explicit whole-Surah scopes.
 * Juz/page plans need an exact coordinate resolver; never widen them to
 * entire Surahs as a fallback.
 */
export function isPresetAutoStartSupported(plan: MemorizationPlan | null | undefined): boolean {
  if (!plan || plan.unitType !== 'ayah') return false;
  if (plan.type === 'whole_quran') return true;
  return (plan.type === 'surahs' || plan.type === 'custom') &&
    Array.isArray(plan.targetSurahs) &&
    plan.targetSurahs.some(number => Number.isInteger(number) && number >= 1 && number <= 114);
}

export function getNextPresetMemorizationRange(
  plan: MemorizationPlan,
  portions: WirdPortion[],
  maxVerses: number = plan.dailyTarget || 7
): DailyMemorizationRange | null {
  if (!isPresetAutoStartSupported(plan)) return null;

  const targetSurahs = plan.type === 'whole_quran'
    ? ALL_SURAHS.map(surah => surah.number)
    : Array.from(new Set(plan.targetSurahs || [])).filter(number =>
        Number.isInteger(number) && number >= 1 && number <= 114
      );

  if (targetSurahs.length === 0) return null;
  return findNextUnmemorizedRange(portions, targetSurahs, maxVerses);
}

export function getDailySessionSelection(
  plans: MemorizationPlan[],
  enginePlans: EngineGeneratedPlan[],
  portions: WirdPortion[],
  todayStr: string
): DailySessionSelection {
  const activeEnginePlan = enginePlans.find(plan => plan.isActive && !plan.isPaused);
  const engineTask = getNextDueEngineTask(activeEnginePlan, todayStr);
  if (engineTask) {
    return {
      kind: 'session',
      mode: 'memorize',
      source: 'engine_plan',
      surahNumber: engineTask.surahNumber,
      startAyah: engineTask.startAyah,
      endAyah: engineTask.endAyah,
      label: `خطة: ${activeEnginePlan?.input.title || activeEnginePlan?.title || 'الحفظ الذكي'}`
    };
  }

  const duePortion = getPrioritizedRevisionQueue(portions, { todayStr, maxDailyLimit: 20 }).queue[0];
  if (duePortion) {
    return {
      kind: 'session',
      mode: 'review',
      source: 'revision',
      surahNumber: duePortion.surahNumber,
      startAyah: duePortion.startAyah,
      endAyah: duePortion.endAyah,
      label: 'مراجعة مستحقة ذات أولوية'
    };
  }

  const activePreset = activeEnginePlan ? undefined : plans.find(plan => plan.isActive);
  if (activePreset) {
    if (!isPresetAutoStartSupported(activePreset)) {
      return {
        kind: 'blocked',
        mode: 'memorize',
        source: 'blocked',
        messageAr: 'هذه الخطة تعتمد على الصفحات أو الأجزاء؛ افتح تفاصيلها لاختيار نطاق آيات دقيق قبل بدء الجلسة.'
      };
    }

    const range = getNextPresetMemorizationRange(activePreset, portions, activePreset.dailyTarget || 7);
    if (range) {
      return {
        kind: 'session',
        mode: 'memorize',
        source: 'preset_plan',
        ...range,
        label: `الخطة النشطة: ${activePreset.title}`
      };
    }

    return {
      kind: 'blocked',
      mode: 'memorize',
      source: 'blocked',
      messageAr: 'اكتمل نطاق الحفظ المحدد في خطتك الحالية؛ راجع إنجازك أو عدّل الخطة.'
    };
  }

  if (activeEnginePlan) {
    return {
      kind: 'blocked',
      mode: 'memorize',
      source: 'blocked',
      messageAr: 'لا توجد مهمة حفظ مستحقة اليوم في خطتك الحالية؛ ستظهر المهمة تلقائياً عند حلول موعدها.'
    };
  }

  const nextRange = findNextUnmemorizedRange(
    portions,
    ALL_SURAHS.map(surah => surah.number),
    7
  );
  if (nextRange) {
    return {
      kind: 'session',
      mode: 'memorize',
      source: 'default',
      ...nextRange,
      label: 'المقطع التالي غير المسجل في محفوظك'
    };
  }

  const firstMemorized = portions.find(portion => portion.status !== 'not_memorized');
  if (firstMemorized) {
    return {
      kind: 'session',
      mode: 'review',
      source: 'revision',
      surahNumber: firstMemorized.surahNumber,
      startAyah: firstMemorized.startAyah,
      endAyah: firstMemorized.endAyah,
      label: 'مراجعة محفوظك وتثبيته'
    };
  }

  return {
    kind: 'session',
    mode: 'memorize',
    source: 'default',
    surahNumber: 1,
    startAyah: 1,
    endAyah: 7,
    label: 'البداية المباركة (فاتحة الكتاب)'
  };
}
