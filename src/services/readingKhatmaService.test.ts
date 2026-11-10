import {
  clearReadingKhatma,
  getReadingKhatmaProgress,
  markReadingPage,
  pauseReadingKhatma,
  readReadingKhatma,
  resumeReadingKhatma,
  startReadingKhatma,
  updateReadingKhatmaPlan
} from './readingKhatmaService';

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
  test('daily reading plan calculates targets and tracks unique pages per local day', () => {
    const started = startReadingKhatma(storage, new Date(2026, 4, 1, 8), { durationDays: 60, sessionsPerDay: 3 });
    assert(started.plan?.targetCompletionDate === '2026-06-30', 'target date should follow the selected 60-day duration');
    markReadingPage(1, storage, new Date(2026, 4, 1, 9));
    markReadingPage(2, storage, new Date(2026, 4, 1, 10));
    markReadingPage(1, storage, new Date(2026, 4, 1, 11));
    const progress = getReadingKhatmaProgress(readReadingKhatma(storage)!, new Date(2026, 4, 1, 12));
    assert(progress.pagesReadToday === 2, 'the same page must not inflate daily page totals');
    assert(progress.pagesPerDay === 11 && progress.pagesPerSession === 4, 'daily and per-session targets should be distributed from remaining pages');
    assert(progress.remainingPages === 602 && progress.percent === 0, 'progress must reflect unique completed pages');
  });
  test('pause blocks progress, resume restores it, and plan can be changed safely', () => {
    startReadingKhatma(storage, new Date(2026, 4, 1, 8), { durationDays: 30, sessionsPerDay: 2 });
    const paused = pauseReadingKhatma(storage, new Date(2026, 4, 1, 12));
    assert(paused.isPaused === true, 'pause state should persist');
    let rejected = false;
    try { markReadingPage(1, storage, new Date(2026, 4, 1, 13)); } catch { rejected = true; }
    assert(rejected, 'reading progress must not be recorded while paused');
    const resumed = resumeReadingKhatma(storage);
    assert(resumed.isPaused === false && resumed.pausedAt === undefined, 'resume should clear pause metadata');
    const updated = updateReadingKhatmaPlan({ durationDays: 90, sessionsPerDay: 4 }, storage, new Date(2026, 4, 2, 8));
    assert(updated.plan?.durationDays === 90 && updated.plan.sessionsPerDay === 4, 'new plan options should persist');
    assert(updated.plan.targetCompletionDate === '2026-07-31', 'updated target date should be recalculated from the update date');
  });
  test('plan validation rejects impossible durations and session counts without corrupting saved data', () => {
    const started = startReadingKhatma(storage, new Date(2026, 4, 1, 8));
    const rawBefore = data.get('wird.reading.khatma.v1');
    let rejected = false;
    try { updateReadingKhatmaPlan({ durationDays: 0, sessionsPerDay: 2 }, storage); } catch { rejected = true; }
    assert(rejected && data.get('wird.reading.khatma.v1') === rawBefore, 'invalid plan must not overwrite the current khatma');
    assert(readReadingKhatma(storage)?.id === started.id, 'existing khatma must remain readable');
  });

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
