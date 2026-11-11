import { ALL_SURAHS } from '../data/quranMeta';
import { buildQuranAyahAudioUrl } from './ruqyahAudioService';

export interface OfflineQuranAudioManifestInput {
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  url: string;
  byteLength?: number | null;
  savedAtMs: number;
  verified: true;
}

export interface OfflineQuranAudioManifestEntry extends OfflineQuranAudioManifestInput {
  schemaVersion: 1;
  key: string;
  byteLength: number | null;
}

interface Options { indexedDBFactory?: IDBFactory; databaseName?: string; }
const DB_VERSION = 1;
const DEFAULT_DB = 'wird-offline-quran-audio-v1';
const STORE = 'verifiedAudioFiles';

function normalizeStorageError(error: unknown, fallback: string): Error {
  if (error && typeof error === 'object' && 'name' in error &&
      (error as { name?: string }).name === 'QuotaExceededError') {
    return new Error('مساحة التخزين المحلية لا تكفي لحفظ سجل التلاوة؛ لم نؤكد حفظًا جزئيًا.');
  }
  return error instanceof Error ? error : new Error(fallback);
}

function getFactory(explicit?: IDBFactory): IDBFactory {
  if (explicit) return explicit;
  if (typeof indexedDB !== 'undefined') return indexedDB;
  throw new Error('التخزين المحلي للتلاوات غير متاح في هذا المتصفح.');
}

function canonicalGlobalAyah(surahNumber: number, ayahNumber: number): number {
  if (!Number.isSafeInteger(surahNumber) || surahNumber < 1 || surahNumber > ALL_SURAHS.length) {
    throw new Error('رقم السورة في سجل التلاوات غير صالح.');
  }
  const surah = ALL_SURAHS[surahNumber - 1];
  if (!surah || surah.number !== surahNumber ||
      !Number.isSafeInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surah.versesCount) {
    throw new Error('رقم الآية في سجل التلاوات غير صالح.');
  }
  return ALL_SURAHS.slice(0, surahNumber - 1).reduce((sum, item) => sum + item.versesCount, 0) + ayahNumber;
}

function normalize(input: OfflineQuranAudioManifestInput): OfflineQuranAudioManifestEntry {
  if (!input || typeof input !== 'object' || input.verified !== true) {
    throw new Error('لا يمكن تسجيل ملف صوتي قبل التحقق من اكتماله.');
  }
  const global = canonicalGlobalAyah(input.surahNumber, input.ayahNumber);
  if (input.globalAyahNumber !== global) throw new Error('إحداثيات الآية لا تطابق فهرس القرآن المحلي المعتمد.');
  const expectedUrl = buildQuranAyahAudioUrl(input.reciterId, global);
  if (input.url !== expectedUrl) throw new Error('رابط ملف التلاوة لا يطابق مصدر القارئ المعتمد.');
  const byteLength = input.byteLength ?? null;
  if (byteLength !== null && (!Number.isSafeInteger(byteLength) || byteLength <= 0)) {
    throw new Error('حجم ملف التلاوة المسجل غير صالح.');
  }
  if (!Number.isSafeInteger(input.savedAtMs) || input.savedAtMs < 0) throw new Error('تاريخ حفظ ملف التلاوة غير صالح.');
  return {
    schemaVersion: 1,
    key: input.reciterId + ':' + String(global),
    reciterId: input.reciterId,
    surahNumber: input.surahNumber,
    ayahNumber: input.ayahNumber,
    globalAyahNumber: global,
    url: expectedUrl,
    byteLength,
    savedAtMs: input.savedAtMs,
    verified: true
  };
}

