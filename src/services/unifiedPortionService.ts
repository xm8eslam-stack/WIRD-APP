import { 
  WirdPortion, 
  PortionStatusRecord, 
  RevisionItem, 
  PortionMemorizationStatus, 
  RevisionRating,
  RevisionLogEntry,
  MemorizationPlan
} from '../types/quran';
import { ALL_SURAHS } from '../data/quranMeta';
import { QURAN_PAGE_AYAH_KEYS } from '../data/quranPageMap';

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
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToLocalDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function getDayDifference(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

// Canonical Portion Identity
export function createCanonicalPortionId(surahNumber: number, startAyah: number, endAyah: number): string {
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
  const keys = new Set<string>();

  portions.forEach(p => {
    // Portions that count as memorized: stable, recently_memorized, needs_revision, weak
    if (
      p.status === 'stable' || 
      p.status === 'recently_memorized' || 
      p.status === 'needs_revision' || 
      p.status === 'weak'
    ) {
      const start = Math.max(1, p.startAyah);
      const end = Math.max(start, p.endAyah);
      for (let a = start; a <= end; a++) {
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
    for (let ayah = Math.max(1, portion.startAyah); ayah <= portion.endAyah; ayah++) {
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
 * Calculate fully memorized Mushaf pages using verified ayah-to-page mappings.
 * A page counts only when every canonical ayah printed on that page is memorized.
 */
export function calculateUniqueMemorizedPages(portions: WirdPortion[]): number {
  const { ayahKeys } = calculateUniqueMemorizedAyahs(portions);
  if (ayahKeys.size === 0) return 0;

  let fullyMemorizedPages = 0;
  Object.values(QURAN_PAGE_AYAH_KEYS).forEach(keys => {
    if (keys.length > 0 && keys.every(key => ayahKeys.has(key))) {
      fullyMemorizedPages++;
    }
  });

  return fullyMemorizedPages;
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
  const todayStr = options?.customTodayStr || getLocalDateString();
  const gracePeriodDays = options?.gracePeriodDays ?? 1;

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
 * Resolve the Surahs covered by a preset plan from its explicit scope.
 * Juz and page scopes use the canonical Mushaf metadata, not a guessed first Surah.
 */
export function getPlanTargetSurahNumbers(plan: Pick<MemorizationPlan, 'targetSurahs' | 'targetJuz' | 'startPage' | 'endPage'>): number[] {
  if (plan.targetSurahs && plan.targetSurahs.length > 0) {
    return Array.from(new Set(plan.targetSurahs)).filter(n => n >= 1 && n <= 114);
  }

  if (plan.targetJuz && plan.targetJuz.length > 0) {
    return ALL_SURAHS
      .filter(surah => plan.targetJuz!.some(juz => juz >= surah.juzStart && juz <= surah.juzEnd))
      .map(surah => surah.number);
  }

  if (plan.startPage !== undefined && plan.endPage !== undefined) {
    const startPage = Math.max(1, Math.min(604, plan.startPage));
    const endPage = Math.max(startPage, Math.min(604, plan.endPage));
    return ALL_SURAHS
      .filter(surah => surah.pageStart <= endPage && surah.pageEnd >= startPage)
      .map(surah => surah.number);
  }

  return ALL_SURAHS.map(surah => surah.number);
}

/**
 * Find the next memorization range that is not already represented by a
 * memorized portion. Existing in-progress portions are resumed before new gaps.
 */
export function findNextUnmemorizedRange(
  portions: WirdPortion[],
  surahNumbers: number[],
  maxVerses: number
): { surahNumber: number; startAyah: number; endAyah: number } | null {
  const limit = Math.max(1, Math.floor(maxVerses || 1));
  const targets = Array.from(new Set(surahNumbers)).filter(n => n >= 1 && n <= 114);

  for (const surahNumber of targets) {
    const surah = ALL_SURAHS.find(s => s.number === surahNumber);
    if (!surah) continue;

    const inProgress = portions
      .filter(p => p.surahNumber === surahNumber && p.status === 'currently_memorizing')
      .sort((a, b) => a.startAyah - b.startAyah)[0];
    if (inProgress && inProgress.startAyah >= 1 && inProgress.startAyah <= surah.versesCount) {
      return {
        surahNumber,
        startAyah: inProgress.startAyah,
        endAyah: Math.max(
          inProgress.startAyah,
          Math.min(inProgress.endAyah, inProgress.startAyah + limit - 1, surah.versesCount)
        )
      };
    }

    const memorized = portions.filter(p =>
      p.surahNumber === surahNumber && p.status !== 'not_memorized'
    );

    let ayah = 1;
    while (ayah <= surah.versesCount) {
      const covered = memorized.some(p => p.startAyah <= ayah && p.endAyah >= ayah);
      if (covered) {
        ayah++;
        continue;
      }

      const startAyah = ayah;
      let count = 0;
      while (ayah <= surah.versesCount && count < limit) {
        const isCovered = memorized.some(p => p.startAyah <= ayah && p.endAyah >= ayah);
        if (isCovered) break;
        ayah++;
        count++;
      }

      return {
        surahNumber,
        startAyah,
        endAyah: ayah - 1
      };
    }
  }

  return null;
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
  const today = options?.todayStr || getLocalDateString();
  const maxLimit = options?.maxDailyLimit ?? 20;

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

function mergePortionRecords(
  existing: WirdPortion,
  incoming: Partial<WirdPortion> & { notes?: string },
  sourceName: string
): void {
  if (!existing.conflictAudit) {
    existing.conflictAudit = [];
  }

  // Preserve metadata disagreements in conflictAudit
  const metaFields: (keyof WirdPortion)[] = [
    'type', 'surahName', 'pageNumber', 'pageStart', 'pageEnd', 'juzNumber',
    'revisionType', 'strength', 'createdAt', 'updatedAt'
  ];

  metaFields.forEach(field => {
    if (
      incoming[field] !== undefined && 
      existing[field] !== undefined && 
      incoming[field] !== existing[field]
    ) {
      existing.conflictAudit!.push({
        source: sourceName,
        field: String(field),
        value: `Metadata conflict: existing '${existing[field]}' vs incoming '${incoming[field]}'`,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 1. Status: Weakest/most urgent state wins to prevent forgotten lapses
  if (incoming.status) {
    const existingRank = STATUS_SEVERITY_HIERARCHY[existing.status] ?? 3;
    const incomingRank = STATUS_SEVERITY_HIERARCHY[incoming.status] ?? 3;
    if (incomingRank < existingRank) {
      if (existing.status !== incoming.status) {
        existing.conflictAudit.push({
          source: sourceName,
          field: 'status',
          value: `Overridden ${existing.status} with higher priority ${incoming.status}`,
          timestamp: new Date().toISOString()
        });
      }
      existing.status = incoming.status;
    }
  }

  // 2. Repetition count: highest verified count
  if (incoming.repetitionCount !== undefined) {
    existing.repetitionCount = Math.max(existing.repetitionCount || 0, incoming.repetitionCount);
  }

  // 3. Interval: if weak, interval is 1; otherwise take maximum interval
  if (existing.status === 'weak') {
    existing.intervalDays = 1;
  } else if (incoming.intervalDays !== undefined) {
    existing.intervalDays = Math.max(existing.intervalDays || 1, incoming.intervalDays);
  }

  // 4. Ease Factor: preserve conservative factor (lower EF means safer, more frequent revision)
  if (incoming.easeFactor !== undefined && incoming.easeFactor > 0) {
    existing.easeFactor = Math.min(existing.easeFactor || 2.5, incoming.easeFactor);
  }

  // 5. Due date: earlier due date wins (ensures no overdue revision is missed)
  if (incoming.nextDueDate) {
    if (!existing.nextDueDate || incoming.nextDueDate < existing.nextDueDate) {
      existing.nextDueDate = incoming.nextDueDate;
    }
  }

  // 6. Last reviewed date: more recent date wins
  if (incoming.lastReviewedDate) {
    if (!existing.lastReviewedDate || incoming.lastReviewedDate > existing.lastReviewedDate) {
      existing.lastReviewedDate = incoming.lastReviewedDate;
    }
  }

  // 7. Mistakes count: accumulate or take maximum
  if (incoming.mistakesCount !== undefined) {
    existing.mistakesCount = Math.max(existing.mistakesCount || 0, incoming.mistakesCount);
  }

  // 8. History: Lossless union of revision logs with duplicate ID content-disagreement handling
  if (Array.isArray(incoming.history) && incoming.history.length > 0) {
    if (!existing.history) existing.history = [];
    
    incoming.history.forEach(incLog => {
      const sameIdLog = existing.history!.find(h => h.id && incLog.id && h.id === incLog.id);
      if (sameIdLog) {
        // Check if content differs
        const contentDiff = sameIdLog.date !== incLog.date ||
          sameIdLog.rating !== incLog.rating ||
          sameIdLog.intervalDaysBefore !== incLog.intervalDaysBefore ||
          sameIdLog.intervalDaysAfter !== incLog.intervalDaysAfter ||
          sameIdLog.notes !== incLog.notes;

        if (contentDiff) {
          // Preserve conflicting history entry under a modified ID so no log is lost!
          const preservedLog = {
            ...incLog,
            id: `${incLog.id}_conflict_${Date.now()}`
          };
          existing.history!.push(preservedLog);
          existing.conflictAudit!.push({
            source: sourceName,
            field: 'history',
            value: `Conflicting history entry under ID '${incLog.id}' preserved as '${preservedLog.id}'`,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Check exact content signature
        const contentSig = `${incLog.date}_${incLog.rating}_${incLog.intervalDaysBefore}_${incLog.intervalDaysAfter}_${incLog.notes || ''}`;
        const existsExact = existing.history!.some(h => 
          `${h.date}_${h.rating}_${h.intervalDaysBefore}_${h.intervalDaysAfter}_${h.notes || ''}` === contentSig
        );
        if (!existsExact) {
          existing.history!.push(incLog);
        }
      }
    });
  }

  // 9. Unreconciled notes
  if (incoming.notes) {
    existing.conflictAudit.push({
      source: sourceName,
      field: 'notes',
      value: incoming.notes,
      timestamp: new Date().toISOString()
    });
  }
}

export function migrateLegacyDataLosslessly(
  legacyPortions: PortionStatusRecord[] = [],
  legacyRevisionItems: RevisionItem[] = []
): { portions: WirdPortion[]; report: MigrationReport } {
  try {
    const mergedMap = new Map<string, WirdPortion>();
    let totalSourceLogs = 0;
    const sourceCoordinateKeys = new Set<string>();

    // 1. Deterministic Ingestion of legacyPortions (handles internal duplicates)
    legacyPortions.forEach((p, idx) => {
      const canonicalId = p.id?.startsWith('s') && p.id.includes('_a') 
        ? p.id 
        : createCanonicalPortionId(p.surahNumber, p.startAyah, p.endAyah);

      const coordKey = `${p.surahNumber}:${p.startAyah}:${p.endAyah}`;
      sourceCoordinateKeys.add(coordKey);

      if (Array.isArray(p.history)) {
        totalSourceLogs += p.history.length;
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
          history: Array.isArray(p.history) ? [...p.history] : [],
          revisionType: p.revisionType || 'minor',
          strength: p.strength || (p.status === 'weak' ? 'weak' : p.status === 'stable' ? 'strong' : 'medium'),
          conflictAudit: Array.isArray(p.conflictAudit) ? [...p.conflictAudit] : []
        });
      }
    });

    // 2. Deterministic Ingestion of legacyRevisionItems
    legacyRevisionItems.forEach((rev, idx) => {
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
      if (p.startAyah < 1 || p.startAyah > surahMeta.versesCount) {
        throw new Error(`Invalid startAyah ${p.startAyah} for Surah ${p.surahNumber} (${surahMeta.name}, max ${surahMeta.versesCount})`);
      }
      if (p.endAyah < p.startAyah || p.endAyah > surahMeta.versesCount) {
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
