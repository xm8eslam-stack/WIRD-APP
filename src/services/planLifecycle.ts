import { EngineGeneratedPlan, ScheduledDayPlan, PlanningEngine } from './planningEngine';
import { QuranMath, VerseCoordinate } from './quranMath';

export const PlanLifecycle = {
  /**
   * Mark a task as completed or update individual properties
   * PRESERVES all historical completion records!
   */
  updateTask(
    plan: EngineGeneratedPlan,
    taskId: string,
    updates: Partial<ScheduledDayPlan>
  ): EngineGeneratedPlan {
    const updatedSchedule = plan.schedule.map(day => {
      if (day.id !== taskId) return day;

      const merged = { ...day, ...updates };
      // If memorization task completed, record timestamp if not set
      if (merged.memorizationTask?.completed && !merged.memorizationTask.completedAt) {
        merged.memorizationTask.completedAt = new Date().toISOString();
      }
      return merged;
    });

    const updatedPlan = {
      ...plan,
      schedule: updatedSchedule
    };

    return this.refreshActualVsPlanned(updatedPlan);
  },

  /**
   * Calculate planned verses up to current date vs actually completed verses
   */
  refreshActualVsPlanned(plan: EngineGeneratedPlan): EngineGeneratedPlan {
    const today = PlanningEngine.formatDate(new Date());
    let plannedToDate = 0;
    let actualCompleted = 0;

    for (const day of plan.schedule) {
      if (day.isRestDay || !day.memorizationTask) continue;

      if (day.date <= today) {
        plannedToDate += day.memorizationTask.versesCount;
      }
      if (day.memorizationTask.completed) {
        actualCompleted += day.memorizationTask.versesCount;
      }
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

  /**
   * Pause an active plan
   */
  pausePlan(plan: EngineGeneratedPlan, pauseDate?: string): EngineGeneratedPlan {
    const pDate = pauseDate || PlanningEngine.formatDate(new Date());
    return {
      ...plan,
      isPaused: true,
      pausedAt: pDate
    };
  },

  /**
   * Resume a paused plan and shift remaining uncompleted tasks forward to resumeDate.
   * Completely preserves historical completed tasks!
   */
  resumePlan(plan: EngineGeneratedPlan, resumeDateStr?: string): EngineGeneratedPlan {
    const rDateStr = resumeDateStr || PlanningEngine.formatDate(new Date());
    if (!plan.isPaused && !plan.pausedAt) return plan;

    // Separate completed tasks (never touched) from pending tasks
    const completedTasks = plan.schedule.filter(s => s.memorizationTask?.completed);
    const uncompletedTasks = plan.schedule.filter(s => !s.memorizationTask?.completed && !s.isRestDay && s.memorizationTask);

    if (uncompletedTasks.length === 0) {
      return { ...plan, isPaused: false, pausedAt: undefined };
    }

    // Re-schedule uncompleted chunks starting from resumeDate
    const newSchedule: ScheduledDayPlan[] = [...completedTasks];
    const curDate = PlanningEngine.parseDate(rDateStr);
    let pendingIdx = 0;

    while (pendingIdx < uncompletedTasks.length) {
      const dateStr = PlanningEngine.formatDate(curDate);
      const dayOfWeek = curDate.getDay();
      const isRest = plan.input.restDays.includes(dayOfWeek) || !plan.input.activeDays.includes(dayOfWeek);

      if (isRest) {
        newSchedule.push({
          id: `task-${dateStr}`,
          date: dateStr,
          dayOfWeek,
          dayNameAr: dayOfWeek === 5 ? 'الجمعة' : dayOfWeek === 6 ? 'السبت' : 'يوم دراسة',
          isRestDay: true,
          status: 'pending',
          notes: 'استراحة أسبوعية'
        });
      } else {
        const origTask = uncompletedTasks[pendingIdx];
        newSchedule.push({
          ...origTask,
          id: `task-${dateStr}`,
          date: dateStr,
          dayOfWeek,
          isRestDay: false,
          status: 'pending'
        });
        pendingIdx++;
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    // Sort by date
    newSchedule.sort((a, b) => a.date.localeCompare(b.date));

    const lastTask = newSchedule.filter(s => !s.isRestDay).pop();
    const updatedPlan: EngineGeneratedPlan = {
      ...plan,
      isPaused: false,
      pausedAt: undefined,
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: lastTask ? lastTask.date : plan.meta.projectedEndDate
      }
    };

    return this.refreshActualVsPlanned(updatedPlan);
  },

  /**
   * Recalculate future tasks when schedule or user pace changes.
   * NEVER overwrites completed memorization records!
   */
  recalculatePlan(
    plan: EngineGeneratedPlan,
    newPaceVerses?: number,
    newTargetEndDate?: string
  ): EngineGeneratedPlan {
    // 1. Identify what has already been memorized
    const completedTasks = plan.schedule.filter(s => s.memorizationTask?.completed);
    
    // Find the furthest verse completed
    let lastCompletedCoord: VerseCoordinate | null = null;
    for (const t of completedTasks) {
      if (t.memorizationTask) {
        const taskEndCoord = { 
          surahNumber: t.memorizationTask.surahNumber, 
          ayahNumber: t.memorizationTask.endAyah 
        };
        if (!lastCompletedCoord || QuranMath.getAbsoluteAyahIndex(taskEndCoord.surahNumber, taskEndCoord.ayahNumber) > QuranMath.getAbsoluteAyahIndex(lastCompletedCoord.surahNumber, lastCompletedCoord.ayahNumber)) {
          lastCompletedCoord = taskEndCoord;
        }
      }
    }

    // If all completed, return as is
    const totalVerses = QuranMath.countVersesBetween(plan.meta.startCoordinate, plan.meta.endCoordinate);
    let remainingStartCoord = plan.meta.startCoordinate;

    if (lastCompletedCoord) {
      if (QuranMath.getAbsoluteAyahIndex(lastCompletedCoord.surahNumber, lastCompletedCoord.ayahNumber) >= QuranMath.getAbsoluteAyahIndex(plan.meta.endCoordinate.surahNumber, plan.meta.endCoordinate.ayahNumber)) {
        // All completed!
        return this.refreshActualVsPlanned(plan);
      }
      remainingStartCoord = QuranMath.addVerses(lastCompletedCoord, 1);
    }

    const remainingVerses = QuranMath.countVersesBetween(remainingStartCoord, plan.meta.endCoordinate);
    const todayStr = PlanningEngine.formatDate(new Date());

    // Compute updated pace
    let pace = newPaceVerses || plan.input.paceQuantity;
    if (newTargetEndDate) {
      const activeDays = PlanningEngine.countActiveDaysBetween(todayStr, newTargetEndDate, plan.input.activeDays, plan.input.restDays);
      if (activeDays > 0) {
        pace = Math.max(1, Math.ceil(remainingVerses / activeDays));
      }
    }

    // Slice remaining verses into chunks
    const chunks = QuranMath.sliceRangeIntoChunks(remainingStartCoord, plan.meta.endCoordinate, pace);

    // Schedule remaining tasks starting from tomorrow (or today if no completed tasks today)
    const newSchedule: ScheduledDayPlan[] = [...completedTasks];
    const curDate = new Date();
    // Start scheduling from next day
    curDate.setDate(curDate.getDate() + 1);

    let chunkIdx = 0;
    while (chunkIdx < chunks.length) {
      const dateStr = PlanningEngine.formatDate(curDate);
      const dayOfWeek = curDate.getDay();
      const isRest = plan.input.restDays.includes(dayOfWeek) || !plan.input.activeDays.includes(dayOfWeek);

      if (isRest) {
        newSchedule.push({
          id: `task-${dateStr}`,
          date: dateStr,
          dayOfWeek,
          dayNameAr: dayOfWeek === 5 ? 'الجمعة' : 'يوم دراسة',
          isRestDay: true,
          status: 'pending',
          notes: 'استراحة أسبوعية'
        });
      } else {
        const chunk = chunks[chunkIdx];
        const surah = QuranMath.getSurah(chunk.start.surahNumber);
        const estMinutes = QuranMath.estimateMemorizationMinutes(chunk.totalVerses, plan.input.level);

        newSchedule.push({
          id: `task-${dateStr}`,
          date: dateStr,
          dayOfWeek,
          dayNameAr: 'يوم دراسة',
          isRestDay: false,
          memorizationTask: {
            surahNumber: chunk.start.surahNumber,
            surahName: surah?.name || '',
            startAyah: chunk.start.ayahNumber,
            endAyah: chunk.end.ayahNumber,
            versesCount: chunk.totalVerses,
            estimatedMinutes: estMinutes,
            completed: false
          },
          status: 'pending'
        });
        chunkIdx++;
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    // Sort by date
    newSchedule.sort((a, b) => a.date.localeCompare(b.date));
    const lastTask = newSchedule.filter(s => !s.isRestDay).pop();

    const updatedPlan: EngineGeneratedPlan = {
      ...plan,
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: lastTask ? lastTask.date : plan.meta.projectedEndDate
      }
    };

    return this.refreshActualVsPlanned(updatedPlan);
  }
};
