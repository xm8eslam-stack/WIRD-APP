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

/**
 * Universal Tafsir fetcher supporting multiple editions from Quran.com API v4
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
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal
  });
  const responseText = await response.text();
  const trimmedResponse = responseText.trim();
  const contentType = response.headers.get('content-type') || '';

  // Vercel's SPA fallback and upstream gateways can return an HTML document
  // for a missing/failed API route. Never pass that document to JSON.parse().
  if (trimmedResponse.startsWith('<') || contentType.toLowerCase().includes('text/html')) {
    throw new Error(
      'خدمة التفسير لم تُرجع بيانات التفسير؛ وصلتنا صفحة HTML بدل استجابة JSON. غالباً مسار API غير متاح في النشر الحالي. أعد المحاولة لاحقاً.'
    );
  }

  let payload: any;
  try {
    payload = trimmedResponse ? JSON.parse(trimmedResponse) : null;
  } catch {
    throw new Error('تعذر قراءة استجابة خدمة التفسير؛ البيانات المستلمة ليست JSON صالحاً.');
  }

  if (!response.ok) {
    const serverMessage = typeof payload?.error === 'string' ? payload.error : '';
    throw new Error(
      serverMessage
        ? 'تعذر جلب التفسير (' + serverMessage + ', HTTP ' + response.status + ').'
        : 'تعذر جلب التفسير (HTTP ' + response.status + ').'
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('استجابة خدمة التفسير فارغة أو غير صالحة.');
  }
  const validBook = payload?.book?.id === bookId ||
    (bookId === LEGACY_TAFSIR_BOOK_ID && (payload?.book?.id === LEGACY_TAFSIR_BOOK_ID || payload?.book?.id === 16)) ||
    (bookId === 16 && (payload?.book?.id === 16 || payload?.book?.id === LEGACY_TAFSIR_BOOK_ID));

  if (!validBook || !Array.isArray(payload.content)) {
    throw new Error('استجابة مصدر التفسير غير مطابقة للبنية المتوقعة.');
  }

  const tafsirText = payload.content
    .map((part: any) => typeof part?.text === 'string' ? part.text.trim() : '')
    .filter((part: string) => part.length > 0)
    .join('\n\n');
  if (!tafsirText) throw new Error('لا يتوفر نص تفسير لهذه الآية في المصدر الحالي.');

  writeCachedTafsir(key, tafsirText);
  return {
    text: tafsirText,
    source: 'network',
    bookName: payload?.book?.name || editionInfo.name,
    bookId: payload?.book?.id || editionInfo.id,
    author: payload?.book?.author || editionInfo.author
  };
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