import type { OfflineQuranAudioLibrary as LibraryType, OfflineAudioFile } from './offlineQuranAudioLibrary';

export type OfflineAudioCacheIdentity = Pick<OfflineAudioFile, 'reciterId' | 'globalAyahNumber' | 'cacheGenerationId'>;

export interface OfflineAudioCacheAdapterOptions {
  cacheStorage?: Pick<CacheStorage, 'open'>;
  cacheName?: string;
  origin?: string;
  maxFileBytes?: number;
}

const DEFAULT_CACHE_NAME = 'wird-offline-quran-audio-v1';
const DEFAULT_MAX_FILE_BYTES = 8 * 1024 * 1024;

function validateIdentity(identity: OfflineAudioCacheIdentity): void {
  if (!identity || typeof identity.reciterId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(identity.reciterId) ||
      !Number.isSafeInteger(identity.globalAyahNumber) || identity.globalAyahNumber < 1 || identity.globalAyahNumber > 6236 ||
      typeof identity.cacheGenerationId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(identity.cacheGenerationId)) {
    throw new Error('هوية ملف التلاوة أو جيل التخزين المؤقت غير صالحة.');
  }
}

/** Synthetic, same-origin key; the upstream audio URL is stored only in verified metadata. */
export function buildOfflineAudioCacheKey(identity: OfflineAudioCacheIdentity, origin: string): Request {
  validateIdentity(identity);
  let base: URL;
  try { base = new URL(origin); }
  catch { throw new Error('عنوان أصل التخزين المؤقت غير صالح.'); }
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') {
    throw new Error('يجب أن يكون أصل التخزين المؤقت HTTPS.');
  }
  const key = new URL(
    '/__wird_offline_audio__/v1/' +
      encodeURIComponent(identity.reciterId) + '/' +
      String(identity.globalAyahNumber) + '/' +
      encodeURIComponent(identity.cacheGenerationId),
    base
  );
  return new Request(key.toString(), { method: 'GET' });
}

function validateAudioResponse(response: Response, maxFileBytes: number): Promise<ArrayBuffer> {
  if (!(response instanceof Response) || response.status !== 200 || response.type === 'opaque') {
    throw new Error('مصدر التلاوة لم يُرجع استجابة صوتية مكتملة وآمنة.');
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
  if (!contentType.startsWith('audio/')) {
    throw new Error('استجابة مصدر التلاوة ليست ملفًا صوتيًا؛ لم تُحفظ.');
  }
  return response.clone().arrayBuffer().then(bytes => {
    const length = bytes.byteLength;
    const declaredLength = response.headers.get('content-length');
    if (length <= 0 || length > maxFileBytes ||
        (declaredLength !== null && Number(declaredLength) !== length)) {
      throw new Error('حجم ملف التلاوة فارغ أو غير متطابق أو يتجاوز الحد الآمن.');
    }
    return bytes;
  });
}

function equalBytes(left: ArrayBuffer, right: ArrayBuffer): boolean {
  if (left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
  return true;
}

/**
 * Cache Storage adapter only. It never marks IndexedDB metadata verified by itself;
 * callers must commit metadata after storeVerifiedResponse resolves successfully.
 */
export class OfflineQuranAudioCacheAdapter {
  private readonly cacheStorage: Pick<CacheStorage, 'open'>;
  private readonly cacheName: string;
  private readonly origin: string;
  private readonly maxFileBytes: number;
  private cachePromise: Promise<Cache> | null = null;

  constructor(options: OfflineAudioCacheAdapterOptions = {}) {
    const cacheStorage = options.cacheStorage ?? globalThis.caches;
    if (!cacheStorage) throw new Error('Cache Storage غير مدعوم في هذا المتصفح.');
    this.cacheStorage = cacheStorage;
    this.cacheName = options.cacheName || DEFAULT_CACHE_NAME;
    this.origin = options.origin || (typeof location !== 'undefined' ? location.origin : 'https://wird.invalid');
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    if (!Number.isSafeInteger(this.maxFileBytes) || this.maxFileBytes < 1) {
      throw new RangeError('حد حجم ملف التلاوة غير صالح.');
    }
  }

  private openCache(): Promise<Cache> {
    if (!this.cachePromise) {
      this.cachePromise = this.cacheStorage.open(this.cacheName).catch(error => {
        this.cachePromise = null;
        throw error instanceof Error ? error : new Error('تعذر فتح مخزن التلاوات المحلي.');
      });
    }
    return this.cachePromise;
  }

  async storeVerifiedResponse(identity: OfflineAudioCacheIdentity, response: Response): Promise<number> {
    const key = buildOfflineAudioCacheKey(identity, this.origin);
    const bytes = await validateAudioResponse(response, this.maxFileBytes);
    const cache = await this.openCache();
    try {
      const headers = new Headers(response.headers);
      headers.set('content-length', String(bytes.byteLength));
      await cache.put(key, new Response(bytes.slice(0), {
        status: 200,
        statusText: 'OK',
        headers
      }));
      const readback = await cache.match(key);
      if (!readback || readback.status !== 200) throw new Error('لم يمكن قراءة ملف التلاوة بعد حفظه.');
      const storedBytes = await readback.arrayBuffer();
      if (!equalBytes(bytes, storedBytes)) throw new Error('فشل التحقق من تطابق الملف الصوتي بعد الحفظ.');
      return bytes.byteLength;
    } catch (error) {
      try { await cache.delete(key); } catch { /* orphan cleanup is retried during reconciliation */ }
      throw error instanceof Error ? error : new Error('تعذر حفظ ملف التلاوة والتحقق منه.');
    }
  }

  async getVerifiedResponse(identity: OfflineAudioCacheIdentity): Promise<Response | null> {
    const key = buildOfflineAudioCacheKey(identity, this.origin);
    const cache = await this.openCache();
    const response = await cache.match(key);
    if (!response) return null;
    try {
      await validateAudioResponse(response, this.maxFileBytes);
      return response;
    } catch {
      return null;
    }
  }

  async hasVerifiedFile(identity: OfflineAudioCacheIdentity): Promise<boolean> {
    return (await this.getVerifiedResponse(identity)) !== null;
  }

  /** Delete exactly one cache generation; stale cleanup cannot remove a replacement generation. */
  async deleteGeneration(identity: OfflineAudioCacheIdentity): Promise<boolean> {
    const key = buildOfflineAudioCacheKey(identity, this.origin);
    const cache = await this.openCache();
    return cache.delete(key);
  }

  async reconcileLibrary(library: LibraryType): Promise<OfflineAudioFile[]> {
    return library.reconcileCachedFiles(file => this.hasVerifiedFile(file));
  }

  close(): void {
    this.cachePromise = null;
  }
}
