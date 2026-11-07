import { getDocs, collection, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { LocalSyncOutbox } from './localSyncOutbox';
import type { RemoteInboxEventInput } from './indexedDbSyncJournal';
import { StorageService } from './storageService';
import { writeRevisionedRemoteMutation } from './revisionedRemoteMutation';
import { projectRemoteInboxBatch } from './remoteInboxProjector';

export const LEGACY_REMOTE_STATE_COLLECTIONS = [
  'profile', 'plans', 'enginePlans', 'portions',
  'weakVerses', 'tests', 'activityEvents', 'ruqyahProgress', 'syncMeta'
] as const;

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'partial'
  | 'offline'
  | 'unverified'
  | 'guest'
  | 'error';
export type RemoteProjectionBlockReason =
  | 'projection_disabled'
  | 'legacy_remote_state'
  | 'events_pending'
  | 'import_failed'
  | 'blocked_pending_local'
  | 'blocked_base_revision'
  | 'blocked_tombstone'
  | 'projection_failed';

export interface ProjectionConflictSummary {
  eventId: string;
  serverSequence: number;
  collection: string;
  documentId: string;
  reason: string;
  createdAtMs: number;
}

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncAtMs: number | null;
  pendingCount: number;
  remoteInboxPendingCount: number;
  remoteCursor: number;
  remoteProjectionCursor: number;
  remoteProjectionBlockReason: RemoteProjectionBlockReason | null;
  remoteProjectionBlockedAtSequence: number | null;
  projectionConflictCount: number;
  latestProjectionConflict: ProjectionConflictSummary | null;
  errorMessage: string | null;
  isOnline: boolean;
}

type SyncListener = (state: CloudSyncState) => void;

/** Cloud writes stay disabled until the matching revision-enforcing Firestore rules are deployed. */
export function isRevisionedSyncEnabled(): boolean {
  return import.meta.env.VITE_WIRD_REVISIONED_SYNC_ENABLED === 'true';
}

