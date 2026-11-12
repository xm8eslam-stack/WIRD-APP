import { StorageService } from './storageService';

export interface SeerahReadingPosition {
  bookVersion: string;
  partId: string;
  chapterId: string;
  sceneId: string;
  anchorId: string;
  updatedAt: string;
}

export const SEERAH_READING_POSITION_KEY = 'wird.seerah.reading-position.prototype.v1';

/** Resolve device-local reader state against WIRD's active guest/user storage scope. */
export function getSeerahScopedStorageKey(baseKey: string, scope = StorageService.getStorageScope()): string {
  const safeScope = typeof scope === 'string' && scope.trim() ? scope : 'legacy';
  return baseKey + '.' + encodeURIComponent(safeScope);
}

function resolveStorageKey(baseKey: string, injectedStorage?: unknown): string {
  // Explicit storage injection is reserved for deterministic tests and callers
  // that deliberately provide an isolated storage adapter.
  return injectedStorage ? baseKey : getSeerahScopedStorageKey(baseKey);
}

export function normalizeSeerahReadingPosition(value: unknown): SeerahReadingPosition | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SeerahReadingPosition>;
  const fields = [candidate.bookVersion, candidate.partId, candidate.chapterId, candidate.sceneId, candidate.anchorId, candidate.updatedAt];
  if (fields.some(field => typeof field !== 'string' || !field.trim() || field.length > 180)) return null;
  if (!Number.isFinite(Date.parse(candidate.updatedAt as string))) return null;
  return {
    bookVersion: candidate.bookVersion as string,
    partId: candidate.partId as string,
    chapterId: candidate.chapterId as string,
    sceneId: candidate.sceneId as string,
    anchorId: candidate.anchorId as string,
    updatedAt: candidate.updatedAt as string
  };
}

export function readSeerahReadingPosition(storage?: Pick<Storage, 'getItem'>): SeerahReadingPosition | null {
  try {
    const source = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!source) return null;
    const raw = source.getItem(resolveStorageKey(SEERAH_READING_POSITION_KEY, storage));
    return raw ? normalizeSeerahReadingPosition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSeerahReadingPosition(
  position: SeerahReadingPosition,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  const normalized = normalizeSeerahReadingPosition(position);
  if (!normalized) return false;
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return false;
    target.setItem(resolveStorageKey(SEERAH_READING_POSITION_KEY, storage), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearSeerahReadingPosition(storage?: Pick<Storage, 'removeItem'>): boolean {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return false;
    target.removeItem(resolveStorageKey(SEERAH_READING_POSITION_KEY, storage));
    return true;
  } catch {
    return false;
  }
}


export interface SeerahBookmark {
  bookVersion: string;
  partId: string;
  chapterId: string;
  sceneId: string;
  anchorId: string;
  createdAt: string;
}

export const SEERAH_BOOKMARKS_KEY = 'wird.seerah.bookmarks.v1';

function normalizeSeerahBookmark(value: unknown): SeerahBookmark | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SeerahBookmark>;
  const fields = [candidate.bookVersion, candidate.partId, candidate.chapterId, candidate.sceneId, candidate.anchorId, candidate.createdAt];
  if (fields.some(field => typeof field !== 'string' || !field.trim() || field.length > 180)) return null;
  if (!Number.isFinite(Date.parse(candidate.createdAt as string))) return null;
  return {
    bookVersion: candidate.bookVersion as string,
    partId: candidate.partId as string,
    chapterId: candidate.chapterId as string,
    sceneId: candidate.sceneId as string,
    anchorId: candidate.anchorId as string,
    createdAt: candidate.createdAt as string
  };
}

function sameSeerahBookmark(a: SeerahBookmark, b: Pick<SeerahBookmark, 'bookVersion' | 'partId' | 'chapterId' | 'sceneId' | 'anchorId'>): boolean {
  return a.bookVersion === b.bookVersion && a.partId === b.partId &&
    a.chapterId === b.chapterId && a.sceneId === b.sceneId && a.anchorId === b.anchorId;
}

export function readSeerahBookmarks(storage?: Pick<Storage, 'getItem'>): SeerahBookmark[] {
  try {
    const source = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!source) return [];
    const raw = source.getItem(resolveStorageKey(SEERAH_BOOKMARKS_KEY, storage));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const bookmarks: SeerahBookmark[] = [];
    for (const item of parsed) {
      const bookmark = normalizeSeerahBookmark(item);
      if (bookmark && !bookmarks.some(existing => sameSeerahBookmark(existing, bookmark))) {
        bookmarks.push(bookmark);
      }
    }
    return bookmarks;
  } catch {
    return [];
  }
}

export function saveSeerahBookmark(
  value: SeerahBookmark,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): boolean {
  const bookmark = normalizeSeerahBookmark(value);
  if (!bookmark) return false;
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return false;
    const current = readSeerahBookmarks(target);
    const next = [...current.filter(item => !sameSeerahBookmark(item, bookmark)), bookmark];
    target.setItem(resolveStorageKey(SEERAH_BOOKMARKS_KEY, storage), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function removeSeerahBookmark(
  value: Pick<SeerahBookmark, 'bookVersion' | 'partId' | 'chapterId' | 'sceneId' | 'anchorId'>,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): boolean {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return false;
    const current = readSeerahBookmarks(target);
    const next = current.filter(item => !sameSeerahBookmark(item, value));
    target.setItem(resolveStorageKey(SEERAH_BOOKMARKS_KEY, storage), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
