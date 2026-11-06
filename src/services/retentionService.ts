import {
  PortionStatusRecord, 
  PortionMemorizationStatus, 
  RevisionRating, 
  RevisionLogEntry, 
  WeakVerseItem,
  WirdPortion 
} from '../types/quran';
import { StorageService, STORAGE_KEYS as APP_STORAGE_KEYS, isValidWeakVerseRecord } from './storageService';
import { createSecureId } from './secureId';
import { getPagesForAyahRange } from './pageProgressService';
import { ALL_SURAHS } from '../data/quranMeta';
import { 
  calculateUniqueMemorizedAyahs,
  calculateUniqueMemorizedPages,
  calculateUniqueRetentionScore, 
  getPrioritizedRevisionQueue, 
  getLocalDateString,
  calculateCanonicalSM2,
  createCanonicalPortionId,
  addDaysToLocalDate,
  mergeCanonicalPortionRecords,
  sortRevisionPortionsByPriority
} from './unifiedPortionService';

const STORAGE_KEYS = {
  WEAK_VERSES: 'wird_weak_verses'
};

function assertValidQuranRange(surahNumber: number, startAyah: number, endAyah: number): void {
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  if (!Number.isSafeInteger(surahNumber) || !surah ||
      !Number.isSafeInteger(startAyah) || startAyah < 1 ||
      !Number.isSafeInteger(endAyah) || endAyah < startAyah || endAyah > surah.versesCount) {
    throw new Error('نطاق الآيات غير صالح؛ تحقق من رقم السورة وبداية الآية ونهايتها.');
  }
}

function isValidWeakVerseArray(value: unknown): value is WeakVerseItem[] {
  if (!Array.isArray(value) || value.length > 6236 || !value.every(isValidWeakVerseRecord)) return false;
  const ids = new Set<string>();
  const coordinates = new Set<string>();
  for (const item of value) {
    const coordinate = item.surahNumber + ':' + item.ayahNumber;
    if (ids.has(item.id) || coordinates.has(coordinate)) return false;
    ids.add(item.id);
    coordinates.add(coordinate);
  }
  return true;
}

function isLegacyMemorizationHistoryEntry(log: RevisionLogEntry): boolean {
  // The legacy first-memorization writer uniquely prefixed these synthetic entries with init-.
  return log.id.startsWith('init-');
}

