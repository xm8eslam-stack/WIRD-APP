import { buildQuranAudioDownloadPlan, type QuranAudioDownloadRange } from './offlineQuranAudioDownload';
import { createSecureId } from './secureId';

const DATABASE_NAME = 'wird-offline-quran-audio';
const DATABASE_VERSION = 1;
const JOBS = 'jobs';
const FILES = 'files';
const JOB_ITEMS = 'jobItems';

export type OfflineAudioJobStatus = 'queued' | 'downloading' | 'partial' | 'completed' | 'failed' | 'cancelled';
export type OfflineAudioJobItemStatus = 'queued' | 'downloading' | 'verified' | 'failed';

export interface OfflineAudioJob extends QuranAudioDownloadRange {
  id: string;
  schemaVersion: 1;
  requestFingerprint: string;
  status: OfflineAudioJobStatus;
  totalAyahs: number;
  completedAyahs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface OfflineAudioFile {
  key: string;
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  cacheGenerationId: string;
  url: string;
  byteLength: number | null;
  downloadedAtMs: number;
  verified: true;
  available: boolean;
  pinned: boolean;
  deletionPending: boolean;
}

export interface OfflineAudioJobItem {
  key: string;
  jobId: string;
  fileKey: string;
  reciterId: string;
  globalAyahNumber: number;
  status: OfflineAudioJobItemStatus;
  updatedAtMs: number;
}

export interface OfflineAudioFileInput {
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  cacheGenerationId: string;
  url: string;
  byteLength: number | null;
  downloadedAtMs: number;
  verified: true;
}

export interface OfflineAudioDeleteResult {
  orphanedFiles: OfflineAudioFile[];
}

export interface OfflineAudioLibraryOptions {
  indexedDBFactory?: IDBFactory;
  databaseName?: string;
}

function normalizeStorageError(error: unknown, fallback: string): Error {
  if (error && typeof error === 'object' && 'name' in error &&
      (error as { name?: unknown }).name === 'QuotaExceededError') {
    return new Error('مساحة التخزين المحلية ممتلئة؛ لم نؤكد حفظ تنزيل جزئي.');
  }
  return error instanceof Error ? error : new Error(fallback);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(normalizeStorageError(request.error, 'تعذر قراءة مكتبة التلاوات المحفوظة.'));
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(normalizeStorageError(transaction.error, 'أُلغيت معاملة مكتبة التلاوات.'));
    transaction.onerror = () => reject(normalizeStorageError(transaction.error, 'تعذر تحديث مكتبة التلاوات.'));
  });
}

function writeSafely<T>(transaction: IDBTransaction, action: () => IDBRequest<T>, fallback: string): IDBRequest<T> {
  try {
    return action();
  } catch (error) {
    try { transaction.abort(); } catch { /* transaction may already be inactive */ }
    throw normalizeStorageError(error, fallback);
  }
}

