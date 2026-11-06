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

  test('Negative counters are rejected instead of being silently clamped', () => {
    let reviewRejected = false;
    let memorizeRejected = false;
    try { getSessionCompletionMetrics('review', -4, -2); } catch { reviewRejected = true; }
    try { getSessionCompletionMetrics('memorize', -4, -2); } catch { memorizeRejected = true; }
    assert(reviewRejected, 'Negative review counters must be rejected');
    assert(memorizeRejected, 'Negative memorization counters must be rejected');
  });

  test('Fractional, unsafe, non-finite, and out-of-range counters are rejected', () => {
    const invalidCases: Array<[any, number, number]> = [
      ['review', 1.5, 1],
      ['memorize', 1, 2.25],
      ['memorize', Number.MAX_SAFE_INTEGER + 1, 0],
      ['review', 0, Number.POSITIVE_INFINITY],
      ['memorize', 6237, 0],
      ['review', 0, 605],
      ['unknown', 0, 0]
    ];
    for (const [mode, ayahs, pages] of invalidCases) {
      let rejected = false;
      try { getSessionCompletionMetrics(mode, ayahs, pages); } catch { rejected = true; }
      assert(rejected, 'Invalid session metric input must be rejected: ' + String(mode) + '/' + ayahs + '/' + pages);
    }
  });

  return { passed, failed };
}
