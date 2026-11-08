import { ALL_SURAHS } from '../src/data/quranMeta.ts';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
let cachedToken: { value: string; expiresAt: number } | null = null;
let pendingToken: Promise<string> | null = null;
type HadithItem = { name: string; collection: string; hadithNumber: string; body: string; grades: Array<{ graded_by: string; grade: string }> };

function send(res: any, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}
function record(value: unknown): value is Record<string, any> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
async function parseLimitedJson(response: Response, maxBytes = 200_000): Promise<unknown | null> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) { await response.body?.cancel(); return null; }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const joined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(joined)) as unknown;
  } catch { return null; }
}
function getClientIp(req: any): string { return String(req.ip || req.socket?.remoteAddress || 'unknown'); }
function isLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, entry] of rateLimits) if (now >= entry.resetAt) rateLimits.delete(key);
  const entry = rateLimits.get(ip);
  if (!entry || now >= entry.resetAt) { rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }); return false; }
  entry.count += 1; return entry.count > RATE_LIMIT_MAX;
}
function getEnvironment() { return process.env.QF_ENV === 'prelive' ? 'prelive' : 'production'; }
function apiBase() { return getEnvironment() === 'prelive' ? 'https://apis-prelive.quran.foundation' : 'https://apis.quran.foundation'; }
function oauthBase() { return getEnvironment() === 'prelive' ? 'https://prelive-oauth2.quran.foundation' : 'https://oauth2.quran.foundation'; }

async function getToken(fetcher: typeof fetch): Promise<string> {
  const clientId = process.env.QF_CLIENT_ID;
  const clientSecret = process.env.QF_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('CONFIGURATION_MISSING');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const response = await fetcher(`${oauthBase()}/oauth2/token`, {
      method: 'POST', headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: process.env.QF_CONTENT_SCOPE || 'content.hadith.read' }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('AUTH_UNAVAILABLE');
    const data: unknown = await response.json();
    if (!record(data) || typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in)) throw new Error('INVALID_AUTH_RESPONSE');
    cachedToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in)) * 1000 };
    return cachedToken.value;
  })().finally(() => { pendingToken = null; });
  return pendingToken;
}

function extractSahihHadiths(payload: unknown): HadithItem[] | null {
  if (!record(payload) || !Array.isArray(payload.hadiths) || payload.hadiths.length > 5 || typeof payload.has_more !== 'boolean') return null;
  const out: HadithItem[] = [];
  for (const item of payload.hadiths) {
    if (!record(item) || typeof item.name !== 'string' || typeof item.collection !== 'string' || typeof item.hadithNumber !== 'string' || !Array.isArray(item.hadith)) return null;
    const arabic = item.hadith.find((part: any) => record(part) && part.lang === 'ar');
    if (!arabic || typeof arabic.body !== 'string' || arabic.body.trim().length === 0 || arabic.body.length > 25_000 || !Array.isArray(arabic.grades)) continue;
    const grades: HadithItem['grades'] = arabic.grades.filter((grade: any) => record(grade) && typeof grade.graded_by === 'string' && typeof grade.grade === 'string')
      .map((grade: any) => ({ graded_by: grade.graded_by.slice(0, 160), grade: grade.grade.slice(0, 80) }));
    const hasExplicitSahihGrade = grades.some(grade => /^(sahih|صحيح)$/i.test(grade.grade.trim()));
    if (hasExplicitSahihGrade) out.push({ name: item.name.slice(0, 120), collection: item.collection.slice(0, 80), hadithNumber: item.hadithNumber.slice(0, 50), body: arabic.body, grades });
  }
  return out;
}

export default async function handler(req: any, res: any, deps: { fetch?: typeof fetch } = {}) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
  const query = req.query || {};
  const surahNumber = Number(Array.isArray(query.surah) ? query.surah[0] : query.surah);
  const ayahNumber = Number(Array.isArray(query.ayah) ? query.ayah[0] : query.ayah);
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : (query.page ?? 1));
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  if (!surah || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surah.versesCount || !Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 100) return send(res, 400, { error: 'INVALID_QURAN_COORDINATES' });
  if (isLimited(getClientIp(req))) { res.setHeader('Retry-After', '60'); return send(res, 429, { error: 'RATE_LIMITED' }); }
  const fetcher = deps.fetch || fetch;
  try {
    const clientId = process.env.QF_CLIENT_ID;
    if (!clientId || !process.env.QF_CLIENT_SECRET) return send(res, 503, { error: 'HADITH_REFERENCES_NOT_CONFIGURED' });
    let token = await getToken(fetcher);
    const request = () => fetcher(`${apiBase()}/content/api/v4/hadith_references/by_ayah/${surahNumber}:${ayahNumber}/hadiths?language=ar&page=${requestedPage}&limit=5`, {
      headers: { Accept: 'application/json', 'x-auth-token': token, 'x-client-id': clientId }, signal: AbortSignal.timeout(10_000)
    });
    let upstream = await request();
    if (upstream.status === 401) { cachedToken = null; token = await getToken(fetcher); upstream = await request(); }
    if (!upstream.ok) return send(res, upstream.status === 429 ? 429 : 502, { error: upstream.status === 429 ? 'SOURCE_RATE_LIMITED' : 'HADITH_SOURCE_UNAVAILABLE' });
    const payload: unknown = await parseLimitedJson(upstream);
    const hadiths = extractSahihHadiths(payload);
    if (!hadiths) return send(res, 502, { error: 'INVALID_HADITH_SOURCE_RESPONSE' });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return send(res, 200, { verseKey: `${surahNumber}:${ayahNumber}`, source: 'Quran Foundation Hadith References', hadiths, page: requestedPage, hasMore: Boolean((payload as Record<string, unknown>).has_more) });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, { error: error instanceof Error && error.message === 'CONFIGURATION_MISSING' ? 'HADITH_REFERENCES_NOT_CONFIGURED' : 'HADITH_SOURCE_ERROR' });
  }
}

export const __testing = { extractSahihHadiths, parseLimitedJson, clearTokenCache: () => { cachedToken = null; pendingToken = null; } };