/** Remote projection stays off until local mutation coverage and conflict UX pass release tests. */
export function isRemoteProjectionEnabled(): boolean {
  return import.meta.env.VITE_WIRD_REMOTE_PROJECTION_ENABLED === 'true';
}

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
  private legacyCheckUid: string | null = null;
  private legacyDataDetected: boolean | null = null;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
  private state: CloudSyncState = {
    status: 'idle',
    lastSyncAtMs: null,
    pendingCount: 0,
    remoteInboxPendingCount: 0,
    remoteCursor: 0,
    remoteProjectionCursor: 0,
    remoteProjectionBlockReason: null,
    remoteProjectionBlockedAtSequence: null,
    projectionConflictCount: 0,
    latestProjectionConflict: null,
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
        this.updateState({
          pendingCount: 0,
          remoteInboxPendingCount: 0,
          remoteCursor: 0,
          remoteProjectionCursor: 0,
          remoteProjectionBlockReason: null,
          remoteProjectionBlockedAtSequence: null,
          projectionConflictCount: 0,
          latestProjectionConflict: null
        });
        return 0;
      }
      const [snapshot, remoteCursor, remoteProjectionCursor, conflictCount, latestConflicts] = await Promise.all([
        LocalSyncOutbox.getSnapshot(),
        LocalSyncOutbox.getRemoteCursor(),
        LocalSyncOutbox.getRemoteProjectionCursor(),
        LocalSyncOutbox.getProjectionConflictCount(),
        LocalSyncOutbox.listProjectionConflicts(1)
      ]);
      const latest = latestConflicts[0];
      this.updateState({
        pendingCount: snapshot.pendingCount,
        remoteCursor,
        remoteProjectionCursor,
        remoteInboxPendingCount: Math.max(0, remoteCursor - remoteProjectionCursor),
        projectionConflictCount: conflictCount,
        latestProjectionConflict: latest ? {
          eventId: latest.event.eventId,
          serverSequence: latest.event.serverSequence,
          collection: latest.event.collection,
          documentId: latest.event.documentId,
          reason: latest.reason,
          createdAtMs: latest.createdAtMs
        } : null
      });
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

    const revisionedSyncEnabled = isRevisionedSyncEnabled();
    this.syncInProgress = true;
    this.updateState({ status: 'syncing', errorMessage: null });

    try {
      let hasMore = true;
      let firstPushError: string | null = null;

      while (hasMore && revisionedSyncEnabled) {
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
        errorMessage: firstPushError || (!revisionedSyncEnabled && finalCount > 0
          ? 'الرفع السحابي الآمن متوقف مؤقتاً حتى نشر قواعد Firestore ومصالحة البيانات القديمة. بياناتك المحلية محفوظة ولم يتم إرسال كتابة قد تستبدل بيانات أحدث.'
          : status === 'error'
            ? 'بعض التغييرات لم تُرفع بعد؛ احتفظنا بها محلياً وسنعيد المحاولة.'
            : status === 'partial'
              ? 'تم حفظ الأحداث المستقبلة في صندوق محلي دائم، لكن تطبيقها ودمجها مع البيانات المحلية لم يكتمل بعد.'
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

  private async hasLegacyRemoteState(uid: string): Promise<boolean> {
    if (this.legacyCheckUid === uid && this.legacyDataDetected === false) return false;
    if (!db) return true;
    try {
      let hasAnyStateDocument = false;
      for (const collectionName of LEGACY_REMOTE_STATE_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, 'users', uid, collectionName));
        const stateDocuments = snapshot.docs.filter(item =>
          !(collectionName === 'syncMeta' && item.id === 'remoteReplication')
        );
        if (stateDocuments.length > 0) hasAnyStateDocument = true;
        const hasUnversionedDocument = stateDocuments.some(item => {
          const data = item.data();
          return !Number.isSafeInteger(data.revision) ||
            !Number.isSafeInteger(data.baseRevision);
        });
        if (hasUnversionedDocument) {
          this.legacyCheckUid = uid;
          this.legacyDataDetected = true;
          return true;
        }
      }
      if (!hasAnyStateDocument) {
        const legacyEvents = await getDocs(query(
          collection(db, 'users', uid, 'events'),
          where('schemaVersion', '==', 1),
          firestoreLimit(1)
        ));
        if (!legacyEvents.empty) {
          this.legacyCheckUid = uid;
          this.legacyDataDetected = true;
          return true;
        }
      }
      this.legacyCheckUid = uid;
      this.legacyDataDetected = false;
      return false;
    } catch (error) {
      console.warn('[WIRD CloudSync] Could not verify legacy remote documents; projection remains blocked.', error);
      this.legacyCheckUid = uid;
      this.legacyDataDetected = true;
      return true;
    }
  }

  /**
   * Import server-ordered events, then project only when the local base revision
   * is known and no pending local mutation would be overwritten.
   */
  private async pullRemoteReconciliation(uid: string): Promise<boolean> {
    if (!db) return false;
    try {
      const eventsRef = collection(db, 'users', uid, 'events');
      for (let page = 0; page < 5; page++) {
        const cursor = await LocalSyncOutbox.getRemoteCursor();
        const eventsQuery = query(
          eventsRef,
          where('serverSequence', '>', cursor),
          orderBy('serverSequence', 'asc'),
          firestoreLimit(100)
        );
        const snapshot = await getDocs(eventsQuery);
        if (snapshot.empty) break;
        const remoteEvents = snapshot.docs.map(item => item.data()) as unknown as RemoteInboxEventInput[];
        await LocalSyncOutbox.importRemotePage(remoteEvents);
        if (snapshot.size < 100) break;
      }

      if (!isRemoteProjectionEnabled()) {
        this.updateState({ remoteProjectionBlockReason: 'projection_disabled', remoteProjectionBlockedAtSequence: null });
        return false;
      }
      if (await this.hasLegacyRemoteState(uid)) {
        this.updateState({ remoteProjectionBlockReason: 'legacy_remote_state', remoteProjectionBlockedAtSequence: null });
        return false;
      }

      const projection = await projectRemoteInboxBatch(100);
      if (projection.reason) {
        console.warn('[WIRD CloudSync] Remote projection paused without advancing its cursor.', projection);
        this.updateState({
          remoteProjectionBlockReason: projection.reason,
          remoteProjectionBlockedAtSequence: projection.blockedAtSequence
        });
        return false;
      }
      const [remoteCursor, projectionCursor] = await Promise.all([
        LocalSyncOutbox.getRemoteCursor(),
        LocalSyncOutbox.getRemoteProjectionCursor()
      ]);
      if (remoteCursor !== projectionCursor) {
        this.updateState({ remoteProjectionBlockReason: 'events_pending', remoteProjectionBlockedAtSequence: null });
        return false;
      }
      this.updateState({ remoteProjectionBlockReason: null, remoteProjectionBlockedAtSequence: null });
      return true;
    } catch (error) {
      console.warn('[WIRD CloudSync] Remote inbox import/projection is incomplete; durable cursors were preserved.', error);
      this.updateState({ remoteProjectionBlockReason: 'import_failed', remoteProjectionBlockedAtSequence: null });
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
