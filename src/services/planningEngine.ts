import { QuranMath, VerseCoordinate } from './quranMath';
import { ALL_SURAHS } from '../data/quranMeta';
import { createSecureId } from './secureId';

export interface PlanGenerationInput {
  title: string;
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
  startDate: string; // YYYY-MM-DD
  targetEndDate?: string; // YYYY-MM-DD (optional)
  level: 'beginner' | 'intermediate' | 'advanced' | 'hafiz';
  dailyAvailableMinutes: number; // For new memorization
  dailyRevisionMinutes: number; // For revision
  paceType: 'verses_per_day' | 'pages_per_day' | 'by_target_date';
  paceQuantity: number; // e.g., 5 verses or 1 page
  activeDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  restDays: number[]; // e.g. [5] for Friday
  schedulePreference: 'morning_evening' | 'single_session';
  existingMemorized?: Array<{ surahNumber: number; startAyah: number; endAyah: number }>;
}

export interface ScheduledTaskUnit {
  surahNumber: number;
  surahName: string;
  startAyah: number;
  endAyah: number;
  versesCount: number;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  userRating?: 'strong' | 'medium' | 'weak';
}

export interface ScheduledRevisionUnit {
  description: string;
  surahNumber?: number;
  surahName?: string;
  startAyah?: number;
  endAyah?: number;
  versesCount: number;
  estimatedMinutes: number;
  completed: boolean;
  type: 'minor' | 'major';
}

export interface ScheduledDayPlan {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayNameAr: string;
  isRestDay: boolean;
  memorizationTask?: ScheduledTaskUnit;
  minorRevisionTask?: ScheduledRevisionUnit;
  majorRevisionTask?: ScheduledRevisionUnit;
  status: 'pending' | 'completed' | 'skipped' | 'partially_completed';
  notes?: string;
}

export interface PlanFeasibility {
  isFeasible: boolean;
  cognitiveLoadScore: 'optimal' | 'light' | 'strenuous' | 'impossible';
  requiredMinutesNew: number;
  requiredMinutesRevision: number;
  totalRequiredMinutes: number;
  availableMinutes: number;
  dailyPaceVerses: number;
  warningMessage?: string;
}

export interface EngineGeneratedPlan {
  id: string;
  title: string;
  input: PlanGenerationInput;
  meta: {
    startCoordinate: VerseCoordinate;
    endCoordinate: VerseCoordinate;
    totalVerses: number;
    activeStudyDaysCount: number;
    restDaysCount: number;
    totalCalendarDays: number;
    projectedEndDate: string;
    weeklyWorkloadHours: number;
  };
  feasibility: PlanFeasibility;
  rationale: string;
  schedule: ScheduledDayPlan[];
  actualVsPlanned: {
    plannedVersesToDate: number;
    actualVersesMemorized: number;
    varianceVerses: number;
    status: 'ahead' | 'on_track' | 'behind';
  };
  isActive: boolean;
  isPaused: boolean;
  pausedAt?: string;
  createdAt: string;
}

const ARABIC_DAY_NAMES = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت'
];

