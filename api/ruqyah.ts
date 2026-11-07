const API_BASE = 'https://islamicapi.com/api/v1/ruqyah/';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

const ALLOWED_TYPES = new Set(['instant-category', 'instant', 'topic-category', 'topic']);
const ALLOWED_PROGRAMS = new Set(['brief-ruqya', 'a-medium-ruqya', 'a-long-ruqya']);
const ALLOWED_SOURCES = new Set(['from-quran', 'from-sunnah']);
const ALLOWED_TOPICS = new Set([
  'introduction-to-ruqyah',
  'protect-yourself-from-jinn',
  'black-magic-sihr',
  'evil-eye-and-envy',
  'about-raqi',
  'types-of-hijamah-bloodletting',
  'ruqyah-materials',
  '7-day-detoxification-program',
  'waswasah-whisperings',
  'the-ruqyah-bath-against-sihr',
  'other-diseases',
  'treatment-for-general-problems',
  'full-ruqyah-program'
]);

function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readQueryValue(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' ? candidate.trim() : '';
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

function validPayload(type: string, payload: unknown): boolean {
  if (!isRecord(payload) || payload.status !== 'success' || !('data' in payload)) return false;
  const rawData = payload.data;
  const isCategory = type === 'instant-category' || type === 'topic-category';
  if (isCategory && !Array.isArray(rawData)) return false;
  const rows = Array.isArray(rawData) ? rawData : [rawData];
  if (rows.length === 0 || rows.length > 500 || rows.some(row => !isRecord(row))) return false;

  if (type === 'instant' && rows.some(row =>
    !Number.isInteger(row.id) ||
    typeof row.title !== 'string' || !row.title.trim() ||
    typeof row.arabic !== 'string' || !row.arabic.trim()
  )) return false;

  if (type === 'topic' && rows.some(row =>
    typeof row.title !== 'string' || !row.title.trim() ||
    !Array.isArray(row.content) ||
    row.content.length > 500 ||
    row.content.some(part => !isRecord(part) ||
      typeof part.type !== 'string' ||
      typeof part.content !== 'string')
  )) return false;

  if (isCategory && rows.some(row =>
    typeof row.title !== 'string' || !row.title.trim() ||
    !Array.isArray(row.subcategories) || row.subcategories.length > 10 ||
    row.subcategories.some(subcategory => !isRecord(subcategory) ||
      typeof subcategory.subcategory !== 'string' ||
      typeof subcategory['subcategory-slug'] !== 'string' ||
      !Array.isArray(subcategory.ruqyah) || subcategory.ruqyah.length > 300 ||
      subcategory.ruqyah.some(entry => !isRecord(entry) ||
        (typeof entry.id !== 'string' && typeof entry.id !== 'number') ||
        typeof entry.title !== 'string' || !entry.title.trim())
    )
  )) return false;

  return true;
}

function parseUpstreamJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('<')) return null;
  try { return JSON.parse(trimmed) as unknown; } catch { return null; }
}

/**
 * Server-side proxy for IslamicAPI Ruqyah. The API key is never sent to the
 * browser. Only the Arabic corpus is exposed; callers cannot choose arbitrary
 * upstream hosts, languages, or query parameters.
 */
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
  const type = readQueryValue(query.type);
  if (!ALLOWED_TYPES.has(type)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });

  const params = new URLSearchParams({ type, lang: 'ar' });
  if (type === 'instant') {
    const program = readQueryValue(query.program);
    const source = readQueryValue(query.source);
    if (!ALLOWED_PROGRAMS.has(program) || !ALLOWED_SOURCES.has(source)) {
      return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    }
    params.set('program', program);
    params.set('source', source);
    const id = readQueryValue(query.id);
    if (id) {
      if (!/^[1-9]\d{0,4}$/.test(id)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
      params.set('id', id);
    }
    const random = readQueryValue(query.random);
    if (random && random !== 'true' && random !== 'false') {
      return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    }
    if (random) params.set('random', random);
  } else if (type === 'topic') {
    const topic = readQueryValue(query.topic);
    if (!ALLOWED_TOPICS.has(topic)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    params.set('topic', topic);
    const id = readQueryValue(query.id);
    if (id) {
      if (!/^[1-9]\d{0,4}$/.test(id)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
      params.set('id', id);
    }
  }

  const apiKey = process.env.ISLAMICAPI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 503, { error: 'RUQYAH_API_KEY_NOT_CONFIGURED' });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, { error: 'RATE_LIMITED' });
  }

  params.set('api_key', apiKey.trim());
  try {
    const upstream = await fetch(API_BASE + '?' + params.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000)
    });
    const contentType = upstream.headers.get('content-type') || '';
    const raw = await upstream.text();
    const payload = /application\/(?:[a-z0-9.+-]*\+)?json/i.test(contentType)
      ? parseUpstreamJson(raw)
      : null;

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, upstream.status === 401 ? 502 : 502, {
        error: upstream.status === 401 ? 'RUQYAH_API_KEY_REJECTED' : 'RUQYAH_SOURCE_UNAVAILABLE'
      });
    }
    if (!validPayload(type, payload)) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return send(res, 200, {
      status: 'success',
      data: (payload as Record<string, unknown>).data,
      source: 'IslamicAPI',
      language: 'ar',
      type
    });
  } catch (error: any) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, {
      error: 'RUQYAH_SOURCE_ERROR',
      message: error?.name === 'TimeoutError' ? 'SOURCE_TIMEOUT' : 'SOURCE_ERROR'
    });
  }
}