function normalizeStored(value: unknown): OfflineQuranAudioManifestEntry {
  if (!value || typeof value !== 'object') throw new Error('سجل تنزيل صوتي تالف؛ لم نستخدمه.');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.reciterId !== 'string' ||
      typeof record.url !== 'string' || typeof record.surahNumber !== 'number' ||
      typeof record.ayahNumber !== 'number' || typeof record.globalAyahNumber !== 'number' ||
      typeof record.savedAtMs !== 'number' || record.verified !== true ||
      (record.byteLength !== null && typeof record.byteLength !== 'number')) {
    throw new Error('سجل تنزيل صوتي لا يطابق مخطط التخزين المعتمد؛ لم نستخدمه.');
  }
  const entry = normalize({
    reciterId: record.reciterId, surahNumber: record.surahNumber, ayahNumber: record.ayahNumber,
    globalAyahNumber: record.globalAyahNumber, url: record.url,
    byteLength: record.byteLength as number | null, savedAtMs: record.savedAtMs, verified: true
  });
  if (record.key !== entry.key) throw new Error('مفتاح سجل التلاوة لا يطابق إحداثياته.');
  return entry;
}

/** Metadata-only device-local manifest. Audio bytes live in a separate Cache Storage namespace. */
export class OfflineQuranAudioManifestStore {
  private readonly factory: IDBFactory;
  private readonly databaseName: string;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: Options = {}) {
    this.factory = getFactory(options.indexedDBFactory);
    this.databaseName = options.databaseName || DEFAULT_DB;
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      let wasBlocked = false;
      try { request = this.factory.open(this.databaseName, DB_VERSION); }
      catch (error) { reject(normalizeStorageError(error, 'تعذر فتح سجل تنزيلات التلاوة.')); return; }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        if (wasBlocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); this.databasePromise = null; };
        resolve(db);
      };
      request.onerror = () => reject(normalizeStorageError(request.error, 'تعذر فتح سجل تنزيلات التلاوة.'));
      request.onblocked = () => {
        wasBlocked = true;
        reject(new Error('أغلق نسخة وِرد الأخرى التي تستخدم سجل التنزيلات ثم أعد المحاولة.'));
      };
    }).catch(error => { this.databasePromise = null; throw error; });
    return this.databasePromise;
  }

  async putVerified(input: OfflineQuranAudioManifestInput): Promise<OfflineQuranAudioManifestEntry> {
    const entry = normalize(input);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction([STORE], 'readwrite'); tx.objectStore(STORE).put(entry); }
      catch (error) { reject(normalizeStorageError(error, 'تعذر حفظ سجل ملف التلاوة.')); return; }
      tx.oncomplete = () => resolve(entry);
      tx.onabort = () => reject(normalizeStorageError(tx.error, 'أُلغيت معاملة سجل تنزيلات التلاوة بالكامل.'));
      tx.onerror = () => { /* onabort is authoritative */ };
    });
  }

  async listVerified(): Promise<OfflineQuranAudioManifestEntry[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE], 'readonly');
      const request = tx.objectStore(STORE).getAll();
      let values: unknown[] = [];
      request.onsuccess = () => { values = request.result as unknown[]; };
      request.onerror = () => reject(request.error || new Error('تعذر قراءة سجل تنزيلات التلاوة.'));
      tx.oncomplete = () => {
        try {
          resolve(values.map(normalizeStored).sort((a, b) =>
            a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber || a.reciterId.localeCompare(b.reciterId)
          ));
        } catch (error) { reject(error instanceof Error ? error : new Error('تعذر التحقق من سجل تنزيلات التلاوة.')); }
      };
      tx.onabort = () => reject(tx.error || new Error('أُلغيت قراءة سجل تنزيلات التلاوة.'));
    });
  }

  async removeManifestEntry(reciterId: string, globalAyahNumber: number): Promise<void> {
    buildQuranAyahAudioUrl(reciterId, globalAyahNumber);
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).delete(reciterId + ':' + String(globalAyahNumber));
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(normalizeStorageError(tx.error, 'تعذر حذف سجل ملف التلاوة.'));
      tx.onerror = () => { /* onabort is authoritative */ };
    });
  }

  async close(): Promise<void> {
    const pending = this.databasePromise;
    this.databasePromise = null;
    if (!pending) return;
    try { (await pending).close(); } catch { /* no live connection after a failed open */ }
  }
}
