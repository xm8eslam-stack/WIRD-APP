import { 
  WirdPortion,
  MemorizationPlan,
  PortionStatusRecord, 
  RevisionItem, 
  PortionMemorizationStatus, 
  RevisionRating,
  RevisionLogEntry 
} from '../types/quran';
import { ALL_SURAHS } from '../data/quranMeta';
import { QURAN_PAGE_INDEX } from '../data/quranPageIndex.generated';

/**
 * ====================================================================
 * WIRD — Unified Portion & Spaced Retention Engine (Phase 3A)
 * ====================================================================
 * 
 * Provides:
 * 1. Canonical portion identity and boundaries.
 * 2. Overlap-safe unique Ayah and page counts.
 * 3. Unified SuperMemo SM-2 algorithm with exact grade mapping.
 * 4. Local-date-safe date arithmetic (no timezone midnight shifts).
 * 5. Daily revision queue prioritization, limits (max 20), grace period, and catch-up.
 * 6. Lossless, idempotent versioned migration from legacy keys.
 */

// Local-Date-Safe Utilities (prevents UTC offset rollover bugs)
const VALID_PORTION_STATUSES: PortionMemorizationStatus[] = [
  'not_memorized', 'currently_memorizing', 'recently_memorized',
  'stable', 'needs_revision', 'weak'
];

function isValidLocalDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function assertValidPortionCollection(portions: WirdPortion[]): void {
  if (!Array.isArray(portions) || portions.length > 10000) {
    throw new TypeError('Portion collection must be an array containing no more than 10,000 records.');
  }
  for (const portion of portions) {
    if (!portion || typeof portion !== 'object') {
      throw new TypeError('Portion collection contains a malformed record.');
    }
    assertValidQuranRange(portion.surahNumber, portion.startAyah, portion.endAyah);
    if (!VALID_PORTION_STATUSES.includes(portion.status)) {
      throw new TypeError('Portion collection contains an unsupported memorization status.');
    }
  }
}

