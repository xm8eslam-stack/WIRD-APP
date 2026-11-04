import { 
  PortionStatusRecord, 
  PortionMemorizationStatus, 
  RevisionRating, 
  RevisionLogEntry, 
  WeakVerseItem 
} from '../types/quran';
import { StorageService } from './storageService';
import { ALL_SURAHS } from '../data/quranMeta';
import { VERIFIED_AYAHS } from '../data/verifiedAyahs';

const STORAGE_KEYS = {
  PORTIONS: 'wird_portions_status',
  WEAK_VERSES: 'wird_weak_verses'
};

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
    nextDueDate: new Date().toISOString().split('T')[0], // Due today
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
    nextDueDate: new Date().toISOString().split('T')[0], // Due today
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
    nextDueDate: new Date().toISOString().split('T')[0], // Due today
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
    nextDueDate: new Date().toISOString().split('T')[0], // Due today
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

// In-memory fallback for server-side / test / build environments where localStorage is not defined
let memoryPortions: PortionStatusRecord[] | null = null;
let memoryWeakVerses: WeakVerseItem[] | null = null;

export const RetentionService = {
  // Get all tracked portions
  getPortions(): PortionStatusRecord[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEYS.PORTIONS);
        if (data) {
          return JSON.parse(data);
        }
        this.savePortions(DEFAULT_PORTIONS);
        return DEFAULT_PORTIONS;
      }
      if (!memoryPortions) memoryPortions = [...DEFAULT_PORTIONS];
      return memoryPortions;
    } catch {
      return DEFAULT_PORTIONS;
    }
  },

  // Save portions
  savePortions(portions: PortionStatusRecord[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.PORTIONS, JSON.stringify(portions));
      } else {
        memoryPortions = portions;
      }
    } catch (e) {
      console.warn('Failed to save portions', e);
    }
  },

  // Update a single portion's status directly
  updatePortionStatus(id: string, newStatus: PortionMemorizationStatus): PortionStatusRecord[] {
    const portions = this.getPortions();
    const updated = portions.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        status: newStatus
      };
    });
    this.savePortions(updated);
    return updated;
  },

  // Add a new portion to track
  addPortion(portion: Omit<PortionStatusRecord, 'id' | 'history'>): PortionStatusRecord {
    const portions = this.getPortions();
    const newRecord: PortionStatusRecord = {
      ...portion,
      id: `portion-${portion.surahNumber}-${portion.startAyah}-${portion.endAyah}-${Date.now()}`,
      history: []
    };
    const updated = [newRecord, ...portions];
    this.savePortions(updated);
    return newRecord;
  },

  // Record performance after a revision session
  recordRevisionPerformance(
    portionId: string, 
    rating: RevisionRating, 
    notes?: string,
    weakAyahDetails?: { ayahNumber: number; text?: string; notes?: string }
  ): {
    updatedPortion: PortionStatusRecord;
    nextIntervalDays: number;
    nextDueDate: string;
    messageAr: string;
  } {
    const portions = this.getPortions();
    const target = portions.find(p => p.id === portionId);
    if (!target) {
      throw new Error(`Portion with id ${portionId} not found`);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const prevInterval = Math.max(1, target.intervalDays || 1);
    let newInterval = 1;
    let newEaseFactor = target.easeFactor || 2.5;
    let newStatus: PortionMemorizationStatus = target.status;
    let mistakesCount = target.mistakesCount || 0;
    let messageAr = '';

    if (rating === 'successful') {
      // Successful revision
      newEaseFactor = Math.min(3.0, Number((newEaseFactor + 0.15).toFixed(2)));
      
      if (target.repetitionCount === 0) {
        newInterval = 2;
      } else if (target.repetitionCount === 1) {
        newInterval = 4;
      } else {
        newInterval = Math.round(prevInterval * newEaseFactor);
      }
      
      // If repetitions >= 3 and rating was successful, it becomes stable
      if (target.repetitionCount >= 2) {
        newStatus = 'stable';
      } else {
        newStatus = 'recently_memorized';
      }
      messageAr = `رسوخ ممتاز ومتقن! تمت مضاعفة الفاصل الزمني للمراجعة القادمة إلى ${newInterval} يوماً.`;

    } else if (rating === 'difficult') {
      // Difficult revision with hesitation
      newEaseFactor = Math.max(1.3, Number((newEaseFactor - 0.05).toFixed(2)));
      newInterval = Math.max(2, Math.round(prevInterval * 0.7));
      newStatus = 'needs_revision';
      messageAr = `مراجعة متوسطة مع تردد. تمت جدولة المراجعة بعد ${newInterval} أيام للتثبيت.`;

    } else {
      // Failed revision / forgetting
      newEaseFactor = Math.max(1.3, Number((newEaseFactor - 0.25).toFixed(2)));
      newInterval = 1; // reset to tomorrow
      newStatus = 'weak';
      mistakesCount += 1;
      messageAr = `المقطع يتفلت ويحتاج عناية فائقة. تم تسجيله كـ "ضعيف" وجدولته للمراجعة غداً.`;

      // Auto-track weak verse if specific ayah provided
      if (weakAyahDetails) {
        this.addOrIncrementWeakVerse(
          target.surahNumber,
          weakAyahDetails.ayahNumber,
          target.surahName,
          weakAyahDetails.text || `آية رقم ${weakAyahDetails.ayahNumber}`,
          weakAyahDetails.notes || 'خطأ أثناء جلسة المراجعة'
        );
      }
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);
    const nextDueDate = nextDate.toISOString().split('T')[0];

    const logEntry: RevisionLogEntry = {
      id: `log-${Date.now()}`,
      date: todayStr,
      rating,
      intervalDaysBefore: prevInterval,
      intervalDaysAfter: newInterval,
      notes: notes || undefined
    };

    const updatedPortion: PortionStatusRecord = {
      ...target,
      status: newStatus,
      lastReviewedDate: todayStr,
      nextDueDate,
      intervalDays: newInterval,
      easeFactor: newEaseFactor,
      repetitionCount: target.repetitionCount + 1,
      mistakesCount,
      history: [logEntry, ...(target.history || [])]
    };

    const updatedList = portions.map(p => p.id === portionId ? updatedPortion : p);
    this.savePortions(updatedList);

    // Also record session completion in daily logs
    const versesCount = (target.endAyah - target.startAyah + 1) || 10;
    StorageService.recordSessionCompletion(
      0, 
      Math.max(1, Math.round(versesCount / 15)), 
      15, 
      `مراجعة ${target.surahName} (${target.startAyah}-${target.endAyah}) - ${rating === 'successful' ? 'ناجحة' : rating === 'difficult' ? 'صعبة' : 'غير متقنة'}`
    );

    return {
      updatedPortion,
      nextIntervalDays: newInterval,
      nextDueDate,
      messageAr
    };
  },

  // 1. Daily Revision Queue
  getDailyRevisionQueue(dateStr?: string): PortionStatusRecord[] {
    const portions = this.getPortions();
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    // Filter items due today or overdue
    const duePortions = portions.filter(p => p.nextDueDate <= targetDate && p.status !== 'not_memorized');

    // Priority ordering:
    // 1. 'weak' first (most vulnerable)
    // 2. 'needs_revision' second
    // 3. 'currently_memorizing' third
    // 4. 'recently_memorized' fourth
    // 5. 'stable' last
    const priorityWeight: Record<PortionMemorizationStatus, number> = {
      weak: 0,
      needs_revision: 1,
      currently_memorizing: 2,
      recently_memorized: 3,
      stable: 4,
      not_memorized: 5
    };

    return duePortions.sort((a, b) => {
      const weightA = priorityWeight[a.status];
      const weightB = priorityWeight[b.status];
      if (weightA !== weightB) return weightA - weightB;
      // Secondary: lower ease factor first
      return a.easeFactor - b.easeFactor;
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
    const baseDate = startDateStr ? new Date(startDateStr) : new Date();
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const todayStr = new Date().toISOString().split('T')[0];

    const weekOverview = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = daysAr[d.getDay()];

      // For day 0 (today), include anything overdue as well
      const dayPortions = i === 0 
        ? portions.filter(p => p.nextDueDate <= dateStr && p.status !== 'not_memorized')
        : portions.filter(p => p.nextDueDate === dateStr && p.status !== 'not_memorized');

      weekOverview.push({
        date: dateStr,
        dayName,
        isToday: dateStr === todayStr,
        portions: dayPortions
      });
    }

    return weekOverview;
  },

  // 3. Weak Verses List
  getWeakVerses(): WeakVerseItem[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEYS.WEAK_VERSES);
        if (data) {
          return JSON.parse(data);
        }
        this.saveWeakVerses(DEFAULT_WEAK_VERSES);
        return DEFAULT_WEAK_VERSES;
      }
      if (!memoryWeakVerses) memoryWeakVerses = [...DEFAULT_WEAK_VERSES];
      return memoryWeakVerses;
    } catch {
      return DEFAULT_WEAK_VERSES;
    }
  },

  saveWeakVerses(items: WeakVerseItem[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.WEAK_VERSES, JSON.stringify(items));
      } else {
        memoryWeakVerses = items;
      }
    } catch (e) {
      console.warn('Failed to save weak verses', e);
    }
  },

  addOrIncrementWeakVerse(
    surahNumber: number, 
    ayahNumber: number, 
    surahName: string, 
    text: string, 
    notes?: string
  ): WeakVerseItem[] {
    const items = this.getWeakVerses();
    const existingIndex = items.findIndex(i => i.surahNumber === surahNumber && i.ayahNumber === ayahNumber);
    const today = new Date().toISOString().split('T')[0];

    if (existingIndex >= 0) {
      items[existingIndex].mistakeCount += 1;
      items[existingIndex].lastFailedDate = today;
      if (notes) {
        items[existingIndex].notes = notes;
      }
    } else {
      items.unshift({
        id: `weak-${surahNumber}-${ayahNumber}-${Date.now()}`,
        surahNumber,
        surahName,
        ayahNumber,
        text,
        mistakeCount: 1,
        lastFailedDate: today,
        notes
      });
    }

    this.saveWeakVerses(items);
    return items;
  },

  resolveWeakVerse(id: string): WeakVerseItem[] {
    const items = this.getWeakVerses().filter(i => i.id !== id);
    this.saveWeakVerses(items);
    return items;
  },

  // 4. Flattened Revision History Audit Log
  getRevisionHistory(): Array<RevisionLogEntry & { surahName: string; surahNumber: number; startAyah: number; endAyah: number }> {
    const portions = this.getPortions();
    const flatLogs: Array<RevisionLogEntry & { surahName: string; surahNumber: number; startAyah: number; endAyah: number }> = [];

    portions.forEach(portion => {
      (portion.history || []).forEach(log => {
        flatLogs.push({
          ...log,
          surahName: portion.surahName,
          surahNumber: portion.surahNumber,
          startAyah: portion.startAyah,
          endAyah: portion.endAyah
        });
      });
    });

    // Sort descending by date
    return flatLogs.sort((a, b) => b.date.localeCompare(a.date));
  },

  // 5. Retention Dashboard Metrics
  getRetentionDashboardMetrics(): RetentionMetrics {
    const portions = this.getPortions();
    const weakVerses = this.getWeakVerses();
    const history = this.getRevisionHistory();

    const breakdown = {
      stable: 0,
      recently_memorized: 0,
      needs_revision: 0,
      weak: 0,
      currently_memorizing: 0,
      not_memorized: 0
    };

    let totalVerses = 0;
    let weightedRetentionPoints = 0;
    let totalEase = 0;

    portions.forEach(p => {
      breakdown[p.status] = (breakdown[p.status] || 0) + 1;
      const count = (p.endAyah - p.startAyah + 1) || 1;
      totalEase += p.easeFactor;

      if (p.status !== 'not_memorized') {
        totalVerses += count;

        // Weighted points for retention quality
        if (p.status === 'stable') weightedRetentionPoints += count * 1.0;
        else if (p.status === 'recently_memorized') weightedRetentionPoints += count * 0.8;
        else if (p.status === 'needs_revision') weightedRetentionPoints += count * 0.5;
        else if (p.status === 'weak') weightedRetentionPoints += count * 0.2;
        else if (p.status === 'currently_memorizing') weightedRetentionPoints += count * 0.4;
      }
    });

    const memorizedPortionsCount = portions.filter(p => p.status !== 'not_memorized').length;
    const averageEase = portions.length > 0 ? Number((totalEase / portions.length).toFixed(2)) : 2.5;
    
    // Overall retention percentage
    const retentionScore = totalVerses > 0 
      ? Math.round((weightedRetentionPoints / totalVerses) * 100)
      : 85;

    const totalActive = memorizedPortionsCount || 1;
    const statusPercentages = {
      stable: Math.round((breakdown.stable / totalActive) * 100),
      recently_memorized: Math.round((breakdown.recently_memorized / totalActive) * 100),
      needs_revision: Math.round((breakdown.needs_revision / totalActive) * 100),
      weak: Math.round((breakdown.weak / totalActive) * 100),
      currently_memorizing: Math.round((breakdown.currently_memorizing / totalActive) * 100)
    };

    return {
      totalTrackedPortions: portions.length,
      totalMemorizedAyahs: totalVerses,
      retentionScorePercentage: Math.min(100, Math.max(10, retentionScore)),
      statusBreakdown: breakdown,
      statusPercentages,
      totalReviewsCompleted: history.length,
      weakVersesCount: weakVerses.length,
      averageEaseFactor: averageEase
    };
  }
};
