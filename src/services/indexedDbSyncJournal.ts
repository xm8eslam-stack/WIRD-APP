import { createSecureId } from './secureId';
import { StorageService } from './storageService';
import type { SyncCollection, SyncOperation } from './localSyncOutbox';

const DATABASE_NAME = 'wird-sync-journal';
const DATABASE_VERSION = 1;
const STORE_EVENTS = 'events';
const STORE_OUTBOX = 'outbox';
const STORE_ACKNOWLEDGEMENTS = 'acknowledgements';
const STORE_METADATA = 'metadata';
const MAX_PENDING_MUTATIONS = 1000;
const MAX_ACKNOWLEDGED_IDS = 5000;
const MAX_MUTATION_PAYLOAD_BYTES = 128_000;
const MAX_BATCH_SIZE = 100;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

export interface JournalMutationInput {
  mutationId?: string;
  collection: SyncCollection;
  documentId: string;
  operation?: SyncOperation;
  payload: Record<string, unknown>;
  nowMs?: number;
}

export interface JournalEvent {
  key: string;
  uid: string;
  eventId: string;
  mutationId: string;
  eventType: 'domain-mutation';
  collection: SyncCollection;
  documentId: string;
  operation: SyncOperation;
  schemaVersion: 1;
  clientUpdatedAtMs: number;
  createdAtMs: number;
  deviceId: string;
  payload: Record<string, unknown>;
  fingerprint: string;
}

export interface JournalOutboxEntry {
  key: string;
  uid: string;
  eventId: string;
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
  fingerprint: string;
}

export interface JournalSnapshot {
  uid: string;
  deviceId: string;
  pendingCount: number;
  acknowledgedCount: number;
  eventCount: number;
}

interface AcknowledgementRecord {
  key: string;
  uid: string;
  mutationId: string;
  fingerprint: string;
  acknowledgedAtMs: number;
}

interface DeviceMetadata {
  uid: string;
  deviceId: string;
  schemaVersion: 1;
}

export type JournalEnqueueResult =
  | { status: 'queued' | 'already_pending'; mutation: JournalOutboxEntry }
  | { status: 'already_acknowledged'; mutationId: string };

export interface IndexedDbSyncJournalOptions {
  databaseName?: string;
  indexedDBFactory?: IDBFactory;
}

const ALLOWED_COLLECTIONS = new Set<SyncCollection>([
  'profile', 'plans', 'enginePlans', 'portions',
  'weakVerses', 'tests', 'activityEvents', 'syncMeta'
]);

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function activeUid(): string {
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

function validMutationId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && byteLength(value) <= 128 &&
    !/[\u0000-\u001f/]/.test(value);
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

function fingerprintMutation(
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

function normalizeError(error: unknown): Error {
  if (error && typeof error === 'object' && 'name' in error &&
      (error as { name?: string }).name === 'QuotaExceededError') {
    return new Error('مساحة التخزين المحلية ممتلئة؛ أُلغيت معاملة المزامنة بالكامل ولم تُسجل عملية جزئية.');
  }
  if (error instanceof Error) return error;
  return new Error('تعذرت إكمال معاملة سجل المزامنة؛ لم يتم تأكيد حفظ جزئي.');
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(normalizeError(transaction.error || new Error('IndexedDB transaction aborted.')));
    transaction.onerror = () => {
      // onabort is the authoritative completion signal for an aborted write transaction.
    };
  });
}

/**
 * Append-only local event journal. Each event and its outbox delivery record are
 * committed in one IndexedDB read/write transaction, so other tabs cannot observe
 * a half-enqueued mutation and a crash cannot persist only one side of the pair.
 */
