import { ALL_SURAHS } from '../data/quranMeta';

export interface TafsirResult {
  text: string;
  source: 'cache' | 'network';
  bookName: string;
  bookId?: number;
  author?: string;
}

export interface TafsirBookOption {
  id: number;
  name: string;
  author: string;
  slug: string;
}

export const TAFSIR_EDITIONS: TafsirBookOption[] = [
  { id: 16, name: 'التفسير الميسر', author: 'مجمع الملك فهد لطباعة المصحف الشريف', slug: 'ar-tafsir-muyassar' },
  { id: 91, name: 'تفسير السعدي', author: 'تيسير الكريم الرحمن في تفسير كلام المنان', slug: 'ar-tafseer-al-saddi' },
  { id: 14, name: 'تفسير ابن كثير', author: 'عمدة التفسير عن الحافظ ابن كثير', slug: 'ar-tafsir-ibn-kathir' },
  { id: 94, name: 'تفسير البغوي', author: 'معالم التنزيل للإمام البغوي', slug: 'ar-tafsir-al-baghawi' },
  { id: 90, name: 'تفسير القرطبي', author: 'الجامع لأحكام القرآن', slug: 'ar-tafseer-al-qurtubi' }
];

const API_BASE = '/api/tafsir';
const LEGACY_TAFSIR_BOOK_ID = 27809;
const CACHE_PREFIX = 'wird_tafsir_muyassar_v1_';
const MULTI_BOOK_CACHE_PREFIX = 'wird_tafsir_edition_v2_';
const MAX_CACHED_TAFSIRS = 150;
const memoryCache = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function buildTafsirCacheKey(surahNumber: number, ayahNumber: number, bookId?: number): string {
  if (bookId && bookId !== LEGACY_TAFSIR_BOOK_ID && bookId !== 16) {
    return `${MULTI_BOOK_CACHE_PREFIX}b${bookId}_s${surahNumber}_a${ayahNumber}`;
  }
  return CACHE_PREFIX + 's' + surahNumber + '_a' + ayahNumber;
}

function readCachedTafsir(key: string): string | null {
  const memoryValue = memoryCache.get(key);
  if (memoryValue) return memoryValue;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored && stored.trim()) {
        memoryCache.set(key, stored);
        return stored;
      }
    }
  } catch { /* Storage may be unavailable or full; network lookup can still proceed. */ }
  return null;
}

function writeCachedTafsir(key: string, text: string): void {
  memoryCache.set(key, text);
  try {
    if (typeof localStorage === 'undefined') return;
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const candidate = localStorage.key(index);
      if (candidate && (candidate.startsWith(CACHE_PREFIX) || candidate.startsWith(MULTI_BOOK_CACHE_PREFIX))) {
        keys.push(candidate);
      }
    }
    if (!keys.includes(key) && keys.length >= MAX_CACHED_TAFSIRS) {
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(key, text);
  } catch { /* Keep the in-memory result even if persistent cache quota is exhausted. */ }
}

async function fetchDirectUpstreamTafsir(
  surahNumber: number,
  ayahNumber: number,
  bookId: number,
  signal?: AbortSignal
): Promise<string> {
  const isQuranpedia = bookId === LEGACY_TAFSIR_BOOK_ID;
  const directUrl = isQuranpedia
    ? `https://api.quranpedia.net/v1/ayah/${surahNumber}/${ayahNumber}/book/${bookId}`
    : `https://api.quran.com/api/v4/tafsirs/${bookId}/by_ayah/${surahNumber}:${ayahNumber}`;

  const res = await fetch(directUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal
  });

  if (!res.ok) {
    throw new Error(`Direct upstream returned HTTP ${res.status}`);
  }

  const rawText = await res.text();
  if (rawText.trim().startsWith('<')) {
    throw new Error('Upstream returned HTML instead of JSON');
  }

  const data = JSON.parse(rawText);

  if (isQuranpedia) {
    if (data?.content && Array.isArray(data.content)) {
      const text = data.content
        .map((part: any) => typeof part?.text === 'string' ? part.text.trim() : '')
        .filter((part: string) => part.length > 0)
        .join('\n\n');
      if (text) return text;
    }
  } else {
    if (data?.tafsir?.text && typeof data.tafsir.text === 'string' && data.tafsir.text.trim()) {
      return data.tafsir.text.trim();
    }
  }

  throw new Error('No valid tafsir text in direct upstream response');
}

/**
 * Universal Tafsir fetcher supporting multiple editions with resilient direct client fallback
 */
