import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { createSecureId } from './secureId';
import { LocalSyncOutbox } from './localSyncOutbox';
import {
  fingerprintConflictSnapshot,
  type RemoteProjectionConflict
} from './indexedDbSyncJournal';
import { StorageService } from './storageService';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

function assertActiveConflictScope(uid: string): void {
  const currentUser = auth?.currentUser;
  if (!currentUser || currentUser.uid !== uid || !currentUser.emailVerified ||
      StorageService.getStorageScope() !== 'user:' + uid) {
    throw new Error('SYNC_SCOPE_CHANGED');
  }
}

export async function cancelPreparedProjectionConflictResolution(
  eventId: string,
  decisionId: string
): Promise<boolean> {
  const user = auth?.currentUser;
  if (!user || !user.emailVerified) throw new Error('يلزم تسجيل الدخول ببريد موثق لإلغاء القرار المحفوظ.');
  assertActiveConflictScope(user.uid);
  const cancelled = await LocalSyncOutbox.cancelPreparedConflictResolutionIntent(eventId, decisionId);
  assertActiveConflictScope(user.uid);
  return cancelled;
}

export interface UseRemoteConflictResolutionResult {
  eventId: string;
  revision: number;
  archivedMutationCount: number;
}

/**
 * Explicitly replace a blocked local projection with the latest authoritative
 * Firestore snapshot. The journal commits local projection, Outbox supersession,
 * conflict closure, and cursor/revision metadata together. Tombstones remain
 * unsupported and are rejected rather than interpreted as empty snapshots.
 */
export async function resolveProjectionConflictUsingRemote(
  eventId: string
): Promise<UseRemoteConflictResolutionResult> {
  if (!isFirebaseConfigured() || !db || !auth) {
    throw new Error('المزامنة السحابية غير مهيأة؛ لم يتم تغيير أي بيانات.');
  }
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('يلزم تسجيل الدخول ببريد موثق قبل حل التعارض السحابي.');
  }
  const uid = user.uid;
  assertActiveConflictScope(uid);

  const conflicts = await LocalSyncOutbox.listProjectionConflicts(100);
  assertActiveConflictScope(uid);
  const conflict: RemoteProjectionConflict | undefined = conflicts.find(item => item.event.eventId === eventId);
  if (!conflict || conflict.status !== 'open') {
    throw new Error('لم يعد التعارض مفتوحاً؛ حدّث قائمة التعارضات.');
  }
  if (conflict.event.operation !== 'upsert') {
    throw new Error('هذا التعارض يتضمن حدث حذف؛ سياسة Tombstones لم تكتمل بعد، لذلك لم نطبق قراراً قد يعيد إحياء بيانات محذوفة.');
  }

  const stateRef = doc(db, 'users', uid, conflict.event.collection, conflict.event.documentId);
  const stateSnapshot = await getDoc(stateRef);
  assertActiveConflictScope(uid);
  if (!stateSnapshot.exists()) {
    throw new Error('لم يعد مستند الحالة السحابي موجوداً؛ لا يمكن اختيار نسخة بعيدة غير متاحة.');
  }
  const state = stateSnapshot.data();
  if (state.schemaVersion !== 1 ||
      !Number.isSafeInteger(state.updatedAtMs) || state.updatedAtMs < 0 ||
      typeof state.deviceId !== 'string' || !state.deviceId ||
      typeof state.mutationId !== 'string' || !state.mutationId ||
      !Number.isSafeInteger(state.baseRevision) || state.baseRevision < 0 ||
      !Number.isSafeInteger(state.revision) || state.revision !== state.baseRevision + 1 ||
      state.revision < conflict.event.revision ||
      !isRecord(state.payload) || state.deletedAt != null) {
    throw new Error('الحالة السحابية الحالية لا تطابق غلاف المزامنة الموثوق أو تحتوي على حذف غير مدعوم؛ لم يتم تعديل البيانات المحلية.');
  }

  const localSnapshot = StorageService.getLocalProjectionSnapshot(conflict.event.collection);
  const localSnapshotFingerprint = fingerprintConflictSnapshot(localSnapshot);
  const localMutationFingerprints = (conflict.localMutations || []).map(item => ({
    mutationId: item.mutationId,
    fingerprint: item.fingerprint
  }));
  const existingIntent = await LocalSyncOutbox.getConflictResolutionIntent(eventId);
  assertActiveConflictScope(uid);

  if (existingIntent) {
    if (existingIntent.decision !== 'use-remote' ||
        existingIntent.baseRevision !== state.revision ||
        existingIntent.localSnapshotFingerprint !== localSnapshotFingerprint ||
        stableStringify(existingIntent.payload) !== stableStringify(state.payload)) {
      throw new Error('يوجد قرار محفوظ سابقاً لكنه لم يعد مطابقاً للحالة السحابية أو المحلية الحالية. لا تحاول تجاوزه؛ يلزم إلغاء القرار المعلّق بعد مراجعة الأدلة.');
    }
  } else {
    await LocalSyncOutbox.prepareConflictResolutionIntent({
      decisionId: createSecureId(),
      eventId,
      eventFingerprint: conflict.event.fingerprint,
      localSnapshotFingerprint,
      decision: 'use-remote',
      baseRevision: state.revision,
      payload: state.payload,
      localMutationFingerprints,
      nowMs: Date.now()
    });
    assertActiveConflictScope(uid);
  }

  const committed = await LocalSyncOutbox.commitUseRemoteConflictResolution(
    eventId,
    state.revision,
    state.payload,
    Date.now()
  );
  assertActiveConflictScope(uid);
  if (!committed) {
    throw new Error('لم يؤكد سجل المزامنة إتمام القرار؛ بقي التعارض والأدلة محفوظة لإعادة المحاولة.');
  }

  return {
    eventId,
    revision: state.revision,
    archivedMutationCount: localMutationFingerprints.length
  };
}
