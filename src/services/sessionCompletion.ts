export type SessionMode = 'memorize' | 'review';

export interface SessionCompletionMetrics {
  memorizedAyahs: number;
  reviewedPages: number;
  shouldRecordMemorization: boolean;
}

/**
 * Keep review activity out of memorization progress.
 * Review sessions may update daily activity logs, but must never create or
 * advance a memorized portion.
 */
export function getSessionCompletionMetrics(
  mode: SessionMode,
  memorizedAyahs: number,
  reviewedPages: number
): SessionCompletionMetrics {
  if (mode === 'review') {
    return {
      memorizedAyahs: 0,
      reviewedPages: Math.max(1, reviewedPages),
      shouldRecordMemorization: false
    };
  }

  return {
    memorizedAyahs: Math.max(0, memorizedAyahs),
    reviewedPages: 0,
    shouldRecordMemorization: true
  };
}
