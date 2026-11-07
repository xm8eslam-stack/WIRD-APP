export interface RuqyahProgressSnapshotV1 {
  schemaVersion: 1;
  updatedAtMs: number;
  counts: Record<string, number>;
}

export interface RuqyahCounterComponents {
  /** Per-device monotonically increasing positive components. */
  increments: Record<string, number>;
  /** Per-device monotonically increasing negative components (resets/decrements). */
  decrements: Record<string, number>;
}

export interface RuqyahProgressSnapshotV2 {
  schemaVersion: 2;
  updatedAtMs: number;
  /** Derived totals retained for existing UI and display consumers. */
  counts: Record<string, number>;
  /** PN-counter components keyed by item ID, then stable journal device ID. */
  components: Record<string, RuqyahCounterComponents>;
}

export type RuqyahProgressSnapshot = RuqyahProgressSnapshotV1 | RuqyahProgressSnapshotV2;

const MAX_ITEMS = 200;
const MAX_LEGACY_COUNT = 1000;
const MAX_COMPONENT_COUNT = 1_000_000;
const MAX_TOTAL_COUNT = 100_000_000;
const MAX_DEVICES_PER_SIDE = 50;
const MAX_TOTAL_COMPONENTS = 2000;
const ITEM_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidCountMap(value: unknown, maximum: number): value is Record<string, number> {
  if (!isPlainRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_ITEMS && entries.every(([id, count]) =>
    ITEM_ID_PATTERN.test(id) &&
    Number.isSafeInteger(count) &&
    Number(count) >= 0 &&
    Number(count) <= maximum
  );
}

function sumComponents(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function deriveCount(components: RuqyahCounterComponents): number {
  return sumComponents(components.increments) - sumComponents(components.decrements);
}

function isValidComponentSide(value: unknown): value is Record<string, number> {
  if (!isPlainRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_DEVICES_PER_SIDE && entries.every(([deviceId, count]) =>
    DEVICE_ID_PATTERN.test(deviceId) &&
    Number.isSafeInteger(count) &&
    Number(count) >= 0 &&
    Number(count) <= MAX_COMPONENT_COUNT
  );
}

export function isValidRuqyahProgressCounts(value: unknown): value is Record<string, number> {
  return isValidCountMap(value, MAX_LEGACY_COUNT);
}

export function isValidRuqyahProgressSnapshotV2(value: unknown): value is RuqyahProgressSnapshotV2 {
  if (!isPlainRecord(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.schemaVersion !== 2 ||
      !Number.isSafeInteger(snapshot.updatedAtMs) ||
      Number(snapshot.updatedAtMs) < 0 ||
      !isValidCountMap(snapshot.counts, MAX_TOTAL_COUNT) ||
      !isPlainRecord(snapshot.components)) return false;

  const itemEntries = Object.entries(snapshot.components);
  if (itemEntries.length > MAX_ITEMS) return false;
  let totalComponents = 0;
  const derivedCounts: Record<string, number> = {};

  for (const [itemId, rawComponents] of itemEntries) {
    if (!ITEM_ID_PATTERN.test(itemId) || !isPlainRecord(rawComponents)) return false;
    const increments = rawComponents.increments;
    const decrements = rawComponents.decrements;
    if (!isValidComponentSide(increments) || !isValidComponentSide(decrements)) return false;
    totalComponents += Object.keys(increments).length + Object.keys(decrements).length;
    if (totalComponents > MAX_TOTAL_COMPONENTS) return false;
    const count = deriveCount({ increments, decrements });
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_TOTAL_COUNT) return false;
    if (count > 0) derivedCounts[itemId] = count;
  }

  const allCountIds = new Set([...Object.keys(snapshot.counts), ...Object.keys(derivedCounts)]);
  for (const itemId of allCountIds) {
    if ((snapshot.counts as Record<string, number>)[itemId] !== (derivedCounts[itemId] ?? 0)) return false;
  }
  return true;
}

export function isValidRuqyahProgressSnapshot(value: unknown): value is RuqyahProgressSnapshot {
  if (!isPlainRecord(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.schemaVersion === 1) {
    return Number.isSafeInteger(snapshot.updatedAtMs) &&
      Number(snapshot.updatedAtMs) >= 0 &&
      isValidRuqyahProgressCounts(snapshot.counts);
  }
  return isValidRuqyahProgressSnapshotV2(value);
}

export function createEmptyRuqyahProgressSnapshot(nowMs = Date.now()): RuqyahProgressSnapshotV2 {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت سجل الرقية غير صالح.');
  return { schemaVersion: 2, updatedAtMs: nowMs, counts: {}, components: {} };
}

/** Upgrade a legacy snapshot without inventing per-device increments. */
export function migrateRuqyahProgressSnapshot(
  snapshot: RuqyahProgressSnapshot,
  nowMs = snapshot.updatedAtMs
): RuqyahProgressSnapshotV2 {
  if (!isValidRuqyahProgressSnapshot(snapshot) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('لقطة تقدم الرقية غير صالحة للترقية.');
  }
  if (snapshot.schemaVersion === 2) {
    return { ...snapshot, updatedAtMs: nowMs, counts: { ...snapshot.counts }, components: Object.fromEntries(
      Object.entries(snapshot.components).map(([itemId, value]) => [itemId, {
        increments: { ...value.increments },
        decrements: { ...value.decrements }
      }])
    ) };
  }
  const components: Record<string, RuqyahCounterComponents> = {};
  for (const [itemId, count] of Object.entries(snapshot.counts)) {
    if (count > 0) components[itemId] = { increments: { legacy: count }, decrements: {} };
  }
  return {
    schemaVersion: 2,
    updatedAtMs: nowMs,
    counts: { ...snapshot.counts },
    components
  };
}

function mergeSide(
  left: Record<string, number>,
  right: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const deviceId of new Set([...Object.keys(left), ...Object.keys(right)])) {
    merged[deviceId] = Math.max(left[deviceId] ?? 0, right[deviceId] ?? 0);
  }
  return merged;
}

/** Convergent PN-counter merge: component-wise max, never last-write-wins. */
export function mergeRuqyahProgressSnapshots(
  left: RuqyahProgressSnapshot,
  right: RuqyahProgressSnapshot,
  nowMs = Math.max(left.updatedAtMs, right.updatedAtMs)
): RuqyahProgressSnapshotV2 {
  const a = migrateRuqyahProgressSnapshot(left);
  const b = migrateRuqyahProgressSnapshot(right);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت دمج تقدم الرقية غير صالح.');
  const components: Record<string, RuqyahCounterComponents> = {};
  const counts: Record<string, number> = {};
  for (const itemId of new Set([...Object.keys(a.components), ...Object.keys(b.components)])) {
    const leftItem = a.components[itemId] || { increments: {}, decrements: {} };
    const rightItem = b.components[itemId] || { increments: {}, decrements: {} };
    const merged = {
      increments: mergeSide(leftItem.increments, rightItem.increments),
      decrements: mergeSide(leftItem.decrements, rightItem.decrements)
    };
    const count = deriveCount(merged);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_TOTAL_COUNT) {
      throw new Error('نتيجة دمج عدادات الرقية خارج الحدود الآمنة.');
    }
    if (count > 0 || Object.keys(merged.increments).length || Object.keys(merged.decrements).length) {
      components[itemId] = merged;
    }
    if (count > 0) counts[itemId] = count;
  }
  const result: RuqyahProgressSnapshotV2 = { schemaVersion: 2, updatedAtMs: nowMs, counts, components };
  if (!isValidRuqyahProgressSnapshotV2(result)) {
    throw new Error('تعذر التحقق من سلامة نتيجة دمج عدادات الرقية.');
  }
  return result;
}

/** Apply one local increment/decrement to this device's monotonic PN-counter component. */
export function adjustRuqyahProgressCounter(
  snapshot: RuqyahProgressSnapshot,
  itemId: string,
  deviceId: string,
  delta: number,
  nowMs = Date.now()
): RuqyahProgressSnapshotV2 {
  if (!ITEM_ID_PATTERN.test(itemId) || !DEVICE_ID_PATTERN.test(deviceId) ||
      !Number.isSafeInteger(delta) || delta === 0 ||
      !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('بيانات تعديل عداد الرقية غير صالحة.');
  }
  const next = migrateRuqyahProgressSnapshot(snapshot, nowMs);
  const existing = next.components[itemId] || { increments: {}, decrements: {} };
  const increments = { ...existing.increments };
  const decrements = { ...existing.decrements };
  if (delta > 0) increments[deviceId] = (increments[deviceId] ?? 0) + delta;
  else decrements[deviceId] = (decrements[deviceId] ?? 0) + Math.abs(delta);
  const components = {
    ...next.components,
    [itemId]: { increments, decrements }
  };
  const count = deriveCount(components[itemId]);
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_TOTAL_COUNT ||
      increments[deviceId] > MAX_COMPONENT_COUNT || decrements[deviceId] > MAX_COMPONENT_COUNT) {
    throw new Error('تجاوز عداد الرقية الحد الآمن؛ لم يتم حفظ التغيير.');
  }
  const counts = { ...next.counts };
  if (count > 0) counts[itemId] = count;
  else delete counts[itemId];
  const result: RuqyahProgressSnapshotV2 = { schemaVersion: 2, updatedAtMs: nowMs, counts, components };
  if (!isValidRuqyahProgressSnapshotV2(result)) {
    throw new Error('تعذر التحقق من سلامة تعديل عداد الرقية.');
  }
  return result;
}