// Initial realistic seed portions representing various Quran portions across the 6 statuses
export const DEFAULT_PORTIONS: PortionStatusRecord[] = [
  {
    id: 'portion-1',
    type: 'surah',
    surahNumber: 1,
    surahName: 'الفاتحة',
    startAyah: 1,
    endAyah: 7,
    pageNumber: 1,
    juzNumber: 1,
    status: 'stable',
    lastReviewedDate: '2026-11-01',
    nextDueDate: '2026-11-15',
    intervalDays: 14,
    easeFactor: 2.8,
    repetitionCount: 12,
    mistakesCount: 0,
    history: [
      { id: 'log-1-1', date: '2026-10-18', rating: 'successful', intervalDaysBefore: 7, intervalDaysAfter: 14, notes: 'إتقان تام والحمد لله' }
    ]
  },
  {
    id: 'portion-67-1',
    type: 'passage',
    surahNumber: 67,
    surahName: 'الملك',
    startAyah: 1,
    endAyah: 15,
    pageNumber: 562,
    juzNumber: 29,
    status: 'recently_memorized',
    lastReviewedDate: '2026-11-02',
    nextDueDate: getLocalDateString(), // Due today
    intervalDays: 2,
    easeFactor: 2.5,
    repetitionCount: 4,
    mistakesCount: 1,
    history: [
      { id: 'log-67-1', date: '2026-10-31', rating: 'successful', intervalDaysBefore: 1, intervalDaysAfter: 2 }
    ]
  },
  {
    id: 'portion-67-2',
    type: 'passage',
    surahNumber: 67,
    surahName: 'الملك',
    startAyah: 16,
    endAyah: 30,
    pageNumber: 563,
    juzNumber: 29,
    status: 'needs_revision',
    lastReviewedDate: '2026-10-30',
    nextDueDate: getLocalDateString(), // Due today
    intervalDays: 3,
    easeFactor: 2.2,
    repetitionCount: 3,
    mistakesCount: 2,
    history: [
      { id: 'log-67-2', date: '2026-10-30', rating: 'difficult', intervalDaysBefore: 3, intervalDaysAfter: 3, notes: 'تردد في خواتيم الآيات 20-24' }
    ]
  },
  {
    id: 'portion-78-1',
    type: 'passage',
    surahNumber: 78,
    surahName: 'النبأ',
    startAyah: 1,
    endAyah: 20,
    pageNumber: 582,
    juzNumber: 30,
    status: 'currently_memorizing',
    lastReviewedDate: '2026-11-03',
    nextDueDate: getLocalDateString(), // Due today
    intervalDays: 1,
    easeFactor: 2.4,
    repetitionCount: 2,
    mistakesCount: 1,
    history: [
      { id: 'log-78-1', date: '2026-11-03', rating: 'difficult', intervalDaysBefore: 1, intervalDaysAfter: 1, notes: 'حفظ جديد يتم تثبيته اليوم' }
    ]
  },
  {
    id: 'portion-18-1',
    type: 'passage',
    surahNumber: 18,
    surahName: 'الكهف',
    startAyah: 1,
    endAyah: 10,
    pageNumber: 293,
    juzNumber: 15,
    status: 'stable',
    lastReviewedDate: '2026-10-28',
    nextDueDate: '2026-11-05',
    intervalDays: 8,
    easeFactor: 2.6,
    repetitionCount: 7,
    mistakesCount: 0,
    history: [
      { id: 'log-18-1', date: '2026-10-28', rating: 'successful', intervalDaysBefore: 4, intervalDaysAfter: 8 }
    ]
  },
  {
    id: 'portion-109',
    type: 'surah',
    surahNumber: 109,
    surahName: 'الكافرون',
    startAyah: 1,
    endAyah: 6,
    pageNumber: 603,
    juzNumber: 30,
    status: 'weak',
    lastReviewedDate: '2026-11-01',
    nextDueDate: getLocalDateString(), // Due today
    intervalDays: 1,
    easeFactor: 1.7,
    repetitionCount: 5,
    mistakesCount: 4,
    history: [
      { id: 'log-109-1', date: '2026-11-01', rating: 'failed', intervalDaysBefore: 2, intervalDaysAfter: 1, notes: 'خلط متكرر بين الآيتين 3 و 5' }
    ]
  },
  {
    id: 'portion-93',
    type: 'surah',
    surahNumber: 93,
    surahName: 'الضحى',
    startAyah: 1,
    endAyah: 11,
    pageNumber: 596,
    juzNumber: 30,
    status: 'stable',
    lastReviewedDate: '2026-10-25',
    nextDueDate: '2026-11-08',
    intervalDays: 14,
    easeFactor: 2.7,
    repetitionCount: 9,
    mistakesCount: 0,
    history: []
  },
  {
    id: 'portion-112',
    type: 'surah',
    surahNumber: 112,
    surahName: 'الإخلاص',
    startAyah: 1,
    endAyah: 4,
    pageNumber: 604,
    juzNumber: 30,
    status: 'stable',
    lastReviewedDate: '2026-10-20',
    nextDueDate: '2026-11-20',
    intervalDays: 30,
    easeFactor: 2.9,
    repetitionCount: 15,
    mistakesCount: 0,
    history: []
  },
  {
    id: 'portion-113',
    type: 'surah',
    surahNumber: 113,
    surahName: 'الفلق',
    startAyah: 1,
    endAyah: 5,
    pageNumber: 604,
    juzNumber: 30,
    status: 'stable',
    lastReviewedDate: '2026-10-20',
    nextDueDate: '2026-11-20',
    intervalDays: 30,
    easeFactor: 2.9,
    repetitionCount: 15,
    mistakesCount: 0,
    history: []
  },
  {
    id: 'portion-114',
    type: 'surah',
    surahNumber: 114,
    surahName: 'الناس',
    startAyah: 1,
    endAyah: 6,
    pageNumber: 604,
    juzNumber: 30,
    status: 'stable',
    lastReviewedDate: '2026-10-20',
    nextDueDate: '2026-11-20',
    intervalDays: 30,
    easeFactor: 2.9,
    repetitionCount: 15,
    mistakesCount: 0,
    history: []
  }
];