export const PlanningEngine = {
  /**
   * Helper: Format Date object to YYYY-MM-DD safely
   */
  formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Helper: Parse YYYY-MM-DD into a localized Date object
   */
  parseDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  /**
   * Calculate available study days between two dates, skipping rest days
   */
  countActiveDaysBetween(startDateStr: string, endDateStr: string, activeDays: number[], restDays: number[]): number {
    const start = this.parseDate(startDateStr);
    const end = this.parseDate(endDateStr);
    let count = 0;
    const cur = new Date(start);

    while (cur <= end) {
      const dayOfWeek = cur.getDay();
      if (activeDays.includes(dayOfWeek) && !restDays.includes(dayOfWeek)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  },

  /**
   * Assess feasibility and cognitive workload limits
   */
  assessFeasibility(
    dailyPaceVerses: number,
    level: PlanGenerationInput['level'],
    availableDailyMinutes: number,
    dailyRevisionMinutes: number
  ): PlanFeasibility {
    const estNewMinutes = QuranMath.estimateMemorizationMinutes(dailyPaceVerses, level);
    const estRevMinutes = Math.round(dailyPaceVerses * 1.5); // estimated rolling revision time
    const totalRequired = estNewMinutes + estRevMinutes;
    const totalAvailable = availableDailyMinutes + dailyRevisionMinutes;

    let score: PlanFeasibility['cognitiveLoadScore'] = 'optimal';
    let warning: string | undefined;

    // Cognitive limit caps based on level:
    const maxPace = {
      beginner: 8,
      intermediate: 15,
      advanced: 25,
      hafiz: 45
    }[level];

    if (dailyPaceVerses > maxPace * 1.5 || estNewMinutes > availableDailyMinutes * 1.8) {
      score = 'impossible';
      warning = `المستهدف اليومي (${dailyPaceVerses} آية) يفوق الطاقة الذهنية لمستوى (${level}) في الوقت المتاح (${availableDailyMinutes} دقيقة). سيؤدي هذا لتفلت سريع للحفظ. ننصح بتخفيض المستهدف إلى ${Math.round(maxPace * 0.8)} آيات أو تمديد موعد الختم.`;
    } else if (dailyPaceVerses > maxPace || estNewMinutes > availableDailyMinutes) {
      score = 'strenuous';
      warning = `خطة مكثفة (${dailyPaceVerses} آية يومياً). الوقت المتاح (${availableDailyMinutes} دقيقة) مضغوط، لذا ستحتاج لانضباط عالٍ دون انقطاع.`;
    } else if (dailyPaceVerses <= Math.max(1, Math.floor(maxPace * 0.25))) {
      score = 'light';
    }

    return {
      isFeasible: score !== 'impossible',
      cognitiveLoadScore: score,
      requiredMinutesNew: estNewMinutes,
      requiredMinutesRevision: estRevMinutes,
      totalRequiredMinutes: totalRequired,
      availableMinutes: totalAvailable,
      dailyPaceVerses,
      warningMessage: warning
    };
  },

  /**
   * Main Plan Generator
   */
  generatePlan(input: PlanGenerationInput): EngineGeneratedPlan {
    const startCoord: VerseCoordinate = { surahNumber: input.startSurah, ayahNumber: input.startAyah };
    const endCoord: VerseCoordinate = { surahNumber: input.endSurah, ayahNumber: input.endAyah };

    const parsedStartDate = this.parseDate(input.startDate);
    if (!Number.isFinite(parsedStartDate.getTime()) || this.formatDate(parsedStartDate) !== input.startDate) {
      throw new Error('تاريخ بداية الخطة غير صالح.');
    }
    if (input.paceType !== 'by_target_date' && (!Number.isSafeInteger(input.paceQuantity) || input.paceQuantity <= 0)) {
      throw new Error('المقدار اليومي يجب أن يكون عدداً صحيحاً موجباً.');
    }
    const activeDays = Array.isArray(input.activeDays) ? input.activeDays : [];
    const restDays = Array.isArray(input.restDays) ? input.restDays : [];
    const hasSchedulableDay = activeDays.some(day =>
      Number.isSafeInteger(day) && day >= 0 && day <= 6 && !restDays.includes(day)
    );
    if (!hasSchedulableDay) {
      throw new Error('يجب اختيار يوم دراسة نشط واحد على الأقل لتوليد الخطة.');
    }

    const totalVerses = QuranMath.countVersesBetween(startCoord, endCoord);

    if (totalVerses <= 0) {
      throw new Error("نطاق الآيات غير صحيح؛ نقطة البداية يجب أن تسبق أو تعادل نقطة النهاية.");
    }

    // Determine Daily Pace (Verses Per Day)
    let dailyPaceVerses = input.paceQuantity;
    if (input.paceType === 'pages_per_day') {
      // Average 15 verses per page in standard Quranic distribution
      dailyPaceVerses = Math.max(1, Math.round(input.paceQuantity * 15));
    } else if (input.paceType === 'by_target_date' && input.targetEndDate) {
      const activeDaysCount = this.countActiveDaysBetween(input.startDate, input.targetEndDate, activeDays, restDays);
      if (activeDaysCount <= 0) {
        throw new Error("لا توجد أيام دراسة نشطة متاحة بين تاريخ البداية والنهاية المحدد.");
      }
      dailyPaceVerses = Math.max(1, Math.ceil(totalVerses / activeDaysCount));
    }

    if (!Number.isSafeInteger(dailyPaceVerses) || dailyPaceVerses <= 0) {
      throw new Error('المقدار اليومي الناتج غير صالح؛ راجع عدد الآيات أو تاريخ الهدف.');
    }

    // Workload & Feasibility Assessment
    const feasibility = this.assessFeasibility(
      dailyPaceVerses,
      input.level,
      input.dailyAvailableMinutes,
      input.dailyRevisionMinutes
    );

    // Slicing into verse ranges
    const chunks = QuranMath.sliceRangeIntoChunks(startCoord, endCoord, dailyPaceVerses);

    // Generate Scheduled Day-by-Day Calendar
    const schedule: ScheduledDayPlan[] = [];
    const curDate = this.parseDate(input.startDate);
    let chunkIndex = 0;
    let activeDaysCount = 0;
    let restDaysCount = 0;

    // Rolling window of recent memorized passages for Minor Revision (المراجعة الصغرى)
    const recentMemorizedPool: ScheduledTaskUnit[] = [];

    while (chunkIndex < chunks.length) {
      const dateStr = this.formatDate(curDate);
      const dayOfWeek = curDate.getDay();
      const isRest = restDays.includes(dayOfWeek) || !activeDays.includes(dayOfWeek);

      if (isRest) {
        restDaysCount++;
        // On rest days, provide optional light revision or rest
        schedule.push({
          id: `task-${dateStr}`,
          date: dateStr,
          dayOfWeek,
          dayNameAr: ARABIC_DAY_NAMES[dayOfWeek],
          isRestDay: true,
          status: 'pending',
          notes: 'يوم استراحة أسبوعي لراحة الذاكرة أو مراجعة خفيفة حرة'
        });
      } else {
        activeDaysCount++;
        const chunk = chunks[chunkIndex];
        const surah = QuranMath.getSurah(chunk.start.surahNumber) || ALL_SURAHS[0];
        
        const estMinutes = QuranMath.estimateMemorizationMinutes(chunk.totalVerses, input.level);

        const memTask: ScheduledTaskUnit = {
          surahNumber: chunk.start.surahNumber,
          surahName: surah.name,
          startAyah: chunk.start.ayahNumber,
          endAyah: chunk.end.ayahNumber,
          versesCount: chunk.totalVerses,
          estimatedMinutes: estMinutes,
          completed: false
        };

        // Minor Revision (Last 3 to 7 days rolling pool)
        let minorRevTask: ScheduledRevisionUnit | undefined;
        if (recentMemorizedPool.length > 0) {
          const toReview = recentMemorizedPool.slice(-3);
          const totalRevVerses = toReview.reduce((acc, c) => acc + c.versesCount, 0);
          minorRevTask = {
            description: `مراجعة الحفظ الحديث (${toReview.map(t => `${t.surahName} ${t.startAyah}-${t.endAyah}`).join('، ')})`,
            versesCount: totalRevVerses,
            estimatedMinutes: Math.min(input.dailyRevisionMinutes, Math.round(totalRevVerses * 0.8)),
            completed: false,
            type: 'minor'
          };
        }

        // Major Revision (Cumulative portions or older memorized)
        let majorRevTask: ScheduledRevisionUnit | undefined;
        if (input.existingMemorized && input.existingMemorized.length > 0 && activeDaysCount % 2 === 0) {
          const portion = input.existingMemorized[(activeDaysCount / 2) % input.existingMemorized.length];
          const portionSurah = QuranMath.getSurah(portion.surahNumber);
          const portionVerses = portion.endAyah - portion.startAyah + 1;
          majorRevTask = {
            description: `تثبيت المحفوظ التراكمي: سورة ${portionSurah?.name || ''} (${portion.startAyah}-${portion.endAyah})`,
            surahNumber: portion.surahNumber,
            surahName: portionSurah?.name,
            startAyah: portion.startAyah,
            endAyah: portion.endAyah,
            versesCount: portionVerses,
            estimatedMinutes: Math.min(input.dailyRevisionMinutes, Math.round(portionVerses * 0.4)),
            completed: false,
            type: 'major'
          };
        }

        schedule.push({
          id: `task-${dateStr}`,
          date: dateStr,
          dayOfWeek,
          dayNameAr: ARABIC_DAY_NAMES[dayOfWeek],
          isRestDay: false,
          memorizationTask: memTask,
          minorRevisionTask: minorRevTask,
          majorRevisionTask: majorRevTask,
          status: 'pending'
        });

        recentMemorizedPool.push(memTask);
        chunkIndex++;
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    // Projected completion date is the date of the last memorization task
    const lastTask = schedule.filter(s => !s.isRestDay).pop();
    const projectedEndDate = lastTask ? lastTask.date : input.startDate;
    const totalCalendarDays = schedule.length;
    const weeklyWorkloadHours = Number(((feasibility.totalRequiredMinutes * (activeDaysCount / (totalCalendarDays / 7 || 1))) / 60).toFixed(1));

    // Generate Pedagogical Explanation in Arabic
    const startSurahName = QuranMath.getSurah(input.startSurah)?.name;
    const endSurahName = QuranMath.getSurah(input.endSurah)?.name;
    const rationale = `صُممت هذه الخطة لحفظ ${totalVerses} آية كريمة (من ${startSurahName} ${input.startAyah} إلى ${endSurahName} ${input.endAyah}) بمعدل علمي مدروس قدره ${dailyPaceVerses} آيات في كل يوم دراسة. 
اعتمد المحرك توزيع الورد على ${activeDaysCount} يوماً نشطاً مع تخصيص ${restDaysCount} يوماً للاستراحة وتفريغ الذاكرة، مما يمنع التشتت والنسيان.
كما تتضمن الخطة مسارين متوازيين: «المراجعة الصغرى» لربط آيات الأيام السابقة فوراً بالورد الجديد، و«المراجعة الكبرى» لتثبيت السور التراكمية وفق فترات زمنية متباعدة.`;

    const planId = `plan-${createSecureId()}`;

    return {
      id: planId,
      title: input.title || `خطة حفظ من ${startSurahName} إلى ${endSurahName}`,
      input,
      meta: {
        startCoordinate: startCoord,
        endCoordinate: endCoord,
        totalVerses,
        activeStudyDaysCount: activeDaysCount,
        restDaysCount,
        totalCalendarDays,
        projectedEndDate,
        weeklyWorkloadHours
      },
      feasibility,
      rationale,
      schedule,
      actualVsPlanned: {
        plannedVersesToDate: 0,
        actualVersesMemorized: 0,
        varianceVerses: 0,
        status: 'on_track'
      },
      isActive: true,
      isPaused: false,
      createdAt: new Date().toISOString()
    };
  }
};
