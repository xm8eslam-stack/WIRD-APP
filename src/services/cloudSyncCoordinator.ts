import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { LocalSyncOutbox } from './localSyncOutbox';
import { StorageService } from './storageService';
import type { SyncCollection } from './localSyncOutbox';

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'unverified'
  | 'guest'
  | 'error';

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncAtMs: number | null;
  pendingCount: number;
  errorMessage: string | null;
  isOnline: boolean;
}

type SyncListener = (state: CloudSyncState) => void;

function checkIsOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

class CloudSyncCoordinator {
  private listeners = new Set<SyncListener>();
  private syncInProgress = false;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
  private state: CloudSyncState = {
    status: 'idle',
    lastSyncAtMs: null,
    pendingCount: 0,
    errorMessage: null,
    isOnline: checkIsOnline()
  };

  constructor() {
    this.setupNetworkListeners();
    this.setupStorageScopeListener();
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.updateState({ isOnline: true });
      void this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.updateState({ isOnline: false, status: 'offline' });
    });
  }

  private setupStorageScopeListener(): void {
    // Refresh snapshot count when scope changes
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => {
        void this.refreshPendingCount();
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): CloudSyncState {
    return { ...this.state };
  }

  private updateState(partial: Partial<CloudSyncState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const scope = StorageService.getStorageScope();
      if (!scope.startsWith('user:')) {
        this.updateState({ pendingCount: 0 });
        return 0;
      }
      const snapshot = await LocalSyncOutbox.getSnapshot();
      this.updateState({ pendingCount: snapshot.pendingCount });
      return snapshot.pendingCount;
    } catch {
      return this.state.pendingCount;
    }
  }

  /**
   * Main synchronization cycle:
   * 1. Check network, auth, and verified email status.
   * 2. Drain pending local outbox mutations to Firestore.
   * 3. Acknowledge local mutations upon confirmed Firestore write.
   * 4. Fetch remote updates from other devices and apply deterministically.
   */
  public async triggerSync(): Promise<boolean> {
    if (this.syncInProgress) return false;

    // 1. Offline check
    if (!checkIsOnline()) {
      this.updateState({ status: 'offline', errorMessage: 'الجهاز غير متصل بالإنترنت حالياً.' });
      return false;
    }

    // 2. Firebase configuration check
    if (!isFirebaseConfigured() || !db || !auth) {
      const scope = StorageService.getStorageScope();
      if (scope.startsWith('user:')) {
        this.updateState({ status: 'idle', errorMessage: null });
      } else {
        this.updateState({ status: 'guest', errorMessage: null });
      }
      return false;
    }

    // 3. User & email verification check
    const currentUser = auth.currentUser;
    const scope = StorageService.getStorageScope();

    if (!currentUser || scope === 'guest') {
      this.updateState({ status: 'guest', errorMessage: null });
      return false;
    }

    if (!currentUser.emailVerified) {
      this.updateState({
        status: 'unverified',
        errorMessage: 'يتطلب حفظ التغييرات سحابياً تفعيل البريد الإلكتروني.'
      });
      return false;
    }

    const uid = currentUser.uid;
    const expectedScope = `user:${uid}`;
    if (scope !== expectedScope) {
      this.updateState({
        status: 'error',
        errorMessage: 'نطاق التخزين المحلي غير متطابق مع هوية المستخدم المسجل.'
      });
      return false;
    }

    this.syncInProgress = true;
    this.updateState({ status: 'syncing', errorMessage: null });

    try {
      // Step A: Push local outbox mutations to Firestore
      let hasMore = true;
      let totalPushed = 0;
      let firstPushError: string | null = null;

      while (hasMore) {
        const readyEntries = await LocalSyncOutbox.listReadyEntries(Date.now(), 25);
        if (readyEntries.length === 0) {
          hasMore = false;
          break;
        }

        for (const entry of readyEntries) {
          try {
            // Write document snapshot
            const docRef = doc(db, 'users', uid, entry.collection, entry.documentId);
            const docData: Record<string, unknown> = {
              schemaVersion: entry.schemaVersion,
              payload: entry.payload,
              updatedAtMs: entry.clientUpdatedAtMs,
              deviceId: entry.deviceId,
              mutationId: entry.mutationId
            };
            if (entry.operation === 'tombstone') {
              docData.deletedAt = new Date(entry.clientUpdatedAtMs);
            }
            await setDoc(docRef, docData);

            // Write immutable domain event record if eventId is present
            if (entry.eventId) {
              const eventRef = doc(db, 'users', uid, 'events', entry.eventId);
              const eventRecord = {
                schemaVersion: 1,
                eventId: entry.eventId,
                mutationId: entry.mutationId,
                uid: uid,
                deviceId: entry.deviceId,
                occurredAtMs: entry.clientUpdatedAtMs,
                eventType: 'domain-mutation',
                payload: entry.payload
              };
              // Event documents are append-only. A previous attempt may have
              // committed the remote event but failed before the local outbox ack.
              // Verify an existing event instead of trying to update it with setDoc.
              const existingEvent = await getDoc(eventRef);
              if (existingEvent.exists()) {
                const remote = existingEvent.data();
                const matches = Object.keys(eventRecord).every((key) =>
                  JSON.stringify(remote[key]) === JSON.stringify(eventRecord[key])
                );
                if (!matches) {
                  throw new Error('يوجد تعارض في سجل المزامنة لنفس معرف العملية؛ تم الاحتفاظ بالعملية المحلية دون استبدال السجل السحابي.');
                }
              } else {
                await setDoc(eventRef, eventRecord);
              }
            }

            // Acknowledge locally on confirmation
            await LocalSyncOutbox.acknowledge([entry.mutationId]);
            totalPushed += 1;
          } catch (writeError: any) {
            console.warn('[WIRD CloudSync] Mutation write failed, scheduling retry:', entry.mutationId, writeError);
            const errCode = writeError?.code || writeError?.message || 'firestore-write-error';
            if (!firstPushError) {
              firstPushError = typeof writeError?.message === 'string'
                ? writeError.message
                : 'تعذر رفع بعض التغييرات؛ ستظل محفوظة محلياً وستتم إعادة المحاولة.';
            }
            await LocalSyncOutbox.markFailed(entry.mutationId, String(errCode).slice(0, 64));
          }
        }

        // If batch was smaller than limit, we reached the end of ready items
        if (readyEntries.length < 25) {
          hasMore = false;
        }
      }

      // Step B: Pull remote events or updates from other devices
      const remoteReconciled = await this.pullRemoteReconciliation(uid);

      // Never report a complete sync while remote changes have not actually
      // been applied locally. A successful upload alone is only partial sync.
      const finalCount = await this.refreshPendingCount();
      const complete = finalCount === 0 && remoteReconciled;
      this.updateState({
        status: complete ? 'synced' : finalCount > 0 ? 'error' : 'unverified',
        lastSyncAtMs: complete ? Date.now() : this.state.lastSyncAtMs,
        errorMessage: firstPushError || (finalCount > 0
          ? 'بعض التغييرات لم تُرفع بعد؛ احتفظنا بها محلياً وسنعيد المحاولة.'
          : !remoteReconciled
            ? 'تم فحص الاتصال، لكن استقبال تغييرات الأجهزة الأخرى وتطبيقها لم يكتمل بعد.'
            : null)
      });

      return complete;
    } catch (syncError: any) {
      console.error('[WIRD CloudSync] Cloud sync failed:', syncError);
      this.updateState({
        status: 'error',
        errorMessage: syncError?.message || 'تعذر استكمال المزامنة السحابية.'
      });
      return false;
    } finally {
      this.syncInProgress = false;
      await this.refreshPendingCount();
    }
  }

  /**
   * Reconcile remote updates from other devices using deterministic projection logic.
   */
  private async pullRemoteReconciliation(uid: string): Promise<boolean> {
    if (!db) return false;
    // Keep the bounded read as a connectivity/permission check, but do not
    // mistake observing remote events for applying them to local projections.
    const eventsRef = collection(db, 'users', uid, 'events');
    const eventsQuery = query(
      eventsRef,
      where('uid', '==', uid),
      orderBy('occurredAtMs', 'desc'),
      firestoreLimit(20)
    );
    await getDocs(eventsQuery);
    // Remote event ingestion and durable local projection are not implemented
    // yet. Returning false prevents the UI from claiming cross-device sync.
    return false;
  }

  public notifyMutationEnqueued(): void {
    void this.refreshPendingCount().then(() => {
      void this.triggerSync();
    });
  }

  public startPeriodicSync(intervalMs: number = 60_000): void {
    if (this.autoSyncInterval) return;
    this.autoSyncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void this.triggerSync();
      }
    }, intervalMs);
  }

  public stopPeriodicSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }
}

export const cloudSyncCoordinator = new CloudSyncCoordinator();
