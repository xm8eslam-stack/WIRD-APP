import { STORAGE_KEYS, StorageService } from './storageService';

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

interface OutboxState {
  schemaVersion: 1;
  deviceId: string;
  pending: OutboxMutation[];
  acknowledgedIds: string[];
  /** Fingerprints retained for newly acknowledged IDs; optional for legacy schema-v1 states. */
  acknowledgedMutations?: OutboxMutation[];
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

import { createSecureId } from './secureId';

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
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
  return typeof value.mutationId === 'string' && value.mutationId.length > 0 && byteLength(value.mutationId) <= 128 && !/[\u0000-\u001f/]/.test(value.mutationId)
    && typeof value.collection === 'string' && ALLOWED_COLLECTIONS.has(value.collection as SyncCollection)
    && typeof value.documentId === 'string' && value.documentId.length > 0 && byteLength(value.documentId) <= 1500 && !value.documentId.includes('/') && !/[\u0000-\u001f]/.test(value.documentId)
    && (value.operation === 'upsert' || value.operation === 'tombstone')
    && value.schemaVersion === 1
    && Number.isSafeInteger(value.clientUpdatedAtMs) && Number(value.clientUpdatedAtMs) >= 0
    && typeof value.deviceId === 'string' && value.deviceId.length > 0 && value.deviceId.length <= 128
    && isRecord(value.payload) && byteLength(JSON.stringify(value.payload) || '') <= MAX_MUTATION_PAYLOAD_BYTES
    && Number.isSafeInteger(value.queuedAtMs) && Number(value.queuedAtMs) >= 0
    && Number.isSafeInteger(value.attemptCount) && Number(value.attemptCount) >= 0
    && Number.isSafeInteger(value.nextAttemptAtMs) && Number(value.nextAttemptAtMs) >= 0
    && (value.lastErrorCode === undefined || (typeof value.lastErrorCode === 'string' && value.lastErrorCode.length <= 64));
}


function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.keys(item).sort().reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = item[key];
      return sorted;
    }, {});
  });
}

function sameMutationIdentity(a: Pick<OutboxMutation, 'collection' | 'documentId' | 'operation' | 'payload'>, b: Pick<OutboxMutation, 'collection' | 'documentId' | 'operation' | 'payload'>): boolean {
  return a.collection === b.collection && a.documentId === b.documentId && a.operation === b.operation && stableJson(a.payload) === stableJson(b.payload);
}

function createEmptyState(): OutboxState {
  return { schemaVersion: 1, deviceId: createSecureId(), pending: [], acknowledgedIds: [], acknowledgedMutations: [] };
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

  if (!isRecord(parsed) || parsed.schemaVersion !== 1 ||
      typeof parsed.deviceId !== 'string' || parsed.deviceId.length === 0 || parsed.deviceId.length > 128 ||
      !Array.isArray(parsed.pending) || parsed.pending.length > MAX_PENDING_MUTATIONS ||
      !Array.isArray(parsed.acknowledgedIds) || parsed.acknowledgedIds.length > MAX_ACKNOWLEDGED_IDS ||
      !parsed.pending.every(isValidMutation) ||
      !parsed.acknowledgedIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128) ||
      (parsed.acknowledgedMutations !== undefined &&
        (!Array.isArray(parsed.acknowledgedMutations) ||
          parsed.acknowledgedMutations.length > MAX_ACKNOWLEDGED_IDS ||
          !parsed.acknowledgedMutations.every(isValidMutation)))) {
    throw new Error('بنية صندوق المزامنة غير صالحة؛ تم الحفاظ على النسخة الحالية دون تعديل.');
  }

  const pendingIds = parsed.pending.map((item: OutboxMutation) => item.mutationId);
  const acknowledgedIds = parsed.acknowledgedIds as string[];
  const acknowledgedMutations = (parsed.acknowledgedMutations ?? []) as OutboxMutation[];
  const fingerprintIds = acknowledgedMutations.map(item => item.mutationId);
  if (new Set(pendingIds).size !== pendingIds.length ||
      new Set(acknowledgedIds).size !== acknowledgedIds.length ||
      new Set(fingerprintIds).size !== fingerprintIds.length ||
      pendingIds.some(id => acknowledgedIds.includes(id)) ||
      fingerprintIds.some(id => !acknowledgedIds.includes(id)) ||
      fingerprintIds.some((id, index) => fingerprintIds.indexOf(id) !== index)) {
    throw new Error('صندوق المزامنة يحتوي على معرفات مكررة أو متعارضة بين العمليات المعلقة والمؤكدة؛ تم إيقافه دون تعديل.');
  }

  return { ...(parsed as unknown as OutboxState), acknowledgedMutations };
}

