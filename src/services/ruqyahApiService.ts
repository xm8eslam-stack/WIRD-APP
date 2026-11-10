import { getRuqyahDisplayText } from './ruqyahContentService';
import { ALL_SURAHS } from '../data/quranMeta';
import type { RuqyahItem } from '../data/ruqyahData';

export type RuqyahApiProgram = 'brief-ruqya' | 'a-medium-ruqya' | 'a-long-ruqya';
export type RuqyahApiSource = 'from-quran';

const MAX_EXTERNAL_INDEX_ID = 999_999_999;
const RUQYAH_INDEX_CACHE_PREFIX = 'wird.ruqyah.index-cache.v1:';
const RUQYAH_INDEX_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface CachedRuqyahApiIndex {
  entries: RuqyahApiEntry[];
  savedAt: string;
}

export interface RuqyahApiEntry {
  id: number | string;
  /** Sanitized numeric locator only, e.g. "2:255-257"; never provider-authored prose. */
  title: string;
}

export interface ResolvedRuqyahApiQuranEntry {
  id: number | string;
  surahNumber: number;
  surahName: string;
  startAyah: number;
  endAyah: number;
  text: string;
}

export interface RuqyahApiRequest {
  type: 'instant';
  program: RuqyahApiProgram;
  source: RuqyahApiSource;
  id?: number;
  random?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Fetch sanitized Quran locator data through WIRD's server proxy; never expose upstream secrets. */
export async function fetchRuqyahApiData<T = unknown>(
  request: RuqyahApiRequest,
  signal?: AbortSignal
): Promise<T> {
  const params = new URLSearchParams({ type: request.type, lang: 'ar' });
  if (request.program) params.set('program', request.program);
  if (request.source) params.set('source', request.source);
  if (request.id !== undefined) params.set('id', String(request.id));
  if (request.random !== undefined) params.set('random', String(request.random));

  let response: Response;
  try {
    response = await fetch('/api/ruqyah?' + params.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new Error('تعذر الاتصال بمصدر الرقية. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  }

  let raw: string;
  try { raw = await response.text(); }
  catch { throw new Error('تعذر قراءة استجابة مصدر الرقية.'); }

  const contentType = response.headers.get('content-type') || '';
  if (raw.trim().startsWith('<') || /text\/html/i.test(contentType)) {
    throw new Error('أعاد خادم الرقية صفحة HTML بدل بيانات JSON؛ لم يتم عرض محتوى غير موثوق.');
  }
  if (!response.ok) {
    const payload = (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : '';
    if (response.status === 503 && code === 'RUQYAH_API_KEY_NOT_CONFIGURED') {
      throw new Error('مصدر الرقية الخارجي يحتاج إلى ضبط مفتاح API في إعدادات الخادم.');
    }
    if (code === 'RUQYAH_API_KEY_REJECTED') {
      throw new Error('رفض مصدر الرقية مفتاح API. تحقق من قيمة ISLAMICAPI_API_KEY في إعدادات Vercel ثم أعد النشر.');
    }
    if (code === 'RUQYAH_SOURCE_RATE_LIMITED' || response.status === 429) {
      throw new Error('بلغ مصدر الرقية حد الطلبات مؤقتًا. انتظر قليلاً ثم أعد المحاولة.');
    }
    if (code === 'RUQYAH_SOURCE_UNAVAILABLE') {
      throw new Error('مصدر الرقية الخارجي غير متاح مؤقتًا (HTTP ' + response.status + '). يمكنك إعادة المحاولة أو استخدام آخر فهرس محفوظ.');
    }
    if (code === 'INVALID_RUQYAH_SOURCE_RESPONSE') {
      throw new Error('أعاد مصدر الرقية استجابة غير صالحة؛ لم يتم عرض أي محتوى منها.');
    }
    if (code === 'RUQYAH_SOURCE_ERROR' && isRecord(payload) && payload.message === 'SOURCE_TIMEOUT') {
      throw new Error('انتهت مهلة الاتصال بمصدر الرقية الخارجي. أعد المحاولة بعد قليل.');
    }
    throw new Error('تعذر جلب محتوى الرقية من المصدر الخارجي (HTTP ' + response.status + ').');
  }
  if (!/application\/(?:[a-z0-9.+-]*\+)?json/i.test(contentType)) {
    throw new Error('استجابة مصدر الرقية ليست بصيغة JSON صالحة.');
  }

  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; }
  catch { throw new Error('أعاد مصدر الرقية بيانات JSON غير صالحة.'); }
  if (!isRecord(payload) || payload.status !== 'success' || !('data' in payload)) {
    throw new Error('استجابة مصدر الرقية لا تطابق البنية المتوقعة.');
  }
  return payload.data as T;
}


/**
 * The proxy sends only a normalized numeric locator. Resolve every locator
 * against WIRD's canonical Mushaf metadata and verified Quran text.
 */
interface ValidatedApiQuranLocator {
  id: number | string;
  surahNumber: number;
  surahName: string;
  startAyah: number;
  endAyah: number;
}

function resolveApiQuranLocator(entry: RuqyahApiEntry): ValidatedApiQuranLocator {
  const validId = typeof entry?.id === 'number'
    ? Number.isSafeInteger(entry.id) && entry.id > 0 && entry.id <= MAX_EXTERNAL_INDEX_ID
    : typeof entry?.id === 'string' && /^[1-9][0-9]{0,8}$/.test(entry.id);
  if (!entry || !validId || typeof entry.title !== 'string') {
    throw new Error('لا يحتوي فهرس الآيات على موضع صالح.');
  }
  const digitMap = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
  const normalized = entry.title.replace(/[٠-٩۰-۹]/g, digit => {
    const index = digitMap.indexOf(digit);
    return String(index % 10);
  });
  const match = normalized.trim().match(/^([0-9]{1,3}) *: *([0-9]{1,3})(?: *[-–—] *([0-9]{1,3}))? *$/);
  if (!match) throw new Error('مرجع الآيات في الفهرس الخارجي غير صالح.');
  const surahNumber = Number(match[1]);
  const startAyah = Number(match[2]);
  const endAyah = match[3] === undefined ? startAyah : Number(match[3]);
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  if (!surah || !Number.isSafeInteger(startAyah) || !Number.isSafeInteger(endAyah) ||
      startAyah < 1 || endAyah < startAyah || endAyah > surah.versesCount) {
    throw new Error('موضع الآيات في الفهرس الخارجي خارج حدود المصحف المعتمد.');
  }
  return { id: entry.id, surahNumber, surahName: surah.name, startAyah, endAyah };
}

/** Store only validated numeric Quran coordinates; no provider-authored text is cached. */
export function writeRuqyahApiIndexCache(
  program: RuqyahApiProgram,
  entries: RuqyahApiEntry[],
  storage: Pick<Storage, 'setItem'> = localStorage,
  now = new Date()
): boolean {
  try {
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 300) return false;
    const sanitized = entries.map(entry => {
      const locator = resolveApiQuranLocator(entry);
      return {
        id: locator.id,
        title: locator.surahNumber + ':' + locator.startAyah + '-' + locator.endAyah
      };
    });
    storage.setItem(RUQYAH_INDEX_CACHE_PREFIX + program, JSON.stringify({
      savedAt: now.toISOString(),
      entries: sanitized
    }));
    return true;
  } catch {
    return false;
  }
}

/** Read a recent, schema-checked locator cache for offline/stale-source fallback. */
export function readRuqyahApiIndexCache(
  program: RuqyahApiProgram,
  storage: Pick<Storage, 'getItem'> = localStorage,
  now = new Date()
): CachedRuqyahApiIndex | null {
  try {
    const raw = storage.getItem(RUQYAH_INDEX_CACHE_PREFIX + program);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.savedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.savedAt)) || !Array.isArray(value.entries) ||
        value.entries.length === 0 || value.entries.length > 300) return null;
    const age = now.getTime() - Date.parse(value.savedAt);
    if (age < 0 || age > RUQYAH_INDEX_CACHE_TTL_MS) return null;
    const entries = value.entries.map(item => {
      if (!isRecord(item)) throw new Error('Invalid cached locator');
      const entry = { id: item.id as number | string, title: item.title as string };
      const locator = resolveApiQuranLocator(entry);
      return {
        id: locator.id,
        title: locator.surahNumber + ':' + locator.startAyah + '-' + locator.endAyah
      };
    });
    return { entries, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

/**
 * The proxy sends only a normalized numeric locator. Resolve it against
 * WIRD's canonical Mushaf metadata and verified Quran text.
 */
export function resolveApiQuranEntry(entry: RuqyahApiEntry): ResolvedRuqyahApiQuranEntry {
  const locator = resolveApiQuranLocator(entry);
  const item: RuqyahItem = {
    id: 'external-ruqyah-' + String(locator.id),
    categories: ['brief'],
    type: 'quran',
    title: 'موضع قرآني من الفهرس',
    surahNumber: locator.surahNumber,
    surahName: locator.surahName,
    verseRange: locator.startAyah === locator.endAyah
      ? String(locator.startAyah)
      : locator.startAyah + '-' + locator.endAyah,
    text: '',
    repeatTarget: null,
    source: 'WIRD canonical Quran corpus'
  };
  return { ...locator, text: getRuqyahDisplayText(item) };
}

/** Match only canonical WIRD surah metadata and verse coordinates, never provider-authored titles. */
export function matchesApiQuranEntry(entry: RuqyahApiEntry, query: string): boolean {
  const digitMap = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
  const normalizedQuery = query.trim().replace(/[٠-٩۰-۹]/g, digit => {
    const index = digitMap.indexOf(digit);
    return String(index % 10);
  }).toLocaleLowerCase();
  if (!normalizedQuery) return true;

  try {
    const locator = resolveApiQuranLocator(entry);
    const canonicalIndex = [
      locator.surahName,
      locator.surahName + ' ' + locator.surahNumber + ':' + locator.startAyah + '-' + locator.endAyah,
      String(locator.surahNumber),
      String(locator.startAyah),
      String(locator.endAyah),
      locator.surahNumber + ':' + locator.startAyah,
      locator.surahNumber + ':' + locator.startAyah + '-' + locator.endAyah,
      locator.surahNumber + ' ' + locator.startAyah + ' ' + locator.endAyah
    ].join(' ').toLocaleLowerCase();
    return canonicalIndex.includes(normalizedQuery);
  } catch {
    return false;
  }
}

export function resolveApiQuranEntryText(entry: RuqyahApiEntry): string {
  return resolveApiQuranEntry(entry).text;
}
