import { ALL_SURAHS } from '../src/data/quranMeta';

export interface SupportedTafsirBook {
  id: number;
  name: string;
  slug: string;
  author?: string;
  source: 'qurancom' | 'quranpedia';
}

export const SUPPORTED_TAFSIR_BOOKS: Record<number, SupportedTafsirBook> = {
  16: {
    id: 16,
    name: 'التفسير الميسر',
    slug: 'ar-tafsir-muyassar',
    author: 'مجمع الملك فهد لطباعة المصحف الشريف',
    source: 'qurancom'
  },
  91: {
    id: 91,
    name: 'تفسير السعدي',
    slug: 'ar-tafseer-al-saddi',
    author: 'الشيخ عبد الرحمن بن ناصر السعدي',
    source: 'qurancom'
  },
  14: {
    id: 14,
    name: 'تفسير ابن كثير',
    slug: 'ar-tafsir-ibn-kathir',
    author: 'الحافظ ابن كثير الدمشقي',
    source: 'qurancom'
  },
  94: {
    id: 94,
    name: 'تفسير البغوي',
    slug: 'ar-tafsir-al-baghawi',
    author: 'الإمام البغوي',
    source: 'qurancom'
  },
  90: {
    id: 90,
    name: 'تفسير القرطبي',
    slug: 'ar-tafseer-al-qurtubi',
    author: 'الإمام القرطبي',
    source: 'qurancom'
  },
  27809: {
    id: 27809,
    name: 'التفسير الميسر',
    slug: 'ar-tafsir-muyassar',
    author: 'مجمع الملك فهد',
    source: 'quranpedia'
  }
};

const DEFAULT_BOOK_ID = 27809;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseUpstreamJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('<')) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimits.size > 1000) {
    for (const [key, record] of rateLimits.entries()) {
      if (now >= record.resetAt) rateLimits.delete(key);
    }
  }
  const current = rateLimits.get(ip);
  if (!current || now >= current.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const query = req.query || {};
  const surahNumber = Number(Array.isArray(query.surah) ? query.surah[0] : query.surah);
  const ayahNumber = Number(Array.isArray(query.ayah) ? query.ayah[0] : query.ayah);
  const rawBook = query.book || query.tafsir_id;
  const requestedBookId = Number(Array.isArray(rawBook) ? rawBook[0] : rawBook);

  const bookId = Number.isInteger(requestedBookId) && SUPPORTED_TAFSIR_BOOKS[requestedBookId]
    ? requestedBookId
    : DEFAULT_BOOK_ID;

  const bookMeta = SUPPORTED_TAFSIR_BOOKS[bookId];

  const surahMeta = ALL_SURAHS.find(surah => surah.number === surahNumber);
  if (!surahMeta || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surahMeta.versesCount) {
    return send(res, 400, { error: 'INVALID_QURAN_COORDINATES' });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, { error: 'RATE_LIMITED' });
  }

  try {
    let content: Array<{ text: string; part?: number; page?: number; ayahs?: string }> = [];

    if (bookMeta.source === 'qurancom') {
      // Official Quran.com API v4
      const url = `https://api.quran.com/api/v4/tafsirs/${bookId}/by_ayah/${surahNumber}:${ayahNumber}`;
      const upstream = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000)
      });
      if (!upstream.ok) {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 502, { error: 'TAFSIR_SOURCE_UNAVAILABLE' });
      }

      const payload = parseUpstreamJson(await upstream.text());
      if (!isRecord(payload) || !isRecord(payload.tafsir)) {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 502, { error: 'INVALID_TAFSIR_SOURCE_RESPONSE' });
      }
      const rawText = payload.tafsir.text;
      if (typeof rawText !== 'string' || !rawText.trim()) {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 404, { error: 'TAFSIR_NOT_FOUND' });
      }

      content = [{ text: rawText.slice(0, 50_000) }];
    } else {
      // Quranpedia / Legacy Book ID 27809
      const url = `https://api.quranpedia.net/v1/ayah/${surahNumber}/${ayahNumber}/book/${bookId}`;
      const upstream = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000)
      });
      if (!upstream.ok) {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 502, { error: 'TAFSIR_SOURCE_UNAVAILABLE' });
      }

      const payload = parseUpstreamJson(await upstream.text());
      const bookRecord = isRecord(payload) && isRecord(payload.book) ? payload.book : null;
      const contentParts = isRecord(payload) && Array.isArray(payload.content) ? payload.content : null;
      if (!payload || bookRecord?.id !== bookId || !contentParts || contentParts.length > 50) {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 502, { error: 'INVALID_TAFSIR_SOURCE_RESPONSE' });
      }

      content = contentParts
        .filter((part): part is Record<string, unknown> =>
          isRecord(part) && typeof part.text === 'string' && part.text.trim().length > 0
        )
        .map(part => ({
          text: String(part.text).slice(0, 20_000),
          part: Number.isInteger(part.part) ? Number(part.part) : undefined,
          page: Number.isInteger(part.page) ? Number(part.page) : undefined,
          ayahs: typeof part.ayahs === 'string' ? part.ayahs.slice(0, 100) : undefined
        }));

      if (content.length === 0) {
        res.setHeader('Cache-Control', 'no-store');
        return send(res, 404, { error: 'TAFSIR_NOT_FOUND' });
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return send(res, 200, {
      book: {
        id: bookMeta.id,
        name: bookMeta.name,
        slug: bookMeta.slug,
        author: bookMeta.author
      },
      content,
      verseKey: `${surahNumber}:${ayahNumber}`
    });
  } catch (error: any) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, {
      error: 'TAFSIR_SOURCE_ERROR',
      message: error?.name === 'TimeoutError' ? 'SOURCE_TIMEOUT' : 'SOURCE_ERROR'
    });
  }
}