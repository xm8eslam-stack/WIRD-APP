const RECITERS_URL = 'https://alfurqan.online/api/v1/reciters';
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

function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimits.size > 1000) {
    for (const [key, record] of rateLimits.entries()) if (now >= record.resetAt) rateLimits.delete(key);
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

  const type = String(Array.isArray(req.query?.type) ? req.query.type[0] : req.query?.type || '');
  if (type !== 'reciters') return send(res, 400, { error: 'INVALID_AUDIO_CATALOG_QUERY' });

  if (isRateLimited(getClientIp(req))) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, { error: 'RATE_LIMITED' });
  }

  try {
    const upstream = await fetch(RECITERS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000)
    });
    const contentType = upstream.headers.get('content-type') || '';
    const raw = await upstream.text();
    if (!upstream.ok || !/application\/(?:[a-z0-9.+-]*\+)?json/i.test(contentType) || raw.trim().startsWith('<')) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'QURAN_AUDIO_SOURCE_UNAVAILABLE' });
    }

    let payload: unknown;
    try { payload = JSON.parse(raw) as unknown; } catch { payload = null; }
    const rows = isRecord(payload) && Array.isArray(payload.reciters) ? payload.reciters : null;
    if (!rows || rows.length < 1 || rows.length > 100 ||
        rows.some(row => !isRecord(row) ||
          typeof row.id !== 'string' || !/^[a-z0-9-]{2,80}$/.test(row.id) ||
          typeof row.name !== 'string' || !row.name.trim() ||
          typeof row.arabicName !== 'string' || !row.arabicName.trim())) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_QURAN_AUDIO_SOURCE_RESPONSE' });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return send(res, 200, {
      source: 'Al Furqan Quran API',
      reciters: rows.map(row => ({
        id: (row as Record<string, unknown>).id,
        name: (row as Record<string, unknown>).name,
        arabicName: (row as Record<string, unknown>).arabicName
      }))
    });
  } catch (error: any) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, {
      error: 'QURAN_AUDIO_SOURCE_ERROR',
      message: error?.name === 'TimeoutError' ? 'SOURCE_TIMEOUT' : 'SOURCE_ERROR'
    });
  }
}
