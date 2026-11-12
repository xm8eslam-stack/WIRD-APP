import {
  clearSeerahReadingPosition,
  normalizeSeerahReadingPosition,
  readSeerahReadingPosition,
  saveSeerahReadingPosition,
  SEERAH_READING_POSITION_KEY
} from './seerahReadingProgress';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

export function runSeerahReadingProgressTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const position = {
    bookVersion: 'prototype-1',
    partId: 'sample-part',
    chapterId: 'sample-chapter',
    sceneId: 'sample-scene-2',
    anchorId: 'scene-sample-scene-2',
    updatedAt: '2026-11-12T08:00:00.000Z'
  };

  test('Normalizes a complete reading position and rejects malformed values', () => {
    if (!normalizeSeerahReadingPosition(position)) throw new Error('Valid position rejected');
    if (normalizeSeerahReadingPosition({ ...position, anchorId: '' }) !== null) throw new Error('Empty anchor accepted');
    if (normalizeSeerahReadingPosition({ ...position, updatedAt: 'not-a-date' }) !== null) throw new Error('Invalid date accepted');
    if (normalizeSeerahReadingPosition(null) !== null) throw new Error('Null position accepted');
  });

  test('Saves and restores a device-local position without affecting other keys', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated', 'preserve');
    if (!saveSeerahReadingPosition(position, storage)) throw new Error('Position was not saved');
    const restored = readSeerahReadingPosition(storage);
    if (restored?.anchorId !== position.anchorId || restored.chapterId !== position.chapterId) throw new Error('Position did not round-trip');
    if (storage.getItem('unrelated') !== 'preserve') throw new Error('Unrelated storage key changed');
    if (!storage.getItem(SEERAH_READING_POSITION_KEY)) throw new Error('Expected scoped key missing');
  });

  test('Clears only the Seerah reading position', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated', 'preserve');
    saveSeerahReadingPosition(position, storage);
    if (!clearSeerahReadingPosition(storage)) throw new Error('Clear failed');
    if (readSeerahReadingPosition(storage) !== null) throw new Error('Position remains after clear');
    if (storage.getItem('unrelated') !== 'preserve') throw new Error('Unrelated key was removed');
  });

  test('Malformed stored JSON and unavailable storage fail closed', () => {
    const malformed = { getItem: () => '{bad json' };
    if (readSeerahReadingPosition(malformed) !== null) throw new Error('Malformed JSON should not throw or restore');
    const unavailable = { setItem: () => { throw new Error('quota'); } };
    if (saveSeerahReadingPosition(position, unavailable)) throw new Error('Storage failure reported as success');
  });

  return { passed, failed };
}
