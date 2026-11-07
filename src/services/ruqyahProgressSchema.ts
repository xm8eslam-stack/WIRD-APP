export interface RuqyahProgressSnapshot {
  schemaVersion: 1;
  updatedAtMs: number;
  counts: Record<string, number>;
}

const MAX_ITEMS = 200;
const MAX_COUNT = 1000;

export function isValidRuqyahProgressCounts(value: unknown): value is Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length <= MAX_ITEMS && entries.every(([id, count]) =>
    /^[a-z0-9][a-z0-9-]{0,99}$/.test(id) &&
    Number.isSafeInteger(count) &&
    Number(count) >= 0 &&
    Number(count) <= MAX_COUNT
  );
}

export function isValidRuqyahProgressSnapshot(value: unknown): value is RuqyahProgressSnapshot {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return snapshot.schemaVersion === 1 &&
    Number.isSafeInteger(snapshot.updatedAtMs) &&
    Number(snapshot.updatedAtMs) >= 0 &&
    isValidRuqyahProgressCounts(snapshot.counts);
}
