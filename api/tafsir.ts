const TAFSIR_BOOK_ID = 27809;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function send(res: any, statusCode: number, payload: unknown) {
  return res.status(statusCode).json(payload);
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
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > 286) {
    return send(res, 400, { error: 'INVALID_QURAN_COORDINATES' });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, { error: 'RATE_LIMITED' });
  }

  try {
    const url = 'https://api.quranpedia.net/v1/ayah/' + surahNumber + '/' + ayahNumber + '/book/' + TAFSIR_BOOK_ID;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000)
    });
    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'TAFSIR_SOURCE_UNAVAILABLE' });
    }

    const payload: any = await upstream.json();
    if (payload?.book?.id !== TAFSIR_BOOK_ID || !Array.isArray(payload.content) || payload.content.length > 50) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_TAFSIR_SOURCE_RESPONSE' });
    }

    const content = payload.content
      .filter((part: any) => typeof part?.text === 'string' && part.text.trim().length > 0)
      .map((part: any) => ({
        text: part.text.slice(0, 20_000),
        part: Number.isInteger(part.part) ? part.part : undefined,
        page: Number.isInteger(part.page) ? part.page : undefined,
        ayahs: typeof part.ayahs === 'string' ? part.ayahs.slice(0, 100) : undefined
      }));
    if (content.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 404, { error: 'TAFSIR_NOT_FOUND' });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return send(res, 200, {
      book: { id: TAFSIR_BOOK_ID, name: 'التفسير الميسر' },
      content
    });
  } catch (error: any) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, { error: 'TAFSIR_SOURCE_ERROR', message: error?.name === 'TimeoutError' ? 'SOURCE_TIMEOUT' : 'SOURCE_ERROR' });
  }
}