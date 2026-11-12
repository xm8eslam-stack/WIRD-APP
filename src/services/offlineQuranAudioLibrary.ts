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
  url: string;
  byteLength: number | null;
  downloadedAtMs: number;
  verified: true;
  available: boolean;
  pinned: boolean;
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
      typeof job.requestFingerprint !== 'string' || !job.requestFingerprint ||
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
    url: input.url,
    byteLength: input.byteLength,
    downloadedAtMs: input.downloadedAtMs,
    verified: true,
    available: true,
    pinned: false
  };
}

function validateStoredFile(value: unknown): OfflineAudioFile {
  if (!value || typeof value !== 'object') throw new Error('سجل ملف صوتي تالف؛ لم نستخدمه.');
  const record = value as OfflineAudioFile;
  const normalized = normalizeFile(record);
  if (record.key !== normalized.key || typeof record.available !== 'boolean' || typeof record.pinned !== 'boolean') {
    throw new Error('سجل الملف الصوتي لا يطابق المخطط المعتمد.');
  }
  return { ...normalized, pinned: record.pinned };
}

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
        verified = validateStoredFile(stored).available;
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
    jobs.add(job);
    relations.forEach(item => items.add(item));
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
    store.put(job);
    await transactionResult(transaction);
    return job;
  }

  async markItemDownloading(jobId: string, globalAyahNumber: number, nowMs = Date.now()): Promise<void> {
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
    items.put(item);
    jobs.put(job);
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
      normalized.pinned = current.pinned;
      normalized.available = true;
    }
    files.put(normalized);
    relation.status = 'verified';
    relation.updatedAtMs = Math.max(input.downloadedAtMs, job.createdAtMs);
    items.put(relation);

    const relatedItems = await requestResult(items.index('fileKey').getAll(normalized.key)) as OfflineAudioJobItem[];
    const affectedJobIds = [...new Set(relatedItems.map(item => item.jobId))];
    for (const affectedId of affectedJobIds) {
      const affectedJob = await requestResult(jobs.get(affectedId)) as OfflineAudioJob | undefined;
      if (!affectedJob || isTerminal(affectedJob.status)) continue;
      const allItems = await requestResult(items.index('jobId').getAll(affectedId)) as OfflineAudioJobItem[];
      affectedJob.completedAyahs = allItems.filter(item => item.status === 'verified').length;
      affectedJob.status = affectedJob.completedAyahs === affectedJob.totalAyahs
        ? 'completed'
        : affectedJob.completedAyahs > 0 ? 'partial' : 'downloading';
      affectedJob.updatedAtMs = Math.max(affectedJob.updatedAtMs, relation.updatedAtMs);
      jobs.put(affectedJob);
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
    relations.forEach(item => items.delete(item.key));
    jobs.delete(jobId);
    const orphanedFiles: OfflineAudioFile[] = [];
    for (const relation of relations) {
      const remaining = await requestResult(items.index('fileKey').getAll(relation.fileKey)) as OfflineAudioJobItem[];
      if (remaining.length > 0) continue;
      const stored = await requestResult(files.get(relation.fileKey));
      if (!stored) continue;
      const file = validateStoredFile(stored);
      if (file.pinned) continue;
      files.delete(file.key);
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
    file.pinned = pinned;
    if (pinned) {
      files.put(file);
      await transactionResult(transaction);
      return { orphanedFiles: [] };
    }
    const references = await requestResult(items.index('fileKey').getAll(key)) as OfflineAudioJobItem[];
    if (references.length > 0) files.put(file);
    else {
      files.delete(key);
      await transactionResult(transaction);
      return { orphanedFiles: [file] };
    }
    await transactionResult(transaction);
    return { orphanedFiles: [] };
  }

  /**
   * Reconcile IndexedDB metadata with Cache Storage before treating files as available.
   * A missing cache object removes only its metadata record; historical job records remain.
   * The caller owns the cache namespace and supplies the exact cache-presence check.
   */
  async reconcileCachedFiles(hasCachedFile: (file: OfflineAudioFile) => Promise<boolean>): Promise<OfflineAudioFile[]> {
    const files = await this.listFiles();
    const checks = await Promise.all(files.map(async file => ({
      file,
      present: await hasCachedFile(file)
    })));
    const missing = checks.filter(item => !item.present).map(item => item.file);
    if (missing.length === 0) return [];
    const db = await this.openDatabase();
    const transaction = db.transaction([FILES], 'readwrite');
    const store = transaction.objectStore(FILES);
    for (const snapshot of missing) {
      const current = await requestResult(store.get(snapshot.key));
      if (!current) continue;
      const file = validateStoredFile(current);
      if (file.downloadedAtMs === snapshot.downloadedAtMs && file.available) {
        file.available = false;
        store.put(file);
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
