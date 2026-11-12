export interface SeerahReadingPosition {
  bookVersion: string;
  partId: string;
  chapterId: string;
  sceneId: string;
  anchorId: string;
  updatedAt: string;
}

export const SEERAH_READING_POSITION_KEY = 'wird.seerah.reading-position.prototype.v1';

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
    const raw = source.getItem(SEERAH_READING_POSITION_KEY);
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
    target.setItem(SEERAH_READING_POSITION_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearSeerahReadingPosition(storage?: Pick<Storage, 'removeItem'>): boolean {
  try {
    const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!target) return false;
    target.removeItem(SEERAH_READING_POSITION_KEY);
    return true;
  } catch {
    return false;
  }
}
