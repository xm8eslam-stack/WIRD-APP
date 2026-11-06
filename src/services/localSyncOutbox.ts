import { STORAGE_KEYS, StorageService } from './storageService';
import { createSecureId } from './secureId';

export type SyncCollection =
  | 'profile'
  | 'plans'
  | 'enginePlans'
  | 'portions'
  | 'weakVerses'
  | 'tests'
  | 'activityEvents'
  | 'syncMeta';

export type SyncOperation = 'upsert' | 'tombstone';

export interface OutboxMutation {
  mutationId: string;
  collection: SyncCollection;
  documentId: string;
  operation: SyncOperation;
  schemaVersion: 1;
  clientUpdatedAtMs: number;
  deviceId: string;
  payload: Record<string, unknown>;
  queuedAtMs: number;
  attemptCount: number;
  nextAttemptAtMs: number;
  lastErrorCode?: string;
}

export interface EnqueueMutationInput {
  mutationId?: string;
  collection: SyncCollection;
  documentId: string;
  operation?: SyncOperation;
  payload: Record<string, unknown>;
  nowMs?: number;
}

export type EnqueueMutationResult =
  | { status: 'queued' | 'already_pending'; mutation: OutboxMutation }
  | { status: 'already_acknowledged'; mutationId: string };

interface AcknowledgedMutationFingerprint {
  mutationId: string;
  fingerprint: string;
}

interface OutboxState {
  schemaVersion: 1;
  deviceId: string;
  pending: OutboxMutation[];
  acknowledgedIds: string[];
  /**
   * Additive to schema v1. Older entries without fingerprints remain reserved,
   * but cannot be treated as idempotent retries because their content is unknown.
   */
  acknowledgedFingerprints: AcknowledgedMutationFingerprint[];
}

const MAX_PENDING_MUTATIONS = 1000;
const MAX_ACKNOWLEDGED_IDS = 5000;
const MAX_OUTBOX_BYTES = 1_500_000;
const MAX_MUTATION_PAYLOAD_BYTES = 128_000;
const MAX_BATCH_SIZE = 100;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const ALLOWED_COLLECTIONS = new Set<SyncCollection>([
  'profile', 'plans', 'enginePlans', 'portions',
  'weakVerses', 'tests', 'activityEvents', 'syncMeta'
]);

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isValidMutationId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && byteLength(value) <= 128 &&
    !/[\u0000-\u001f/]/.test(value);
}