function isTerminal(status: OfflineAudioJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function fileKey(reciterId: string, globalAyahNumber: number): string {
  return reciterId + ':' + String(globalAyahNumber);
}

function jobItemKey(jobId: string, key: string): string {
  return jobId + ':' + key;
}

function requestFingerprint(range: QuranAudioDownloadRange): string {
  return [range.reciterId, range.surahNumber, range.startAyah, range.endAyah].join('|');
}

function validateJob(job: OfflineAudioJob): void {
  if (!job || job.schemaVersion !== 1 || typeof job.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(job.id) ||
      typeof job.requestFingerprint !== 'string' || !job.requestFingerprint || job.requestFingerprint !== requestFingerprint(job) ||
      !['queued', 'downloading', 'partial', 'completed', 'failed', 'cancelled'].includes(job.status)) {
    throw new Error('بيانات مهمة تنزيل التلاوة غير صالحة.');
  }
  const plan = buildQuranAudioDownloadPlan(job);
  if (job.totalAyahs !== plan.totalAyahs || !Number.isSafeInteger(job.completedAyahs) ||
      job.completedAyahs < 0 || job.completedAyahs > job.totalAyahs ||
      !Number.isSafeInteger(job.createdAtMs) || job.createdAtMs < 0 ||
      !Number.isSafeInteger(job.updatedAtMs) || job.updatedAtMs < job.createdAtMs ||
      (job.status === 'queued' && job.completedAyahs !== 0) ||
      (job.status === 'partial' && (job.completedAyahs < 1 || job.completedAyahs >= job.totalAyahs)) ||
      (job.status === 'completed' && job.completedAyahs !== job.totalAyahs)) {
    throw new Error('تقدم مهمة تنزيل التلاوة لا يطابق نطاقها.');
  }
}

function validateJobItem(job: OfflineAudioJob, item: OfflineAudioJobItem): void {
  if (!item || typeof item !== 'object') throw new Error('علاقة ملف التلاوة بمهمة التنزيل غير صالحة.');
  const expected = buildQuranAudioDownloadPlan(job).items.find(candidate =>
    candidate.globalAyahNumber === item.globalAyahNumber
  );
  if (!item || item.jobId !== job.id || item.fileKey !== fileKey(job.reciterId, item.globalAyahNumber) ||
      item.key !== jobItemKey(job.id, item.fileKey) || item.reciterId !== job.reciterId ||
      !expected || !['queued', 'downloading', 'verified', 'failed'].includes(item.status) ||
      !Number.isSafeInteger(item.updatedAtMs) || item.updatedAtMs < job.createdAtMs) {
    throw new Error('علاقة ملف التلاوة بمهمة التنزيل غير صالحة.');
  }
}

function normalizeFile(input: OfflineAudioFileInput): OfflineAudioFile {
  if (!input || typeof input !== 'object' || input.verified !== true) {
    throw new Error('لا يمكن تسجيل ملف تلاوة قبل اكتمال تنزيله والتحقق منه.');
  }
  if (typeof input.cacheGenerationId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.cacheGenerationId)) {
    throw new Error('معرّف نسخة ملف التلاوة المحفوظ غير صالح.');
  }
  const plan = buildQuranAudioDownloadPlan({
    reciterId: input.reciterId,
    surahNumber: input.surahNumber,
    startAyah: input.ayahNumber,
    endAyah: input.ayahNumber
  });
  const expected = plan.items[0];
  if (!expected || expected.globalAyahNumber !== input.globalAyahNumber || expected.url !== input.url ||
      (input.byteLength !== null && (!Number.isSafeInteger(input.byteLength) || input.byteLength <= 0)) ||
      !Number.isSafeInteger(input.downloadedAtMs) || input.downloadedAtMs < 0) {
    throw new Error('بيانات ملف التلاوة لا تطابق إحداثيات القرآن أو مصدر القارئ المعتمد.');
  }
  return {
    key: fileKey(input.reciterId, input.globalAyahNumber),
    reciterId: input.reciterId,
    surahNumber: input.surahNumber,
    ayahNumber: input.ayahNumber,
    globalAyahNumber: input.globalAyahNumber,
    cacheGenerationId: input.cacheGenerationId,
    url: input.url,
    byteLength: input.byteLength,
    downloadedAtMs: input.downloadedAtMs,
    verified: true,
    available: true,
    pinned: false,
    deletionPending: false
  };
}

function validateStoredFile(value: unknown): OfflineAudioFile {
  if (!value || typeof value !== 'object') throw new Error('سجل ملف صوتي تالف؛ لم نستخدمه.');
  const record = value as OfflineAudioFile;
  const normalized = normalizeFile(record);
  if (record.key !== normalized.key || typeof record.available !== 'boolean' || typeof record.pinned !== 'boolean' || typeof record.deletionPending !== 'boolean') {
    throw new Error('سجل الملف الصوتي لا يطابق المخطط المعتمد.');
  }
  return { ...normalized, available: record.available, pinned: record.pinned, deletionPending: record.deletionPending };
}

/**
 * Device-local metadata coordinator only. Audio bytes stay in a dedicated Cache Storage namespace.
 * Callers must verify cache presence before playback and finalize orphan deletion only after cache deletion succeeds.
 * This service is intentionally excluded from Firebase sync, backup, and account export.
 */
