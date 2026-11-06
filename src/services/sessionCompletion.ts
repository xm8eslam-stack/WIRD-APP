export type SessionMode = 'memorize' | 'review';

export interface SessionCompletionMetrics {
  memorizedAyahs: number;
  reviewedPages: number;
  shouldRecordMemorization: boolean;
}

/**
 * Keep review activity separate from memorization progress.
 * Reject invalid counters at the domain boundary; never silently floor or clamp
 * user-provided values because doing so can turn corrupt input into a valid-looking completion.
 */
export function getSessionCompletionMetrics(
  mode: SessionMode,
  memorizedAyahs: number,
  reviewedPages: number
): SessionCompletionMetrics {
  if (mode !== 'memorize' && mode !== 'review') {
    throw new TypeError('نوع جلسة القرآن غير صالح.');
  }
  if (!Number.isSafeInteger(memorizedAyahs) || memorizedAyahs < 0 || memorizedAyahs > 6236) {
    throw new RangeError('عدد الآيات المحفوظة يجب أن يكون عددًا صحيحًا من 0 إلى 6236.');
  }
  if (!Number.isSafeInteger(reviewedPages) || reviewedPages < 0 || reviewedPages > 604) {
    throw new RangeError('عدد صفحات المراجعة يجب أن يكون عددًا صحيحًا من 0 إلى 604.');
  }

  return mode === 'review'
    ? {
        memorizedAyahs: 0,
        reviewedPages,
        shouldRecordMemorization: false
      }
    : {
        memorizedAyahs,
        reviewedPages: 0,
        shouldRecordMemorization: true
      };
}
