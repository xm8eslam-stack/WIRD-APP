import { doc, setDoc, getDocs, collection, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { LocalSyncOutbox } from './localSyncOutbox';
import { StorageService } from './storageService';
import type { SyncCollection } from './localSyncOutbox';

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'partial'
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

/** Full sync is only possible after remote events have been durably imported and projected. */
export function getCloudSyncCompletionStatus(
  pendingCount: number,
  remoteReconciled: boolean
): CloudSyncStatus {
  if (!Number.isSafeInteger(pendingCount) || pendingCount < 0) return 'error';
  if (pendingCount > 0) return 'error';
  return remoteReconciled ? 'synced' : 'partial';
}

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
              await setDoc(eventRef, eventRecord);
            }

            // Acknowledge locally on confirmation
            await LocalSyncOutbox.acknowledge([entry.mutationId]);
            totalPushed += 1;
          } catch (writeError: any) {
            console.warn('[WIRD CloudSync] Mutation write failed, scheduling retry:', entry.mutationId, writeError);
            const errCode = writeError?.code || writeError?.message || 'firestore-write-error';
            await LocalSyncOutbox.markFailed(entry.mutationId, errCode);
          }
        }

        // If batch was smaller than limit, we reached the end of ready items
        if (readyEntries.length < 25) {
          hasMore = false;
        }
      }

      // Step B: Inspect remote events. This is not yet a durable import/projection.
      const remoteReconciled = await this.pullRemoteReconciliation(uid);

      // Never claim full sync until remote events are durably imported and projected.
      const finalCount = await this.refreshPendingCount();
      const status = getCloudSyncCompletionStatus(finalCount, remoteReconciled);
      this.updateState({
        status,
        lastSyncAtMs: status === 'synced' ? Date.now() : this.state.lastSyncAtMs,
        errorMessage: status === 'error'
          ? 'بعض التغييرات لم تُرفع بعد؛ احتفظنا بها محلياً وسنعيد المحاولة.'
          : status === 'partial'
            ? 'تم رفع التغييرات المحلية، لكن استقبال تغييرات الأجهزة الأخرى وتطبيقها لم يكتمل بعد.'
            : null
      });

      return status === 'synced';
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
    try {
      // Pull recent domain events for this user to detect multi-device activity
      const eventsRef = collection(db, 'users', uid, 'events');
      const eventsQuery = query(
        eventsRef,
        where('uid', '==', uid),
        orderBy('occurredAtMs', 'desc'),
        firestoreLimit(20)
      );
      // Even if offline or empty, query runs gracefully
      const snapshot = await getDocs(eventsQuery);
      if (!snapshot.empty) {
        // Reading remote events is only an inspection, not an import or projection.
      }
      // Remote inbox, durable cursor and projection are not implemented yet.
      return false;
    } catch {
      return false;
    }
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