export class OfflineQuranAudioLibrary {
  private readonly factory: IDBFactory;
  private readonly databaseName: string;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: OfflineAudioLibraryOptions = {}) {
    const factory = options.indexedDBFactory ?? globalThis.indexedDB;
    if (!factory) throw new Error('التخزين المحلي لتنزيلات التلاوة غير مدعوم في هذا المتصفح.');
    this.factory = factory;
    this.databaseName = options.databaseName || DATABASE_NAME;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try { request = this.factory.open(this.databaseName, DATABASE_VERSION); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(JOBS)) {
          const jobs = db.createObjectStore(JOBS, { keyPath: 'id' });
          jobs.createIndex('requestFingerprint', 'requestFingerprint', { unique: false });
          jobs.createIndex('updatedAtMs', 'updatedAtMs', { unique: false });
        }
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(JOB_ITEMS)) {
          const items = db.createObjectStore(JOB_ITEMS, { keyPath: 'key' });
          items.createIndex('jobId', 'jobId', { unique: false });
          items.createIndex('fileKey', 'fileKey', { unique: false });
        }
      };
      let blocked = false;
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); this.databasePromise = null; };
        resolve(db);
      };
      request.onerror = () => {
        this.databasePromise = null;
        reject(normalizeStorageError(request.error, 'تعذر فتح مكتبة تنزيلات التلاوة.'));
      };
      request.onblocked = () => {
        blocked = true;
        this.databasePromise = null;
        reject(new Error('مكتبة التلاوات مفتوحة في نافذة أخرى؛ أغلق النسخة القديمة ثم أعد المحاولة.'));
      };
    });
    return this.databasePromise;
  }

  async createJob(range: QuranAudioDownloadRange, nowMs = Date.now()): Promise<OfflineAudioJob> {
    const plan = buildQuranAudioDownloadPlan(range);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت إنشاء مهمة التنزيل غير صالح.');
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS, FILES, JOB_ITEMS], 'readwrite');
    const jobs = transaction.objectStore(JOBS);
    const files = transaction.objectStore(FILES);
    const items = transaction.objectStore(JOB_ITEMS);
    const fingerprint = requestFingerprint(range);
    const existingJobs = await requestResult(jobs.index('requestFingerprint').getAll(fingerprint)) as OfflineAudioJob[];
    const reusable = existingJobs
      .filter(job => !isTerminal(job.status))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
    if (reusable) {
      validateJob(reusable);
      await transactionResult(transaction);
      return reusable;
    }

    const job: OfflineAudioJob = {
      ...range,
      id: createSecureId(),
      schemaVersion: 1,
      requestFingerprint: fingerprint,
      status: 'queued',
      totalAyahs: plan.totalAyahs,
      completedAyahs: 0,
      createdAtMs: nowMs,
      updatedAtMs: nowMs
    };
    const relations: OfflineAudioJobItem[] = [];
    for (const item of plan.items) {
      const key = fileKey(range.reciterId, item.globalAyahNumber);
      const stored = await requestResult(files.get(key));
      let verified = false;
      if (stored) {
        const storedFile = validateStoredFile(stored);
        verified = storedFile.available && !storedFile.deletionPending;
      }
      relations.push({
        key: jobItemKey(job.id, key),
        jobId: job.id,
        fileKey: key,
        reciterId: range.reciterId,
        globalAyahNumber: item.globalAyahNumber,
        status: verified ? 'verified' : 'queued',
        updatedAtMs: nowMs
      });
    }
    job.completedAyahs = relations.filter(item => item.status === 'verified').length;
    job.status = job.completedAyahs === job.totalAyahs
      ? 'completed'
      : job.completedAyahs > 0 ? 'partial' : 'queued';
    writeSafely(transaction, () => jobs.add(job), 'تعذر إنشاء مهمة تنزيل التلاوة.');
    relations.forEach(item => writeSafely(transaction, () => items.add(item), 'تعذر إنشاء عناصر مهمة التنزيل.'));
    await transactionResult(transaction);
    return job;
  }

  async getJob(jobId: string): Promise<OfflineAudioJob | null> {
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS], 'readonly');
    const value = await requestResult(transaction.objectStore(JOBS).get(jobId));
    await transactionResult(transaction);
    if (!value) return null;
    validateJob(value);
    return value;
  }

  async listJobs(): Promise<OfflineAudioJob[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS], 'readonly');
    const values = await requestResult(transaction.objectStore(JOBS).getAll()) as OfflineAudioJob[];
    await transactionResult(transaction);
    values.forEach(validateJob);
    return values.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  async listJobItems(jobId: string): Promise<OfflineAudioJobItem[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS, JOB_ITEMS], 'readonly');
    const job = await requestResult(transaction.objectStore(JOBS).get(jobId));
    if (!job) throw new Error('مهمة تنزيل التلاوة غير موجودة.');
    const values = await requestResult(transaction.objectStore(JOB_ITEMS).index('jobId').getAll(jobId)) as OfflineAudioJobItem[];
    await transactionResult(transaction);
    validateJob(job);
    values.forEach(item => validateJobItem(job, item));
    if (values.filter(item => item.status === 'verified').length !== job.completedAyahs) {
      throw new Error('تقدم مهمة التنزيل لا يطابق علاقات الملفات المحفوظة.');
    }
    return values.sort((a, b) => a.globalAyahNumber - b.globalAyahNumber);
  }

  async listFiles(): Promise<OfflineAudioFile[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction([FILES], 'readonly');
    const values = await requestResult(transaction.objectStore(FILES).getAll()) as unknown[];
    await transactionResult(transaction);
    return values.map(validateStoredFile).sort((a, b) =>
      a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber || a.reciterId.localeCompare(b.reciterId)
    );
  }

  async setJobStatus(jobId: string, status: OfflineAudioJobStatus, nowMs = Date.now()): Promise<OfflineAudioJob> {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت تحديث مهمة التنزيل غير صالح.');
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS], 'readwrite');
    const store = transaction.objectStore(JOBS);
    const job = await requestResult(store.get(jobId)) as OfflineAudioJob | undefined;
    if (!job) { transaction.abort(); throw new Error('مهمة تنزيل التلاوة غير موجودة.'); }
    validateJob(job);
    if (isTerminal(job.status) && status !== job.status) {
      transaction.abort();
      throw new Error('لا يمكن تغيير حالة مهمة تنزيل منتهية.');
    }
    const allowed: Record<OfflineAudioJobStatus, OfflineAudioJobStatus[]> = {
      queued: ['queued', 'downloading', 'partial', 'completed', 'failed', 'cancelled'],
      downloading: ['downloading', 'partial', 'completed', 'failed', 'cancelled'],
      partial: ['partial', 'downloading', 'completed', 'failed', 'cancelled'],
      completed: ['completed'],
      failed: ['failed'],
      cancelled: ['cancelled']
    };
    if (!allowed[job.status].includes(status) ||
        (status === 'completed' && job.completedAyahs !== job.totalAyahs) ||
        (status === 'partial' && (job.completedAyahs < 1 || job.completedAyahs >= job.totalAyahs)) ||
        (status === 'queued' && job.completedAyahs !== 0)) {
      transaction.abort();
      throw new Error('انتقال حالة مهمة التنزيل غير مسموح أو لا يطابق تقدمها.');
    }
    job.status = status;
    job.updatedAtMs = Math.max(nowMs, job.createdAtMs);
    writeSafely(transaction, () => store.put(job), 'تعذر تحديث حالة مهمة التنزيل.');
    await transactionResult(transaction);
    return job;
  }

  async markItemDownloading(jobId: string, globalAyahNumber: number, nowMs = Date.now()): Promise<void> {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت تحديث عنصر التنزيل غير صالح.');
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS, JOB_ITEMS], 'readwrite');
    const jobs = transaction.objectStore(JOBS);
    const items = transaction.objectStore(JOB_ITEMS);
    const job = await requestResult(jobs.get(jobId)) as OfflineAudioJob | undefined;
    if (!job) { transaction.abort(); throw new Error('مهمة تنزيل التلاوة غير موجودة.'); }
    validateJob(job);
    if (isTerminal(job.status)) { transaction.abort(); throw new Error('لا يمكن تنزيل عنصر داخل مهمة منتهية.'); }
    const key = fileKey(job.reciterId, globalAyahNumber);
    const item = await requestResult(items.get(jobItemKey(jobId, key))) as OfflineAudioJobItem | undefined;
    if (!item) { transaction.abort(); throw new Error('موضع الآية خارج مهمة التنزيل.'); }
    validateJobItem(job, item);
    if (item.status === 'verified') {
      await transactionResult(transaction);
      return;
    }
    item.status = 'downloading';
    item.updatedAtMs = Math.max(nowMs, job.createdAtMs);
    job.status = 'downloading';
    job.updatedAtMs = item.updatedAtMs;
    writeSafely(transaction, () => items.put(item), 'تعذر تحديث عنصر التلاوة في المهمة.');
    writeSafely(transaction, () => jobs.put(job), 'تعذر تحديث تقدم مهمة التنزيل.');
    await transactionResult(transaction);
  }

  async recordVerifiedFile(jobId: string, input: OfflineAudioFileInput): Promise<OfflineAudioJob> {
    const normalized = normalizeFile(input);
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS, FILES, JOB_ITEMS], 'readwrite');
    const jobs = transaction.objectStore(JOBS);
    const files = transaction.objectStore(FILES);
    const items = transaction.objectStore(JOB_ITEMS);
    const job = await requestResult(jobs.get(jobId)) as OfflineAudioJob | undefined;
    if (!job) { transaction.abort(); throw new Error('مهمة تنزيل التلاوة غير موجودة.'); }
    validateJob(job);
    const plan = buildQuranAudioDownloadPlan(job);
    const expected = plan.items.find(item => item.globalAyahNumber === normalized.globalAyahNumber);
    if (!expected || expected.url !== normalized.url || job.reciterId !== normalized.reciterId) {
      transaction.abort();
      throw new Error('الملف الصوتي خارج نطاق المهمة أو لا يطابق مصدرها.');
    }
    const relationKey = jobItemKey(jobId, normalized.key);
    const relation = await requestResult(items.get(relationKey)) as OfflineAudioJobItem | undefined;
    if (!relation) { transaction.abort(); throw new Error('علاقة ملف التلاوة بالمهمة غير موجودة.'); }
    validateJobItem(job, relation);
    if (isTerminal(job.status) && relation.status !== 'verified') {
      transaction.abort();
      throw new Error('لا يمكن إضافة ملف جديد إلى مهمة تنزيل منتهية.');
    }
    const existing = await requestResult(files.get(normalized.key));
    if (existing) {
      const current = validateStoredFile(existing);
      if (current.url !== normalized.url) {
        transaction.abort();
        throw new Error('تعارض في الملف المحفوظ لنفس القارئ والآية.');
      }
      // A completed/failed/cancelled job may be retried by a delayed worker.
      // It must not replace a newer cache generation installed by another job.
      if (isTerminal(job.status) && relation.status === 'verified' &&
          current.cacheGenerationId !== normalized.cacheGenerationId) {
        transaction.abort();
        throw new Error('انتهت مهمة التنزيل ولا يمكنها استبدال نسخة صوتية أحدث.');
      }
      normalized.pinned = current.pinned;
      normalized.available = true;
      normalized.deletionPending = false;
    }
    writeSafely(transaction, () => files.put(normalized), 'تعذر تسجيل الملف الصوتي المحقق.');
    relation.status = 'verified';
    relation.updatedAtMs = Math.max(input.downloadedAtMs, job.createdAtMs);
    writeSafely(transaction, () => items.put(relation), 'تعذر ربط الملف الصوتي بمهمة التنزيل.');

    const relatedItems = await requestResult(items.index('fileKey').getAll(normalized.key)) as OfflineAudioJobItem[];
    const affectedJobIds = [...new Set(relatedItems.map(item => item.jobId))];
    for (const relatedItem of relatedItems) {
      const relatedJob = await requestResult(jobs.get(relatedItem.jobId)) as OfflineAudioJob | undefined;
      if (!relatedJob || isTerminal(relatedJob.status)) continue;
      validateJobItem(relatedJob, relatedItem);
      relatedItem.status = 'verified';
      relatedItem.updatedAtMs = Math.max(relatedItem.updatedAtMs, relation.updatedAtMs);
      writeSafely(transaction, () => items.put(relatedItem), 'تعذر تحديث علاقة ملف صوتي مشتركة.');
    }
    for (const affectedId of affectedJobIds) {
      const affectedJob = await requestResult(jobs.get(affectedId)) as OfflineAudioJob | undefined;
      if (!affectedJob || isTerminal(affectedJob.status)) continue;
      const allItems = await requestResult(items.index('jobId').getAll(affectedId)) as OfflineAudioJobItem[];
      affectedJob.completedAyahs = allItems.filter(item => item.status === 'verified').length;
      affectedJob.status = affectedJob.completedAyahs === affectedJob.totalAyahs
        ? 'completed'
        : allItems.some(item => item.status === 'downloading') ? 'downloading'
          : affectedJob.completedAyahs > 0 ? 'partial' : 'downloading';
      affectedJob.updatedAtMs = Math.max(affectedJob.updatedAtMs, relation.updatedAtMs);
      writeSafely(transaction, () => jobs.put(affectedJob), 'تعذر تحديث تقدم مهمة مرتبطة.');
    }
    await transactionResult(transaction);
    return (await this.getJob(jobId))!;
  }

  async deleteJob(jobId: string): Promise<OfflineAudioDeleteResult> {
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS, FILES, JOB_ITEMS], 'readwrite');
    const jobs = transaction.objectStore(JOBS);
    const files = transaction.objectStore(FILES);
    const items = transaction.objectStore(JOB_ITEMS);
    const job = await requestResult(jobs.get(jobId));
    if (!job) { await transactionResult(transaction); return { orphanedFiles: [] }; }
    validateJob(job);
    const relations = await requestResult(items.index('jobId').getAll(jobId)) as OfflineAudioJobItem[];
    // Validate every relationship before mutating anything; a corrupt fileKey must not orphan or target another file.
    relations.forEach(item => validateJobItem(job, item));
    relations.forEach(item => writeSafely(transaction, () => items.delete(item.key), 'تعذر حذف علاقات مهمة التنزيل.'));
    writeSafely(transaction, () => jobs.delete(jobId), 'تعذر حذف مهمة التنزيل.');
    const orphanedFiles: OfflineAudioFile[] = [];
    for (const relation of relations) {
      const remaining = await requestResult(items.index('fileKey').getAll(relation.fileKey)) as OfflineAudioJobItem[];
      if (remaining.length > 0) continue;
      const stored = await requestResult(files.get(relation.fileKey));
      if (!stored) continue;
      const file = validateStoredFile(stored);
      if (file.pinned) continue;
      file.deletionPending = true;
      writeSafely(transaction, () => files.put(file), 'تعذر تسجيل حذف ملف صوتي غير مستخدم.');
      orphanedFiles.push(file);
    }
    await transactionResult(transaction);
    return { orphanedFiles };
  }

  async setFilePinned(reciterId: string, globalAyahNumber: number, pinned: boolean): Promise<OfflineAudioDeleteResult> {
    const key = fileKey(reciterId, globalAyahNumber);
    const db = await this.openDatabase();
    const transaction = db.transaction([FILES, JOB_ITEMS], 'readwrite');
    const files = transaction.objectStore(FILES);
    const items = transaction.objectStore(JOB_ITEMS);
    const stored = await requestResult(files.get(key));
    if (!stored) { transaction.abort(); throw new Error('ملف التلاوة غير موجود في المكتبة المحلية.'); }
    const file = validateStoredFile(stored);
    if (pinned && (!file.available || file.deletionPending)) { transaction.abort(); throw new Error('لا يمكن تثبيت ملف صوتي غير متاح أو جارٍ حذفه.'); }
    file.pinned = pinned;
    if (pinned) {
      file.deletionPending = false;
      writeSafely(transaction, () => files.put(file), 'تعذر تحديث تفضيل تثبيت الملف الصوتي.');
      await transactionResult(transaction);
      return { orphanedFiles: [] };
    }
    const references = await requestResult(items.index('fileKey').getAll(key)) as OfflineAudioJobItem[];
    if (references.length > 0) {
      file.deletionPending = false;
      writeSafely(transaction, () => files.put(file), 'تعذر تحديث تفضيل تثبيت الملف الصوتي.');
    } else {
      file.deletionPending = true;
      writeSafely(transaction, () => files.put(file), 'تعذر تسجيل حذف الملف الصوتي.');
      await transactionResult(transaction);
      return { orphanedFiles: [file] };
    }
    await transactionResult(transaction);
    return { orphanedFiles: [] };
  }

  /**
   * Finalize metadata removal only after the caller has successfully deleted the Cache Storage object.
   * A crash before this call leaves a durable deletionPending record that can be retried.
   */
  async finalizeOrphanDeletion(reciterId: string, globalAyahNumber: number, expectedCacheGenerationId: string): Promise<boolean> {
    if (typeof expectedCacheGenerationId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(expectedCacheGenerationId)) {
      throw new Error('معرّف نسخة الملف المطلوب حذفها غير صالح.');
    }
    const key = fileKey(reciterId, globalAyahNumber);
    const db = await this.openDatabase();
    const transaction = db.transaction([FILES, JOB_ITEMS], 'readwrite');
    const files = transaction.objectStore(FILES);
    const items = transaction.objectStore(JOB_ITEMS);
    const stored = await requestResult(files.get(key));
    if (!stored) { await transactionResult(transaction); return true; }
    const file = validateStoredFile(stored);
    // A delayed Cache Storage cleanup must never remove metadata for a newer download generation.
    if (file.cacheGenerationId !== expectedCacheGenerationId || !file.deletionPending) {
      await transactionResult(transaction);
      return false;
    }
    const references = await requestResult(items.index('fileKey').getAll(key)) as OfflineAudioJobItem[];
    if (references.length > 0 || file.pinned) {
      file.deletionPending = false;
      writeSafely(transaction, () => files.put(file), 'تعذر إلغاء حذف الملف الصوتي المرتبط.');
      await transactionResult(transaction);
      return false;
    }
    writeSafely(transaction, () => files.delete(key), 'تعذر إنهاء حذف سجل الملف الصوتي.');
    await transactionResult(transaction);
    return true;
  }

  /**
   * Reconcile IndexedDB metadata with Cache Storage before treating files as available.
   * A missing cache object is marked unavailable; historical job records and pin preference remain.
   * The caller owns the cache namespace and supplies the exact cache-presence check.
   */
  async reconcileCachedFiles(hasCachedFile: (file: OfflineAudioFile) => Promise<boolean>): Promise<OfflineAudioFile[]> {
    const files = await this.listFiles();
    const checks = await Promise.all(files.map(async file => ({
      file,
      present: await hasCachedFile(file)
    })));
    const missing = checks.filter(item => !item.present).map(item => item.file);
    if (checks.length === 0) return [];
    const missingKeys = new Set(missing.map(file => file.key));
    const db = await this.openDatabase();
    const transaction = db.transaction([FILES], 'readwrite');
    const store = transaction.objectStore(FILES);
    for (const snapshot of checks.map(item => item.file)) {
      const current = await requestResult(store.get(snapshot.key));
      if (!current) continue;
      const file = validateStoredFile(current);
      if (file.downloadedAtMs !== snapshot.downloadedAtMs || file.cacheGenerationId !== snapshot.cacheGenerationId) continue;
      const shouldBeAvailable = !missingKeys.has(file.key);
      if (file.available !== shouldBeAvailable) {
        file.available = shouldBeAvailable;
        writeSafely(transaction, () => store.put(file), 'تعذر تحديث حالة توفر الملف الصوتي.');
      }
    }
    await transactionResult(transaction);
    return missing;
  }

  close(): void {
    if (!this.databasePromise) return;
    void this.databasePromise.then(db => db.close()).catch(() => undefined);
    this.databasePromise = null;
  }
}
