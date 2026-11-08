import { clearReadingKhatma, markReadingPage, readReadingKhatma, startReadingKhatma } from './readingKhatmaService';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function runReadingKhatmaServiceTests(): { passed: number; failed: number } {
  let passed = 0; let failed = 0;
  const test = (name: string, callback: () => void) => { try { callback(); passed++; console.log(`  ✅ ${name}`); } catch (error) { failed++; console.error(`  ❌ ${name}:`, error); } };
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  test('reading khatma starts empty and round-trips independently', () => { const started = startReadingKhatma(storage, new Date('2026-01-01T00:00:00Z')); assert(started.completedPages.length === 0, 'new khatma must be empty'); assert(readReadingKhatma(storage)?.id === started.id, 'khatma must persist'); });
  test('page progress is unique, sorted and range checked', () => { startReadingKhatma(storage); markReadingPage(10, storage); markReadingPage(2, storage); const next = markReadingPage(10, storage); assert(JSON.stringify(next.completedPages) === '[2,10]', 'progress should normalize'); let rejected = false; try { markReadingPage(605, storage); } catch { rejected = true; } assert(rejected, 'page 605 must be rejected'); });
  test('requires an active khatma and clear resets only reading state', () => { clearReadingKhatma(storage); let rejected = false; try { markReadingPage(1, storage); } catch { rejected = true; } assert(rejected, 'page mark without active khatma must fail'); startReadingKhatma(storage); clearReadingKhatma(storage); assert(readReadingKhatma(storage) === null, 'clear must remove the reading record'); });
  test('corrupt persisted progress is ignored safely', () => { data.set('wird.reading.khatma.v1', JSON.stringify({ id: 'bad', startedAt: 'bad-date', completedPages: [1] })); assert(readReadingKhatma(storage) === null, 'invalid record must not be used'); });
  test('starting a new cycle preserves completed khatmat and refuses to overwrite corrupt progress', () => {
    const completed = { id: 'completed-1', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-02-01T00:00:00Z', completedPages: Array.from({ length: 604 }, (_, index) => index + 1), completedCycles: [] };
    data.set('wird.reading.khatma.v1', JSON.stringify(completed));
    const next = startReadingKhatma(storage, new Date('2026-03-01T00:00:00Z'));
    assert(next.completedPages.length === 0 && next.completedCycles.length === 1 && next.completedCycles[0].id === 'completed-1', 'new cycle must retain a compact record of completed cycles');
    const corrupt = '{"id":"bad","startedAt":"bad-date","completedPages":[1]}'; data.set('wird.reading.khatma.v1', corrupt);
    let rejected = false; try { startReadingKhatma(storage); } catch { rejected = true; }
    assert(rejected && data.get('wird.reading.khatma.v1') === corrupt, 'new cycle must preserve corrupt source instead of replacing it');
  });
  return { passed, failed };
}
