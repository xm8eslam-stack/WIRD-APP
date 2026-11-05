export interface TafsirResult {
  text: string;
  source: 'cache' | 'network';
  bookName: string;
}

const API_BASE = '/api/tafsir';
const TAFSIR_BOOK_ID = 27809;
const CACHE_PREFIX = 'wird_tafsir_muyassar_v1_';
const MAX_CACHED_TAFSIRS = 100;
const memoryCache = new Map<string, string>();

export function buildTafsirCacheKey(surahNumber: number, ayahNumber: number): string {
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
      if (candidate && candidate.startsWith(CACHE_PREFIX)) keys.push(candidate);
    }
    if (!keys.includes(key) && keys.length >= MAX_CACHED_TAFSIRS) {
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(key, text);
  } catch { /* Keep the in-memory result even if persistent cache quota is exhausted. */ }
}

export async function getTafsirMuyassar(
  surahNumber: number,
  ayahNumber: number,
  signal?: AbortSignal
): Promise<TafsirResult> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 || !Number.isInteger(ayahNumber) || ayahNumber < 1) {
    throw new Error('إحداثيات الآية غير صالحة.');
  }

  const key = buildTafsirCacheKey(surahNumber, ayahNumber);
  const cached = readCachedTafsir(key);
  if (cached) return { text: cached, source: 'cache', bookName: 'التفسير الميسر' };

  const url = API_BASE + '?surah=' + surahNumber + '&ayah=' + ayahNumber;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal
  });
  if (!response.ok) throw new Error('تعذر جلب التفسير (HTTP ' + response.status + ').');

  const payload: any = await response.json();
  if (payload?.book?.id !== TAFSIR_BOOK_ID || !Array.isArray(payload.content)) {
    throw new Error('استجابة مصدر التفسير غير مطابقة للبنية المتوقعة.');
  }

  const tafsirText = payload.content
    .map((part: any) => typeof part?.text === 'string' ? part.text.trim() : '')
    .filter((part: string) => part.length > 0)
    .join('\n\n');
  if (!tafsirText) throw new Error('لا يتوفر نص تفسير لهذه الآية في المصدر الحالي.');

  writeCachedTafsir(key, tafsirText);
  return { text: tafsirText, source: 'network', bookName: 'التفسير الميسر' };
}