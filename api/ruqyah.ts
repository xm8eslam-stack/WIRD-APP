const API_BASE = 'https://islamicapi.com/api/v1/ruqyah/';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const MAX_RATE_LIMIT_BUCKETS = 1000;
const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TOPIC_BLOCK_TYPES = new Set(['text', 'arabic', 'translation', 'header', 'transliteration']);
const rateLimits = new Map<string, { count: number; resetAt: number }>();

const ALLOWED_TYPES = new Set(['instant-category', 'instant']);
const ALLOWED_PROGRAMS = new Set(['brief-ruqya', 'a-medium-ruqya', 'a-long-ruqya']);
// Only use the external API as an index for Quran references. Hadith/dua text
// from third-party payloads is not trusted or rendered in WIRD.
const ALLOWED_SOURCES = new Set(['from-quran']);
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

function isAllowedType(type: string): boolean {
  if (ALLOWED_TYPES.has(type)) return true;
  // Educational topic content remains disabled until its Shariah/medical
  // references are reviewed for WIRD. Enable only through a server-side flag.
  return process.env.RUQYAH_TOPICS_ENABLED === 'true' &&
    (type === 'topic-category' || type === 'topic');
}

function getClientIp(req: any): string {
  // On Vercel, x-real-ip is set by the trusted edge. Do not trust the
  // client-controlled leftmost x-forwarded-for value for rate-limit identity.
  const realIp = req.headers?.['x-real-ip'];
  const candidate = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  const remoteAddress = req.socket?.remoteAddress;
  return typeof remoteAddress === 'string' && remoteAddress.trim() ? remoteAddress.trim() : 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimits.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [key, record] of rateLimits.entries()) {
      if (now >= record.resetAt) rateLimits.delete(key);
    }
    while (rateLimits.size > MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = rateLimits.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      rateLimits.delete(oldestKey);
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
  const rawRows: unknown[] = Array.isArray(rawData) ? rawData : [rawData];
  if (rawRows.length === 0 || rawRows.length > 500) return false;
  const rows = rawRows.filter(isRecord);
  if (rows.length !== rawRows.length) return false;

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
      typeof part.type !== 'string' || !ALLOWED_TOPIC_BLOCK_TYPES.has(part.type) ||
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

async function readBoundedUpstreamText(response: Response): Promise<string | null> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    try { reader.releaseLock(); } catch { /* stream already cancelled or closed */ }
  }
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
  if (!isAllowedType(type)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });

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
    const declaredLengthHeader = upstream.headers.get('content-length');
    const declaredLength = declaredLengthHeader === null ? null : Number(declaredLengthHeader);
    if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_RESPONSE_BYTES) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }
    const raw = await readBoundedUpstreamText(upstream);
    if (raw === null) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }
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
