export type SessionMode = 'memorize' | 'review';

export interface SessionCompletionMetrics {
  memorizedAyahs: number;
  reviewedPages: number;
  shouldRecordMemorization: boolean;
}

/**
 * Keep review activity separate from memorization progress.
 * Review sessions may count reviewed pages, but never create or advance a
 * memorized portion. The caller passes the actual reviewed page count.
 */
export function getSessionCompletionMetrics(
  mode: SessionMode,
  memorizedAyahs: number,
  reviewedPages: number
): SessionCompletionMetrics {
  if (mode === 'review') {
    return {
      memorizedAyahs: 0,
      reviewedPages: Math.max(0, Math.floor(reviewedPages)),
      shouldRecordMemorization: false
    };
  }

  return {
    memorizedAyahs: Math.max(0, Math.floor(memorizedAyahs)),
    reviewedPages: 0,
    shouldRecordMemorization: true
  };
}
