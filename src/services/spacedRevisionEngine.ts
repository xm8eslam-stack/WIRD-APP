import { RevisionItem } from '../types/quran';

export type QuranRetentionGrade = 1 | 2 | 3 | 4 | 5;

export interface SpacedRevisionResult {
  updatedItem: RevisionItem;
  nextIntervalDays: number;
  newEaseFactor: number;
  messageAr: string;
}

export const SpacedRevisionEngine = {
  /**
   * SuperMemo SM-2 algorithm adapted for Quran memorization
   * @param item Current revision item
   * @param grade User retention score: 1 (forgotten) to 5 (perfect)
   */
  scheduleNextReview(item: RevisionItem, grade: QuranRetentionGrade): SpacedRevisionResult {
    const today = new Date().toISOString().split('T')[0];
    let easeFactor = item.easeFactor || 2.5;
    let repCount = item.repetitionCount || 0;
    let nextIntervalDays = 1;

    // SM-2 Ease Factor calculation
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const qDelta = 5 - grade;
    easeFactor = easeFactor + (0.1 - qDelta * (0.08 + qDelta * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    let strength: RevisionItem['strength'] = 'strong';
    let messageAr = '';

    if (grade < 3) {
      // Failed / Weak: Reset interval to 1 day for urgent tomorrow review
      nextIntervalDays = 1;
      repCount = 0;
      strength = 'weak';
      messageAr = 'المقطع يحتاج تثبيتاً عاجلاً. تم جدولته للمراجعة غداً بإذن الله.';
    } else {
      // Successful retention
      repCount += 1;
      if (repCount === 1) {
        nextIntervalDays = 1;
      } else if (repCount === 2) {
        nextIntervalDays = 3;
      } else {
        const prevInterval = Math.max(1, item.intervalDays);
        nextIntervalDays = Math.round(prevInterval * easeFactor);
      }

      if (grade === 5) {
        strength = 'strong';
        messageAr = `رسوخ ممتاز! المراجعة القادمة بعد ${nextIntervalDays} يوماً.`;
      } else if (grade === 4) {
        strength = 'strong';
        messageAr = `جيد جداً. المراجعة القادمة بعد ${nextIntervalDays} يوماً.`;
      } else {
        strength = 'medium';
        messageAr = `مستوى متوسط مع لبس طفيف. المراجعة القادمة بعد ${nextIntervalDays} أيام.`;
      }
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextIntervalDays);
    const nextDueDate = nextDate.toISOString().split('T')[0];

    const updatedItem: RevisionItem = {
      ...item,
      easeFactor: Number(easeFactor.toFixed(2)),
      repetitionCount: repCount,
      intervalDays: nextIntervalDays,
      nextDueDate,
      lastReviewedDate: today,
      strength
    };

    return {
      updatedItem,
      nextIntervalDays,
      newEaseFactor: updatedItem.easeFactor,
      messageAr
    };
  },

  /**
   * Prioritize revision queue:
   * 1. Overdue weak items first (ضعيف / يتفلت)
   * 2. Overdue medium items
   * 3. Overdue strong items
   */
  prioritizeRevisionQueue(items: RevisionItem[]): RevisionItem[] {
    const today = new Date().toISOString().split('T')[0];

    return [...items].sort((a, b) => {
      const aDue = a.nextDueDate <= today ? 1 : 0;
      const bDue = b.nextDueDate <= today ? 1 : 0;

      if (aDue !== bDue) return bDue - aDue; // Due first

      // Weakest first (lowest easeFactor)
      const aStrengthScore = a.strength === 'weak' ? 0 : a.strength === 'medium' ? 1 : 2;
      const bStrengthScore = b.strength === 'weak' ? 0 : b.strength === 'medium' ? 1 : 2;

      if (aStrengthScore !== bStrengthScore) {
        return aStrengthScore - bStrengthScore;
      }

      return a.easeFactor - b.easeFactor;
    });
  },

  /**
   * Pack revision tasks for today within available revision minutes
   */
  getDailyRevisionAgenda(items: RevisionItem[], availableMinutes: number): {
    packedItems: RevisionItem[];
    totalEstimatedMinutes: number;
    remainingItemsCount: number;
  } {
    const sorted = this.prioritizeRevisionQueue(items);
    const today = new Date().toISOString().split('T')[0];
    const dueItems = sorted.filter(i => i.nextDueDate <= today);

    const packedItems: RevisionItem[] = [];
    let accumulatedMinutes = 0;

    for (const item of dueItems) {
      const versesCount = (item.endAyah - item.startAyah + 1) || 15;
      const estMin = Math.max(5, Math.round(versesCount * 0.5));

      if (accumulatedMinutes + estMin <= availableMinutes || packedItems.length === 0) {
        packedItems.push(item);
        accumulatedMinutes += estMin;
      } else {
        break;
      }
    }

    return {
      packedItems,
      totalEstimatedMinutes: accumulatedMinutes,
      remainingItemsCount: Math.max(0, dueItems.length - packedItems.length)
    };
  }
};