export const DEFAULT_WEAK_VERSES: WeakVerseItem[] = [
  {
    id: 'weak-109-3-5',
    surahNumber: 109,
    surahName: 'الكافرون',
    ayahNumber: 3,
    text: 'وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ',
    mistakeCount: 3,
    lastFailedDate: '2026-11-01',
    notes: 'التباس التكرار بين الآيتين 3 و 5 (الحاضر والمستقبل)'
  },
  {
    id: 'weak-67-8',
    surahNumber: 67,
    surahName: 'الملك',
    ayahNumber: 8,
    text: 'تَكَادُ تَمَيَّزُ مِنَ الْغَيْظِ ۖ كُلَّمَا أُلْقِيَ فِيهَا فَوْجٌ سَأَلَهُمْ خَزَنَتُهَا أَلَمْ يَأْتِكُمْ نَذِيرٌ',
    mistakeCount: 2,
    lastFailedDate: '2026-10-30',
    notes: 'تردد في بداية الآية وربطها بالآية السابقة'
  },
  {
    id: 'weak-18-2',
    surahNumber: 18,
    surahName: 'الكهف',
    ayahNumber: 2,
    text: 'قَيِّمًا لِّيُنذِرَ بَأْسًا شَدِيدًا مِّن لَّدُنْهُ وَيُبَشِّرَ الْمُؤْمِنِينَ الَّذِينَ يَعْمَلُونَ الصَّالِحَاتِ أَنَّ لَهُمْ أَجْرًا حَسَنًا',
    mistakeCount: 1,
    lastFailedDate: '2026-10-25',
    notes: 'تذكر كلمة قيماً فور انتهاء الآية الأولى'
  }
];

export interface RetentionMetrics {
  totalTrackedPortions: number;
  totalMemorizedAyahs: number;
  totalMemorizedPages: number;
  retentionScorePercentage: number; // 0-100%
  statusBreakdown: {
    stable: number;
    recently_memorized: number;
    needs_revision: number;
    weak: number;
    currently_memorizing: number;
    not_memorized: number;
  };
  statusPercentages: {
    stable: number;
    recently_memorized: number;
    needs_revision: number;
    weak: number;
    currently_memorizing: number;
  };
  totalReviewsCompleted: number;
  weakVersesCount: number;
  averageEaseFactor: number;
}

// In-memory fallback for weak verses in server-side / test environments