export async function getTafsir(
  surahNumber: number,
  ayahNumber: number,
  bookId: number = 16,
  signal?: AbortSignal
): Promise<TafsirResult> {
  const surahMeta = ALL_SURAHS.find(surah => surah.number === surahNumber);
  if (!surahMeta || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surahMeta.versesCount) {
    throw new Error('إحداثيات الآية غير صالحة.');
  }

  const key = buildTafsirCacheKey(surahNumber, ayahNumber, bookId);
  const cached = readCachedTafsir(key);
  const editionInfo = TAFSIR_EDITIONS.find(b => b.id === bookId) || {
    id: bookId,
    name: bookId === LEGACY_TAFSIR_BOOK_ID ? 'التفسير الميسر' : 'تفسير القرآن',
    author: 'أهل السنة والجماعة',
    slug: 'tafsir'
  };

  if (cached) {
    return {
      text: cached,
      source: 'cache',
      bookName: editionInfo.name,
      bookId: editionInfo.id,
      author: editionInfo.author
    };
  }

  const url = `${API_BASE}?surah=${surahNumber}&ayah=${ayahNumber}&book=${bookId}`;
  let response: Response | null = null;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
  }

  if (response) {
    let responseText = '';
    try {
      responseText = await response.text();
    } catch {
      throw new Error('تعذر قراءة استجابة خادم التفسير.');
    }

    const trimmedResponse = responseText.trim();
    const contentType = response.headers.get('content-type') || '';

    if (trimmedResponse.startsWith('<') || /text\/html/i.test(contentType)) {
      try {
        const directText = await fetchDirectUpstreamTafsir(surahNumber, ayahNumber, bookId, signal);
        writeCachedTafsir(key, directText);
        return {
          text: directText,
          source: 'network',
          bookName: editionInfo.name,
          bookId: editionInfo.id,
          author: editionInfo.author
        };
      } catch {
        throw new Error(
          'خدمة التفسير أعادت صفحة HTML بدل بيانات JSON؛ غالباً مسار API غير متاح في النشر الحالي. لم يتم عرض محتوى بديل.'
        );
      }
    }

    if (!response.ok) {
      try {
        const directText = await fetchDirectUpstreamTafsir(surahNumber, ayahNumber, bookId, signal);
        writeCachedTafsir(key, directText);
        return {
          text: directText,
          source: 'network',
          bookName: editionInfo.name,
          bookId: editionInfo.id,
          author: editionInfo.author
        };
      } catch {
        throw new Error('تعذر جلب التفسير (HTTP ' + response.status + ').');
      }
    }

    if (!/\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(contentType)) {
      throw new Error('استجابة خادم التفسير ليست بصيغة JSON صالحة؛ لم يتم عرض محتوى بديل.');
    }

    let payload: unknown;
    try {
      payload = trimmedResponse ? JSON.parse(trimmedResponse) as unknown : null;
    } catch {
      throw new Error('تعذر قراءة بيانات التفسير؛ أعاد الخادم JSON غير صالح.');
    }

    const payloadRecord = isRecord(payload) ? payload : null;
    const bookRecord = payloadRecord && isRecord(payloadRecord.book) ? payloadRecord.book : null;
    const contentParts: unknown[] = payloadRecord && Array.isArray(payloadRecord.content)
      ? payloadRecord.content
      : [];
    const responseBookId = bookRecord?.id;
    const validBook = responseBookId === bookId ||
      (bookId === LEGACY_TAFSIR_BOOK_ID && (responseBookId === LEGACY_TAFSIR_BOOK_ID || responseBookId === 16)) ||
      (bookId === 16 && (responseBookId === 16 || responseBookId === LEGACY_TAFSIR_BOOK_ID));

    if (!validBook || !Array.isArray(payloadRecord?.content)) {
      throw new Error('استجابة مصدر التفسير غير مطابقة للبنية المتوقعة.');
    }

    const tafsirText = contentParts
      .map(part => isRecord(part) && typeof part.text === 'string' ? part.text.trim() : '')
      .filter(part => part.length > 0)
      .join('\n\n');

    if (!tafsirText) throw new Error('لا يتوفر نص تفسير لهذه الآية في المصدر الحالي.');

    writeCachedTafsir(key, tafsirText);
    return {
      text: tafsirText,
      source: 'network',
      bookName: typeof bookRecord?.name === 'string' ? bookRecord.name : editionInfo.name,
      bookId: typeof responseBookId === 'number' ? responseBookId : editionInfo.id,
      author: typeof bookRecord?.author === 'string' ? bookRecord.author : editionInfo.author
    };
  }

  // Network error on /api/tafsir -> Try direct client fallback
  try {
    const directText = await fetchDirectUpstreamTafsir(surahNumber, ayahNumber, bookId, signal);
    writeCachedTafsir(key, directText);
    return {
      text: directText,
      source: 'network',
      bookName: editionInfo.name,
      bookId: editionInfo.id,
      author: editionInfo.author
    };
  } catch {
    throw new Error('تعذر الاتصال بخادم التفسير. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  }
}

/**
 * Backward-compatible helper for Tafsir Muyassar
 */
export async function getTafsirMuyassar(
  surahNumber: number,
  ayahNumber: number,
  signal?: AbortSignal
): Promise<TafsirResult> {
  return getTafsir(surahNumber, ayahNumber, LEGACY_TAFSIR_BOOK_ID, signal);
}