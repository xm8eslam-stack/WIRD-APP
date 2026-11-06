import { getSessionCompletionMetrics } from '../services/sessionCompletion';

export function runSessionCompletionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Review sessions never add memorized ayahs or create memorization portions', () => {
    const result = getSessionCompletionMetrics('review', 12, 3);
    assert(result.memorizedAyahs === 0, 'Review must contribute zero memorized ayahs');
    assert(result.reviewedPages === 3, 'Review must preserve the actual reviewed page count');
    assert(result.shouldRecordMemorization === false, 'Review must not write memorization progress');
  });

  test('Memorization sessions add ayahs but do not count reviewed pages', () => {
    const result = getSessionCompletionMetrics('memorize', 12, 3);
    assert(result.memorizedAyahs === 12, 'Memorization must preserve the completed ayah count');
    assert(result.reviewedPages === 0, 'Memorization must not masquerade as page review');
    assert(result.shouldRecordMemorization === true, 'Memorization must write memorization progress');
  });

  test('Negative counters are clamped to zero', () => {
    const review = getSessionCompletionMetrics('review', -4, -2);
    const memorize = getSessionCompletionMetrics('memorize', -4, -2);
    assert(review.reviewedPages === 0 && review.memorizedAyahs === 0, 'Review counters must not be negative');
    assert(memorize.memorizedAyahs === 0 && memorize.reviewedPages === 0, 'Memorization counters must not be negative');
  });

  return { passed, failed };
}
