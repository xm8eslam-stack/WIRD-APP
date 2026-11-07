import { STORAGE_KEYS, StorageService } from './storageService';
import { createSecureId } from './secureId';
import { IndexedDbSyncJournal } from './indexedDbSyncJournal';
import type { JournalOutboxEntry, LegacyOutboxState } from './indexedDbSyncJournal';

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
  eventId?: string;
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
  sequence?: number;
  baseRevision?: number;
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

const MAX_OUTBOX_BYTES = 1_500_000;
const MAX_PENDING_MUTATIONS = 1000;
const MAX_ACKNOWLEDGED_IDS = 5000;
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
    && (value.sequence === undefined || (Number.isSafeInteger(value.sequence) && Number(value.sequence) >= 0))
    && (value.baseRevision === undefined || (Number.isSafeInteger(value.baseRevision) && Number(value.baseRevision) >= 0))
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
    const rollbackVerified = StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, previousRaw);
    throw new Error(rollbackVerified
      ? 'تعذر حفظ صندوق المزامنة؛ تم التحقق من بقاء الحالة السابقة ولم يتم وضع العملية في قائمة الانتظار.'
      : 'تعذر حفظ صندوق المزامنة، كما تعذر التحقق من استعادة الحالة السابقة. لا تكرر العملية؛ احتفظ بنسخة من بياناتك واطلب مراجعة صندوق المزامنة.');
  }
  if (!StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, serialized)) {
    try {
      if (previousRaw === null) StorageService.removeRawItem(STORAGE_KEYS.SYNC_OUTBOX);
      else StorageService.setRawItem(STORAGE_KEYS.SYNC_OUTBOX, previousRaw);
    } catch {
      // Durable read-back below determines whether the old state was restored.
    }
    const rollbackVerified = StorageService.verifyRawItem(STORAGE_KEYS.SYNC_OUTBOX, previousRaw);
    throw new Error(rollbackVerified
      ? 'تعذر التحقق من حفظ صندوق المزامنة؛ تم التحقق من استعادة الحالة السابقة ولم يتم تأكيد العملية.'
      : 'تعذر التحقق من حفظ صندوق المزامنة، ولم ينجح التحقق من استعادة الحالة السابقة. لا تكرر العملية؛ احتفظ بنسخة من البيانات واطلب مراجعة صندوق المزامنة.');
  }
}

let indexedDbJournal: IndexedDbSyncJournal | null = null;
const lastMigratedLegacyRawByUid = new Map<string, string>();

function getIndexedDbJournal(): IndexedDbSyncJournal {
  if (!indexedDbJournal) indexedDbJournal = new IndexedDbSyncJournal();
  return indexedDbJournal;
}

async function migrateLegacyOutboxToIndexedDb(): Promise<'empty' | 'migrated' | 'already_migrated'> {
  const uid = getActiveUid();
  const key = STORAGE_KEYS.SYNC_OUTBOX;
  const raw = StorageService.getRawItem(key);
  if (raw === null) {
    if (!StorageService.verifyRawItem(key, null)) {
      throw new Error('تعذرت قراءة صندوق المزامنة القديم بشكل موثوق؛ لم يتم افتراض أنه فارغ.');
    }
    return 'empty';
  }
  if (lastMigratedLegacyRawByUid.get(uid) === raw) return 'already_migrated';
  if (byteLength(raw) > MAX_OUTBOX_BYTES) {
    throw new Error('صندوق المزامنة القديم أكبر من الحد الآمن؛ تم الحفاظ عليه دون تعديل.');
  }
  if (!StorageService.verifyRawItem(key, raw)) {
    throw new Error('تعذرت مطابقة نسخة صندوق المزامنة مع التخزين الدائم؛ أوقفنا الترحيل قبل أي تغيير.');
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('بيانات صندوق المزامنة القديم تالفة؛ لم يتم حذفها أو استبدالها.'); }
  const normalized = normalizeOutboxState(parsed);
  if (!normalized) {
    throw new Error('بنية صندوق المزامنة القديم غير صالحة؛ تم الاحتفاظ بالنسخة الأصلية دون تعديل.');
  }

  const result = await getIndexedDbJournal().importLegacyState(normalized as LegacyOutboxState);
  // Keep the source as a recovery copy. Older tabs may still write the v1 key;
  // later imports merge new entries by fingerprint without deleting that source.
  if (!StorageService.verifyRawItem(key, raw)) {
    throw new Error('تغير صندوق المزامنة القديم أثناء الترحيل؛ تم الاحتفاظ بالمصدر وأُوقف تأكيد المزامنة حتى إعادة الدمج.');
  }
  lastMigratedLegacyRawByUid.set(uid, raw);
  return result;
}

