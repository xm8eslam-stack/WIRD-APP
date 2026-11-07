import { RUQYAH_ITEMS } from '../data/ruqyahData';
import { StorageService } from './storageService';

const STORAGE_KEY = 'wird_ruqyah_progress_v1';
const MAX_ITEMS = 200;
const MAX_COUNT = 1000;
const KNOWN_ITEM_IDS = new Set(RUQYAH_ITEMS.map(item => item.id));

export interface RuqyahProgressSnapshot {
  schemaVersion: 1;
  updatedAtMs: number;
  counts: Record<string, number>;
}

export type RuqyahProgressLoadResult =
  | { status: 'empty'; counts: Record<string, number> }
  | { status: 'loaded'; counts: Record<string, number>; updatedAtMs: number }
  | { status: 'corrupt'; counts: Record<string, number> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateCounts(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_ITEMS && entries.every(([id, count]) =>
    KNOWN_ITEM_IDS.has(id) &&
    Number.isSafeInteger(count) &&
    Number(count) >= 0 &&
    Number(count) <= MAX_COUNT
  );
}

/** Load progress from WIRD's current UID-scoped storage namespace. */
export function loadRuqyahProgress(): RuqyahProgressLoadResult {
  const raw = StorageService.getRawItem(STORAGE_KEY);
  if (raw === null) return { status: 'empty', counts: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1 ||
        !Number.isSafeInteger(parsed.updatedAtMs) ||
        Number(parsed.updatedAtMs) < 0 ||
        !validateCounts(parsed.counts)) {
      return { status: 'corrupt', counts: {} };
    }
    return {
      status: 'loaded',
      counts: parsed.counts,
      updatedAtMs: Number(parsed.updatedAtMs)
    };
  } catch {
    // Preserve the original bytes for recovery; never overwrite malformed state.
    return { status: 'corrupt', counts: {} };
  }
}

/** Persist progress atomically through the same account-scoped storage adapter as WIRD. */
export function saveRuqyahProgress(counts: Record<string, number>, nowMs = Date.now()): void {
  if (!validateCounts(counts) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('بيانات تقدم الرقية غير صالحة.');
  }
  const snapshot: RuqyahProgressSnapshot = {
    schemaVersion: 1,
    updatedAtMs: nowMs,
    counts: { ...counts }
  };
  const serialized = JSON.stringify(snapshot);
  if (!StorageService.setRawItem(STORAGE_KEY, serialized) ||
      !StorageService.verifyRawItem(STORAGE_KEY, serialized)) {
    throw new Error('تعذر حفظ تقدم الرقية والتحقق من سلامة التخزين.');
  }
}

/** Remove only this account's Ruqyah progress, retaining all other WIRD data. */
export function resetRuqyahProgress(): void {
  if (!StorageService.removeRawItem(STORAGE_KEY) ||
      !StorageService.verifyRawItem(STORAGE_KEY, null)) {
    throw new Error('تعذر إعادة ضبط تقدم الرقية.');
  }
}
