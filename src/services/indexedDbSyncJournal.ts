import { createSecureId } from './secureId';
import { StorageService } from './storageService';
import type { SyncCollection, SyncOperation } from './localSyncOutbox';

const DATABASE_NAME = 'wird-sync-journal';
const DATABASE_VERSION = 8;
const STORE_EVENTS = 'events';
const STORE_OUTBOX = 'outbox';
const STORE_ACKNOWLEDGEMENTS = 'acknowledgements';
const STORE_METADATA = 'metadata';
const STORE_REMOTE_INBOX = 'remoteInbox';
const STORE_PROJECTION_CONFLICTS = 'projectionConflicts';
const MAX_PENDING_MUTATIONS = 1000;
const MAX_ACKNOWLEDGED_IDS = 5000;
const MAX_REMOTE_REVISION_RECORDS = 10_000;
const MAX_REMOTE_INBOX_EVENTS = 1_000;
const MAX_PROJECTION_CONFLICTS = 100;
const MAX_CONFLICT_SNAPSHOT_BYTES = 500_000;
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
  sequence: number;
  baseRevision?: number;
  projectionRequired?: boolean;
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
  sequence: number;
  baseRevision: number;
}

export interface JournalSnapshot {
  uid: string;
  deviceId: string;
  pendingCount: number;
  acknowledgedCount: number;
  eventCount: number;
  projectionCursor: number;
}

export interface RemoteRevisionSnapshot {
  revision: number;
  localSequence: number;
}

export interface RemoteInboxEvent {
  key: string;
  uid: string;
  eventId: string;
  mutationId: string;
  eventType: 'domain-mutation';
  collection: SyncCollection;
  documentId: string;
  operation: SyncOperation;
  schemaVersion: 2;
  deviceId: string;
  occurredAtMs: number;
  payload: Record<string, unknown>;
  baseRevision: number;
  revision: number;
  serverSequence: number;
  fingerprint: string;
}

export type RemoteInboxEventInput = Omit<RemoteInboxEvent, 'key' | 'fingerprint'>;

export interface RemoteProjectionConflict {
  key: string;
  uid: string;
  event: RemoteInboxEvent;
  reason: string;
  localSnapshot: Record<string, string | null>;
  createdAtMs: number;
  updatedAtMs: number;
  status: 'open' | 'resolved';
  resolution?: 'keep-local' | 'use-remote';
  resolvedAtMs?: number;
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
  nextSequence: number;
  lastProjectedSequence: number;
  remoteRevisions?: Record<string, { revision: number; localSequence: number }>;
  remoteCursor?: number;
  remoteProjectionCursor?: number;
  remoteInitializedCollections?: SyncCollection[];
  legacyOutboxMigrated?: boolean;
  legacyOutboxFingerprint?: string;
}

export interface LegacyOutboxMutation {
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
  baseRevision?: number;
}