function toOutboxMutation(entry: JournalOutboxEntry): OutboxMutation {
  const { key: _key, uid: _uid, fingerprint: _fingerprint, ...mutation } = entry;
  return mutation;
}

export const LocalSyncOutbox = {
  /** One-time, idempotent migration; the old localStorage value remains as a recovery copy. */
  migrateLegacyToIndexedDb: migrateLegacyOutboxToIndexedDb,

  /** Add one UID-scoped mutation using the atomic IndexedDB event/outbox transaction. */
  async enqueue(input: EnqueueMutationInput): Promise<EnqueueMutationResult> {
    await migrateLegacyOutboxToIndexedDb();
    const result = await getIndexedDbJournal().enqueue(input);
    if (result.status === 'already_acknowledged') return result;
    return { status: result.status, mutation: toOutboxMutation(result.mutation) };
  },

  /** Return only due mutations, oldest first, with a bounded page size. */
  async listReady(nowMs: number = Date.now(), limit: number = 25): Promise<OutboxMutation[]> {
    await migrateLegacyOutboxToIndexedDb();
    return (await getIndexedDbJournal().listReady(nowMs, limit)).map(toOutboxMutation);
  },

  /** Return ready journal outbox entries including eventId and fingerprint */
  async listReadyEntries(nowMs: number = Date.now(), limit: number = 25): Promise<JournalOutboxEntry[]> {
    await migrateLegacyOutboxToIndexedDb();
    return getIndexedDbJournal().listReady(nowMs, limit);
  },

  /** Acknowledge only after the remote server confirms the mutation. */
  async acknowledge(mutationIds: string[], nowMs: number = Date.now()): Promise<number> {
    await migrateLegacyOutboxToIndexedDb();
    return getIndexedDbJournal().acknowledge(mutationIds, nowMs);
  },

  /** Read the last server revision durably acknowledged for one document. */
  async getRemoteRevision(collection: SyncCollection, documentId: string) {
    await migrateLegacyOutboxToIndexedDb();
    return getIndexedDbJournal().getRemoteRevision(collection, documentId);
  },

  /** Atomically acknowledge a remote write and persist its new server revision. */
  async acknowledgeRemoteMutation(mutationId: string, revision: number, nowMs: number = Date.now()): Promise<boolean> {
    await migrateLegacyOutboxToIndexedDb();
    return getIndexedDbJournal().acknowledgeRemoteMutation(mutationId, revision, nowMs);
  },

  /** Rebase a later pending mutation only after a preceding local mutation advanced its document. */
  async rebasePendingMutation(mutationId: string, expectedBaseRevision: number, nextBaseRevision: number): Promise<boolean> {
    await migrateLegacyOutboxToIndexedDb();
    return getIndexedDbJournal().rebasePendingMutation(mutationId, expectedBaseRevision, nextBaseRevision);
  },

  /** Record a retryable failure with capped exponential backoff; keep the mutation. */
  async markFailed(mutationId: string, errorCode: string, nowMs: number = Date.now()): Promise<boolean> {
    await migrateLegacyOutboxToIndexedDb();
    return getIndexedDbJournal().markFailed(mutationId, errorCode, nowMs);
  },

  async getSnapshot(): Promise<{ uid: string; deviceId: string; pendingCount: number; acknowledgedCount: number }> {
    await migrateLegacyOutboxToIndexedDb();
    const snapshot = await getIndexedDbJournal().getSnapshot();
    return {
      uid: snapshot.uid,
      deviceId: snapshot.deviceId,
      pendingCount: snapshot.pendingCount,
      acknowledgedCount: snapshot.acknowledgedCount
    };
  }
};