export function getLocalDateString(d: Date = new Date()): string {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) throw new TypeError('A valid Date is required.');
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToLocalDate(dateStr: string, days: number): string {
  if (!isValidLocalDateString(dateStr) || !Number.isSafeInteger(days) || Math.abs(days) > 100000) {
    throw new RangeError('A valid YYYY-MM-DD date and a safe whole-day offset are required.');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function getDayDifference(dateStr1: string, dateStr2: string): number {
  if (!isValidLocalDateString(dateStr1) || !isValidLocalDateString(dateStr2)) {
    throw new RangeError('Both dates must be valid YYYY-MM-DD calendar dates.');
  }
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

// Canonical Portion Identity
export function createCanonicalPortionId(surahNumber: number, startAyah: number, endAyah: number): string {
  assertValidQuranRange(surahNumber, startAyah, endAyah);
  return `s${surahNumber}_a${startAyah}_a${endAyah}`;
}

/**
 * 3. Prevent duplicate Ayah counting when portions overlap.
 * Returns exact unique Ayah count and the Set of unique Ayah keys.
 */
export function calculateUniqueMemorizedAyahs(portions: WirdPortion[]): {
  uniqueCount: number;
  ayahKeys: Set<string>;
} {
  assertValidPortionCollection(portions);
  const keys = new Set<string>();

  portions.forEach(p => {
    // Portions that count as memorized: stable, recently_memorized, needs_revision, weak
    if (
      p.status === 'stable' || 
      p.status === 'recently_memorized' || 
      p.status === 'needs_revision' || 
      p.status === 'weak'
    ) {
      for (let a = p.startAyah; a <= p.endAyah; a++) {
        keys.add(`${p.surahNumber}:${a}`);
      }
    }
  });

  return { uniqueCount: keys.size, ayahKeys: keys };
}

/**
 * Calculate retention quality once per unique ayah, resolving overlapping
 * records conservatively by keeping the weakest recorded status.
 */
export function calculateUniqueRetentionScore(portions: WirdPortion[]): number {
  assertValidPortionCollection(portions);
  const statusPriority: Record<PortionMemorizationStatus, number> = {
    weak: 0,
    needs_revision: 1,
    currently_memorizing: 2,
    recently_memorized: 3,
    stable: 4,
    not_memorized: 5
  };
  const statusPoints: Record<PortionMemorizationStatus, number> = {
    stable: 1,
    recently_memorized: 0.8,
    needs_revision: 0.5,
    currently_memorizing: 0.4,
    weak: 0.2,
    not_memorized: 0
  };
  const uniqueStatuses = new Map<string, PortionMemorizationStatus>();

  portions.forEach(portion => {
    if (portion.status === 'not_memorized') return;
    for (let ayah = portion.startAyah; ayah <= portion.endAyah; ayah++) {
      const key = `${portion.surahNumber}:${ayah}`;
      const existing = uniqueStatuses.get(key);
      if (!existing || statusPriority[portion.status] < statusPriority[existing]) {
        uniqueStatuses.set(key, portion.status);
      }
    }
  });

  if (uniqueStatuses.size === 0) return 0;
  const totalPoints = [...uniqueStatuses.values()].reduce((sum, status) => sum + statusPoints[status], 0);
  return Math.round((totalPoints / uniqueStatuses.size) * 100);
}

/**
 * Calculate unique memorized pages using verified Quran page mappings.
 * Returns how many unique Mushaf pages (1 to 604) have their verses memorized.
 */
export function calculateUniqueMemorizedPages(portions: WirdPortion[]): number {
  const { ayahKeys } = calculateUniqueMemorizedAyahs(portions);
  if (ayahKeys.size === 0) return 0;

  // Count only pages whose every ayah is covered by memorized portions.
  let completedPages = 0;
  for (const segments of Object.values(QURAN_PAGE_INDEX)) {
    const isComplete = segments.every(segment => {
      for (let ayahNumber = segment.startAyah; ayahNumber <= segment.endAyah; ayahNumber++) {
        if (!ayahKeys.has(`${segment.surahNumber}:${ayahNumber}`)) return false;
      }
      return true;
    });
    if (isComplete) completedPages++;
  }

  return completedPages;
}

/**
 * Resolve the Surah numbers touched by an explicit memorization-plan scope.
 * Page/Juz scopes are returned for display and validation only; automatic
 * memorization start still requires an exact ayah scope.
 */
export function getPlanTargetSurahNumbers(
  plan: Pick<MemorizationPlan, 'targetSurahs' | 'targetJuz' | 'startPage' | 'endPage'>
): number[] {
  if (!plan || typeof plan !== 'object') throw new TypeError('A valid memorization plan scope is required.');

  if (plan.targetSurahs !== undefined) {
    if (!Array.isArray(plan.targetSurahs)) throw new TypeError('Target Surahs must be an array.');
    if (plan.targetSurahs.length === 0) {
      // An empty explicit list means no Surah filter was selected.
    } else if (plan.targetSurahs.some(number => !Number.isSafeInteger(number) || number < 1 || number > 114)) {
      throw new RangeError('Target Surahs must contain integers from 1 to 114.');
    }
    if (plan.targetSurahs.length > 0) {
      if (new Set(plan.targetSurahs).size !== plan.targetSurahs.length) {
        throw new RangeError('Target Surahs must not contain duplicate numbers.');
      }
      return [...plan.targetSurahs];
    }
  }

  if (plan.targetJuz !== undefined) {
    if (!Array.isArray(plan.targetJuz)) throw new TypeError('Target Juz values must be an array.');
    if (plan.targetJuz.length === 0) {
      // An empty explicit list means no Juz filter was selected.
    } else if (plan.targetJuz.some(juz => !Number.isSafeInteger(juz) || juz < 1 || juz > 30)) {
      throw new RangeError('Target Juz values must be integers from 1 to 30.');
    }
    if (plan.targetJuz.length > 0) {
      if (new Set(plan.targetJuz).size !== plan.targetJuz.length) {
        throw new RangeError('Target Juz values must not contain duplicates.');
      }
      return ALL_SURAHS
        .filter(surah => plan.targetJuz!.some(juz => juz >= surah.juzStart && juz <= surah.juzEnd))
        .map(surah => surah.number);
    }
  }

  if (plan.startPage !== undefined || plan.endPage !== undefined) {
    if (!Number.isSafeInteger(plan.startPage) || !Number.isSafeInteger(plan.endPage) ||
        plan.startPage! < 1 || plan.endPage! > 604 || plan.endPage! < plan.startPage!) {
      throw new RangeError('Page scope must be an inclusive integer range from 1 to 604.');
    }
    return ALL_SURAHS
      .filter(surah => surah.pageStart <= plan.endPage! && surah.pageEnd >= plan.startPage!)
      .map(surah => surah.number);
  }

  return ALL_SURAHS.map(surah => surah.number);
}

/**
 * Find the next memorization range not already represented by a memorized
 * portion. Existing in-progress portions are resumed before new gaps.
 */
export function findNextUnmemorizedRange(
  portions: WirdPortion[],
  surahNumbers: number[],
  maxVerses: number
): { surahNumber: number; startAyah: number; endAyah: number } | null {
  assertValidPortionCollection(portions);
  if (!Number.isSafeInteger(maxVerses) || maxVerses < 1 || maxVerses > 6236) {
    throw new RangeError('maxVerses must be a whole number from 1 to 6,236.');
  }
  if (!Array.isArray(surahNumbers) || surahNumbers.some(number => !Number.isSafeInteger(number) || number < 1 || number > 114)) {
    throw new RangeError('Every target Surah must be an integer from 1 to 114.');
  }
  const limit = maxVerses;
  const targets = Array.from(new Set(surahNumbers));

  for (const surahNumber of targets) {
    const surah = ALL_SURAHS.find(item => item.number === surahNumber);
    if (!surah) continue;

    const inProgress = portions
      .filter(portion => portion.surahNumber === surahNumber && portion.status === 'currently_memorizing')
      .sort((a, b) => a.startAyah - b.startAyah)[0];
    if (inProgress && inProgress.startAyah >= 1 && inProgress.startAyah <= surah.versesCount) {
      // Resume the exact persisted passage. Never clip it to the daily target:
      // completion updates exact coordinate matches, so a child range would
      // leave the parent in-progress and cause the same passage to repeat.
      const endAyah = inProgress.endAyah;
      return {
        surahNumber,
        startAyah: inProgress.startAyah,
        endAyah
      };
    }

    const memorized = portions.filter(portion =>
      portion.surahNumber === surahNumber && portion.status !== 'not_memorized'
    );

    let ayah = 1;
    while (ayah <= surah.versesCount) {
      const covered = memorized.some(portion => portion.startAyah <= ayah && portion.endAyah >= ayah);
      if (covered) {
        ayah++;
        continue;
      }

      const startAyah = ayah;
      let count = 0;
      while (ayah <= surah.versesCount && count < limit) {
        const isCovered = memorized.some(portion => portion.startAyah <= ayah && portion.endAyah >= ayah);
        if (isCovered) break;
        ayah++;
        count++;
      }

      return { surahNumber, startAyah, endAyah: ayah - 1 };
    }
  }

  return null;
}

/**
 * Grade mapping:
 * - Again (1): Lapse / Failed
 * - Hard (2): Difficult / Hesitation
 * - Good (3): Successful retention
 * - Strong (5): Flawless recall
 */
export type RetentionGradeInput = 1 | 2 | 3 | 4 | 5 | 'failed' | 'difficult' | 'successful' | 'strong';

export interface SM2CalculationResult {
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
  nextDueDate: string;
  status: PortionMemorizationStatus;
  strength: 'strong' | 'medium' | 'weak';
  messageAr: string;
}

export function calculateCanonicalSM2(
  portion: WirdPortion,
  gradeInput: RetentionGradeInput,
  options?: { customTodayStr?: string; gracePeriodDays?: number }
): SM2CalculationResult {
  assertValidPortionCollection([portion]);
  if (!isValidLocalDateString(options?.customTodayStr ?? getLocalDateString())) {
    throw new RangeError('SM-2 requires a valid YYYY-MM-DD review date.');
  }
  const todayStr = options?.customTodayStr || getLocalDateString();
  const gracePeriodDays = options?.gracePeriodDays ?? 1;
  if (!Number.isSafeInteger(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 30) {
    throw new RangeError('SM-2 grace period must be a whole number from 0 to 30 days.');
  }
  if (!['failed', 'difficult', 'successful', 'strong', 1, 2, 3, 4, 5].includes(gradeInput)) {
    throw new TypeError('Unsupported SM-2 review grade.');
  }
  if (!Number.isFinite(portion.easeFactor) || portion.easeFactor < 1.3 || portion.easeFactor > 3 ||
      !Number.isSafeInteger(portion.intervalDays) || portion.intervalDays < 0 ||
      !Number.isSafeInteger(portion.repetitionCount) || portion.repetitionCount < 0) {
    throw new RangeError('SM-2 portion scheduling metrics are invalid.');
  }

  // Normalize grade to 1, 2, 3, or 5
  let grade: 1 | 2 | 3 | 5;
  if (gradeInput === 'failed' || gradeInput === 1) grade = 1;
  else if (gradeInput === 'difficult' || gradeInput === 2) grade = 2;
  else if (gradeInput === 4 || gradeInput === 'successful' || gradeInput === 3) grade = 3;
  else grade = 5; // gradeInput 5 or 'strong'

  let easeFactor = portion.easeFactor || 2.5;
  let repCount = portion.repetitionCount || 0;
  let prevInterval = Math.max(1, portion.intervalDays || 1);
  let nextInterval = 1;
  let status: PortionMemorizationStatus = portion.status;
  let strength: 'strong' | 'medium' | 'weak' = 'medium';
  let messageAr = '';

  // Check if review is within grace period
  const daysOverdue = getDayDifference(portion.nextDueDate, todayStr);
  const withinGrace = daysOverdue <= gracePeriodDays;

  if (grade === 1) {
    // Lapse (Again / Failed)
    easeFactor = Math.max(1.3, Number((easeFactor - 0.20).toFixed(2)));
    nextInterval = 1; // Immediate review tomorrow
    repCount = 0;
    status = 'weak';
    strength = 'weak';
    messageAr = 'المقطع يتفلت ويحتاج عناية فائقة. تم تسجيله كـ "ضعيف" وجدولته للمراجعة غداً.';
  } else if (grade === 2) {
    // Hard / Hesitant
    easeFactor = Math.max(1.3, Number((easeFactor - 0.05).toFixed(2)));
    nextInterval = Math.max(2, Math.round(prevInterval * 0.7));
    status = 'needs_revision';
    strength = 'medium';
    messageAr = `مراجعة متوسطة مع تردد. تمت جدولة المراجعة بعد ${nextInterval} أيام للتثبيت.`;
  } else if (grade === 3) {
    // Good (Successful standard)
    if (!withinGrace && daysOverdue > 7) {
      // Overdue penalty dampened by grace period
      easeFactor = Math.max(1.3, Number((easeFactor - 0.05).toFixed(2)));
    } else {
      easeFactor = Math.min(3.0, Number((easeFactor + 0.05).toFixed(2)));
    }

    repCount += 1;
    if (repCount === 1) {
      nextInterval = 2;
    } else if (repCount === 2) {
      nextInterval = 4;
    } else {
      nextInterval = Math.round(prevInterval * easeFactor);
    }

    if (repCount >= 3) {
      status = 'stable';
      strength = 'strong';
    } else {
      status = 'recently_memorized';
      strength = 'medium';
    }
    messageAr = `مراجعة متقنة وناجحة! تمت جدولة المراجعة القادمة بعد ${nextInterval} يوماً.`;
  } else {
    // Strong (5 - Flawless)
    easeFactor = Math.min(3.0, Number((easeFactor + 0.15).toFixed(2)));
    repCount += 1;
    if (repCount === 1) {
      nextInterval = 3;
    } else if (repCount === 2) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(prevInterval * easeFactor * 1.1);
    }
    status = 'stable';
    strength = 'strong';
    messageAr = `رسوخ تام وإتقان رفيع والحمد لله! الفاصل القادم ${nextInterval} يوماً.`;
  }

  const nextDueDate = addDaysToLocalDate(todayStr, nextInterval);

  return {
    intervalDays: nextInterval,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitionCount: repCount,
    nextDueDate,
    status,
    strength,
    messageAr
  };
}

/**
 * 8. Overdue queue prioritization, daily limits, grace period, and catch-up behavior.
 */
export interface QueueOptions {
  todayStr?: string;
  maxDailyLimit?: number;
  gracePeriodDays?: number;
}

export interface PrioritizedQueueResult {
  queue: WirdPortion[];
  totalDueCount: number;
  overdueCount: number;
  catchUpSuggested: boolean;
}

export function getPrioritizedRevisionQueue(
  portions: WirdPortion[],
  options?: QueueOptions
): PrioritizedQueueResult {
  assertValidPortionCollection(portions);
  const today = options?.todayStr || getLocalDateString();
  if (!isValidLocalDateString(today)) throw new RangeError('Revision queue requires a valid YYYY-MM-DD date.');
  const maxLimit = options?.maxDailyLimit ?? 20;
  if (!Number.isSafeInteger(maxLimit) || maxLimit < 1 || maxLimit > 20) {
    throw new RangeError('Daily revision queue limit must be a whole number from 1 to 20.');
  }
  if (options?.gracePeriodDays !== undefined &&
      (!Number.isSafeInteger(options.gracePeriodDays) || options.gracePeriodDays < 0 || options.gracePeriodDays > 30)) {
    throw new RangeError('Revision queue grace period must be a whole number from 0 to 30 days.');
  }
  for (const portion of portions) {
    if ((portion.status !== 'not_memorized' && !isValidLocalDateString(portion.nextDueDate)) ||
        !Number.isFinite(portion.easeFactor) || portion.easeFactor < 1.3 || portion.easeFactor > 3) {
      throw new RangeError('Revision queue contains an invalid due date or ease factor.');
    }
  }

  // Filter portions due today or overdue (excluding unmemorized)
  const dueItems = portions.filter(p => p.nextDueDate <= today && p.status !== 'not_memorized');
  const overdueItems = dueItems.filter(p => p.nextDueDate < today);

  // Status priority weights
  const statusWeight: Record<PortionMemorizationStatus, number> = {
    weak: 0,
    needs_revision: 1,
    currently_memorizing: 2,
    recently_memorized: 3,
    stable: 4,
    not_memorized: 5
  };

  const sorted = [...dueItems].sort((a, b) => {
    // 1. Weak and needs_revision first
    const weightDiff = statusWeight[a.status] - statusWeight[b.status];
    if (weightDiff !== 0) return weightDiff;

    // 2. Oldest overdue first
    if (a.nextDueDate !== b.nextDueDate) {
      return a.nextDueDate.localeCompare(b.nextDueDate);
    }

    // 3. Lowest ease factor first
    return a.easeFactor - b.easeFactor;
  });

  const queue = sorted.slice(0, maxLimit);
  const catchUpSuggested = dueItems.length > 15;

  return {
    queue,
    totalDueCount: dueItems.length,
    overdueCount: overdueItems.length,
    catchUpSuggested
  };
}

/**
 * 9 & 10. Lossless, Idempotent, and Validated Migration (Phase 3.1)
 */
export interface MigrationReport {
  success: boolean;
  legacyPortionsCount: number;
  legacyRevisionCount: number;
  migratedPortionsCount: number;
  totalPreservedLogsCount: number;
  conflictAuditCount: number;
  alreadyMigrated: boolean;
  error?: string;
}

const STATUS_SEVERITY_HIERARCHY: Record<PortionMemorizationStatus, number> = {
  weak: 0,
  needs_revision: 1,
  currently_memorizing: 2,
  recently_memorized: 3,
  stable: 4,
  not_memorized: 5
};

function getStableHistoryConflictSuffix(log: RevisionLogEntry): string {
  const signature = JSON.stringify([
    log.date, log.rating, log.intervalDaysBefore, log.intervalDaysAfter, log.notes || ''
  ]);
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index++) {
    hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

const MAX_MIGRATED_HISTORY_ENTRIES = 10000;
const MAX_CONFLICT_AUDIT_ENTRIES = 1000;

function assertValidQuranRange(surahNumber: number, startAyah: number, endAyah: number): void {
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  if (!Number.isSafeInteger(surahNumber) || !surah ||
      !Number.isSafeInteger(startAyah) || startAyah < 1 ||
      !Number.isSafeInteger(endAyah) || endAyah < startAyah || endAyah > surah.versesCount) {
    throw new RangeError('Invalid Quran portion coordinates; migration and calculations require a valid integer Surah/ayah range.');
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRevisionHistoryEntry(value: unknown): value is RevisionLogEntry {
  return isPlainObject(value) && typeof value.id === 'string' && value.id.trim().length > 0 &&
    value.id.length <= 160 && isValidLocalDateString(value.date) &&
    ['successful', 'difficult', 'failed'].includes(value.rating) &&
    Number.isSafeInteger(value.intervalDaysBefore) && value.intervalDaysBefore >= 0 && value.intervalDaysBefore <= 100000 &&
    Number.isSafeInteger(value.intervalDaysAfter) && value.intervalDaysAfter >= 0 && value.intervalDaysAfter <= 100000 &&
    (value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= 2000));
}

function assertValidLegacyPortionInput(value: unknown, index: number): asserts value is PortionStatusRecord {
  if (!isPlainObject(value)) throw new TypeError('Malformed legacy portion at index ' + index + '.');
  assertValidQuranRange(value.surahNumber, value.startAyah, value.endAyah);
  if ((value.id !== undefined && (typeof value.id !== 'string' || value.id.length > 180)) ||
      (value.type !== undefined && !['passage', 'surah', 'page'].includes(value.type)) ||
      (value.surahName !== undefined && (typeof value.surahName !== 'string' || value.surahName.length > 100)) ||
      (value.status !== undefined && !VALID_PORTION_STATUSES.includes(value.status)) ||
      (value.lastReviewedDate !== undefined && value.lastReviewedDate !== '' && !isValidLocalDateString(value.lastReviewedDate)) ||
      (value.nextDueDate !== undefined && value.nextDueDate !== '' && !isValidLocalDateString(value.nextDueDate)) ||
      (value.pageNumber !== undefined && (!Number.isSafeInteger(value.pageNumber) || value.pageNumber < 1 || value.pageNumber > 604)) ||
      (value.pageStart !== undefined && (!Number.isSafeInteger(value.pageStart) || value.pageStart < 1 || value.pageStart > 604)) ||
      (value.pageEnd !== undefined && (!Number.isSafeInteger(value.pageEnd) || value.pageEnd < 1 || value.pageEnd > 604)) ||
      (value.pageStart !== undefined && value.pageEnd !== undefined && value.pageStart > value.pageEnd) ||
      (value.juzNumber !== undefined && (!Number.isSafeInteger(value.juzNumber) || value.juzNumber < 1 || value.juzNumber > 30)) ||
      (value.intervalDays !== undefined && (!Number.isSafeInteger(value.intervalDays) || value.intervalDays < 0 || value.intervalDays > 100000)) ||
      (value.easeFactor !== undefined && (typeof value.easeFactor !== 'number' || !Number.isFinite(value.easeFactor) || value.easeFactor < 0.1 || value.easeFactor > 3)) ||
      (value.repetitionCount !== undefined && (!Number.isSafeInteger(value.repetitionCount) || value.repetitionCount < 0 || value.repetitionCount > 100000)) ||
      (value.mistakesCount !== undefined && (!Number.isSafeInteger(value.mistakesCount) || value.mistakesCount < 0 || value.mistakesCount > 100000)) ||
      (value.revisionType !== undefined && !['minor', 'major'].includes(value.revisionType)) ||
      (value.strength !== undefined && !['strong', 'medium', 'weak'].includes(value.strength)) ||
      (value.createdAt !== undefined && (typeof value.createdAt !== 'string' || value.createdAt.length > 64 || !/^\\d{4}-\\d{2}-\\d{2}T/.test(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)))) ||
      (value.updatedAt !== undefined && (typeof value.updatedAt !== 'string' || value.updatedAt.length > 64 || !/^\\d{4}-\\d{2}-\\d{2}T/.test(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt)))) ||
      (value.history !== undefined && (!Array.isArray(value.history) || value.history.length > MAX_MIGRATED_HISTORY_ENTRIES || !value.history.every(isValidRevisionHistoryEntry))) ||
      (value.conflictAudit !== undefined && (!Array.isArray(value.conflictAudit) || value.conflictAudit.length > MAX_CONFLICT_AUDIT_ENTRIES ||
        !value.conflictAudit.every((item: unknown) => isPlainObject(item) &&
          typeof item.source === 'string' && item.source.length <= 160 &&
          typeof item.field === 'string' && item.field.length <= 160 &&
          (item.timestamp === undefined || (typeof item.timestamp === 'string' && item.timestamp.length <= 64 && /^\\d{4}-\\d{2}-\\d{2}T/.test(item.timestamp) && Number.isFinite(Date.parse(item.timestamp))))))) {
    throw new TypeError('Legacy portion record is invalid at index ' + index + '; source archive must be preserved.');
  }
}

function assertValidLegacyRevisionInput(value: unknown, index: number): asserts value is RevisionItem {
  if (!isPlainObject(value)) throw new TypeError('Malformed legacy revision item at index ' + index + '.');
  assertValidQuranRange(value.surahNumber, value.startAyah, value.endAyah);
  if ((value.id !== undefined && (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 160)) ||
      (value.surahName !== undefined && (typeof value.surahName !== 'string' || value.surahName.length > 100)) ||
      (value.type !== undefined && !['minor', 'major'].includes(value.type)) ||
      (value.lastReviewedDate !== undefined && value.lastReviewedDate !== '' && !isValidLocalDateString(value.lastReviewedDate)) ||
      (value.nextDueDate !== undefined && value.nextDueDate !== '' && !isValidLocalDateString(value.nextDueDate)) ||
      (value.pageNumber !== undefined && (!Number.isSafeInteger(value.pageNumber) || value.pageNumber < 1 || value.pageNumber > 604)) ||
      (value.juzNumber !== undefined && (!Number.isSafeInteger(value.juzNumber) || value.juzNumber < 1 || value.juzNumber > 30)) ||
      (value.intervalDays !== undefined && (!Number.isSafeInteger(value.intervalDays) || value.intervalDays < 0 || value.intervalDays > 100000)) ||
      (value.easeFactor !== undefined && (typeof value.easeFactor !== 'number' || !Number.isFinite(value.easeFactor) || value.easeFactor < 0 || value.easeFactor > 3)) ||
      (value.repetitionCount !== undefined && (!Number.isSafeInteger(value.repetitionCount) || value.repetitionCount < 0 || value.repetitionCount > 100000)) ||
      (value.strength !== undefined && !['strong', 'medium', 'weak'].includes(value.strength))) {
    throw new TypeError('Legacy revision record is invalid at index ' + index + '; source archive must be preserved.');
  }
}

function addConflictAudit(
  existing: WirdPortion,
  source: string,
  field: string,
  value: string
): void {
  if (!existing.conflictAudit) existing.conflictAudit = [];
  const normalizedValue = value.slice(0, 2000);
  const duplicate = existing.conflictAudit.some(item =>
    item.source === source && item.field === field && item.value === normalizedValue
  );
  if (duplicate) return;
  if (existing.conflictAudit.length >= MAX_CONFLICT_AUDIT_ENTRIES) {
    throw new Error('Conflict audit limit exceeded; original legacy archives must remain unchanged for manual recovery.');
  }
  existing.conflictAudit.push({
    source: source.slice(0, 160),
    field: field.slice(0, 160),
    value: normalizedValue
  });
}

function sameRevisionLogContent(a: RevisionLogEntry, b: RevisionLogEntry): boolean {
  return a.date === b.date && a.rating === b.rating &&
    a.intervalDaysBefore === b.intervalDaysBefore &&
    a.intervalDaysAfter === b.intervalDaysAfter &&
    a.notes === b.notes;
}

/**
 * Deduplicate only by stable event ID. Two different IDs represent two distinct
 * review attempts even when date, grade, intervals, and notes happen to match.
 */
function mergeHistoryEntries(
  existing: WirdPortion,
  incomingHistory: RevisionLogEntry[],
  sourceName: string
): void {
  if (!Array.isArray(incomingHistory)) {
    throw new Error('Revision history must be an array before migration.');
  }
  if (!existing.history) existing.history = [];

  for (const incomingLog of incomingHistory) {
    if (!incomingLog || typeof incomingLog.id !== 'string' || !incomingLog.id.trim() ||
        incomingLog.id.length > 160 || !/^\d{4}-\d{2}-\d{2}$/.test(incomingLog.date) ||
        !['successful', 'difficult', 'failed'].includes(incomingLog.rating) ||
        !Number.isSafeInteger(incomingLog.intervalDaysBefore) || incomingLog.intervalDaysBefore < 0 ||
        !Number.isSafeInteger(incomingLog.intervalDaysAfter) || incomingLog.intervalDaysAfter < 0 ||
        (incomingLog.notes !== undefined && (typeof incomingLog.notes !== 'string' || incomingLog.notes.length > 2000))) {
      throw new Error('Malformed revision history entry; migration was stopped without modifying source archives.');
    }

    const sameIdLog = existing.history.find(log => log.id === incomingLog.id);
    if (!sameIdLog) {
      if (existing.history.length >= MAX_MIGRATED_HISTORY_ENTRIES) {
        throw new Error('Merged revision history exceeds the safe 10,000-entry limit; source archives remain unchanged.');
      }
      existing.history.push({ ...incomingLog });
      continue;
    }

    if (sameRevisionLogContent(sameIdLog, incomingLog)) continue;

    const suffix = getStableHistoryConflictSuffix(incomingLog);
    const baseId = incomingLog.id.slice(0, 100) + '_conflict_' + suffix;
    let preservedId = baseId;
    let collisionIndex = 1;
    while (true) {
      const collision = existing.history.find(log => log.id === preservedId);
      if (!collision || sameRevisionLogContent(collision, incomingLog)) break;
      preservedId = baseId + '_' + collisionIndex++;
      if (preservedId.length > 160) {
        throw new Error('Unable to assign a unique deterministic ID to a conflicting revision log; source archives remain unchanged.');
      }
    }
    if (!existing.history.some(log => log.id === preservedId)) {
      if (existing.history.length >= MAX_MIGRATED_HISTORY_ENTRIES) {
        throw new Error('Merged revision history exceeds the safe 10,000-entry limit; source archives remain unchanged.');
      }
      existing.history.push({ ...incomingLog, id: preservedId });
      addConflictAudit(existing, sourceName, 'history',
        'Conflicting history entry under ID ' + incomingLog.id + ' preserved as ' + preservedId);
    }
  }
}

function mergePortionRecords(
  existing: WirdPortion,
  incoming: Partial<WirdPortion> & { notes?: string },
  sourceName: string
): void {
  const metaFields: (keyof WirdPortion)[] = [
    'type', 'surahName', 'pageNumber', 'pageStart', 'pageEnd', 'juzNumber',
    'revisionType', 'strength', 'createdAt', 'updatedAt'
  ];

  metaFields.forEach(field => {
    if (incoming[field] !== undefined &&
        existing[field] !== undefined &&
        incoming[field] !== existing[field]) {
      addConflictAudit(existing, sourceName, String(field),
        'Metadata conflict: existing ' + String(existing[field]) + ' vs incoming ' + String(incoming[field]));
    }
  });

  // Conservative status merge: the weakest state wins.
  if (incoming.status) {
    const existingRank = STATUS_SEVERITY_HIERARCHY[existing.status] ?? 3;
    const incomingRank = STATUS_SEVERITY_HIERARCHY[incoming.status] ?? 3;
    if (incomingRank < existingRank) {
      if (existing.status !== incoming.status) {
        addConflictAudit(existing, sourceName, 'status',
          'Overridden ' + existing.status + ' with higher priority ' + incoming.status);
      }
      existing.status = incoming.status;
    }
  }

  if (incoming.repetitionCount !== undefined) {
    existing.repetitionCount = Math.max(existing.repetitionCount || 0, incoming.repetitionCount);
  }

  if (existing.status === 'weak') {
    existing.intervalDays = 1;
  } else if (incoming.intervalDays !== undefined) {
    existing.intervalDays = Math.max(existing.intervalDays || 1, incoming.intervalDays);
  }

  if (incoming.easeFactor !== undefined && incoming.easeFactor > 0) {
    existing.easeFactor = Math.min(existing.easeFactor || 2.5, incoming.easeFactor);
  }

  if (incoming.nextDueDate &&
      (!existing.nextDueDate || incoming.nextDueDate < existing.nextDueDate)) {
    existing.nextDueDate = incoming.nextDueDate;
  }

  if (incoming.lastReviewedDate &&
      (!existing.lastReviewedDate || incoming.lastReviewedDate > existing.lastReviewedDate)) {
    existing.lastReviewedDate = incoming.lastReviewedDate;
  }

  if (incoming.mistakesCount !== undefined) {
    existing.mistakesCount = Math.max(existing.mistakesCount || 0, incoming.mistakesCount);
  }

  if (Array.isArray(incoming.history) && incoming.history.length > 0) {
    mergeHistoryEntries(existing, incoming.history, sourceName);
  }

  if (incoming.notes) {
    addConflictAudit(existing, sourceName, 'notes', incoming.notes);
  }
}

export function migrateLegacyDataLosslessly(
  legacyPortions: PortionStatusRecord[] = [],
  legacyRevisionItems: RevisionItem[] = []
): { portions: WirdPortion[]; report: MigrationReport } {
  try {
    if (!Array.isArray(legacyPortions) || legacyPortions.length > 10000 ||
        !Array.isArray(legacyRevisionItems) || legacyRevisionItems.length > 10000) {
      throw new Error('Legacy portion and revision archives must be valid arrays within the 10,000-record safety limit.');
    }
    const mergedMap = new Map<string, WirdPortion>();
    const sourceCoordinateKeys = new Set<string>();

    // 1. Deterministic Ingestion of legacyPortions (handles internal duplicates)
    legacyPortions.forEach((p, idx) => {
      assertValidLegacyPortionInput(p, idx);
      const canonicalId = createCanonicalPortionId(p.surahNumber, p.startAyah, p.endAyah);

      const coordKey = `${p.surahNumber}:${p.startAyah}:${p.endAyah}`;
      sourceCoordinateKeys.add(coordKey);

      if (p.history !== undefined && !Array.isArray(p.history)) {
        throw new Error('Malformed revision history in legacy portion at index ' + idx + '.');
      }

      const existing = mergedMap.get(canonicalId);
      if (existing) {
        // Merge duplicate within legacyPortions deterministically
        mergePortionRecords(existing, p, `legacyPortions[${idx}]`);
      } else {
        const surahMeta = ALL_SURAHS.find(s => s.number === p.surahNumber);
        const surahName = p.surahName || surahMeta?.name || `سورة ${p.surahNumber}`;
        const page = p.pageNumber || (surahMeta ? surahMeta.pageStart : 1);
        const juz = p.juzNumber || (surahMeta ? surahMeta.juzStart : 1);

        mergedMap.set(canonicalId, {
          id: canonicalId,
          type: p.type || 'passage',
          surahNumber: p.surahNumber,
          surahName,
          startAyah: p.startAyah,
          endAyah: p.endAyah,
          pageNumber: page,
          pageStart: p.pageStart || page,
          pageEnd: p.pageEnd || page,
          juzNumber: juz,
          status: p.status || 'stable',
          lastReviewedDate: p.lastReviewedDate,
          nextDueDate: p.nextDueDate || getLocalDateString(),
          intervalDays: p.intervalDays || 1,
          easeFactor: p.easeFactor || 2.5,
          repetitionCount: p.repetitionCount || 0,
          mistakesCount: p.mistakesCount || 0,
          history: [],
          revisionType: p.revisionType || 'minor',
          strength: p.strength || (p.status === 'weak' ? 'weak' : p.status === 'stable' ? 'strong' : 'medium'),
          conflictAudit: Array.isArray(p.conflictAudit) ? [...p.conflictAudit] : []
        });
        mergeHistoryEntries(mergedMap.get(canonicalId)!, p.history || [], `legacyPortions[${idx}]`);
      }
    });

    // 2. Deterministic Ingestion of legacyRevisionItems
    legacyRevisionItems.forEach((rev, idx) => {
      assertValidLegacyRevisionInput(rev, idx);
      const canonicalId = createCanonicalPortionId(rev.surahNumber, rev.startAyah, rev.endAyah);
      const coordKey = `${rev.surahNumber}:${rev.startAyah}:${rev.endAyah}`;
      sourceCoordinateKeys.add(coordKey);

      const existing = mergedMap.get(canonicalId);
      if (existing) {
        // Merge without losing data
        mergePortionRecords(existing, {
          repetitionCount: rev.repetitionCount,
          intervalDays: rev.intervalDays,
          easeFactor: rev.easeFactor,
          lastReviewedDate: rev.lastReviewedDate,
          nextDueDate: rev.nextDueDate,
          revisionType: rev.type,
          strength: rev.strength,
          status: rev.strength === 'weak' ? 'weak' : undefined
        }, `legacyRevisionItems[${idx}]`);
      } else {
        const surahMeta = ALL_SURAHS.find(s => s.number === rev.surahNumber);
        const surahName = rev.surahName || surahMeta?.name || `سورة ${rev.surahNumber}`;
        const page = rev.pageNumber || (surahMeta ? surahMeta.pageStart : 1);
        const juz = rev.juzNumber || (surahMeta ? surahMeta.juzStart : 1);
        const status: PortionMemorizationStatus = rev.strength === 'weak' 
          ? 'weak' 
          : (rev.strength === 'strong' ? 'stable' : 'recently_memorized');

        mergedMap.set(canonicalId, {
          id: canonicalId,
          type: 'passage',
          surahNumber: rev.surahNumber,
          surahName,
          startAyah: rev.startAyah,
          endAyah: rev.endAyah,
          pageNumber: page,
          pageStart: page,
          pageEnd: page,
          juzNumber: juz,
          status,
          lastReviewedDate: rev.lastReviewedDate,
          nextDueDate: rev.nextDueDate || getLocalDateString(),
          intervalDays: rev.intervalDays || 1,
          easeFactor: rev.easeFactor || 2.5,
          repetitionCount: rev.repetitionCount || 0,
          mistakesCount: 0,
          history: [],
          revisionType: rev.type || 'minor',
          strength: rev.strength || 'strong',
          conflictAudit: []
        });
      }
    });

    const portions = Array.from(mergedMap.values());

    // 3. Post-Migration Integrity & Verified Quran Coordinates Validation
    let totalPreservedLogs = 0;
    let totalConflictAudits = 0;

    for (const p of portions) {
      const surahMeta = ALL_SURAHS.find(s => s.number === p.surahNumber);
      if (!surahMeta) {
        throw new Error(`Invalid Quran Surah number: ${p.surahNumber}`);
      }
      if (!Number.isSafeInteger(p.startAyah) || p.startAyah < 1 || p.startAyah > surahMeta.versesCount) {
        throw new Error(`Invalid startAyah ${p.startAyah} for Surah ${p.surahNumber} (${surahMeta.name}, max ${surahMeta.versesCount})`);
      }
      if (!Number.isSafeInteger(p.endAyah) || p.endAyah < p.startAyah || p.endAyah > surahMeta.versesCount) {
        throw new Error(`Invalid endAyah ${p.endAyah} for Surah ${p.surahNumber} (${surahMeta.name}, max ${surahMeta.versesCount})`);
      }
      if (p.easeFactor < 1.3) {
        p.easeFactor = 1.3;
      }
      if (Array.isArray(p.history)) {
        totalPreservedLogs += p.history.length;
      }
      if (Array.isArray(p.conflictAudit)) {
        totalConflictAudits += p.conflictAudit.length;
      }
    }

    // Ensure all source coordinate keys are preserved
    for (const key of sourceCoordinateKeys) {
      const [s, start, end] = key.split(':').map(Number);
      const canonicalId = createCanonicalPortionId(s, start, end);
      if (!mergedMap.has(canonicalId)) {
        throw new Error(`Loss of source coordinate during migration: ${key}`);
      }
    }

    return {
      portions,
      report: {
        success: true,
        legacyPortionsCount: legacyPortions.length,
        legacyRevisionCount: legacyRevisionItems.length,
        migratedPortionsCount: portions.length,
        totalPreservedLogsCount: totalPreservedLogs,
        conflictAuditCount: totalConflictAudits,
        alreadyMigrated: false
      }
    };
  } catch (err: any) {
    return {
      portions: legacyPortions as WirdPortion[],
      report: {
        success: false,
        legacyPortionsCount: legacyPortions.length,
        legacyRevisionCount: legacyRevisionItems.length,
        migratedPortionsCount: 0,
        totalPreservedLogsCount: 0,
        conflictAuditCount: 0,
        alreadyMigrated: false,
        error: err?.message || 'فشل في ترحيل البيانات القديمة'
      }
    };
  }
}