function getActiveUid(): string {
  const scope = StorageService.getStorageScope();
  if (!scope.startsWith('user:')) {
    throw new Error('المزامنة السحابية متاحة للحساب المسجل فقط؛ بيانات الزائر تبقى محلية.');
  }
  const uid = scope.slice('user:'.length);
  if (!uid || uid.length > 128 || /[\u0000-\u001f]/.test(uid)) {
    throw new Error('تعذر تحديد حساب صالح لصندوق المزامنة.');
  }
  return uid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidMutation(value: unknown): value is OutboxMutation {
  if (!isRecord(value)) return false;
  let payloadBytes = 0;
  try { payloadBytes = byteLength(JSON.stringify(value.payload) || ''); }
  catch { return false; }
  return isValidMutationId(value.mutationId)
    && typeof value.collection === 'string' && ALLOWED_COLLECTIONS.has(value.collection as SyncCollection)
    && typeof value.documentId === 'string' && value.documentId.length > 0 && byteLength(value.documentId) <= 1500 && !value.documentId.includes('/') && !/[\u0000-\u001f]/.test(value.documentId)
    && (value.operation === 'upsert' || value.operation === 'tombstone')
    && value.schemaVersion === 1
    && Number.isSafeInteger(value.clientUpdatedAtMs) && Number(value.clientUpdatedAtMs) >= 0
    && typeof value.deviceId === 'string' && value.deviceId.length > 0 && value.deviceId.length <= 128 && !/[\u0000-\u001f]/.test(value.deviceId)
    && isRecord(value.payload) && payloadBytes <= MAX_MUTATION_PAYLOAD_BYTES
    && Number.isSafeInteger(value.queuedAtMs) && Number(value.queuedAtMs) >= 0
    && Number.isSafeInteger(value.attemptCount) && Number(value.attemptCount) >= 0
    && Number.isSafeInteger(value.nextAttemptAtMs) && Number(value.nextAttemptAtMs) >= 0
    && (value.lastErrorCode === undefined || (typeof value.lastErrorCode === 'string' && value.lastErrorCode.length <= 64));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableStringify(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * A compact non-cryptographic identity fingerprint. It detects accidental reuse
 * of a mutation ID with changed content; it is not an authentication mechanism.
 */
function createMutationFingerprint(
  collection: SyncCollection,
  documentId: string,
  operation: SyncOperation,
  payload: Record<string, unknown>
): string {
  const source = stableStringify({ collection, documentId, operation, payload });
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193);
    hashB = Math.imul(hashB ^ code, 0x85ebca6b);
  }
  return (hashA >>> 0).toString(16).padStart(8, '0') +
    (hashB >>> 0).toString(16).padStart(8, '0');
}

function normalizeOutboxState(value: unknown): OutboxState | null {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      typeof value.deviceId !== 'string' || value.deviceId.length === 0 ||
      value.deviceId.length > 128 || /[\u0000-\u001f]/.test(value.deviceId) ||
      !Array.isArray(value.pending) || value.pending.length > MAX_PENDING_MUTATIONS ||
      !Array.isArray(value.acknowledgedIds) || value.acknowledgedIds.length > MAX_ACKNOWLEDGED_IDS) {
    return null;
  }

  // Older v1 states did not store acknowledged payload fingerprints.
  const fingerprintsRaw = value.acknowledgedFingerprints === undefined
    ? []
    : value.acknowledgedFingerprints;
  if (!Array.isArray(fingerprintsRaw) || fingerprintsRaw.length > MAX_ACKNOWLEDGED_IDS) return null;

  if (!value.pending.every(isValidMutation) ||
      !value.pending.every((item: OutboxMutation) => item.deviceId === value.deviceId) ||
      !value.acknowledgedIds.every(isValidMutationId)) return null;

  const pendingIds = value.pending.map((item: OutboxMutation) => item.mutationId);
  const acknowledgedIds = value.acknowledgedIds as string[];
  if (new Set(pendingIds).size !== pendingIds.length ||
      new Set(acknowledgedIds).size !== acknowledgedIds.length) return null;

  const acknowledgedSet = new Set(acknowledgedIds);
  if (pendingIds.some(id => acknowledgedSet.has(id))) return null;

  const fingerprints: AcknowledgedMutationFingerprint[] = [];
  for (const item of fingerprintsRaw) {
    if (!isRecord(item) || !isValidMutationId(item.mutationId) ||
        typeof item.fingerprint !== 'string' || !/^[0-9a-f]{16}$/.test(item.fingerprint) ||
        !acknowledgedSet.has(item.mutationId)) return null;
    fingerprints.push({ mutationId: item.mutationId, fingerprint: item.fingerprint });
  }
  if (new Set(fingerprints.map(item => item.mutationId)).size !== fingerprints.length) return null;

  return {
    schemaVersion: 1,
    deviceId: value.deviceId,
    pending: value.pending as OutboxMutation[],
    acknowledgedIds,
    acknowledgedFingerprints: fingerprints
  };
}

function createEmptyState(): OutboxState {
  return {
    schemaVersion: 1,
    deviceId: createSecureId(),
    pending: [],
    acknowledgedIds: [],
    acknowledgedFingerprints: []
  };
}

function readState(): OutboxState {
  const raw = StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX);
  if (raw === null) {
    const empty = createEmptyState();
    persistState(empty);
    return empty;
  }
  if (byteLength(raw) > MAX_OUTBOX_BYTES) {
    throw new Error('صندوق المزامنة أكبر من الحد الآمن؛ تم إيقاف التعديل لحماية البيانات الموجودة.');
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('بيانات صندوق المزامنة تالفة؛ لم يتم استبدالها أو حذفها.'); }

  const normalized = normalizeOutboxState(parsed);
  if (!normalized) {
    throw new Error('بنية صندوق المزامنة غير صالحة أو تحتوي على معرفات مكررة/متعارضة؛ تم الحفاظ على النسخة الحالية دون تعديل.');
  }
  return normalized;
}

