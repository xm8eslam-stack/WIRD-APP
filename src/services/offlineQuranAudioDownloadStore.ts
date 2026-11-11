import { buildQuranAudioDownloadPlan, type QuranAudioDownloadRange } from './offlineQuranAudioDownload';
import { createSecureId } from './secureId';

const DATABASE_NAME = 'wird-offline-quran-audio';
const DATABASE_VERSION = 1;
const JOBS_STORE = 'jobs';
const ITEMS_STORE = 'items';

export type OfflineQuranAudioJobStatus = 'queued' | 'downloading' | 'partial' | 'completed' | 'failed' | 'cancelled';

export interface OfflineQuranAudioJob extends QuranAudioDownloadRange {
  id: string;
  schemaVersion: 1;
  status: OfflineQuranAudioJobStatus;
  totalAyahs: number;
  completedAyahs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface OfflineQuranAudioItem {
  key: string;
  jobId: string;
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  url: string;
  byteLength: number | null;
  downloadedAtMs: number;
  verified: true;
}

export interface OfflineQuranAudioDownloadStoreOptions {
  indexedDBFactory?: IDBFactory;
  databaseName?: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذر قراءة فهرس التلاوات المحفوظة.'));
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('تم إلغاء تحديث فهرس التلاوات المحفوظة.'));
    transaction.onerror = () => reject(transaction.error || new Error('تعذر تحديث فهرس التلاوات المحفوظة.'));
  });
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function isValidStatus(value: unknown): value is OfflineQuranAudioJobStatus {
  return value === 'queued' || value === 'downloading' || value === 'partial' ||
    value === 'completed' || value === 'failed' || value === 'cancelled';
}

function validateJob(job: OfflineQuranAudioJob): void {
  if (!job || job.schemaVersion !== 1 || !isValidId(job.id) || !isValidStatus(job.status)) {
    throw new Error('بيانات تنزيل التلاوة المحفوظة غير صالحة.');
  }
  const plan = buildQuranAudioDownloadPlan(job);
  if (job.totalAyahs !== plan.totalAyahs ||
      !Number.isSafeInteger(job.completedAyahs) || job.completedAyahs < 0 ||
      job.completedAyahs > job.totalAyahs ||
      !Number.isSafeInteger(job.createdAtMs) || job.createdAtMs < 0 ||
      !Number.isSafeInteger(job.updatedAtMs) || job.updatedAtMs < job.createdAtMs ||
      (job.status === 'completed' && job.completedAyahs !== job.totalAyahs)) {
    throw new Error('حالة تنزيل التلاوة المحفوظة لا تطابق نطاقها.');
  }
}

