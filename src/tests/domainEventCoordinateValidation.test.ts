import { isValidDomainEvent } from '../services/domainEvents';

export async function runDomainEventCoordinateTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✓ ' + name); }
    catch (error) { failed++; console.error('  ✗ ' + name + ': ' + (error instanceof Error ? error.message : error)); }
  };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const base = {
    schemaVersion: 1,
    id: 'event_123',
    occurredAt: '2026-11-07T00:00:00.000Z'
  };

  test('Weak verse events reject an ayah beyond the selected Surah length', () => {
    const valid = { ...base, type: 'weak_verse.failed', payload: { surahNumber: 1, ayahNumber: 7 } };
    const invalid = { ...base, type: 'weak_verse.failed', payload: { surahNumber: 1, ayahNumber: 8 } };
    assert(isValidDomainEvent(valid), 'Valid Al-Fatihah coordinate must be accepted');
    assert(!isValidDomainEvent(invalid), 'Al-Fatihah ayah 8 must be rejected');
  });

  test('Revision rating ranges must fit inside the selected Surah', () => {
    const valid = {
      ...base,
      type: 'revision.rated',
      payload: { portionId: 's1-a1-a7', surahNumber: 1, startAyah: 1, endAyah: 7, rating: 'successful' }
    };
    const invalidEnd = {
      ...base,
      type: 'revision.rated',
      payload: { portionId: 's1-a1-a8', surahNumber: 1, startAyah: 1, endAyah: 8, rating: 'successful' }
    };
    const invalidWeakAyah = {
      ...base,
      type: 'revision.rated',
      payload: { portionId: 's1-a1-a7', surahNumber: 1, startAyah: 1, endAyah: 7, weakAyahNumber: 8, rating: 'failed' }
    };
    assert(isValidDomainEvent(valid), 'Valid revision range must be accepted');
    assert(!isValidDomainEvent(invalidEnd), 'Revision range beyond Surah length must be rejected');
    assert(!isValidDomainEvent(invalidWeakAyah), 'Weak ayah outside the range must be rejected');
  });

  test('Session completion ranges validate both endpoints against Quran metadata', () => {
    const valid = {
      ...base,
      type: 'session.completed',
      payload: {
        mode: 'memorize', memorizedAyahs: 7, reviewedPages: 0, minutes: 15,
        taskName: 'اختبار', surahNumber: 1, startAyah: 1, endAyah: 7,
        includesSmartPlanProjection: false
      }
    };
    const invalid = {
      ...base,
      type: 'session.completed',
      payload: {
        ...valid.payload, endAyah: 8
      }
    };
    assert(isValidDomainEvent(valid), 'Valid session range must be accepted');
    assert(!isValidDomainEvent(invalid), 'Session range beyond Surah length must be rejected');
  });

  test('Revision event IDs and portion identifiers remain bounded', () => {
    const event = {
      ...base,
      type: 'revision.rated',
      payload: { portionId: 'x'.repeat(129), surahNumber: 2, startAyah: 1, endAyah: 2, rating: 'successful' }
    };
    assert(!isValidDomainEvent(event), 'Oversized portion IDs must be rejected');
    assert(!isValidDomainEvent({ ...event, id: 'different' }, 'event_123'),
      'An event whose ID differs from the expected ID must be rejected');
  });

  return { passed, failed };
}
