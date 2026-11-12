import {
  clearSeerahReadingPosition,
  normalizeSeerahReadingPosition,
  readSeerahReadingPosition,
  saveSeerahReadingPosition,
  SEERAH_READING_POSITION_KEY,
  readSeerahBookmarks,
  saveSeerahBookmark,
  removeSeerahBookmark,
  SEERAH_BOOKMARKS_KEY,
  getSeerahScopedStorageKey
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

  test('Separates local reader data between guest and authenticated account scopes', () => {
    const guest = getSeerahScopedStorageKey(SEERAH_READING_POSITION_KEY, 'guest');
    const firstUser = getSeerahScopedStorageKey(SEERAH_READING_POSITION_KEY, 'user:uid-one');
    const secondUser = getSeerahScopedStorageKey(SEERAH_READING_POSITION_KEY, 'user:uid-two');
    if (guest === firstUser || firstUser === secondUser || guest === secondUser) {
      throw new Error('Reader state keys must be unique for every storage scope');
    }
  });

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

  test('Saves versioned bookmarks and restores them without duplicating the same scene anchor', () => {
    const storage = new MemoryStorage();
    const bookmark = { bookVersion: 'book-v1', partId: 'part-1', chapterId: 'chapter-1', sceneId: 'scene-2', anchorId: 'scene-2-start', createdAt: '2026-11-12T08:00:00.000Z' };
    if (!saveSeerahBookmark(bookmark, storage)) throw new Error('Bookmark was not saved');
    if (!saveSeerahBookmark({ ...bookmark, createdAt: '2026-11-12T09:00:00.000Z' }, storage)) throw new Error('Bookmark update failed');
    const restored = readSeerahBookmarks(storage);
    if (restored.length !== 1 || restored[0].createdAt !== '2026-11-12T09:00:00.000Z') throw new Error('Bookmark identity was duplicated or not updated');
    if (!storage.getItem(SEERAH_BOOKMARKS_KEY)) throw new Error('Bookmark storage key missing');
  });

  test('Keeps bookmarks from different content versions separate and removes only the selected bookmark', () => {
    const storage = new MemoryStorage();
    const first = { bookVersion: 'book-v1', partId: 'part-1', chapterId: 'chapter-1', sceneId: 'scene-1', anchorId: 'scene-1-start', createdAt: '2026-11-12T08:00:00.000Z' };
    const second = { ...first, bookVersion: 'book-v2', createdAt: '2026-11-12T08:01:00.000Z' };
    saveSeerahBookmark(first, storage);
    saveSeerahBookmark(second, storage);
    if (readSeerahBookmarks(storage).length !== 2) throw new Error('Different content versions were collapsed');
    if (!removeSeerahBookmark(first, storage)) throw new Error('Bookmark removal failed');
    const remaining = readSeerahBookmarks(storage);
    if (remaining.length !== 1 || remaining[0].bookVersion !== 'book-v2') throw new Error('Removal affected the wrong version');
  });

  test('Rejects malformed bookmarks and fails closed when storage is corrupt or full', () => {
    const storage = new MemoryStorage();
    const invalid = { bookVersion: '', partId: 'part', chapterId: 'chapter', sceneId: 'scene', anchorId: 'anchor', createdAt: 'not-a-date' };
    if (saveSeerahBookmark(invalid as any, storage)) throw new Error('Malformed bookmark was saved');
    const corrupt = { getItem: () => '{bad json' };
    if (readSeerahBookmarks(corrupt).length !== 0) throw new Error('Corrupt bookmark JSON was accepted');
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    if (saveSeerahBookmark({ bookVersion: 'v1', partId: 'p', chapterId: 'c', sceneId: 's', anchorId: 'a', createdAt: '2026-11-12T08:00:00.000Z' }, full as any)) throw new Error('Quota failure reported as success');
  });

  return { passed, failed };
}
