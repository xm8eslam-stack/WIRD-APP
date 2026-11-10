import { projectDailyActivityFromEvents, type ActivityBaselineV1, type SessionActivityEventV2 } from './activityEventProjection';

export function runActivityEventProjectionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const equal = (left: unknown, right: unknown, message: string) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(message);
  };

  const baseline: ActivityBaselineV1 = {
    schemaVersion: 1,
    baselineId: 'baseline-current',
    logs: [{
      date: '2026-11-10',
      memorizedAyahsCount: 2,
      reviewedPagesCount: 1,
      minutesSpent: 10,
      completedTasks: ['حفظ الملك 1-2']
    }]
  };
  const makeEvent = (overrides: Partial<SessionActivityEventV2> = {}): SessionActivityEventV2 => ({
    schemaVersion: 2,
    eventId: 'session-event-1',
    baselineId: 'baseline-current',
    occurredAtMs: Date.parse('2026-11-11T00:30:00.000Z'),
    localDate: '2026-11-10',
    timezoneOffsetMinutes: -180,
    mode: 'memorize',
    memorizedAyahs: 3,
    reviewedPages: 0,
    minutes: 15,
    taskName: 'حفظ الملك 1-2',
    surahNumber: 67,
    startAyah: 1,
    endAyah: 3,
    ...overrides
  });

  test('projects by captured local date and preserves the legacy baseline', () => {
    const original = JSON.stringify(baseline);
    const result = projectDailyActivityFromEvents(baseline, [makeEvent()]);
    assert(result.success, 'A valid event should project successfully');
    if (!result.success) return;
    equal(result.logs, [{
      date: '2026-11-10',
      memorizedAyahsCount: 5,
      reviewedPagesCount: 1,
      minutesSpent: 25,
      completedTasks: ['حفظ الملك 1-2']
    }], 'The event must aggregate onto its captured local date without duplicating the task label');
    assert(JSON.stringify(baseline) === original, 'The reducer must not mutate the legacy baseline');
    assert(result.appliedEventCount === 1, 'One unique event should be applied');
  });

  test('identical duplicate delivery is idempotent', () => {
    const event = makeEvent();
    const result = projectDailyActivityFromEvents(baseline, [event, { ...event }]);
    assert(result.success, 'Identical duplicate events should be accepted');
    if (!result.success) return;
    assert(result.logs[0].memorizedAyahsCount === 5, 'Duplicate delivery must not double the ayah count');
    assert(result.logs[0].minutesSpent === 25, 'Duplicate delivery must not double the duration');
    assert(result.appliedEventCount === 1 && result.duplicateEventCount === 1,
      'The result should report one applied event and one duplicate');
  });

  test('reusing an event ID with different content fails closed', () => {
    const result = projectDailyActivityFromEvents(baseline, [
      makeEvent(),
      makeEvent({ minutes: 16 })
    ]);
    assert(!result.success && result.errorCode === 'event_id_collision',
      'A different payload under the same event ID must be rejected');
  });

  test('events from an older offline baseline are preserved as a blocked conflict', () => {
    const result = projectDailyActivityFromEvents(baseline, [
      makeEvent({ baselineId: 'baseline-before-cutover' })
    ]);
    assert(!result.success && result.errorCode === 'baseline_mismatch',
      'An event from an older baseline must not be silently counted or ignored');
  });

  test('event order does not change the projected totals or task order', () => {
    const first = makeEvent({ eventId: 'event-a', taskName: 'مراجعة الملك', memorizedAyahs: 0, reviewedPages: 2, minutes: 10 });
    const second = makeEvent({ eventId: 'event-b', taskName: 'حفظ البقرة', memorizedAyahs: 4, reviewedPages: 0, minutes: 20 });
    const forward = projectDailyActivityFromEvents(baseline, [first, second]);
    const reverse = projectDailyActivityFromEvents(baseline, [second, first]);
    assert(forward.success && reverse.success, 'Both event orders should project');
    if (!forward.success || !reverse.success) return;
    equal(forward.logs, reverse.logs, 'Out-of-order delivery should produce the same daily log');
    equal(forward.logs[0].completedTasks, ['حفظ الملك 1-2', 'حفظ البقرة', 'مراجعة الملك'],
      'New task labels should be appended in stable lexical order');
  });

  test('new dates are appended in deterministic order while baseline order is preserved', () => {
    const multiBaseline: ActivityBaselineV1 = {
      schemaVersion: 1,
      baselineId: 'baseline-current',
      logs: [
        { date: '2026-11-11', memorizedAyahsCount: 1, reviewedPagesCount: 0, minutesSpent: 5, completedTasks: ['أ'] },
        { date: '2026-11-09', memorizedAyahsCount: 2, reviewedPagesCount: 0, minutesSpent: 8, completedTasks: ['ب'] }
      ]
    };
    const events = [
      makeEvent({ eventId: 'event-z', localDate: '2026-11-13', memorizedAyahs: 1, minutes: 2 }),
      makeEvent({ eventId: 'event-y', localDate: '2026-11-12', memorizedAyahs: 1, minutes: 2 })
    ];
    const result = projectDailyActivityFromEvents(multiBaseline, events);
    assert(result.success, 'Valid new activity dates should project');
    if (!result.success) return;
    equal(result.logs.map(log => log.date), ['2026-11-11', '2026-11-09', '2026-11-12', '2026-11-13'],
      'Existing baseline order should remain stable and new dates should be sorted');
  });

  test('invalid local date, UTC offset, and Quran coordinates are rejected', () => {
    for (const event of [
      makeEvent({ localDate: '2026-02-30' }),
      makeEvent({ timezoneOffsetMinutes: 900 }),
      makeEvent({ surahNumber: 1, startAyah: 1, endAyah: 8 })
    ]) {
      const result = projectDailyActivityFromEvents(baseline, [event]);
      assert(!result.success && result.errorCode === 'invalid_event',
        'Invalid event fields must be rejected before projection');
    }
  });

  test('invalid baseline dates and duplicate daily records are rejected', () => {
    const invalidBaseline = {
      schemaVersion: 1,
      baselineId: 'baseline-current',
      logs: [
        ...baseline.logs,
        { ...baseline.logs[0] }
      ]
    };
    const result = projectDailyActivityFromEvents(invalidBaseline, []);
    assert(!result.success && result.errorCode === 'invalid_baseline',
      'Duplicate dates in the legacy baseline must fail closed');
  });

  test('daily aggregate overflow returns no partial projection', () => {
    const nearLimit: ActivityBaselineV1 = {
      schemaVersion: 1,
      baselineId: 'baseline-current',
      logs: [{
        date: '2026-11-10',
        memorizedAyahsCount: 2,
        reviewedPagesCount: 1,
        minutesSpent: 1430,
        completedTasks: ['حفظ الملك 1-2']
      }]
    };
    const result = projectDailyActivityFromEvents(nearLimit, [makeEvent({ minutes: 20 })]);
    assert(!result.success && result.errorCode === 'aggregate_overflow',
      'Overflow must fail the complete projection instead of returning partial totals');
  });

  test('the projected daily archive cannot exceed the legacy storage bound', () => {
    const logs = Array.from({ length: 10_000 }, (_, index) => ({
      date: new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10),
      memorizedAyahsCount: 0,
      reviewedPagesCount: 0,
      minutesSpent: 0,
      completedTasks: []
    }));
    const largeBaseline: ActivityBaselineV1 = {
      schemaVersion: 1,
      baselineId: 'baseline-current',
      logs
    };
    const result = projectDailyActivityFromEvents(largeBaseline, [
      makeEvent({ localDate: '2030-01-01' })
    ]);
    assert(!result.success && result.errorCode === 'aggregate_overflow',
      'A new date beyond the 10,000-day archive limit must fail closed');
  });

  test('an empty event list returns a separate copy of the legacy baseline', () => {
    const result = projectDailyActivityFromEvents(baseline, []);
    assert(result.success, 'An empty event list should return the baseline');
    if (!result.success) return;
    assert(result.logs !== baseline.logs && result.logs[0] !== baseline.logs[0] &&
      result.logs[0].completedTasks !== baseline.logs[0].completedTasks,
      'The reducer must return a deep-enough copy for daily log records');
  });

  return { passed, failed };
}