export interface LegacyOutboxState {
  schemaVersion: 1;
  deviceId: string;
  pending: LegacyOutboxMutation[];
  acknowledgedIds: string[];
  acknowledgedFingerprints: Array<{ mutationId: string; fingerprint: string }>;
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

function fingerprintRemoteInboxEvent(event: RemoteInboxEventInput): string {
  const source = stableStringify(event);
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

      request.onupgradeneeded = (upgradeEvent) => {
        const database = request.result;
        const upgradeTransaction = request.transaction!;
        let events: IDBObjectStore;
        if (!database.objectStoreNames.contains(STORE_EVENTS)) {
          events = database.createObjectStore(STORE_EVENTS, { keyPath: 'key' });
          events.createIndex('uid', 'uid', { unique: false });
          events.createIndex('uidCreatedAt', ['uid', 'createdAtMs'], { unique: false });
        } else {
          events = upgradeTransaction.objectStore(STORE_EVENTS);
        }
        if (!events.indexNames.contains('uidSequence')) {
          events.createIndex('uidSequence', ['uid', 'sequence'], { unique: true });
        }
        if (!database.objectStoreNames.contains(STORE_OUTBOX)) {
          const outbox = database.createObjectStore(STORE_OUTBOX, { keyPath: 'key' });
          outbox.createIndex('uid', 'uid', { unique: false });
          outbox.createIndex('uidNextAttempt', ['uid', 'nextAttemptAtMs'], { unique: false });
        }
        const outboxStore = upgradeTransaction.objectStore(STORE_OUTBOX);
        if (!outboxStore.indexNames.contains('uidCollectionDocument')) {
          outboxStore.createIndex('uidCollectionDocument', ['uid', 'collection', 'documentId'], { unique: false });
        }
        if (!outboxStore.indexNames.contains('uidCollection')) {
          outboxStore.createIndex('uidCollection', ['uid', 'collection'], { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_ACKNOWLEDGEMENTS)) {
          const acknowledgements = database.createObjectStore(STORE_ACKNOWLEDGEMENTS, { keyPath: 'key' });
          acknowledgements.createIndex('uid', 'uid', { unique: false });
          acknowledgements.createIndex('uidAcknowledgedAt', ['uid', 'acknowledgedAtMs'], { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_REMOTE_INBOX)) {
          const remoteInbox = database.createObjectStore(STORE_REMOTE_INBOX, { keyPath: 'key' });
          remoteInbox.createIndex('uid', 'uid', { unique: false });
          remoteInbox.createIndex('uidServerSequence', ['uid', 'serverSequence'], { unique: true });
        }
        if (!database.objectStoreNames.contains(STORE_PROJECTION_CONFLICTS)) {
          const conflicts = database.createObjectStore(STORE_PROJECTION_CONFLICTS, { keyPath: 'key' });
          conflicts.createIndex('uid', 'uid', { unique: false });
          conflicts.createIndex('uidCreatedAt', ['uid', 'createdAtMs'], { unique: false });
        }
        let metadataStore: IDBObjectStore;
        if (!database.objectStoreNames.contains(STORE_METADATA)) {
          metadataStore = database.createObjectStore(STORE_METADATA, { keyPath: 'uid' });
        } else {
          metadataStore = upgradeTransaction.objectStore(STORE_METADATA);
        }

        // Version 1 events had no monotonic sequence. Backfill only for the
        // v1 -> v2 upgrade; future upgrades must preserve the durable cursor.
        if (upgradeEvent.oldVersion < 2) {
          const eventsRequest = events.getAll();
          eventsRequest.onsuccess = () => {
            const allEvents = (eventsRequest.result as JournalEvent[])
              .sort((a, b) => a.uid.localeCompare(b.uid) ||
                a.createdAtMs - b.createdAtMs || a.eventId.localeCompare(b.eventId));
            const nextByUid = new Map<string, number>();
            for (const event of allEvents) {
              const sequence = nextByUid.get(event.uid) ?? 1;
              event.sequence = sequence;
              event.projectionRequired = false;
              events.put(event);
              nextByUid.set(event.uid, sequence + 1);
            }

            const metadataRequest = metadataStore.getAll();
            metadataRequest.onsuccess = () => {
              const existing = metadataRequest.result as DeviceMetadata[];
              const existingUids = new Set<string>();
              for (const metadata of existing) {
                existingUids.add(metadata.uid);
                metadataStore.put({
                  ...metadata,
                  nextSequence: nextByUid.get(metadata.uid) || 1,
                  lastProjectedSequence: 0
                });
              }
              for (const [uid, nextSequence] of nextByUid) {
                if (!existingUids.has(uid)) {
                  metadataStore.put({
                    uid, deviceId: createSecureId(), schemaVersion: 1,
                    nextSequence, lastProjectedSequence: 0
                  } satisfies DeviceMetadata);
                }
              }
            };
          };
        }
        if (upgradeEvent.oldVersion >= 2 && upgradeEvent.oldVersion < 3) {
          // v2 was the journal foundation before domain mutation call sites were
          // connected. Its existing events are legacy imports/already-projected data.
          const projectionFlagRequest = events.getAll();
          projectionFlagRequest.onsuccess = () => {
            for (const event of projectionFlagRequest.result as JournalEvent[]) {
              if (event.projectionRequired === undefined) {
                event.projectionRequired = false;
                events.put(event);
              }
            }
          };
        }

        if (upgradeEvent.oldVersion < 4) {
          // Add delivery revision metadata without changing any existing event or payload.
          const eventRequest = events.getAll();
          const outboxStore = upgradeTransaction.objectStore(STORE_OUTBOX);
          const outboxRequest = outboxStore.getAll();
          let eventsReady = false;
          let outboxReady = false;
          let existingEvents: JournalEvent[] = [];
          let existingOutbox: JournalOutboxEntry[] = [];
          const migrateOutbox = () => {
            if (!eventsReady || !outboxReady) return;
            const sequenceByKey = new Map(existingEvents.map(event => [event.key, event.sequence]));
            for (const mutation of existingOutbox) {
              outboxStore.put({
                ...mutation,
                sequence: sequenceByKey.get(mutation.key) ?? 0,
                baseRevision: 0
              });
            }
          };
          eventRequest.onsuccess = () => {
            existingEvents = eventRequest.result as JournalEvent[];
            eventsReady = true;
            migrateOutbox();
          };
          outboxRequest.onsuccess = () => {
            existingOutbox = outboxRequest.result as JournalOutboxEntry[];
            outboxReady = true;
            migrateOutbox();
          };
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          this.databasePromise = null;
        };
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

  /**
   * Import the v1 localStorage outbox as one IndexedDB transaction. The caller
   * removes the legacy localStorage key only after this method commits.
   */
  async importLegacyState(state: LegacyOutboxState): Promise<'migrated' | 'already_migrated'> {
    const uid = activeUid();
    if (!state || state.schemaVersion !== 1 || typeof state.deviceId !== 'string' ||
        !state.deviceId || state.deviceId.length > 128 || /[\u0000-\u001f]/.test(state.deviceId) ||
        !Array.isArray(state.pending) || state.pending.length > MAX_PENDING_MUTATIONS ||
        !Array.isArray(state.acknowledgedIds) || state.acknowledgedIds.length > MAX_ACKNOWLEDGED_IDS ||
        !Array.isArray(state.acknowledgedFingerprints)) {
      throw new Error('بنية صندوق المزامنة القديم غير صالحة؛ تم الحفاظ على النسخة الأصلية دون تعديل.');
    }

    const fingerprints = new Map<string, string>();
    for (const item of state.acknowledgedFingerprints) {
      if (!item || !validMutationId(item.mutationId) || typeof item.fingerprint !== 'string' ||
          !/^[0-9a-f]{16}$/.test(item.fingerprint) || fingerprints.has(item.mutationId)) {
        throw new Error('بصمات صندوق المزامنة القديم غير صالحة؛ لم يتم بدء الترحيل.');
      }
      fingerprints.set(item.mutationId, item.fingerprint);
    }

    const pendingIds = new Set<string>();
    for (const item of state.pending) {
      if (!item || !validMutationId(item.mutationId) || pendingIds.has(item.mutationId) ||
          !ALLOWED_COLLECTIONS.has(item.collection) || typeof item.documentId !== 'string' ||
          !item.documentId || item.documentId.includes('/') || byteLength(item.documentId) > 1500 ||
          (item.operation !== 'upsert' && item.operation !== 'tombstone') || item.schemaVersion !== 1 ||
          item.deviceId !== state.deviceId || !isRecord(item.payload) ||
          byteLength(JSON.stringify(item.payload)) > MAX_MUTATION_PAYLOAD_BYTES ||
          !Number.isSafeInteger(item.clientUpdatedAtMs) || item.clientUpdatedAtMs < 0 ||
          !Number.isSafeInteger(item.queuedAtMs) || item.queuedAtMs < 0 ||
          !Number.isSafeInteger(item.attemptCount) || item.attemptCount < 0 ||
          !Number.isSafeInteger(item.nextAttemptAtMs) || item.nextAttemptAtMs < 0 ||
          (item.baseRevision !== undefined && (!Number.isSafeInteger(item.baseRevision) || item.baseRevision < 0)) ||
          (item.lastErrorCode !== undefined && (typeof item.lastErrorCode !== 'string' || item.lastErrorCode.length > 64))) {
        throw new Error('تحتوي قائمة العمليات القديمة على سجل غير صالح؛ لم يتم بدء الترحيل.');
      }
      pendingIds.add(item.mutationId);
    }

    const acknowledgedIds = new Set<string>();
    for (const id of state.acknowledgedIds) {
      if (!validMutationId(id) || acknowledgedIds.has(id) || pendingIds.has(id)) {
        throw new Error('معرفات الإقرار في صندوق المزامنة القديم متكررة أو متعارضة؛ لم يتم بدء الترحيل.');
      }
      acknowledgedIds.add(id);
    }
    for (const id of fingerprints.keys()) {
      if (!acknowledgedIds.has(id)) {
        throw new Error('توجد بصمة إقرار لا تقابل معرفاً محفوظاً في صندوق المزامنة القديم.');
      }
    }

    const legacyOutboxFingerprint = fingerprintMutation(
      'syncMeta', 'legacy-outbox-v1', 'upsert',
      JSON.parse(JSON.stringify(state)) as Record<string, unknown>
    );
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_EVENTS, STORE_OUTBOX, STORE_ACKNOWLEDGEMENTS, STORE_METADATA],
        'readwrite'
      );
      const events = transaction.objectStore(STORE_EVENTS);
      const outbox = transaction.objectStore(STORE_OUTBOX);
      const acknowledgements = transaction.objectStore(STORE_ACKNOWLEDGEMENTS);
      const metadata = transaction.objectStore(STORE_METADATA);
      const metadataRequest = metadata.get(uid);
      const outboxRequest = outbox.index('uid').getAll(IDBKeyRange.only(uid));
      const eventRequest = events.index('uid').getAll(IDBKeyRange.only(uid));
      const acknowledgementRequest = acknowledgements.index('uid').getAll(IDBKeyRange.only(uid));
      let readsRemaining = 4;
      let result: 'migrated' | 'already_migrated' | undefined;
      let failure: Error | undefined;
      let currentMetadata: DeviceMetadata | undefined;
      let currentOutbox: JournalOutboxEntry[] = [];
      let currentEvents: JournalEvent[] = [];
      let currentAcknowledgements: AcknowledgementRecord[] = [];

      const finishRead = () => {
        readsRemaining--;
        if (readsRemaining !== 0 || failure || result) return;
        if (currentMetadata?.legacyOutboxMigrated &&
            currentMetadata.legacyOutboxFingerprint === legacyOutboxFingerprint) {
          result = 'already_migrated';
          return;
        }

        const outboxByKey = new Map(currentOutbox.map(item => [item.key, item]));
        const eventsByKey = new Map(currentEvents.map(item => [item.key, item]));
        const acknowledgementsByKey = new Map(currentAcknowledgements.map(item => [item.key, item]));
        let pendingCount = currentOutbox.length;
        let nextSequence = currentMetadata?.nextSequence ||
          (Math.max(0, ...currentEvents.map(event => event.sequence || 0)) + 1);
        if (!Number.isSafeInteger(nextSequence) || nextSequence < 1 ||
            nextSequence + state.pending.length > Number.MAX_SAFE_INTEGER) {
          failure = new Error('وصل تسلسل سجل الأحداث إلى الحد الآمن؛ احتفظنا بالمصدر القديم دون ترحيل جزئي.');
          transaction.abort();
          return;
        }

        for (const legacy of state.pending) {
          const key = uid + ':' + legacy.mutationId;
          const fingerprint = fingerprintMutation(legacy.collection, legacy.documentId, legacy.operation, legacy.payload);
          const existingOutbox = outboxByKey.get(key);
          const existingAck = acknowledgementsByKey.get(key);
          const existingEvent = eventsByKey.get(key);
          if (existingOutbox && existingOutbox.fingerprint !== fingerprint) {
            failure = new Error('يوجد تعارض بين صندوق المزامنة القديم والحديث لنفس المعرف؛ أوقفنا الترحيل لحماية البيانات.');
            transaction.abort();
            return;
          }
          if (existingAck && existingAck.fingerprint !== fingerprint) {
            failure = new Error('يتعارض سجل قديم مع عملية أُقرّت سابقاً؛ لم يتم استبدال أي سجل.');
            transaction.abort();
            return;
          }
          if (existingEvent && existingEvent.fingerprint !== fingerprint) {
            failure = new Error('سجل الأحداث يحتوي على محتوى مختلف لنفس المعرف؛ تم إيقاف الترحيل.');
            transaction.abort();
            return;
          }
          if (existingAck) continue;

          const sequence = existingEvent?.sequence ?? nextSequence++;
          const mutation: JournalOutboxEntry = {
            ...legacy,
            key,
            uid,
            eventId: legacy.mutationId,
            fingerprint,
            sequence,
            baseRevision: legacy.baseRevision ?? 0
          };
          if (!existingEvent) {
            events.add({
              key, uid, eventId: legacy.mutationId, mutationId: legacy.mutationId,
              eventType: 'domain-mutation', collection: legacy.collection,
              documentId: legacy.documentId, operation: legacy.operation,
              schemaVersion: 1, clientUpdatedAtMs: legacy.clientUpdatedAtMs,
              createdAtMs: legacy.queuedAtMs, deviceId: legacy.deviceId,
              payload: legacy.payload, fingerprint, sequence, baseRevision: legacy.baseRevision ?? 0,
              projectionRequired: false
            } satisfies JournalEvent);
          }
          if (!existingOutbox) {
            outbox.add(mutation);
            pendingCount++;
          }
        }

        for (const id of state.acknowledgedIds) {
          const key = uid + ':' + id;
          const existingAck = acknowledgementsByKey.get(key);
          const incomingFingerprint = fingerprints.get(id);
          if (existingAck) {
            if (incomingFingerprint && existingAck.fingerprint !== incomingFingerprint &&
                existingAck.fingerprint !== 'legacy-unknown') {
              failure = new Error('بصمة الإقرار القديم تختلف عن الإقرار المحفوظ؛ أوقفنا الترحيل دون استبدال البيانات.');
              transaction.abort();
              return;
            }
            continue;
          }
          const existingOutbox = outboxByKey.get(key);
          if (existingOutbox) {
            if (!incomingFingerprint || existingOutbox.fingerprint !== incomingFingerprint) {
              failure = new Error('لا يمكن تأكيد أن العملية المعلقة تطابق الإقرار القديم؛ تم الحفاظ على العملية دون حذفها.');
              transaction.abort();
              return;
            }
            outbox.delete(key);
            pendingCount--;
          }
          acknowledgements.put({
            key, uid, mutationId: id,
            fingerprint: fingerprints.get(id) || 'legacy-unknown',
            acknowledgedAtMs: Date.now()
          } satisfies AcknowledgementRecord);
        }

        if (pendingCount > MAX_PENDING_MUTATIONS) {
          failure = new Error('ترحيل صندوق المزامنة سيتجاوز السعة الآمنة؛ احتفظ بالنسخة القديمة كما هي.');
          transaction.abort();
          return;
        }

        metadata.put({
          uid,
          deviceId: currentMetadata?.deviceId || state.deviceId,
          schemaVersion: 1,
          nextSequence,
          lastProjectedSequence: currentMetadata?.lastProjectedSequence ?? 0,
          remoteRevisions: currentMetadata?.remoteRevisions ?? {},
          remoteCursor: currentMetadata?.remoteCursor ?? 0,
          remoteProjectionCursor: currentMetadata?.remoteProjectionCursor ?? 0,
          remoteInitializedCollections: currentMetadata?.remoteInitializedCollections ?? [],
          legacyOutboxMigrated: true,
          legacyOutboxFingerprint
        } satisfies DeviceMetadata);
        result = 'migrated';
      };

      metadataRequest.onsuccess = () => { currentMetadata = metadataRequest.result as DeviceMetadata | undefined; finishRead(); };
      outboxRequest.onsuccess = () => { currentOutbox = outboxRequest.result as JournalOutboxEntry[]; finishRead(); };
      eventRequest.onsuccess = () => { currentEvents = eventRequest.result as JournalEvent[]; finishRead(); };
      acknowledgementRequest.onsuccess = () => { currentAcknowledgements = acknowledgementRequest.result as AcknowledgementRecord[]; finishRead(); };

      transaction.oncomplete = () => {
        if (failure) reject(failure);
        else if (result) resolve(result);
        else reject(new Error('اكتملت معاملة ترحيل صندوق المزامنة دون نتيجة مؤكدة.'));
      };
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Legacy outbox migration transaction aborted.')));
      transaction.onerror = () => {
        // IndexedDB aborts the complete migration if any add/put/delete request fails.
      };
    });
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
        const sequence = deviceMetadata?.nextSequence ?? 1;
        const revisionKey = input.collection + ':' + input.documentId;
        const cachedRevision = deviceMetadata?.remoteRevisions?.[revisionKey];
        const baseRevision = cachedRevision?.revision ?? 0;
        if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence >= Number.MAX_SAFE_INTEGER ||
            !Number.isSafeInteger(baseRevision) || baseRevision < 0 ||
            (cachedRevision !== undefined &&
              (!Number.isSafeInteger(cachedRevision.localSequence) || cachedRevision.localSequence < 0))) {
          failure = new Error('بيانات تسلسل الأحداث أو إصدار المزامنة المحلي غير صالحة؛ لم يتم إنشاء عملية جديدة.');
          transaction.abort();
          return;
        }
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
          fingerprint,
          sequence,
          baseRevision
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
          fingerprint,
          sequence,
          baseRevision,
          projectionRequired: true
        };
        events.add(event);
        outbox.add(mutation);
        metadata.put({
          ...(deviceMetadata || {}),
          uid,
          deviceId,
          schemaVersion: 1,
          nextSequence: sequence + 1,
          lastProjectedSequence: deviceMetadata?.lastProjectedSequence ?? 0
        } satisfies DeviceMetadata);
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

  async getRemoteRevision(
    collection: SyncCollection,
    documentId: string
  ): Promise<RemoteRevisionSnapshot | null> {
    const uid = activeUid();
    if (!ALLOWED_COLLECTIONS.has(collection) || !documentId || documentId.includes('/')) {
      throw new Error('معرّف مستند الإصدار السحابي غير صالح.');
    }
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_METADATA], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_METADATA).get(uid);
    const metadata = await requestResult(request) as DeviceMetadata | undefined;
    await completed;
    const value = metadata?.remoteRevisions?.[collection + ':' + documentId];
    if (!value) return null;
    if (!Number.isSafeInteger(value.revision) || value.revision < 0 ||
        !Number.isSafeInteger(value.localSequence) || value.localSequence < 0) {
      throw new Error('بيانات الإصدار السحابي المحلية تالفة؛ تم إيقاف المزامنة لحماية البيانات.');
    }
    return { revision: value.revision, localSequence: value.localSequence };
  }

  /** Atomically persist the server revision and acknowledge the exact outbox mutation. */
  async acknowledgeRemoteMutation(
    mutationId: string,
    revision: number,
    nowMs: number = Date.now()
  ): Promise<boolean> {
    const uid = activeUid();
    if (!validMutationId(mutationId) || !Number.isSafeInteger(revision) || revision < 1 ||
        !Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error('بيانات إقرار المزامنة ذات الإصدار غير صالحة.');
    }
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_OUTBOX, STORE_ACKNOWLEDGEMENTS, STORE_METADATA],
        'readwrite'
      );
      const outbox = transaction.objectStore(STORE_OUTBOX);
      const acknowledgements = transaction.objectStore(STORE_ACKNOWLEDGEMENTS);
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const key = uid + ':' + mutationId;
      const mutationRequest = outbox.get(key);
      const metadataRequest = metadataStore.get(uid);
      let mutation: JournalOutboxEntry | undefined;
      let metadata: DeviceMetadata | undefined;
      let readsRemaining = 2;
      let failure: Error | undefined;
      let acknowledged = false;
      const finishRead = () => {
        readsRemaining--;
        if (readsRemaining !== 0 || failure) return;
        if (!mutation) return;
        if (revision !== mutation.baseRevision + 1) {
          failure = new Error('إصدار الخادم لا يطابق الإصدار المتوقع للعملية؛ لم يتم إقرارها محلياً.');
          transaction.abort();
          return;
        }
        const revisionKey = mutation.collection + ':' + mutation.documentId;
        const remoteRevisions = { ...(metadata?.remoteRevisions || {}) };
        const initializedCollections = new Set(metadata?.remoteInitializedCollections || []);
        initializedCollections.add(mutation.collection);
        const current = remoteRevisions[revisionKey];
        if (current && (!Number.isSafeInteger(current.revision) || current.revision > revision)) {
          failure = new Error('وصل إقرار قديم بعد إصدار أحدث؛ تم إيقاف تحديث مؤشر الإصدار.');
          transaction.abort();
          return;
        }
        if (!current && Object.keys(remoteRevisions).length >= MAX_REMOTE_REVISION_RECORDS) {
          failure = new Error('وصل سجل إصدارات المستندات إلى الحد الآمن؛ لم نحذف أي سجل محفوظ.');
          transaction.abort();
          return;
        }
        acknowledgements.put({
          key, uid, mutationId,
          fingerprint: mutation.fingerprint,
          acknowledgedAtMs: nowMs
        } satisfies AcknowledgementRecord);
        outbox.delete(key);
        remoteRevisions[revisionKey] = { revision, localSequence: Math.max(current?.localSequence ?? 0, mutation.sequence) };
        metadataStore.put({
          ...(metadata || {
            uid, deviceId: mutation.deviceId, schemaVersion: 1,
            nextSequence: mutation.sequence + 1, lastProjectedSequence: 0
          }),
          remoteRevisions,
          remoteInitializedCollections: [...initializedCollections]
        } satisfies DeviceMetadata);
        const allAcknowledgementsRequest = acknowledgements.index('uid').getAll(IDBKeyRange.only(uid));
        allAcknowledgementsRequest.onsuccess = () => {
          const all = allAcknowledgementsRequest.result as AcknowledgementRecord[];
          all.sort((a, b) => a.acknowledgedAtMs - b.acknowledgedAtMs);
          for (const oldAcknowledgement of all.slice(0, Math.max(0, all.length - MAX_ACKNOWLEDGED_IDS))) {
            acknowledgements.delete(oldAcknowledgement.key);
          }
        };
        acknowledged = true;
      };
      mutationRequest.onsuccess = () => { mutation = mutationRequest.result as JournalOutboxEntry | undefined; finishRead(); };
      metadataRequest.onsuccess = () => { metadata = metadataRequest.result as DeviceMetadata | undefined; finishRead(); };
      transaction.oncomplete = () => resolve(acknowledged);
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Revision acknowledgement transaction aborted.')));
    });
  }

  /** Rebase only a later local event after an earlier local event advanced this document. */
  async rebasePendingMutation(
    mutationId: string,
    expectedBaseRevision: number,
    nextBaseRevision: number
  ): Promise<boolean> {
    const uid = activeUid();
    if (!validMutationId(mutationId) || !Number.isSafeInteger(expectedBaseRevision) ||
        expectedBaseRevision < 0 || !Number.isSafeInteger(nextBaseRevision) ||
        nextBaseRevision <= expectedBaseRevision) {
      throw new Error('بيانات إعادة تأسيس إصدار العملية غير صالحة.');
    }
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_OUTBOX, STORE_METADATA], 'readwrite');
      const outbox = transaction.objectStore(STORE_OUTBOX);
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const key = uid + ':' + mutationId;
      const mutationRequest = outbox.get(key);
      const metadataRequest = metadataStore.get(uid);
      let mutation: JournalOutboxEntry | undefined;
      let metadata: DeviceMetadata | undefined;
      let readsRemaining = 2;
      let rebased = false;
      let failure: Error | undefined;
      const finishRead = () => {
        readsRemaining--;
        if (readsRemaining !== 0 || failure || !mutation) return;
        const revisionKey = mutation.collection + ':' + mutation.documentId;
        const cached = metadata?.remoteRevisions?.[revisionKey];
        if (!cached || cached.revision !== nextBaseRevision ||
            mutation.baseRevision !== expectedBaseRevision ||
            mutation.sequence <= cached.localSequence) {
          failure = new Error('لا يمكن إعادة تأسيس عملية قديمة أو غير متتابعة على إصدار أحدث؛ يلزم حل التعارض أولاً.');
          transaction.abort();
          return;
        }
        outbox.put({ ...mutation, baseRevision: nextBaseRevision } satisfies JournalOutboxEntry);
        rebased = true;
      };
      mutationRequest.onsuccess = () => { mutation = mutationRequest.result as JournalOutboxEntry | undefined; finishRead(); };
      metadataRequest.onsuccess = () => { metadata = metadataRequest.result as DeviceMetadata | undefined; finishRead(); };
      transaction.oncomplete = () => resolve(rebased);
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Outbox revision rebase transaction aborted.')));
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
    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /** Read the next deterministic event page after the durable local-projection cursor. */
  async listEventsAfter(sequence: number = 0, limit: number = 100): Promise<JournalEvent[]> {
    const uid = activeUid();
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('رقم تسلسل سجل الأحداث غير صالح.');
    if (sequence === Number.MAX_SAFE_INTEGER) return [];
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('حجم دفعة إعادة التشغيل يجب أن يكون من 1 إلى 500.');
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_EVENTS], 'readonly');
    const completed = transactionComplete(transaction);
    const range = IDBKeyRange.bound([uid, sequence + 1], [uid, Number.MAX_SAFE_INTEGER]);
    const request = transaction.objectStore(STORE_EVENTS).index('uidSequence').getAll(range, limit);
    const events = await requestResult(request) as JournalEvent[];
    await completed;
    return events.sort((a, b) => a.sequence - b.sequence);
  }

  async getProjectionCursor(): Promise<number> {
    const uid = activeUid();
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_METADATA], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_METADATA).get(uid);
    const metadata = await requestResult(request) as DeviceMetadata | undefined;
    await completed;
    return metadata?.lastProjectedSequence ?? 0;
  }

  /**
   * Advance only one committed sequence at a time and only after its local
   * projection has been written and verified by the caller.
   */
  async markProjected(sequence: number): Promise<boolean> {
    const uid = activeUid();
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('رقم تسلسل الإسقاط المحلي غير صالح.');
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_METADATA], 'readwrite');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get(uid);
      let advanced = false;
      let failure: Error | undefined;
      request.onsuccess = () => {
        const metadata = request.result as DeviceMetadata | undefined;
        if (!metadata) {
          failure = new Error('لا توجد بيانات وصفية لسجل المزامنة؛ لم يتم تحريك مؤشر الإسقاط.');
          transaction.abort();
          return;
        }
        const cursor = metadata.lastProjectedSequence ?? 0;
        if (sequence <= cursor) return;
        if (sequence !== cursor + 1 || sequence >= (metadata.nextSequence ?? 1)) {
          failure = new Error('لا يمكن تجاوز أحداث غير مسقطة أو مؤشر يتجاوز آخر حدث محفوظ.');
          transaction.abort();
          return;
        }
        store.put({ ...metadata, lastProjectedSequence: sequence } satisfies DeviceMetadata);
        advanced = true;
      };
      transaction.oncomplete = () => resolve(advanced);
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Projection cursor transaction aborted.')));
    });
  }

  async hasPendingForCollection(collection: SyncCollection): Promise<boolean> {
    const uid = activeUid();
    if (!ALLOWED_COLLECTIONS.has(collection)) throw new Error('مجموعة المزامنة غير صالحة.');
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_OUTBOX], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_OUTBOX)
      .index('uidCollection').getAll([uid, collection]);
    const pending = await requestResult(request) as JournalOutboxEntry[];
    await completed;
    return pending.length > 0;
  }

  async hasPendingForDocument(collection: SyncCollection, documentId: string): Promise<boolean> {
    const uid = activeUid();
    if (!ALLOWED_COLLECTIONS.has(collection) || !documentId || documentId.includes('/')) {
      throw new Error('معرّف المستند المحلي غير صالح.');
    }
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_OUTBOX], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_OUTBOX)
      .index('uidCollectionDocument').getAll([uid, collection, documentId]);
    const pending = await requestResult(request) as JournalOutboxEntry[];
    await completed;
    return pending.length > 0;
  }

  /** Record a revision learned from a remote event without treating it as a local mutation. */
  async setRemoteRevisionFromRemote(
    collection: SyncCollection,
    documentId: string,
    revision: number
  ): Promise<boolean> {
    const uid = activeUid();
    if (!ALLOWED_COLLECTIONS.has(collection) || !documentId || documentId.includes('/') ||
        !Number.isSafeInteger(revision) || revision < 1) {
      throw new Error('بيانات الإصدار المستقبَل غير صالحة.');
    }
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_METADATA], 'readwrite');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get(uid);
      let updated = false;
      let failure: Error | undefined;
      request.onsuccess = () => {
        const metadata = request.result as DeviceMetadata | undefined;
        const revisionKey = collection + ':' + documentId;
        const remoteRevisions = { ...(metadata?.remoteRevisions || {}) };
        const current = remoteRevisions[revisionKey];
        if (current && current.revision > revision) return;
        const nextSequence = metadata?.nextSequence ?? 1;
        const initialized = new Set(metadata?.remoteInitializedCollections || []);
        initialized.add(collection);
        remoteRevisions[revisionKey] = {
          revision,
          localSequence: Math.max(current?.localSequence ?? 0, nextSequence - 1)
        };
        store.put({
          ...(metadata || {
            uid, deviceId: createSecureId(), schemaVersion: 1,
            nextSequence: 1, lastProjectedSequence: 0
          }),
          remoteRevisions,
          remoteInitializedCollections: [...initialized]
        } satisfies DeviceMetadata);
        updated = true;
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Remote revision cache transaction aborted.')));
    });
  }

  async isRemoteCollectionInitialized(collection: SyncCollection): Promise<boolean> {
    const uid = activeUid();
    if (!ALLOWED_COLLECTIONS.has(collection)) throw new Error('مجموعة المزامنة غير صالحة.');
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_METADATA], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_METADATA).get(uid);
    const metadata = await requestResult(request) as DeviceMetadata | undefined;
    await completed;
    return (metadata?.remoteInitializedCollections || []).includes(collection);
  }

  async markRemoteCollectionInitialized(collection: SyncCollection): Promise<boolean> {
    const uid = activeUid();
    if (!ALLOWED_COLLECTIONS.has(collection)) throw new Error('مجموعة المزامنة غير صالحة.');
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_METADATA], 'readwrite');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get(uid);
      let updated = false;
      request.onsuccess = () => {
        const metadata = request.result as DeviceMetadata | undefined;
        const initialized = new Set(metadata?.remoteInitializedCollections || []);
        initialized.add(collection);
        store.put({
          ...(metadata || {
            uid, deviceId: createSecureId(), schemaVersion: 1,
            nextSequence: 1, lastProjectedSequence: 0
          }),
          remoteInitializedCollections: [...initialized]
        } satisfies DeviceMetadata);
        updated = true;
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onabort = () => reject(normalizeError(transaction.error || new Error('Remote collection initialization transaction aborted.')));
    });
  }

  async getRemoteCursor(): Promise<number> {
    const uid = activeUid();
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_METADATA], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_METADATA).get(uid);
    const metadata = await requestResult(request) as DeviceMetadata | undefined;
    await completed;
    const cursor = metadata?.remoteCursor ?? 0;
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new Error('مؤشر استقبال الأحداث السحابية غير صالح؛ لم يتم تجاوزه.');
    }
    return cursor;
  }

  /** Persist a contiguous remote page and its cursor in one IndexedDB transaction. */
  async importRemotePage(events: RemoteInboxEventInput[]): Promise<number> {
    const uid = activeUid();
    if (!Array.isArray(events) || events.length > 100) {
      throw new Error('حجم صفحة الأحداث السحابية غير صالح.');
    }
    const normalized: RemoteInboxEvent[] = [];
    let previousSequence = 0;
    for (const event of events) {
      if (!event || event.uid !== uid || event.schemaVersion !== 2 ||
          event.eventType !== 'domain-mutation' || !validMutationId(event.eventId) ||
          !validMutationId(event.mutationId) || event.eventId !== event.mutationId || !validMutationId(event.deviceId) ||
          !ALLOWED_COLLECTIONS.has(event.collection) ||
          typeof event.documentId !== 'string' || !event.documentId ||
          event.documentId.includes('/') || /[\u0000-\u001f]/.test(event.documentId) || byteLength(event.documentId) > 1500 ||
          (event.operation !== 'upsert' && event.operation !== 'tombstone') ||
          !Number.isSafeInteger(event.occurredAtMs) || event.occurredAtMs < 0 ||
          !Number.isSafeInteger(event.baseRevision) || event.baseRevision < 0 ||
          !Number.isSafeInteger(event.revision) || event.revision !== event.baseRevision + 1 ||
          !Number.isSafeInteger(event.serverSequence) || event.serverSequence < 1 ||
          !isRecord(event.payload) ||
          byteLength(JSON.stringify(event.payload) || '') > MAX_MUTATION_PAYLOAD_BYTES) {
        throw new Error('REMOTE_INBOX_EVENT_INVALID');
      }
      if (event.serverSequence <= previousSequence) {
        throw new Error('REMOTE_INBOX_PAGE_NOT_SORTED');
      }
      previousSequence = event.serverSequence;
      const fingerprint = fingerprintRemoteInboxEvent(event);
      normalized.push({
        ...event,
        key: uid + ':' + event.eventId,
        fingerprint
      });
    }

    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_REMOTE_INBOX, STORE_METADATA], 'readwrite');
      const inbox = transaction.objectStore(STORE_REMOTE_INBOX);
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const metadataRequest = metadataStore.get(uid);
      const countRequest = inbox.index('uid').count(IDBKeyRange.only(uid));
      const existingRequests = normalized.map(event => inbox.get(event.key));
      let metadata: DeviceMetadata | undefined;
      let inboxCount = 0;
      const existing: Array<RemoteInboxEvent | undefined> = new Array(normalized.length);
      let readsRemaining = 2 + existingRequests.length;
      let resultCursor = 0;
      let failure: Error | undefined;
      const finishRead = () => {
        readsRemaining--;
        if (readsRemaining !== 0 || failure) return;
        const cursor = metadata?.remoteCursor ?? 0;
        const projectionCursor = metadata?.remoteProjectionCursor ?? 0;
        if (!Number.isSafeInteger(cursor) || cursor < 0 ||
            !Number.isSafeInteger(projectionCursor) || projectionCursor < 0 ||
            projectionCursor > cursor) {
          failure = new Error('بيانات مؤشر صندوق الاستقبال تالفة؛ لم يتم تغييرها.');
          transaction.abort();
          return;
        }
        let additions = 0;
        for (let index = 0; index < normalized.length; index++) {
          if (normalized[index].serverSequence > cursor && !existing[index]) additions++;
        }
        if (inboxCount + additions > MAX_REMOTE_INBOX_EVENTS) {
          failure = new Error('امتلأ صندوق الأحداث السحابية قبل اكتمال تطبيق الأحداث؛ لم نحذف أي حدث أو نحرك المؤشر.');
          transaction.abort();
          return;
        }
        let nextCursor = cursor;
        for (let index = 0; index < normalized.length; index++) {
          const event = normalized[index];
          const stored = existing[index];
          if (stored && stored.fingerprint !== event.fingerprint) {
            failure = new Error('تعارض معرف حدث داخل صندوق الاستقبال؛ تم الحفاظ على النسخة الأصلية.');
            transaction.abort();
            return;
          }
          if (event.serverSequence <= nextCursor) {
            if (!stored) {
              failure = new Error('مؤشر الاستقبال تجاوز حدثاً غير محفوظ؛ أوقفنا المزامنة لحماية السجل.');
              transaction.abort();
              return;
            }
            continue;
          }
          if (event.serverSequence !== nextCursor + 1) {
            failure = new Error('توجد فجوة في تسلسل الأحداث السحابية؛ لم يتم تحريك المؤشر.');
            transaction.abort();
            return;
          }
          if (!stored) inbox.add(event);
          nextCursor = event.serverSequence;
        }
        if (nextCursor > cursor) {
          metadataStore.put({
            ...(metadata || {
              uid, deviceId: createSecureId(), schemaVersion: 1,
              nextSequence: 1, lastProjectedSequence: 0
            }),
            remoteCursor: nextCursor,
            remoteProjectionCursor: projectionCursor
          } satisfies DeviceMetadata);
        }
        resultCursor = nextCursor;
      };
      metadataRequest.onsuccess = () => {
        metadata = metadataRequest.result as DeviceMetadata | undefined;
        finishRead();
      };
      countRequest.onsuccess = () => {
        inboxCount = countRequest.result;
        finishRead();
      };
      existingRequests.forEach((request, index) => {
        request.onsuccess = () => {
          existing[index] = request.result as RemoteInboxEvent | undefined;
          finishRead();
        };
      });
      transaction.oncomplete = () => resolve(resultCursor);
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Remote inbox import transaction aborted.')));
      transaction.onerror = () => {
        // IndexedDB aborts the page and cursor update together.
      };
    });
  }

  async listRemoteInboxAfter(sequence: number = 0, limit: number = 100): Promise<RemoteInboxEvent[]> {
    const uid = activeUid();
    if (!Number.isSafeInteger(sequence) || sequence < 0 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('معاملات قراءة صندوق الأحداث السحابية غير صالحة.');
    }
    if (sequence === Number.MAX_SAFE_INTEGER) return [];
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_REMOTE_INBOX], 'readonly');
    const completed = transactionComplete(transaction);
    const range = IDBKeyRange.bound([uid, sequence + 1], [uid, Number.MAX_SAFE_INTEGER]);
    const request = transaction.objectStore(STORE_REMOTE_INBOX)
      .index('uidServerSequence').getAll(range, limit);
    const events = await requestResult(request) as RemoteInboxEvent[];
    await completed;
    return events.sort((a, b) => a.serverSequence - b.serverSequence);
  }

  async getRemoteProjectionCursor(): Promise<number> {
    const uid = activeUid();
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_METADATA], 'readonly');
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_METADATA).get(uid);
    const metadata = await requestResult(request) as DeviceMetadata | undefined;
    await completed;
    const cursor = metadata?.remoteProjectionCursor ?? 0;
    if (!Number.isSafeInteger(cursor) || cursor < 0) {
      throw new Error('مؤشر تطبيق الأحداث السحابية غير صالح.');
    }
    return cursor;
  }

  /** Advance the projection cursor only after the corresponding event is durably applied locally. */
  async markRemoteProjected(sequence: number): Promise<boolean> {
    const uid = activeUid();
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      throw new Error('رقم تسلسل الإسقاط السحابي غير صالح.');
    }
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_METADATA, STORE_REMOTE_INBOX], 'readwrite');
      const metadataStore = transaction.objectStore(STORE_METADATA);
      const inbox = transaction.objectStore(STORE_REMOTE_INBOX);
      const metadataRequest = metadataStore.get(uid);
      const eventRequest = inbox.index('uidServerSequence').get([uid, sequence]);
      let metadata: DeviceMetadata | undefined;
      let event: RemoteInboxEvent | undefined;
      let readsRemaining = 2;
      let advanced = false;
      let failure: Error | undefined;
      const finishRead = () => {
        readsRemaining--;
        if (readsRemaining !== 0 || failure) return;
        const cursor = metadata?.remoteProjectionCursor ?? 0;
        const importedCursor = metadata?.remoteCursor ?? 0;
        if (sequence <= cursor) return;
        if (!metadata || sequence !== cursor + 1 || sequence > importedCursor || !event) {
          failure = new Error('لا يمكن تجاوز حدث غير مطبق أو حدث غير محفوظ في صندوق الاستقبال.');
          transaction.abort();
          return;
        }
        metadataStore.put({ ...metadata, remoteProjectionCursor: sequence } satisfies DeviceMetadata);
        inbox.delete(event.key);
        advanced = true;
      };
      metadataRequest.onsuccess = () => {
        metadata = metadataRequest.result as DeviceMetadata | undefined;
        finishRead();
      };
      eventRequest.onsuccess = () => {
        event = eventRequest.result as RemoteInboxEvent | undefined;
        finishRead();
      };
      transaction.oncomplete = () => resolve(advanced);
      transaction.onabort = () => reject(failure || normalizeError(transaction.error || new Error('Remote projection cursor transaction aborted.')));
    });
  }


  async getSnapshot(): Promise<JournalSnapshot> {
    const uid = activeUid();
    const database = await this.openDatabase();
    const transaction = database.transaction([STORE_OUTBOX, STORE_ACKNOWLEDGEMENTS, STORE_EVENTS, STORE_METADATA], 'readwrite');
    const completed = transactionComplete(transaction);
    const pendingRequest = transaction.objectStore(STORE_OUTBOX).index('uid').getAll(IDBKeyRange.only(uid));
    const acknowledgedRequest = transaction.objectStore(STORE_ACKNOWLEDGEMENTS).index('uid').getAll(IDBKeyRange.only(uid));
    const eventRequest = transaction.objectStore(STORE_EVENTS).index('uid').getAll(IDBKeyRange.only(uid));
    const metadataStore = transaction.objectStore(STORE_METADATA);
    const metadataRequest = metadataStore.get(uid);
    let deviceId = '';
    let projectionCursor = 0;
    metadataRequest.onsuccess = () => {
      const metadata = metadataRequest.result as DeviceMetadata | undefined;
      if (metadata?.deviceId) {
        deviceId = metadata.deviceId;
        projectionCursor = metadata.lastProjectedSequence ?? 0;
      } else {
        deviceId = createSecureId();
        metadataStore.put({ uid, deviceId, schemaVersion: 1, nextSequence: 1, lastProjectedSequence: 0 } satisfies DeviceMetadata);
      }
    };
    const [pending, acknowledged, events] = await Promise.all([
      requestResult(pendingRequest), requestResult(acknowledgedRequest), requestResult(eventRequest)
    ]);
    await completed;
    return {
      uid,
      deviceId,
      pendingCount: (pending as JournalOutboxEntry[]).length,
      acknowledgedCount: (acknowledged as AcknowledgementRecord[]).length,
      eventCount: (events as JournalEvent[]).length,
      projectionCursor
    };
  }

  close(): void {
    if (!this.databasePromise) return;
    void this.databasePromise.then(database => database.close()).catch(() => undefined);
    this.databasePromise = null;
  }
}