export class OfflineQuranAudioDownloadStore {
  private readonly factory: IDBFactory;
  private readonly databaseName: string;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: OfflineQuranAudioDownloadStoreOptions = {}) {
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
        if (!db.objectStoreNames.contains(JOBS_STORE)) {
          const jobs = db.createObjectStore(JOBS_STORE, { keyPath: 'id' });
          jobs.createIndex('updatedAtMs', 'updatedAtMs', { unique: false });
        }
        if (!db.objectStoreNames.contains(ITEMS_STORE)) {
          const items = db.createObjectStore(ITEMS_STORE, { keyPath: 'key' });
          items.createIndex('jobId', 'jobId', { unique: false });
          items.createIndex('globalAyahNumber', 'globalAyahNumber', { unique: false });
        }
      };
      let wasBlocked = false;
      request.onsuccess = () => {
        const db = request.result;
        if (wasBlocked) { db.close(); return; }
        db.onversionchange = () => {
          db.close();
          this.databasePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        this.databasePromise = null;
        reject(request.error || new Error('تعذر فتح فهرس تنزيلات التلاوة.'));
      };
      request.onblocked = () => {
        wasBlocked = true;
        this.databasePromise = null;
        reject(new Error('فهرس تنزيلات التلاوة مشغول في نافذة أخرى؛ أغلق النوافذ القديمة ثم أعد المحاولة.'));
      };
    });
    return this.databasePromise;
  }

  async createJob(range: QuranAudioDownloadRange, nowMs = Date.now()): Promise<OfflineQuranAudioJob> {
    const plan = buildQuranAudioDownloadPlan(range);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('وقت إنشاء التنزيل غير صالح.');
    const job: OfflineQuranAudioJob = {
      ...range,
      id: createSecureId(),
      schemaVersion: 1,
      status: 'queued',
      totalAyahs: plan.totalAyahs,
      completedAyahs: 0,
      createdAtMs: nowMs,
      updatedAtMs: nowMs
    };
    await this.saveJob(job);
    return job;
  }

  private async saveJob(job: OfflineQuranAudioJob): Promise<void> {
    validateJob(job);
    const db = await this.openDatabase();
    const transaction = db.transaction(JOBS_STORE, 'readwrite');
    transaction.objectStore(JOBS_STORE).put({ ...job });
    await transactionResult(transaction);
  }

  async getJob(jobId: string): Promise<OfflineQuranAudioJob | null> {
    if (!isValidId(jobId)) throw new Error('معرّف تنزيل التلاوة غير صالح.');
    const db = await this.openDatabase();
    const transaction = db.transaction(JOBS_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(JOBS_STORE).get(jobId)) as OfflineQuranAudioJob | undefined;
    await transactionResult(transaction);
    if (!result) return null;
    validateJob(result);
    return result;
  }

  async setJobStatus(jobId: string, status: OfflineQuranAudioJobStatus, nowMs = Date.now()): Promise<OfflineQuranAudioJob> {
    if (!isValidId(jobId) || !isValidStatus(status) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error('تحديث حالة تنزيل التلاوة غير صالح.');
    }
    const db = await this.openDatabase();
    const transaction = db.transaction(JOBS_STORE, 'readwrite');
    const store = transaction.objectStore(JOBS_STORE);
    const job = await requestResult(store.get(jobId)) as OfflineQuranAudioJob | undefined;
    if (!job) {
      transaction.abort();
      throw new Error('لم يتم العثور على عملية تنزيل التلاوة.');
    }
    validateJob(job);
    if ((job.status === 'completed' && status !== 'completed') ||
        (status === 'completed' && job.completedAyahs !== job.totalAyahs) ||
        (status === 'partial' && (job.completedAyahs < 1 || job.completedAyahs >= job.totalAyahs)) ||
        (status === 'queued' && job.completedAyahs !== 0) ||
        (status === 'downloading' && job.completedAyahs >= job.totalAyahs)) {
      transaction.abort();
      throw new Error('انتقال حالة تنزيل التلاوة غير مسموح.');
    }
    job.status = status;
    job.updatedAtMs = Math.max(nowMs, job.createdAtMs);
    store.put(job);
    await transactionResult(transaction);
    return job;
  }

  async listJobs(): Promise<OfflineQuranAudioJob[]> {
    const db = await this.openDatabase();
    const transaction = db.transaction(JOBS_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(JOBS_STORE).index('updatedAtMs').getAll()) as OfflineQuranAudioJob[];
    await transactionResult(transaction);
    result.forEach(validateJob);
    return result.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }

  async listItems(jobId: string): Promise<OfflineQuranAudioItem[]> {
    if (!isValidId(jobId)) throw new Error('معرّف تنزيل التلاوة غير صالح.');
    const db = await this.openDatabase();
    const transaction = db.transaction(ITEMS_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(ITEMS_STORE).index('jobId').getAll(jobId)) as OfflineQuranAudioItem[];
    await transactionResult(transaction);
    return result.sort((a, b) => a.globalAyahNumber - b.globalAyahNumber);
  }

  async recordDownloadedAyah(jobId: string, item: Omit<OfflineQuranAudioItem, 'key' | 'jobId'>, nowMs = Date.now()): Promise<OfflineQuranAudioJob> {
    if (!isValidId(jobId) || !Number.isSafeInteger(nowMs) || nowMs < 0 ||
        (item.byteLength !== null && (!Number.isSafeInteger(item.byteLength) || item.byteLength < 1)) ||
        !Number.isSafeInteger(item.downloadedAtMs) || item.downloadedAtMs < 0 ||
        item.verified !== true) {
      throw new Error('بيانات ملف التلاوة الذي تم تنزيله غير صالحة.');
    }
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS_STORE, ITEMS_STORE], 'readwrite');
    const jobs = transaction.objectStore(JOBS_STORE);
    const items = transaction.objectStore(ITEMS_STORE);
    const job = await requestResult(jobs.get(jobId)) as OfflineQuranAudioJob | undefined;
    if (!job) {
      transaction.abort();
      throw new Error('لم يتم العثور على عملية تنزيل التلاوة.');
    }
    validateJob(job);
    const plan = buildQuranAudioDownloadPlan(job);
    const expected = plan.items.find(candidate => candidate.globalAyahNumber === item.globalAyahNumber);
    if (!expected || expected.surahNumber !== item.surahNumber ||
        expected.ayahNumber !== item.ayahNumber || expected.url !== item.url ||
        item.reciterId !== job.reciterId) {
      transaction.abort();
      throw new Error('ملف التلاوة لا يطابق السورة والقارئ ونطاق التنزيل المعتمد.');
    }
    const key = jobId + ':' + item.globalAyahNumber;
    const existing = await requestResult(items.get(key)) as OfflineQuranAudioItem | undefined;
    if (existing) {
      const identical = existing.url === item.url && existing.byteLength === item.byteLength && existing.verified === true;
      if (!identical) {
        transaction.abort();
        throw new Error('يوجد ملف محفوظ مختلف لنفس موضع الآية؛ تم إيقاف تحديث الفهرس.');
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        await transactionResult(transaction);
        return job;
      }
    } else {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        transaction.abort();
        throw new Error('لا يمكن إضافة ملف إلى عملية تنزيل منتهية أو ملغاة.');
      }
      items.add({ ...item, key, jobId });
    }
    const keys = await requestResult(items.index('jobId').getAllKeys(jobId));
    job.completedAyahs = keys.length;
    job.status = keys.length >= job.totalAyahs ? 'completed' : keys.length > 0 ? 'partial' : 'downloading';
    job.updatedAtMs = Math.max(nowMs, job.createdAtMs);
    jobs.put(job);
    await transactionResult(transaction);
    return job;
  }

  async deleteJob(jobId: string): Promise<void> {
    if (!isValidId(jobId)) throw new Error('معرّف تنزيل التلاوة غير صالح.');
    const db = await this.openDatabase();
    const transaction = db.transaction([JOBS_STORE, ITEMS_STORE], 'readwrite');
    const jobs = transaction.objectStore(JOBS_STORE);
    const items = transaction.objectStore(ITEMS_STORE);
    const keys = await requestResult(items.index('jobId').getAllKeys(jobId));
    keys.forEach(key => items.delete(key));
    jobs.delete(jobId);
    await transactionResult(transaction);
  }

  close(): void {
    if (!this.databasePromise) return;
    void this.databasePromise.then(db => db.close()).catch(() => undefined);
    this.databasePromise = null;
  }
}
