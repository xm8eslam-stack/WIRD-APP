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

  let normalizedRemotePayload: Record<string, unknown>;
  try {
    normalizedRemotePayload = JSON.parse(JSON.stringify(state.payload)) as Record<string, unknown>;
  } catch {
    throw new Error('تعذر تطبيع حمولة الحالة السحابية؛ لم يتم تغيير البيانات المحلية.');
  }
  if (!isRecord(normalizedRemotePayload)) {
    throw new Error('حمولة الحالة السحابية ليست كائناً صالحاً؛ لم يتم تغيير البيانات المحلية.');
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
        stableStringify(existingIntent.payload) !== stableStringify(normalizedRemotePayload)) {
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
      payload: normalizedRemotePayload,
      localMutationFingerprints,
      nowMs: Date.now()
    });
    assertActiveConflictScope(uid);
  }

  // Re-read the authoritative document immediately before the local journal commit.
  // A revision/payload change after the prepared intent was saved must leave the
  // conflict open; never apply a stale snapshot simply because the earlier read succeeded.
  const latestSnapshot = await getDoc(stateRef);
  assertActiveConflictScope(uid);
  if (!latestSnapshot.exists()) {
    throw new Error('اختفى مستند الحالة السحابي قبل اعتماد القرار؛ بقيت أدلة التعارض محفوظة.');
  }
  const latestState = latestSnapshot.data();
  if (latestState.schemaVersion !== 1 ||
      latestState.revision !== state.revision ||
      latestState.baseRevision !== state.baseRevision ||
      latestState.mutationId !== state.mutationId ||
      latestState.deviceId !== state.deviceId ||
      latestState.updatedAtMs !== state.updatedAtMs ||
      latestState.deletedAt != null ||
      !isRecord(latestState.payload) ||
      stableStringify(latestState.payload) !== stableStringify(normalizedRemotePayload)) {
    throw new Error('تغيرت النسخة السحابية بعد تجهيز القرار؛ لم نطبق لقطة قديمة، وما زال التعارض وأرشيفه محفوظين.');
  }

  const committed = await LocalSyncOutbox.commitUseRemoteConflictResolution(
    eventId,
    state.revision,
    normalizedRemotePayload,
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


export interface KeepLocalConflictResolutionResult {
  eventId: string;
  revision: number;
  queuedMutationId: string;
  archivedMutationCount: number;
}

/**
 * Keep the current local full snapshot and queue one consolidated replacement
 * against the latest authoritative remote revision. This first executor is
 * deliberately limited to single-collection upserts; grouped syncMeta and
 * tombstones fail closed until their semantics are implemented separately.
 */
export async function resolveProjectionConflictUsingLocal(
  eventId: string
): Promise<KeepLocalConflictResolutionResult> {
  if (!isFirebaseConfigured() || !db || !auth) {
    throw new Error('المزامنة السحابية غير مهيأة؛ لم يتم تغيير أي بيانات.');
  }
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('يلزم تسجيل الدخول ببريد موثق قبل إعادة نشر النسخة المحلية.');
  }
  const uid = user.uid;
  assertActiveConflictScope(uid);

  const conflicts = await LocalSyncOutbox.listProjectionConflicts(100);
  assertActiveConflictScope(uid);
  const conflict = conflicts.find(item => item.event.eventId === eventId);
  if (!conflict || conflict.status !== 'open') {
    throw new Error('لم يعد التعارض مفتوحاً؛ حدّث قائمة التعارضات.');
  }
  if (conflict.event.operation !== 'upsert' ||
      conflict.event.collection === 'ruqyahProgress') {
    throw new Error('إعادة نشر أحداث الحذف وعدادات الرقية غير مفعّلة حتى تكتمل دلالات الحذف والدمج الإضافي واختباراتها.');
  }

  const archivedMutations = [...(conflict.localMutations || [])]
    .sort((a, b) => a.sequence - b.sequence || a.mutationId.localeCompare(b.mutationId));
  if (archivedMutations.length === 0 ||
      archivedMutations.some(item =>
        item.operation !== 'upsert' || !isRecord(item.payload) ||
        (item.collection !== conflict.event.collection &&
          !(conflict.event.collection === 'syncMeta' &&
            ['profile', 'plans', 'enginePlans', 'portions', 'weakVerses', 'tests', 'activityEvents'].includes(item.collection)))
      )) {
    throw new Error('لا توجد مجموعة تغييرات محلية كاملة ومتجانسة في سجل التعارض لإعادة نشرها بأمان.');
  }

  let localPayload: Record<string, unknown>;
  if (conflict.event.collection === 'syncMeta') {
    const remoteTransaction = conflict.event.payload.transaction;
    if (!isRecord(remoteTransaction) || remoteTransaction.version !== 1 ||
        !Array.isArray(remoteTransaction.operations) ||
        remoteTransaction.operations.length < 1 || remoteTransaction.operations.length > 8) {
      throw new Error('المعاملة السحابية المجمعة غير صالحة؛ بقي التعارض محفوظاً دون تغيير.');
    }
    const allowed = new Set(['profile', 'plans', 'enginePlans', 'portions', 'weakVerses', 'tests', 'activityEvents', 'ruqyahProgress']);
    const seen = new Set<string>();
    const operations: Array<{ collection: string; documentId: string; operation: 'upsert'; payload: Record<string, unknown> }> = [];
    for (const remoteOperation of remoteTransaction.operations) {
      if (!isRecord(remoteOperation) || typeof remoteOperation.collection !== 'string' ||
          !allowed.has(remoteOperation.collection) || seen.has(remoteOperation.collection) ||
          typeof remoteOperation.documentId !== 'string' || !remoteOperation.documentId ||
          remoteOperation.operation !== 'upsert' || !isRecord(remoteOperation.payload)) {
        throw new Error('تحتوي المعاملة المجمعة على مجموعة مكررة أو عملية غير مدعومة؛ لم نعد نشر أي بيانات.');
      }
      seen.add(remoteOperation.collection);
      const localForCollection = archivedMutations.filter(item => item.collection === remoteOperation.collection);
      if (localForCollection.some(item => item.documentId !== localForCollection[0]?.documentId)) {
        throw new Error('توجد عدة هويات مستندات محلية للمجموعة نفسها؛ يلزم حل يدوي قبل إعادة النشر.');
      }
      const latestLocal = localForCollection[localForCollection.length - 1];
      const documentId = latestLocal?.documentId || remoteOperation.documentId;
      const payload = JSON.parse(JSON.stringify(latestLocal?.payload || remoteOperation.payload)) as Record<string, unknown>;
      if (!StorageService.matchesJournalProjection(remoteOperation.collection as Parameters<typeof StorageService.matchesJournalProjection>[0], payload)) {
        throw new Error('لقطة إحدى المجموعات المحلية لا تطابق بياناتها الدائمة؛ لم نرفع نسخة قديمة.');
      }
      operations.push({ collection: remoteOperation.collection, documentId, operation: 'upsert', payload });
    }
    if (archivedMutations.some(item =>
      item.collection !== 'syncMeta' && !seen.has(item.collection)
    )) {
      throw new Error('يتضمن الأرشيف تغييرات لم تشملها المعاملة المجمعة؛ أوقفنا إعادة النشر لحماية البيانات.');
    }
    localPayload = { transaction: { version: 1, operations } };
    if (!StorageService.matchesJournalProjection('syncMeta', localPayload)) {
      throw new Error('اللقطة المحلية المجمعة لا تطابق الحالة الدائمة الحالية؛ لم نعد نشرها.');
    }
  } else {
    if (archivedMutations.some(item =>
      item.collection !== conflict.event.collection || item.documentId !== conflict.event.documentId
    )) {
      throw new Error('لا توجد لقطة محلية كاملة ومتجانسة في سجل التعارض لإعادة نشرها بأمان.');
    }
    const latestLocalMutation = archivedMutations[archivedMutations.length - 1];
    localPayload = JSON.parse(JSON.stringify(latestLocalMutation.payload)) as Record<string, unknown>;
    if (!StorageService.matchesJournalProjection(conflict.event.collection, localPayload)) {
      throw new Error('اللقطة المحلية الحالية لا تطابق آخر عملية محفوظة في الأرشيف؛ لم نرفع نسخة قديمة.');
    }
  }

  const stateRef = doc(db, 'users', uid, conflict.event.collection, conflict.event.documentId);
  const stateSnapshot = await getDoc(stateRef);
  assertActiveConflictScope(uid);
  if (!stateSnapshot.exists()) {
    throw new Error('لم يعد مستند الحالة السحابي موجوداً؛ لا يمكن إعادة تأسيس النسخة المحلية على إصدار غير متاح.');
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
    throw new Error('الحالة السحابية الحالية لا تطابق غلاف المزامنة الموثوق أو تحتوي على حذف غير مدعوم؛ لم نعد نشر البيانات.');
  }

  const localSnapshot = StorageService.getLocalProjectionSnapshot(conflict.event.collection);
  const localSnapshotFingerprint = fingerprintConflictSnapshot(localSnapshot);
  const localMutationFingerprints = archivedMutations.map(item => ({
    mutationId: item.mutationId,
    fingerprint: item.fingerprint
  }));
  const existingIntent = await LocalSyncOutbox.getConflictResolutionIntent(eventId);
  assertActiveConflictScope(uid);
  if (existingIntent) {
    if (existingIntent.decision !== 'keep-local' ||
        existingIntent.baseRevision !== state.revision ||
        existingIntent.localSnapshotFingerprint !== localSnapshotFingerprint ||
        stableStringify(existingIntent.payload) !== stableStringify(localPayload)) {
      throw new Error('يوجد قرار محفوظ سابقاً لكنه لم يعد مطابقاً للحالة السحابية أو المحلية الحالية. ألغِ القرار بعد مراجعة الأدلة قبل إنشاء قرار جديد.');
    }
  } else {
    await LocalSyncOutbox.prepareConflictResolutionIntent({
      decisionId: createSecureId(),
      eventId,
      eventFingerprint: conflict.event.fingerprint,
      localSnapshotFingerprint,
      decision: 'keep-local',
      baseRevision: state.revision,
      payload: localPayload,
      localMutationFingerprints,
      nowMs: Date.now()
    });
    assertActiveConflictScope(uid);
  }

  // Re-read the authoritative server document immediately before the journal commit.
  const latestSnapshot = await getDoc(stateRef);
  assertActiveConflictScope(uid);
  if (!latestSnapshot.exists()) {
    throw new Error('اختفى مستند الحالة السحابي قبل اعتماد القرار؛ بقيت أدلة التعارض محفوظة.');
  }
  const latestState = latestSnapshot.data();
  if (latestState.schemaVersion !== 1 ||
      latestState.revision !== state.revision ||
      latestState.baseRevision !== state.baseRevision ||
      latestState.mutationId !== state.mutationId ||
      latestState.deviceId !== state.deviceId ||
      latestState.updatedAtMs !== state.updatedAtMs ||
      latestState.deletedAt != null ||
      !isRecord(latestState.payload) ||
      stableStringify(latestState.payload) !== stableStringify(state.payload)) {
    throw new Error('تغيرت النسخة السحابية بعد تجهيز القرار؛ لم نعد نشر لقطة محلية على إصدار قديم، وما زال الأرشيف محفوظاً.');
  }

  const committed = await LocalSyncOutbox.commitKeepLocalConflictResolution(
    eventId,
    state.revision,
    localPayload,
    Date.now()
  );
  assertActiveConflictScope(uid);
  if (!committed || !committed.mutationId) {
    throw new Error('لم يؤكد سجل المزامنة تجهيز عملية إعادة النشر؛ بقي التعارض والأدلة محفوظة.');
  }

  return {
    eventId,
    revision: state.revision,
    queuedMutationId: committed.mutationId,
    archivedMutationCount: localMutationFingerprints.length
  };
}
