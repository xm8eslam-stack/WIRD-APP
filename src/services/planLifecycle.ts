import {
  EngineGeneratedPlan,
  ScheduledDayPlan,
  PlanningEngine
} from './planningEngine';
import { QuranMath, VerseCoordinate } from './quranMath';

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type PendingTaskBundle = Pick<
  ScheduledDayPlan,
  'memorizationTask' | 'minorRevisionTask' | 'majorRevisionTask' | 'notes'
>;

function splitDayTasks(day: ScheduledDayPlan): {
  historical?: ScheduledDayPlan;
  pending?: PendingTaskBundle;
} {
  const dayMarkedComplete = day.status === 'completed';
  const completedMemorization = day.memorizationTask &&
    (day.memorizationTask.completed || dayMarkedComplete)
    ? { ...day.memorizationTask, completed: true }
    : undefined;
  const completedMinorRevision = day.minorRevisionTask &&
    (day.minorRevisionTask.completed || dayMarkedComplete)
    ? { ...day.minorRevisionTask, completed: true }
    : undefined;
  const completedMajorRevision = day.majorRevisionTask &&
    (day.majorRevisionTask.completed || dayMarkedComplete)
    ? { ...day.majorRevisionTask, completed: true }
    : undefined;

  const pendingMemorization = day.memorizationTask && !completedMemorization
    ? day.memorizationTask
    : undefined;
  const pendingMinorRevision = day.minorRevisionTask && !completedMinorRevision
    ? day.minorRevisionTask
    : undefined;
  const pendingMajorRevision = day.majorRevisionTask && !completedMajorRevision
    ? day.majorRevisionTask
    : undefined;

  const hasCompletedTask = Boolean(
    completedMemorization || completedMinorRevision || completedMajorRevision
  );
  const hasPendingTask = Boolean(
    pendingMemorization || pendingMinorRevision || pendingMajorRevision
  );

  const historical = hasCompletedTask || dayMarkedComplete
    ? {
        ...day,
        memorizationTask: completedMemorization,
        minorRevisionTask: completedMinorRevision,
        majorRevisionTask: completedMajorRevision,
        isRestDay: false,
        status: hasPendingTask ? 'partially_completed' as const : 'completed' as const
      }
    : undefined;

  const pending = hasPendingTask
    ? {
        memorizationTask: pendingMemorization,
        minorRevisionTask: pendingMinorRevision,
        majorRevisionTask: pendingMajorRevision,
        notes: day.notes
      }
    : undefined;

  return { historical, pending };
}

