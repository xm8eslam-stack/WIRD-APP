import { STORAGE_KEYS, StorageService } from './storageService';
import { isValidRuqyahProgressCounts, isValidRuqyahProgressSnapshot } from './ruqyahProgressSchema';
import type { RuqyahProgressSnapshot } from './ruqyahProgressSchema';

const STORAGE_KEY = STORAGE_KEYS.RUQYAH_PROGRESS;
export type { RuqyahProgressSnapshot } from './ruqyahProgressSchema';

export type RuqyahProgressLoadResult =
  | { status: 'empty'; counts: Record<string, number> }
  | { status: 'loaded'; counts: Record<string, number>; updatedAtMs: number }
  | { status: 'corrupt'; counts: Record<string, number> };

/** Load progress from WIRD's current UID-scoped storage namespace. */
export function loadRuqyahProgress(): RuqyahProgressLoadResult {
  const raw = StorageService.getRawItem(STORAGE_KEY);
  if (raw === null) return { status: 'empty', counts: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidRuqyahProgressSnapshot(parsed)) {
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
  if (!isValidRuqyahProgressCounts(counts) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('بيانات تقدم الرقية غير صالحة.');
  }
  const snapshot: RuqyahProgressSnapshot = {
    schemaVersion: 1,
    updatedAtMs: nowMs,
    counts: { ...counts }
  };
  const serialized = JSON.stringify(snapshot);
  if (!StorageService.saveRuqyahProgressSnapshot(snapshot) ||
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