function persistState(state: OutboxState): void {
  const serialized = JSON.stringify(state);
  if (byteLength(serialized) > MAX_OUTBOX_BYTES) {
    throw new Error('امتلأ صندوق المزامنة المحلي؛ لم نحذف أي عملية قديمة ولم نؤكد إضافة العملية الجديدة.');
  }
  if (!StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, serialized)) {
    throw new Error('تعذر حفظ صندوق المزامنة في التخزين الدائم؛ لم يتم وضع العملية في قائمة الانتظار.');
  }
  if (StorageService.getRawItem(STORAGE_KEYS.SYNC_OUTBOX) !== serialized) {
    throw new Error('تعذر التحقق من حفظ صندوق المزامنة؛ لم يتم تأكيد العملية.');
  }
}

export const LocalSyncOutbox = {
  /** Add one UID-scoped mutation. Reusing an ID never creates a second queue item. */
  enqueue(input: EnqueueMutationInput): EnqueueMutationResult {
    getActiveUid();

    if (!ALLOWED_COLLECTIONS.has(input.collection)) throw new Error('مجموعة مزامنة غير مسموح بها.');
    if (typeof input.documentId !== 'string' || !input.documentId || byteLength(input.documentId) > 1500 || input.documentId.includes('/') || /[\u0000-\u001f]/.test(input.documentId)) {
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
    const mutationId = input.mutationId || createSecureId();
    if (typeof mutationId !== 'string' || !mutationId || mutationId.length > 128 || /[\u0000-\u001f/]/.test(mutationId)) throw new Error('معرّف العملية غير صالح.');
    const canonicalPayload = JSON.parse(payloadJson) as Record<string, unknown>;

    const state = readState();
    const existing = state.pending.find(item => item.mutationId === mutationId);
    if (existing) {
      const sameMutation = existing.collection === input.collection &&
        existing.documentId === input.documentId &&
        existing.operation === operation &&
        stableJson(existing.payload) === stableJson(canonicalPayload);
      if (!sameMutation) throw new Error('معرّف المزامنة مستخدم مسبقاً لبيانات مختلفة؛ أوقفنا العملية لمنع إسقاط تعديل جديد.');
      return { status: 'already_pending', mutation: { ...existing } };
    }
    if (state.acknowledgedIds.includes(mutationId)) {
      const acknowledged = state.acknowledgedMutations?.find(item => item.mutationId === mutationId);
      if (!acknowledged) {
        throw new Error('معرّف العملية موجود في سجل تأكيد قديم بلا بصمة بيانات؛ لا يمكن إثبات تطابق العملية بأمان، لذلك أوقفنا إعادة استخدامها.');
      }
      if (!sameMutationIdentity(acknowledged, { collection: input.collection, documentId: input.documentId, operation, payload: canonicalPayload })) {
        throw new Error('معرّف عملية مؤكدة مستخدم لبيانات مختلفة؛ تم رفض العملية لمنع إسقاط تعديل جديد.');
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
    const boundedLimit = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(limit)));
    return readState().pending
      .filter(item => item.nextAttemptAtMs <= nowMs)
      .sort((a, b) => a.queuedAtMs - b.queuedAtMs || a.mutationId.localeCompare(b.mutationId))
      .slice(0, boundedLimit)
      .map(item => ({ ...item, payload: { ...item.payload } }));
  },

  /** Acknowledge only after the remote server confirms the mutation. */
  acknowledge(mutationIds: string[]): number {
    getActiveUid();
    if (!Array.isArray(mutationIds) || mutationIds.length === 0) return 0;
    const state = readState();
    const ids = new Set(mutationIds);
    const remaining = state.pending.filter(item => !ids.has(item.mutationId));
    const removedCount = state.pending.length - remaining.length;
    const newlyAcknowledged = state.pending.filter(item => ids.has(item.mutationId));
    const acknowledged = [...state.acknowledgedIds, ...newlyAcknowledged.map(item => item.mutationId)]
      .slice(-MAX_ACKNOWLEDGED_IDS);
    if (removedCount === 0) return 0;
    state.pending = remaining;
    state.acknowledgedIds = acknowledged;
    const fingerprints = [...(state.acknowledgedMutations ?? []), ...newlyAcknowledged]
      .filter(item => acknowledged.includes(item.mutationId));
    state.acknowledgedMutations = fingerprints.slice(-MAX_ACKNOWLEDGED_IDS);
    persistState(state);
    return removedCount;
  },

  /** Record a retryable failure with capped exponential backoff; keep the mutation. */
  markFailed(mutationId: string, errorCode: string, nowMs: number = Date.now()): boolean {
    getActiveUid();
    const state = readState();
    const index = state.pending.findIndex(item => item.mutationId === mutationId);
    if (index < 0) return false;
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت إعادة المحاولة غير صالح.');
    const current = state.pending[index];
    const attemptCount = current.attemptCount + 1;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * (2 ** Math.min(attemptCount, 16)));
    state.pending[index] = {
      ...current,
      attemptCount,
      nextAttemptAtMs: nowMs + delay,
      lastErrorCode: String(errorCode || 'UNKNOWN').slice(0, 64)
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
