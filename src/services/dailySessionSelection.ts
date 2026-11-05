import { ALL_SURAHS } from '../data/quranMeta';
import type { MemorizationPlan, WirdPortion } from '../types/quran';
import type { EngineGeneratedPlan, ScheduledTaskUnit } from './planningEngine';
import { findNextUnmemorizedRange } from './unifiedPortionService';

export interface DailyMemorizationRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

/**
 * Return only a task that is due today or overdue. Future plan tasks must not
 * be started early by the dashboard's "today" action.
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
 * Juz/page plans need a precise coordinate resolver; never widen them to
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