function schedulePendingBundles(
  bundles: PendingTaskBundle[],
  startDate: Date,
  input: EngineGeneratedPlan['input'],
  idPrefix: string
): ScheduledDayPlan[] {
  const schedule: ScheduledDayPlan[] = [];
  const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  let pendingIndex = 0;

  while (pendingIndex < bundles.length) {
    const dateStr = PlanningEngine.formatDate(currentDate);
    const dayOfWeek = currentDate.getDay();
    const isRest = input.restDays.includes(dayOfWeek) || !input.activeDays.includes(dayOfWeek);

    if (isRest) {
      schedule.push({
        id: idPrefix + '-rest-' + dateStr,
        date: dateStr,
        dayOfWeek,
        dayNameAr: DAY_NAMES_AR[dayOfWeek],
        isRestDay: true,
        status: 'pending',
        notes: 'استراحة أسبوعية'
      });
    } else {
      const bundle = bundles[pendingIndex];
      schedule.push({
        id: idPrefix + '-' + dateStr + '-' + (pendingIndex + 1),
        date: dateStr,
        dayOfWeek,
        dayNameAr: DAY_NAMES_AR[dayOfWeek],
        isRestDay: false,
        memorizationTask: bundle.memorizationTask,
        minorRevisionTask: bundle.minorRevisionTask,
        majorRevisionTask: bundle.majorRevisionTask,
        status: 'pending',
        notes: bundle.notes
      });
      pendingIndex++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedule;
}

function getLastScheduledWorkDate(schedule: ScheduledDayPlan[], fallback: string): string {
  const workDays = schedule.filter(day =>
    !day.isRestDay && Boolean(day.memorizationTask || day.minorRevisionTask || day.majorRevisionTask)
  );
  return workDays.length ? workDays[workDays.length - 1].date : fallback;
}

export const PlanLifecycle = {
  /**
   * Mark a task as completed or update individual properties.
   * Completion timestamps are preserved once written.
   */
  updateTask(
    plan: EngineGeneratedPlan,
    taskId: string,
    updates: Partial<ScheduledDayPlan>
  ): EngineGeneratedPlan {
    const updatedSchedule = plan.schedule.map(day => {
      if (day.id !== taskId) return day;

      const merged = { ...day, ...updates };
      if (merged.memorizationTask?.completed && !merged.memorizationTask.completedAt) {
        merged.memorizationTask.completedAt = new Date().toISOString();
      }
      return merged;
    });

    return this.refreshActualVsPlanned({ ...plan, schedule: updatedSchedule });
  },

  refreshActualVsPlanned(plan: EngineGeneratedPlan): EngineGeneratedPlan {
    const today = PlanningEngine.formatDate(new Date());
    let plannedToDate = 0;
    let actualCompleted = 0;

    for (const day of plan.schedule) {
      if (day.isRestDay || !day.memorizationTask) continue;
      if (day.date <= today) plannedToDate += day.memorizationTask.versesCount;
      if (day.memorizationTask.completed) actualCompleted += day.memorizationTask.versesCount;
    }

    const variance = actualCompleted - plannedToDate;
    let status: 'ahead' | 'on_track' | 'behind' = 'on_track';
    if (variance > 5) status = 'ahead';
    else if (variance < -5) status = 'behind';

    return {
      ...plan,
      actualVsPlanned: {
        plannedVersesToDate: plannedToDate,
        actualVersesMemorized: actualCompleted,
        varianceVerses: variance,
        status
      }
    };
  },

  pausePlan(plan: EngineGeneratedPlan, pauseDate?: string): EngineGeneratedPlan {
    const pDate = pauseDate || PlanningEngine.formatDate(new Date());
    return { ...plan, isPaused: true, pausedAt: pDate };
  },

  /**
   * Resume all unfinished work, including revision-only tasks. Completed task
   * components remain on their original dates; only unfinished components move.
   */
  resumePlan(plan: EngineGeneratedPlan, resumeDateStr?: string): EngineGeneratedPlan {
    const rDateStr = resumeDateStr || PlanningEngine.formatDate(new Date());
    if (!plan.isPaused && !plan.pausedAt) return plan;

    const historical: ScheduledDayPlan[] = [];
    const pendingBundles: PendingTaskBundle[] = [];

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date < rDateStr) historical.push(day);
        continue;
      }

      const split = splitDayTasks(day);
      if (split.historical) historical.push(split.historical);
      if (split.pending) pendingBundles.push(split.pending);
    }

    if (pendingBundles.length === 0) {
      return { ...plan, isPaused: false, pausedAt: undefined };
    }

    const rescheduled = schedulePendingBundles(
      pendingBundles,
      PlanningEngine.parseDate(rDateStr),
      plan.input,
      'resume'
    );
    const newSchedule = [...historical, ...rescheduled].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan: EngineGeneratedPlan = {
      ...plan,
      isPaused: false,
      pausedAt: undefined,
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    };

    return this.refreshActualVsPlanned(updatedPlan);
  },

  /**
   * Recalculate future memorization chunks while preserving completed
   * memorization/revision history and rescheduling unfinished revision tasks.
   */
  recalculatePlan(
    plan: EngineGeneratedPlan,
    newPaceVerses?: number,
    newTargetEndDate?: string
  ): EngineGeneratedPlan {
    const todayStr = PlanningEngine.formatDate(new Date());
    const historical: ScheduledDayPlan[] = [];
    const pendingRevisionBundles: PendingTaskBundle[] = [];
    const completedMemorizationTasks: ScheduledDayPlan[] = [];

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date <= todayStr) historical.push(day);
        continue;
      }

      const split = splitDayTasks(day);
      if (split.historical) {
        historical.push(split.historical);
        if (split.historical.memorizationTask?.completed) {
          completedMemorizationTasks.push(split.historical);
        }
      }
      if (split.pending) {
        const pendingRevision = {
          minorRevisionTask: split.pending.minorRevisionTask,
          majorRevisionTask: split.pending.majorRevisionTask,
          notes: split.pending.notes
        };
        if (pendingRevision.minorRevisionTask || pendingRevision.majorRevisionTask) {
          pendingRevisionBundles.push(pendingRevision);
        }
      }
    }

    let lastCompletedCoord: VerseCoordinate | null = null;
    for (const day of completedMemorizationTasks) {
      const task = day.memorizationTask;
      if (!task) continue;
      const taskEndCoord = { surahNumber: task.surahNumber, ayahNumber: task.endAyah };
      if (
        !lastCompletedCoord ||
        QuranMath.getAbsoluteAyahIndex(taskEndCoord.surahNumber, taskEndCoord.ayahNumber) >
          QuranMath.getAbsoluteAyahIndex(lastCompletedCoord.surahNumber, lastCompletedCoord.ayahNumber)
      ) {
        lastCompletedCoord = taskEndCoord;
      }
    }

    const totalVerses = QuranMath.countVersesBetween(
      plan.meta.startCoordinate,
      plan.meta.endCoordinate
    );
    let remainingStartCoord = plan.meta.startCoordinate;

    if (lastCompletedCoord) {
      if (
        QuranMath.getAbsoluteAyahIndex(lastCompletedCoord.surahNumber, lastCompletedCoord.ayahNumber) >=
        QuranMath.getAbsoluteAyahIndex(plan.meta.endCoordinate.surahNumber, plan.meta.endCoordinate.ayahNumber)
      ) {
        // All memorization is complete, but pending revision work is still retained.
        if (pendingRevisionBundles.length === 0) return this.refreshActualVsPlanned(plan);
        const revisionSchedule = schedulePendingBundles(
          pendingRevisionBundles,
          PlanningEngine.parseDate(todayStr),
          plan.input,
          'recalc-revision'
        );
        const schedule = [...historical, ...revisionSchedule].sort((a, b) =>
          a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
        );
        return this.refreshActualVsPlanned({
          ...plan,
          schedule,
          meta: {
            ...plan.meta,
            projectedEndDate: getLastScheduledWorkDate(schedule, plan.meta.projectedEndDate)
          }
        });
      }
      remainingStartCoord = QuranMath.addVerses(lastCompletedCoord, 1);
    }

    const remainingVerses = QuranMath.countVersesBetween(
      remainingStartCoord,
      plan.meta.endCoordinate
    );
    let pace = Number.isInteger(newPaceVerses) && (newPaceVerses || 0) > 0
      ? newPaceVerses as number
      : plan.input.paceQuantity;

    if (newTargetEndDate) {
      const activeDays = PlanningEngine.countActiveDaysBetween(
        todayStr,
        newTargetEndDate,
        plan.input.activeDays,
        plan.input.restDays
      );
      if (activeDays > 0) pace = Math.max(1, Math.ceil(remainingVerses / activeDays));
    }

    const chunks = remainingVerses > 0
      ? QuranMath.sliceRangeIntoChunks(remainingStartCoord, plan.meta.endCoordinate, pace)
      : [];
    const workBundles: PendingTaskBundle[] = [];
    const workCount = Math.max(chunks.length, pendingRevisionBundles.length);

    for (let index = 0; index < workCount; index++) {
      const chunk = chunks[index];
      const revisionBundle = pendingRevisionBundles[index];
      let memorizationTask: ScheduledDayPlan['memorizationTask'];

      if (chunk) {
        const surah = QuranMath.getSurah(chunk.start.surahNumber);
        memorizationTask = {
          surahNumber: chunk.start.surahNumber,
          surahName: surah?.name || '',
          startAyah: chunk.start.ayahNumber,
          endAyah: chunk.end.ayahNumber,
          versesCount: chunk.totalVerses,
          estimatedMinutes: QuranMath.estimateMemorizationMinutes(
            chunk.totalVerses,
            plan.input.level
          ),
          completed: false
        };
      }

      workBundles.push({
        memorizationTask,
        minorRevisionTask: revisionBundle?.minorRevisionTask,
        majorRevisionTask: revisionBundle?.majorRevisionTask,
        notes: revisionBundle?.notes
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    const rescheduled = schedulePendingBundles(
      workBundles,
      startDate,
      plan.input,
      'recalc'
    );
    const newSchedule = [...historical, ...rescheduled].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan: EngineGeneratedPlan = {
      ...plan,
      input: { ...plan.input, paceQuantity: pace },
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    };

    // Keep totalVerses for the original plan range; this is not a new plan.
    void totalVerses;
    return this.refreshActualVsPlanned(updatedPlan);
  }
};