export const RetentionService = {
  // Get all tracked portions (Returns canonical WirdPortion array from StorageService)
  getPortions(): PortionStatusRecord[] {
    return StorageService.getUnifiedPortions() as PortionStatusRecord[];
  },

  // Save portions (Persists canonical WirdPortion to StorageService)
  savePortions(portions: PortionStatusRecord[]): boolean {
    return StorageService.saveUnifiedPortions(portions);
  },

  // Update a single portion's status directly
  updatePortionStatus(id: string, newStatus: PortionMemorizationStatus): PortionStatusRecord[] {
    if (typeof id !== 'string' || !id.trim() || id.length > 180) {
      throw new Error('معرّف المقطع غير صالح؛ لم يتم تعديل أي بيانات.');
    }
    if (!['not_memorized', 'currently_memorizing', 'recently_memorized', 'stable', 'needs_revision', 'weak'].includes(newStatus)) {
      throw new Error('حالة الحفظ المطلوبة غير صالحة؛ لم يتم تعديل أي بيانات.');
    }
    const portions = this.getPortions();
    const index = portions.findIndex(portion => portion.id === id);
    if (index < 0) throw new Error('المقطع المطلوب غير موجود؛ لم يتم حفظ تحديث وهمي.');
    const updated: PortionStatusRecord[] = portions.map((portion, currentIndex): PortionStatusRecord =>
      currentIndex !== index ? portion : {
        ...portion,
        status: newStatus,
        strength: newStatus === 'weak' ? 'weak' : newStatus === 'stable' ? 'strong' : 'medium'
      }
    );
    if (!this.savePortions(updated)) throw new Error('تعذر حفظ تحديث حالة المقطع في التخزين المحلي.');
    return updated;
  },

  // Add a new portion to track
  addPortion(portion: Omit<PortionStatusRecord, 'id' | 'history'>): PortionStatusRecord {
    if (!portion || typeof portion !== 'object') throw new Error('بيانات المقطع غير صالحة.');
    assertValidQuranRange(portion.surahNumber, portion.startAyah, portion.endAyah);
    const surahMeta = ALL_SURAHS.find(surah => surah.number === portion.surahNumber)!;
    const normalizedPortion = { ...portion, surahName: surahMeta.name };
    const portions = this.getPortions();
    const canonicalId = createCanonicalPortionId(portion.surahNumber, portion.startAyah, portion.endAyah);
    const existingIndex = portions.findIndex(existing =>
      existing.id === canonicalId ||
      (existing.surahNumber === portion.surahNumber &&
        existing.startAyah === portion.startAyah && existing.endAyah === portion.endAyah)
    );

    let record: PortionStatusRecord;
    if (existingIndex >= 0) {
      // Re-adding an existing range must never reset its review history,
      // counters, or weaker memorization state.
      record = mergeCanonicalPortionRecords(
        portions[existingIndex],
        normalizedPortion,
        'RetentionService.addPortion'
      ) as PortionStatusRecord;
      record.id = canonicalId;
      portions[existingIndex] = record;
    } else {
      record = {
        ...normalizedPortion,
        id: canonicalId,
        history: [],
        createdAt: portion.createdAt || new Date().toISOString()
      };
      portions.unshift(record);
    }
    if (!this.savePortions(portions)) throw new Error('تعذر حفظ المقطع الجديد في التخزين المحلي.');
    return record;
  },

  // Record memorization session completion into canonical portions
  recordMemorizationCompletion(surahNumber: number, startAyah: number, endAyah: number): PortionStatusRecord {
    assertValidQuranRange(surahNumber, startAyah, endAyah);
    const surahMeta = ALL_SURAHS.find(s => s.number === surahNumber)!;
    const portions = this.getPortions();
    const canonicalId = createCanonicalPortionId(surahNumber, startAyah, endAyah);
    const today = getLocalDateString();
    const tomorrow = addDaysToLocalDate(today, 1);
    const surahName = surahMeta.name;

    const existingIndex = portions.findIndex(p => 
      p.id === canonicalId || 
      (p.surahNumber === surahNumber && p.startAyah === startAyah && p.endAyah === endAyah)
    );

    let updatedPortion: PortionStatusRecord;
    if (existingIndex >= 0) {
      const existing = portions[existingIndex];
      const newStatus = existing.status === 'not_memorized' || existing.status === 'currently_memorizing' 
        ? 'recently_memorized' 
        : existing.status;
      const nextIntervalDays = newStatus === 'weak'
        ? 1
        : Math.max(1, existing.intervalDays || 1);
      updatedPortion = {
        ...existing,
        id: canonicalId,
        status: newStatus,
        strength: newStatus === 'weak' ? 'weak' : existing.strength || 'medium',
        lastReviewedDate: today,
        nextDueDate: tomorrow,
        repetitionCount: (existing.repetitionCount || 0) + 1,
        intervalDays: nextIntervalDays,
        easeFactor: existing.easeFactor || 2.5,
        history: existing.history || []
      };
      portions[existingIndex] = updatedPortion;
    } else {
      updatedPortion = {
        id: canonicalId,
        type: 'passage',
        surahNumber,
        surahName,
        startAyah,
        endAyah,
        pageNumber: surahMeta ? surahMeta.pageStart : 1,
        status: 'recently_memorized',
        lastReviewedDate: today,
        nextDueDate: tomorrow,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitionCount: 1,
        mistakesCount: 0,
        history: [],
        createdAt: new Date().toISOString()
      };
      portions.unshift(updatedPortion);
    }

    if (!this.savePortions(portions)) {
      throw new Error('تعذر حفظ تقدم الحفظ في التخزين المحلي؛ لم يتم تأكيد الإنجاز.');
    }
    return updatedPortion;
  },

  // Record performance after a revision session using canonical SM-2
  recordRevisionPerformance(
    portionId: string, 
    rating: RevisionRating, 
    notes?: string,
    weakAyahDetails?: { ayahNumber: number; text?: string; notes?: string },
    minutesSpent: number = 0
  ): {
    updatedPortion: PortionStatusRecord;
    nextIntervalDays: number;
    nextDueDate: string;
    activitySaved: boolean;
    messageAr: string;
  } {
    if (typeof portionId !== 'string' || !portionId.trim() || portionId.length > 180) {
      throw new Error('معرّف مقطع المراجعة غير صالح.');
    }
    if (!['successful', 'difficult', 'failed'].includes(rating)) {
      throw new Error('تقييم المراجعة غير صالح؛ اختر تقييمًا معتمدًا.');
    }
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) {
      throw new Error('ملاحظات المراجعة تتجاوز الحد المسموح أو تحتوي على قيمة غير صالحة.');
    }
    if (!Number.isSafeInteger(minutesSpent) || minutesSpent < 0 || minutesSpent > 1440) {
      throw new Error('مدة المراجعة المسجلة غير صالحة؛ يجب أن تكون عدد دقائق صحيحاً من 0 إلى 1440.');
    }
    let weakAyahText: string | undefined;
    if (weakAyahDetails !== undefined) {
      const suppliedText = weakAyahDetails?.text;
      if (rating !== 'failed' || !weakAyahDetails || typeof weakAyahDetails !== 'object' ||
          !Number.isSafeInteger(weakAyahDetails.ayahNumber) || weakAyahDetails.ayahNumber < 1 ||
          typeof suppliedText !== 'string' || !suppliedText.trim() || suppliedText.length > 4000 ||
          (weakAyahDetails.notes !== undefined && (typeof weakAyahDetails.notes !== 'string' || weakAyahDetails.notes.length > 2000))) {
        throw new Error('بيانات الآية المتعثرة غير صالحة أو لا تتوافق مع تقييم المراجعة.');
      }
      weakAyahText = suppliedText;
    }

    const portions = this.getPortions();
    const target = portions.find(p => p.id === portionId);
    if (!target) {
      throw new Error(`Portion with id ${portionId} not found`);
    }
    if (weakAyahDetails &&
        (weakAyahDetails.ayahNumber < target.startAyah || weakAyahDetails.ayahNumber > target.endAyah)) {
      throw new Error('الآية المتعثرة يجب أن تقع داخل نطاق المقطع الذي تتم مراجعته.');
    }

    const todayStr = getLocalDateString();
    const reviewedPagesCount = getPagesForAyahRange(target.surahNumber, target.startAyah, target.endAyah).length;
    if (reviewedPagesCount === 0) {
      throw new Error('تعذر تحديد صفحات المقطع بدقة؛ لم يتم تسجيل عدد صفحات تقريبي ولم يتغير تقييم المراجعة.');
    }

    // Execute canonical SM-2 algorithm
    const sm2Result = calculateCanonicalSM2(target, rating, {
      customTodayStr: todayStr,
      gracePeriodDays: 1
    });

    const mistakesCount = rating === 'failed' 
      ? (target.mistakesCount || 0) + 1 
      : (target.mistakesCount || 0);

    const logEntry: RevisionLogEntry = {
      id: `log-${createSecureId()}`,
      date: todayStr,
      rating,
      intervalDaysBefore: target.intervalDays || 1,
      intervalDaysAfter: sm2Result.intervalDays,
      notes: notes || undefined
    };

    const updatedPortion: PortionStatusRecord = {
      ...target,
      status: sm2Result.status,
      strength: sm2Result.strength,
      lastReviewedDate: todayStr,
      nextDueDate: sm2Result.nextDueDate,
      intervalDays: sm2Result.intervalDays,
      easeFactor: sm2Result.easeFactor,
      repetitionCount: sm2Result.repetitionCount,
      mistakesCount,
      history: [logEntry, ...(target.history || [])]
    };

    const updatedList = portions.map(p => p.id === portionId ? updatedPortion : p);
    const previousWeakArchive = StorageService.getRawItem(APP_STORAGE_KEYS.WEAK_VERSES);
    const restoreAttempt = (): boolean => {
      const portionsRestored = this.savePortions(portions) &&
        JSON.stringify(this.getPortions()) === JSON.stringify(portions);
      if (previousWeakArchive === null) {
        StorageService.removeRawItem(APP_STORAGE_KEYS.WEAK_VERSES);
      } else {
        StorageService.setRawItem(APP_STORAGE_KEYS.WEAK_VERSES, previousWeakArchive);
      }
      const weakArchiveRestored = StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES) === previousWeakArchive;
      return portionsRestored && weakArchiveRestored;
    };

    if (!this.savePortions(updatedList)) {
      throw new Error('تعذر حفظ تقييم المراجعة في التخزين المحلي؛ لم يتم تأكيد التغيير.');
    }

    if (rating === 'failed' && weakAyahDetails) {
      try {
        this.addOrIncrementWeakVerse(
          target.surahNumber,
          weakAyahDetails.ayahNumber,
          target.surahName,
          weakAyahText!,
          weakAyahDetails.notes || 'خطأ أثناء جلسة المراجعة'
        );
      } catch (error) {
        if (!restoreAttempt()) {
          throw new Error('فشل حفظ الآية المتعثرة، كما تعذر التحقق من استعادة تقييم المراجعة وسجل الآيات السابق. لا تغلق الصفحة؛ صدّر نسخة احتياطية قبل المتابعة.');
        }
        throw error;
      }
    }

    // Activity aggregation is a separate durable write; record only measured time.
    const activitySaved = StorageService.recordSessionCompletion(
      0,
      reviewedPagesCount,
      minutesSpent,
      `مراجعة ${target.surahName} (${target.startAyah}-${target.endAyah}) - ${rating === 'successful' ? 'ناجحة' : rating === 'difficult' ? 'صعبة' : 'غير متقنة'}`
    );
    if (!activitySaved) {
      if (!restoreAttempt()) {
        throw new Error('تعذر حفظ سجل نشاط المراجعة، كما تعذر التحقق من استعادة تقييم المقطع وسجل الآيات المتعثرة. لا تغلق الصفحة؛ صدّر نسخة احتياطية قبل المتابعة.');
      }
      throw new Error('تعذر حفظ سجل نشاط المراجعة؛ أُلغي التقييم وأُعيدت حالة المقطع وقائمة الآيات إلى ما قبل المحاولة. يمكنك المحاولة مجددًا.');
    }

    return {
      updatedPortion,
      nextIntervalDays: sm2Result.intervalDays,
      nextDueDate: sm2Result.nextDueDate,
      activitySaved: true,
      messageAr: sm2Result.messageAr
    };
  },

  // 1. Daily Revision Queue (Enforces the canonical 20-item daily limit)
  getDailyRevisionQueue(dateStr?: string): PortionStatusRecord[] {
    const portions = this.getPortions();
    const today = dateStr || getLocalDateString();
    const queueResult = getPrioritizedRevisionQueue(portions, {
      todayStr: today,
      maxDailyLimit: 20
    });
    return queueResult.queue as PortionStatusRecord[];
  },

  // Full queue details including catch-up recommendation
  getDailyRevisionQueueDetails(dateStr?: string) {
    const portions = this.getPortions();
    const today = dateStr || getLocalDateString();
    return getPrioritizedRevisionQueue(portions, {
      todayStr: today,
      maxDailyLimit: 20
    });
  },

  // 2. Weekly Revision Overview (7 upcoming days)
  getWeeklyRevisionOverview(startDateStr?: string): {
    date: string;
    dayName: string;
    isToday: boolean;
    portions: PortionStatusRecord[];
  }[] {
    const portions = this.getPortions();
    const firstDateStr = startDateStr || getLocalDateString();
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const todayStr = getLocalDateString();

    const weekOverview = [];

    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysToLocalDate(firstDateStr, i);
      const [year, month, day] = dateStr.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const dayName = daysAr[localDate.getDay()];

      // For day 0 (today), include anything overdue as well
      const dayPortions = i === 0
        ? portions.filter(p => p.nextDueDate <= dateStr && p.status !== 'not_memorized')
        : portions.filter(p => p.nextDueDate === dateStr && p.status !== 'not_memorized');

      weekOverview.push({
        date: dateStr,
        dayName,
        isToday: dateStr === todayStr,
        portions: sortRevisionPortionsByPriority(dayPortions) as PortionStatusRecord[]
      });
    }

    return weekOverview;
  },

  // 3. Weak Verses List — use the same UID-scoped storage adapter as all other progress.
  getWeakVerses(): WeakVerseItem[] {
    const data = StorageService.getRawItem(STORAGE_KEYS.WEAK_VERSES);
    if (data === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error('بيانات الآيات المتعثرة تالفة؛ تم الحفاظ عليها دون استبدال.');
    }
    if (!isValidWeakVerseArray(parsed)) {
      throw new Error('بنية بيانات الآيات المتعثرة غير صالحة؛ تم إيقاف التعديل لحماية السجل الحالي.');
    }
    return parsed;
  },

  saveWeakVerses(items: WeakVerseItem[]): boolean {
    if (!isValidWeakVerseArray(items)) return false;
    return StorageService.setRawItem(STORAGE_KEYS.WEAK_VERSES, JSON.stringify(items));
  },

  addOrIncrementWeakVerse(
    surahNumber: number,
    ayahNumber: number,
    _surahName: string,
    text: string,
    notes?: string
  ): WeakVerseItem[] {
    const surah = Number.isSafeInteger(surahNumber)
      ? ALL_SURAHS.find(item => item.number === surahNumber)
      : undefined;
    if (!surah || !Number.isSafeInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surah.versesCount) {
      throw new Error('رقم السورة أو الآية غير صحيح؛ لم يتم تعديل قائمة الآيات المتعثرة.');
    }
    if (typeof text !== 'string' || !text.trim() || text.length > 4000 ||
        (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000))) {
      throw new Error('نص الآية أو الملاحظة غير صالح؛ لم يتم تعديل قائمة الآيات المتعثرة.');
    }
    const items = this.getWeakVerses();
    const existingIndex = items.findIndex(item =>
      item.surahNumber === surahNumber && item.ayahNumber === ayahNumber
    );
    const today = getLocalDateString();

    if (existingIndex >= 0) {
      if (items[existingIndex].mistakeCount >= 1000000) {
        throw new Error('وصل عداد تعثر الآية إلى الحد الآمن؛ لم يتم تغيير السجل.');
      }
      items[existingIndex].mistakeCount += 1;
      items[existingIndex].lastFailedDate = today;
      items[existingIndex].surahName = surah.name;
      if (notes) items[existingIndex].notes = notes;
    } else {
      items.unshift({
        id: `weak-${surahNumber}-${ayahNumber}-${createSecureId()}`,
        surahNumber,
        surahName: surah.name,
        ayahNumber,
        text,
        mistakeCount: 1,
        lastFailedDate: today,
        notes
      });
    }

    if (!this.saveWeakVerses(items)) throw new Error('تعذر حفظ قائمة الآيات المتعثرة في التخزين المحلي.');
    return items;
  },

  resolveWeakVerse(id: string): WeakVerseItem[] {
    if (typeof id !== 'string' || !id.trim() || id.length > 180) {
      throw new Error('معرّف الآية المتعثرة غير صالح.');
    }
    const items = this.getWeakVerses();
    const updated = items.filter(item => item.id !== id);
    if (updated.length === items.length) return items; // Idempotent repeated resolution.
    if (!this.saveWeakVerses(updated)) throw new Error('تعذر تحديث قائمة الآيات المتعثرة في التخزين المحلي.');
    return updated;
  },

  // 4. Flattened Revision History Audit Log
  getRevisionHistory(): Array<RevisionLogEntry & { surahName: string; surahNumber: number; startAyah: number; endAyah: number }> {
    const portions = this.getPortions();
    const flatLogs: Array<RevisionLogEntry & { surahName: string; surahNumber: number; startAyah: number; endAyah: number }> = [];

    portions.forEach(portion => {
      (portion.history || []).forEach(log => {
        // Older releases incorrectly wrote first-time memorization as a successful review.
        // Keep the original archive untouched, but exclude those entries from review history.
        if (isLegacyMemorizationHistoryEntry(log)) return;
        flatLogs.push({
          ...log,
          surahName: portion.surahName,
          surahNumber: portion.surahNumber,
          startAyah: portion.startAyah,
          endAyah: portion.endAyah
        });
      });
    });

    // Event IDs are the review identity. Collapse exact retries/duplicate projections
    // across portions so one review cannot inflate the history or dashboard totals.
    flatLogs.sort((a, b) =>
      b.date.localeCompare(a.date) ||
      a.id.localeCompare(b.id) ||
      a.surahNumber - b.surahNumber ||
      a.startAyah - b.startAyah
    );
    const seenIds = new Set<string>();
    const uniqueLogs = flatLogs.filter(log => {
      if (seenIds.has(log.id)) return false;
      seenIds.add(log.id);
      return true;
    });

    return uniqueLogs;
  },

  // 5. Retention Dashboard Metrics
  getRetentionDashboardMetrics(): RetentionMetrics {
    const portions = this.getPortions();
    let weakVersesCount = 0;
    try { weakVersesCount = this.getWeakVerses().length; } catch {
      // Metrics for memorization/revision must remain available if this separate archive needs recovery.
    }
    const history = this.getRevisionHistory();

    const breakdown = {
      stable: 0,
      recently_memorized: 0,
      needs_revision: 0,
      weak: 0,
      currently_memorizing: 0,
      not_memorized: 0
    };

    let totalEase = 0;
    portions.forEach(portion => {
      breakdown[portion.status] = (breakdown[portion.status] || 0) + 1;
    });

    const activePortions = portions.filter(portion => portion.status !== 'not_memorized');
    activePortions.forEach(portion => { totalEase += portion.easeFactor; });
    const memorizedPortionsCount = activePortions.length;
    const averageEase = memorizedPortionsCount > 0
      ? Number((totalEase / memorizedPortionsCount).toFixed(2))
      : 2.5;
    const retentionScore = calculateUniqueRetentionScore(portions as WirdPortion[]);

    const totalActive = memorizedPortionsCount || 1;
    const statusPercentages = {
      stable: memorizedPortionsCount > 0 ? Math.round((breakdown.stable / totalActive) * 100) : 0,
      recently_memorized: memorizedPortionsCount > 0 ? Math.round((breakdown.recently_memorized / totalActive) * 100) : 0,
      needs_revision: memorizedPortionsCount > 0 ? Math.round((breakdown.needs_revision / totalActive) * 100) : 0,
      weak: memorizedPortionsCount > 0 ? Math.round((breakdown.weak / totalActive) * 100) : 0,
      currently_memorizing: memorizedPortionsCount > 0 ? Math.round((breakdown.currently_memorizing / totalActive) * 100) : 0
    };

    const { uniqueCount: uniqueAyahsCount } = calculateUniqueMemorizedAyahs(portions as WirdPortion[]);
    const uniquePagesCount = calculateUniqueMemorizedPages(portions as WirdPortion[]);

    return {
      totalTrackedPortions: portions.length,
      totalMemorizedAyahs: uniqueAyahsCount,
      totalMemorizedPages: uniquePagesCount,
      retentionScorePercentage: Math.min(100, Math.max(0, retentionScore)),
      statusBreakdown: breakdown,
      statusPercentages,
      totalReviewsCompleted: history.length,
      weakVersesCount,
      averageEaseFactor: averageEase
    };
  },

  // Explicit demo loader for demo mode
  loadDemoPortions(): void {
    const canonicalDemoPortions = DEFAULT_PORTIONS.map(portion => ({
      ...portion,
      id: createCanonicalPortionId(portion.surahNumber, portion.startAyah, portion.endAyah)
    }));
    this.savePortions(canonicalDemoPortions);
    this.saveWeakVerses(DEFAULT_WEAK_VERSES);
  },

  // Complete reset
  resetAll(): void {
    StorageService.removeRawItem(STORAGE_KEYS.WEAK_VERSES);
  }
};