export class IndexedDbSyncJournal {
  private readonly databaseName: string;
  private readonly factory?: IDBFactory;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDbSyncJournalOptions = {}) {
    this.databaseName = options.databaseName || DATABASE_NAME;
    this.factory = options.indexedDBFactory || globalThis.indexedDB;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    if (!this.factory) {
      return Promise.reject(new Error('IndexedDB غير متاح في هذا المتصفح؛ لم يتم استخدام تخزين غير ذري كبديل.'));
    }

    this.databasePromise = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try { request = this.factory!.open(this.databaseName, DATABASE_VERSION); }
      catch (error) { reject(normalizeError(error)); return; }

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_EVENTS)) {
          const events = database.createObjectStore(STORE_EVENTS, { keyPath: 'key' });
          events.createIndex('uid', 'uid', { unique: false });
          events.createIndex('uidCreatedAt', ['uid', 'createdAtMs'], { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_OUTBOX)) {
          const outbox = database.createObjectStore(STORE_OUTBOX, { keyPath: 'key' });
          outbox.createIndex('uid', 'uid', { unique: false });
          outbox.createIndex('uidNextAttempt', ['uid', 'nextAttemptAtMs'], { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_ACKNOWLEDGEMENTS)) {
          const acknowledgements = database.createObjectStore(STORE_ACKNOWLEDGEMENTS, { keyPath: 'key' });
          acknowledgements.createIndex('uid', 'uid', { unique: false });
          acknowledgements.createIndex('uidAcknowledgedAt', ['uid', 'acknowledgedAtMs'], { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_METADATA)) {
          database.createObjectStore(STORE_METADATA, { keyPath: 'uid' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => {
        this.databasePromise = null;
        reject(normalizeError(request.error || new Error('Could not open IndexedDB database.')));
      };
      request.onblocked = () => {
        this.databasePromise = null;
        reject(new Error('قاعدة بيانات المزامنة مشغولة في تبويب آخر؛ أغلق التبويب القديم ثم أعد المحاولة.'));
      };
    });
    return this.databasePromise;
  }

  async enqueue(input: JournalMutationInput): Promise<JournalEnqueueResult> {
    const uid = activeUid();
    if (!input || typeof input !== 'object') throw new Error('بيانات عملية المزامنة غير صالحة.');
    if (!ALLOWED_COLLECTIONS.has(input.collection)) throw new Error('مجموعة مزامنة غير مسموح بها.');
    if (typeof input.documentId !== 'string' || !input.documentId ||
        byteLength(input.documentId) > 1500 || input.documentId.includes('/') ||
        /[\u0000-\u001f]/.test(input.documentId)) {
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
    if (!validMutationId(mutationId)) throw new Error('معرّف العملية غير صالح.');
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const fingerprint = fingerprintMutation(input.collection, input.documentId, operation, payload);
    const now = input.nowMs ?? Date.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('وقت إنشاء العملية غير صالح.');

    const database = await this.openDatabase();
    const key = uid + ':' + mutationId;

    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(
          [STORE_EVENTS, STORE_OUTBOX, STORE_ACKNOWLEDGEMENTS, STORE_METADATA],
          'readwrite'
        );
      } catch (error) { reject(normalizeError(error)); return; }

      const events = transaction.objectStore(STORE_EVENTS);
      const outbox = transaction.objectStore(STORE_OUTBOX);
      const acknowledgements = transaction.objectStore(STORE_ACKNOWLEDGEMENTS);
      const metadata = transaction.objectStore(STORE_METADATA);
      let pendingRecord: JournalOutboxEntry | undefined;
      let acknowledgedRecord: AcknowledgementRecord | undefined;
      let deviceMetadata: DeviceMetadata | undefined;
      let pendingCount = 0;
      let readsRemaining = 4;
      let result: JournalEnqueueResult | undefined;
      let failure: Error | undefined;
      const finishRead = () => {
        readsRemaining--;
        if (readsRemaining !== 0 || failure || result) return;

        if (pendingRecord) {
          if (pendingRecord.fingerprint !== fingerprint) {
            failure = new Error('معرّف المزامنة مستخدم مسبقاً لبيانات مختلفة؛ أوقفنا العملية لمنع إسقاط تعديل جديد.');
          } else {
            result = { status: 'already_pending', mutation: { ...pendingRecord } };
          }
          return;
        }
        if (acknowledgedRecord) {
          if (acknowledgedRecord.fingerprint !== fingerprint) {
            failure = new Error('معرّف المزامنة أُقرّ سابقاً بمحتوى مختلف؛ أوقفنا العملية لمنع إسقاط تعديل جديد.');
          } else {
            result = { status: 'already_acknowledged', mutationId };
          }
          return;
        }
        if (pendingCount >= MAX_PENDING_MUTATIONS) {
          failure = new Error('وصل صندوق المزامنة إلى سعته الآمنة؛ لم نحذف أي عملية معلقة.');
          return;
        }

        const deviceId = deviceMetadata?.deviceId || createSecureId();
        const mutation: JournalOutboxEntry = {
          key,
          uid,
          eventId: mutationId,
          mutationId,
          collection: input.collection,
          documentId: input.documentId,
          operation,
          schemaVersion: 1,
          clientUpdatedAtMs: now,
          deviceId,
          payload,
          queuedAtMs: now,
          attemptCount: 0,
          nextAttemptAtMs: 0,
          fingerprint
        };
        const event: JournalEvent = {
          key,
          uid,
          eventId: mutationId,
          mutationId,
          eventType: 'domain-mutation',
          collection: input.collection,
          documentId: input.documentId,
          operation,
          schemaVersion: 1,
          clientUpdatedAtMs: now,
          createdAtMs: now,
          deviceId,
          payload,
          fingerprint
        };
        events.add(event);
        outbox.add(mutation);
        metadata.put({ uid, deviceId, schemaVersion: 1 } satisfies DeviceMetadata);
        result = { status: 'queued', mutation: { ...mutation } };
      };

      const pendingRequest = outbox.get(key);
      pendingRequest.onsuccess = () => { pendingRecord = pendingRequest.result as JournalOutboxEntry | undefined; finishRead(); };
      const acknowledgedRequest = acknowledgements.get(key);
      acknowledgedRequest.onsuccess = () => { acknowledgedRecord = acknowledgedRequest.result as AcknowledgementRecord | undefined; finishRead(); };
      const metadataRequest = metadata.get(uid);
      metadataRequest.onsuccess = () => { deviceMetadata = metadataRequest.result as DeviceMetadata | undefined; finishRead(); };
      const countRequest = outbox.index('uid').count(IDBKeyRange.only(uid));
      countRequest.onsuccess = () => { pendingCount = countRequest.result; finishRead(); };

      transaction.oncomplete = () => {
        if (failure) reject(failure);
        else if (result) resolve(result);
        else reject(new Error('اكتملت معاملة المزامنة دون نتيجة مؤكدة.'));
      };
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('IndexedDB transaction aborted.')));
      transaction.onerror = () => {
        // Let IndexedDB abort the whole read/write transaction.
      };
    });
  }

  async listReady(nowMs: number = Date.now(), limit: number = 25): Promise<JournalOutboxEntry[]> {
    const uid = activeUid();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت قراءة صندوق المزامنة غير صالح.');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
      throw new Error('حجم دفعة المزامنة يجب أن يكون عدداً صحيحاً من 1 إلى ' + MAX_BATCH_SIZE + '.');
    }
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_OUTBOX], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_OUTBOX).index('uid').getAll(IDBKeyRange.only(uid));
    const entries = await requestResult(request) as JournalOutboxEntry[];
    await completed;
    return entries.filter(item => item.nextAttemptAtMs <= nowMs)
      .sort((a, b) => a.queuedAtMs - b.queuedAtMs || a.mutationId.localeCompare(b.mutationId))
      .slice(0, limit)
      .map(item => ({ ...item, payload: { ...item.payload } }));
  }

  async acknowledge(mutationIds: string[], nowMs: number = Date.now()): Promise<number> {
    const uid = activeUid();
    if (!Array.isArray(mutationIds) || !mutationIds.every(validMutationId)) {
      throw new Error('قائمة معرفات الإقرار غير صالحة.');
    }
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت الإقرار غير صالح.');
    const ids = Array.from(new Set(mutationIds));
    if (ids.length === 0) return 0;

    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_OUTBOX, STORE_ACKNOWLEDGEMENTS], 'readwrite');
      const outbox = transaction.objectStore(STORE_OUTBOX);
      const acknowledgements = transaction.objectStore(STORE_ACKNOWLEDGEMENTS);
      let remaining = ids.length;
      let acknowledgedCount = 0;
      for (const mutationId of ids) {
        const key = uid + ':' + mutationId;
        const request = outbox.get(key);
        request.onsuccess = () => {
          const mutation = request.result as JournalOutboxEntry | undefined;
          if (mutation) {
            acknowledgements.put({
              key, uid, mutationId,
              fingerprint: mutation.fingerprint,
              acknowledgedAtMs: nowMs
            } satisfies AcknowledgementRecord);
            outbox.delete(key);
            acknowledgedCount++;
          }
          remaining--;
          if (remaining === 0) {
            const allRequest = acknowledgements.index('uid').getAll(IDBKeyRange.only(uid));
            allRequest.onsuccess = () => {
              const all = allRequest.result as AcknowledgementRecord[];
              all.sort((a, b) => a.acknowledgedAtMs - b.acknowledgedAtMs);
              for (const old of all.slice(0, Math.max(0, all.length - MAX_ACKNOWLEDGED_IDS))) {
                acknowledgements.delete(old.key);
              }
            };
          }
        };
      }
      transaction.oncomplete = () => resolve(acknowledgedCount);
      transaction.onabort = () => reject(normalizeError(transaction.error || new Error('IndexedDB acknowledgement transaction aborted.')));
    });
  }

  async markFailed(mutationId: string, errorCode: string, nowMs: number = Date.now()): Promise<boolean> {
    const uid = activeUid();
    if (!validMutationId(mutationId)) throw new Error('معرّف العملية غير صالح.');
    if (typeof errorCode !== 'string' || errorCode.length > 64) throw new Error('رمز خطأ المزامنة غير صالح.');
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت إعادة المحاولة غير صالح.');
    const database = await this.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_OUTBOX], 'readwrite');
      const store = transaction.objectStore(STORE_OUTBOX);
      const request = store.get(uid + ':' + mutationId);
      let updated = false;
      request.onsuccess = () => {
        const current = request.result as JournalOutboxEntry | undefined;
        if (!current) return;
        if (current.attemptCount >= Number.MAX_SAFE_INTEGER) {
          transaction.abort();
          return;
        }
        const attemptCount = current.attemptCount + 1;
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * (2 ** Math.min(attemptCount, 16)));
        const nextAttemptAtMs = nowMs + delay;
        if (!Number.isSafeInteger(nextAttemptAtMs)) {
          transaction.abort();
          return;
        }
        store.put({
          ...current,
          attemptCount,
          nextAttemptAtMs,
          lastErrorCode: errorCode.trim().slice(0, 64) || 'UNKNOWN'
        });
        updated = true;
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onabort = () => reject(normalizeError(transaction.error || new Error('IndexedDB retry transaction aborted.')));
    });
  }

  async listEvents(): Promise<JournalEvent[]> {
    const uid = activeUid();
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_EVENTS], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_EVENTS).index('uid').getAll(IDBKeyRange.only(uid));
    const events = await requestResult(request) as JournalEvent[];
    await completed;
    return events.sort((a, b) => a.createdAtMs - b.createdAtMs || a.eventId.localeCompare(b.eventId));
  }

  async getSnapshot(): Promise<JournalSnapshot> {
    const uid = activeUid();
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_OUTBOX, STORE_ACKNOWLEDGEMENTS, STORE_EVENTS, STORE_METADATA], 'readonly');
    const completed = transactionComplete(transaction);
    const pendingRequest = transaction.objectStore(STORE_OUTBOX).index('uid').getAll(IDBKeyRange.only(uid));
    const acknowledgedRequest = transaction.objectStore(STORE_ACKNOWLEDGEMENTS).index('uid').getAll(IDBKeyRange.only(uid));
    const eventRequest = transaction.objectStore(STORE_EVENTS).index('uid').getAll(IDBKeyRange.only(uid));
    const metadataRequest = transaction.objectStore(STORE_METADATA).get(uid);
    const [pending, acknowledged, events, metadata] = await Promise.all([
      requestResult(pendingRequest), requestResult(acknowledgedRequest),
      requestResult(eventRequest), requestResult(metadataRequest)
    ]);
    await completed;
    return {
      uid,
      deviceId: (metadata as DeviceMetadata | undefined)?.deviceId || '',
      pendingCount: (pending as JournalOutboxEntry[]).length,
      acknowledgedCount: (acknowledged as AcknowledgementRecord[]).length,
      eventCount: (events as JournalEvent[]).length
    };
  }

  close(): void {
    if (!this.databasePromise) return;
    void this.databasePromise.then(database => database.close()).catch(() => undefined);
    this.databasePromise = null;
  }
}
