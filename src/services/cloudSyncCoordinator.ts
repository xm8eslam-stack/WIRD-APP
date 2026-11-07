import { getDocs, collection, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { LocalSyncOutbox } from './localSyncOutbox';
import { StorageService } from './storageService';
import { writeRevisionedRemoteMutation } from './revisionedRemoteMutation';

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

/** Full sync requires durable remote import and local projection, not just upload success. */
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
   * 4. Reconcile remote updates only when they can be durably imported and projected.
   */
  public async triggerSync(): Promise<boolean> {
    if (this.syncInProgress) return false;

    if (!checkIsOnline()) {
      this.updateState({ status: 'offline', errorMessage: 'الجهاز غير متصل بالإنترنت حالياً.' });
      return false;
    }

    if (!isFirebaseConfigured() || !db || !auth) {
      const scope = StorageService.getStorageScope();
      if (scope.startsWith('user:')) {
        this.updateState({ status: 'idle', errorMessage: null });
      } else {
        this.updateState({ status: 'guest', errorMessage: null });
      }
      return false;
    }

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
      let hasMore = true;
      let firstPushError: string | null = null;

      while (hasMore) {
        const readyEntries = await LocalSyncOutbox.listReadyEntries(Date.now(), 25);
        if (readyEntries.length === 0) {
          hasMore = false;
          break;
        }

        for (const entry of readyEntries) {
          try {
            let baseRevision = entry.baseRevision;
            const cachedRevision = await LocalSyncOutbox.getRemoteRevision(entry.collection, entry.documentId);
            if (cachedRevision && baseRevision < cachedRevision.revision) {
              if (entry.sequence <= cachedRevision.localSequence) {
                throw new Error('REMOTE_REVISION_CONFLICT');
              }
              const rebased = await LocalSyncOutbox.rebasePendingMutation(
                entry.mutationId,
                baseRevision,
                cachedRevision.revision
              );
              if (!rebased) throw new Error('REMOTE_REVISION_CONFLICT');
              baseRevision = cachedRevision.revision;
            } else if (cachedRevision && baseRevision > cachedRevision.revision) {
              throw new Error('REMOTE_REVISION_CONFLICT');
            }

            const result = await writeRevisionedRemoteMutation(db, {
              uid,
              collection: entry.collection,
              documentId: entry.documentId,
              operation: entry.operation,
              schemaVersion: entry.schemaVersion,
              mutationId: entry.mutationId,
              eventId: entry.eventId || entry.mutationId,
              deviceId: entry.deviceId,
              clientUpdatedAtMs: entry.clientUpdatedAtMs,
              baseRevision,
              payload: entry.payload
            });
            await LocalSyncOutbox.acknowledgeRemoteMutation(entry.mutationId, result.revision);
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

        if (readyEntries.length < 25) {
          hasMore = false;
        }
      }

      const remoteReconciled = await this.pullRemoteReconciliation(uid);
      const finalCount = await this.refreshPendingCount();
      const status = getCloudSyncCompletionStatus(finalCount, remoteReconciled);
      this.updateState({
        status,
        lastSyncAtMs: status === 'synced' ? Date.now() : this.state.lastSyncAtMs,
        errorMessage: firstPushError || (status === 'error'
          ? 'بعض التغييرات لم تُرفع بعد؛ احتفظنا بها محلياً وسنعيد المحاولة.'
          : status === 'partial'
            ? 'تم رفع التغييرات المحلية، لكن استقبال تغييرات الأجهزة الأخرى وتطبيقها لم يكتمل بعد.'
            : null)
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
   * A bounded remote read is not a durable import or projection.
   * Keep returning false until the inbox, cursor and projector are implemented.
   */
  private async pullRemoteReconciliation(uid: string): Promise<boolean> {
    if (!db) return false;
    try {
      const eventsRef = collection(db, 'users', uid, 'events');
      const eventsQuery = query(
        eventsRef,
        where('uid', '==', uid),
        orderBy('occurredAtMs', 'desc'),
        firestoreLimit(20)
      );
      await getDocs(eventsQuery);
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