function persistState(state: OutboxState): void {
  const normalized = normalizeOutboxState(state);
  if (!normalized) throw new Error('رفض حفظ حالة صندوق مزامنة غير متسقة.');
  const serialized = JSON.stringify(normalized);
  if (byteLength(serialized) > MAX_OUTBOX_BYTES) {
    throw new Error('امتلأ صندوق المزامنة المحلي؛ لم نحذف أي عملية قديمة ولم نؤكد إضافة العملية الجديدة.');
  }

  const previousRaw = StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX);
  if (!StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, serialized)) {
    throw new Error('تعذر حفظ صندوق المزامنة في التخزين الدائم؛ لم يتم وضع العملية في قائمة الانتظار.');
  }
  if (StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) !== serialized) {
    if (previousRaw === null) StorageService.removeRawItem(STORAGE_KEYS.SYNC_OUTBOX);
    else StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, previousRaw);
    throw new Error('تعذر التحقق من حفظ صندوق المزامنة؛ أُعيدت الحالة السابقة ولم يتم تأكيد العملية.');
  }
}

export const LocalSyncOutbox = {
  /** Add one UID-scoped mutation. Reusing an ID never creates a second queue item. */
  enqueue(input: EnqueueMutationInput): EnqueueMutationResult {
    if (!input || typeof input !== 'object') throw new Error('بيانات عملية المزامنة غير صالحة.');
    getActiveUid();

    if (!ALLOWED_COLLECTIONS.has(input.collection)) throw new Error('مجموعة مزامنة غير مسموح بها.');
    if (typeof input.documentId !== 'string' || !input.documentId || byteLength(input.documentId) > 1500 ||
        input.documentId.includes('/') || /[\u0000-\u001f]/.test(input.documentId)) {
      throw new Error('معرّف مستند المزامنة غير صالح.');
    }
    const operation = input.operation ?? 'upsert';
    if (operation !== 'upsert' && operation !== 'tombstone') throw new Error('نوع عملية المزامنة غير مسموح به.');
    if (!isRecord(input.payload)) throw new Error('حمولة عملية المزامنة يجب أن تكون كائناً صالحاً.');

    let payloadJson: string;
    try { payloadJson = JSON.stringify(input.payload); }
    catch { throw new Error('تعذر تحويل بيانات العملية إلى صيغة قابلة للحفظ.'); }
    if (!payloadJson || byteLength(payloadJson) > MAX_MUTATION_PAYLOAD_BYTES) {
      throw new Error('بيانات العملية أكبر من الحد المسموح به أو غير قابلة للتسلسل.');
    }

    const mutationId = input.mutationId === undefined ? createSecureId() : input.mutationId;
    if (!isValidMutationId(mutationId)) throw new Error('معرّف العملية غير صالح.');
    const canonicalPayload = JSON.parse(payloadJson) as Record<string, unknown>;
    const fingerprint = createMutationFingerprint(input.collection, input.documentId, operation, canonicalPayload);

    const state = readState();
    const existing = state.pending.find(item => item.mutationId === mutationId);
    if (existing) {
      const sameMutation = existing.collection === input.collection &&
        existing.documentId === input.documentId &&
        existing.operation === operation &&
        stableStringify(existing.payload) === stableStringify(canonicalPayload);
      if (!sameMutation) throw new Error('معرّف المزامنة مستخدم مسبقاً لبيانات مختلفة؛ أوقفنا العملية لمنع إسقاط تعديل جديد.');
      return { status: 'already_pending', mutation: { ...existing } };
    }

    if (state.acknowledgedIds.includes(mutationId)) {
      const previousFingerprint = state.acknowledgedFingerprints.find(item => item.mutationId === mutationId);
      if (!previousFingerprint) {
        throw new Error('هذا المعرّف أُقرّ سابقاً قبل حفظ بصمة محتواه؛ لا يمكن التحقق من تطابق العملية القديمة. استخدم معرّفاً جديداً.');
      }
      if (previousFingerprint.fingerprint !== fingerprint) {
        throw new Error('معرّف المزامنة أُقرّ سابقاً بمحتوى مختلف؛ أوقفنا العملية لمنع إسقاط تعديل جديد.');
      }
      return { status: 'already_acknowledged', mutationId };
    }

    if (state.pending.length >= MAX_PENDING_MUTATIONS) {
      throw new Error('وصل صندوق المزامنة إلى سعته الآمنة؛ لم نحذف أي عملية معلقة.');
    }

    const now = input.nowMs ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('وقت إنشاء العملية غير صالح.');
    const mutation: OutboxMutation = {
      mutationId,
      collection: input.collection,
      documentId: input.documentId,
      operation,
      schemaVersion: 1,
      clientUpdatedAtMs: now,
      deviceId: state.deviceId,
      payload: canonicalPayload,
      queuedAtMs: now,
      attemptCount: 0,
      nextAttemptAtMs: 0
    };

    state.pending.push(mutation);
    persistState(state);
    return { status: 'queued', mutation: { ...mutation } };
  },

  /** Return only due mutations, oldest first, with a bounded page size. */
  listReady(nowMs: number = Date.now(), limit: number = 25): OutboxMutation[] {
    getActiveUid();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت قراءة صندوق المزامنة غير صالح.');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
      throw new Error('حجم دفعة المزامنة يجب أن يكون عدداً صحيحاً من 1 إلى ' + MAX_BATCH_SIZE + '.');
    }
    return readState().pending
      .filter(item => item.nextAttemptAtMs <= nowMs)
      .sort((a, b) => a.queuedAtMs - b.queuedAtMs || a.mutationId.localeCompare(b.mutationId))
      .slice(0, limit)
      .map(item => ({ ...item, payload: { ...item.payload } }));
  },

  /** Acknowledge only after the remote server confirms the mutation. */
  acknowledge(mutationIds: string[]): number {
    getActiveUid();
    if (!Array.isArray(mutationIds)) throw new Error('قائمة معرفات الإقرار غير صالحة.');
    if (mutationIds.length === 0) return 0;
    if (!mutationIds.every(isValidMutationId)) throw new Error('تحتوي قائمة الإقرار على معرف عملية غير صالح.');

    const state = readState();
    const ids = new Set(mutationIds);
    const acknowledgedNow = state.pending.filter(item => ids.has(item.mutationId));
    if (acknowledgedNow.length === 0) return 0;

    const remaining = state.pending.filter(item => !ids.has(item.mutationId));
    const removedCount = state.pending.length - remaining.length;
    const acknowledged = Array.from(new Set([
      ...state.acknowledgedIds,
      ...acknowledgedNow.map(item => item.mutationId)
    ])).slice(-MAX_ACKNOWLEDGED_IDS);
    const acknowledgedSet = new Set(acknowledged);
    const fingerprintById = new Map(state.acknowledgedFingerprints.map(item => [item.mutationId, item.fingerprint]));
    for (const item of acknowledgedNow) {
      fingerprintById.set(item.mutationId, createMutationFingerprint(item.collection, item.documentId, item.operation, item.payload));
    }
    const acknowledgedFingerprints = acknowledged
      .filter(id => fingerprintById.has(id))
      .map(id => ({ mutationId: id, fingerprint: fingerprintById.get(id)! }));

    state.pending = remaining;
    state.acknowledgedIds = acknowledged;
    state.acknowledgedFingerprints = acknowledgedFingerprints.filter(item => acknowledgedSet.has(item.mutationId));
    persistState(state);
    return removedCount;
  },

  /** Record a retryable failure with capped exponential backoff; keep the mutation. */
  markFailed(mutationId: string, errorCode: string, nowMs: number = Date.now()): boolean {
    getActiveUid();
    if (!isValidMutationId(mutationId)) throw new Error('معرّف العملية غير صالح.');
    if (typeof errorCode !== 'string' || errorCode.length > 64) throw new Error('رمز خطأ المزامنة غير صالح.');
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت إعادة المحاولة غير صالح.');

    const state = readState();
    const index = state.pending.findIndex(item => item.mutationId === mutationId);
    if (index < 0) return false;

    const current = state.pending[index];
    if (current.attemptCount >= Number.MAX_SAFE_INTEGER) {
      throw new Error('تعذر زيادة عداد محاولات المزامنة بأمان؛ لم يتم تعديل العملية.');
    }
    const attemptCount = current.attemptCount + 1;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * (2 ** Math.min(attemptCount, 16)));
    const nextAttemptAtMs = nowMs + delay;
    if (!Number.isSafeInteger(nextAttemptAtMs)) {
      throw new Error('وقت إعادة المحاولة يتجاوز الحد الآمن؛ لم يتم تعديل العملية.');
    }

    state.pending[index] = {
      ...current,
      attemptCount,
      nextAttemptAtMs,
      lastErrorCode: errorCode.trim().slice(0, 64) || 'UNKNOWN'
    };
    persistState(state);
    return true;
  },

  getSnapshot(): { uid: string; deviceId: string; pendingCount: number; acknowledgedCount: number } {
    const uid = getActiveUid();
    const state = readState();
    return {
      uid,
      deviceId: state.deviceId,
      pendingCount: state.pending.length,
      acknowledgedCount: state.acknowledgedIds.length
    };
  }
};
