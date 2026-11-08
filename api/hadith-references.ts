import { ALL_SURAHS } from '../src/data/quranMeta.ts';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
let cachedToken: { value: string; expiresAt: number } | null = null;
let pendingToken: Promise<string> | null = null;
type HadithItem = { name: string; collection: string; hadithNumber: string; body: string; grades: Array<{ graded_by: string; grade: string }>; authenticityBasis: 'explicit_grade' | 'sahih_collection'; bookNumber?: string; chapterId?: string; chapterNumber?: string; chapterTitle?: string; referenceUrn?: number; urn?: number };

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

function safeUrn(value: unknown): number | null {
  if (Number.isSafeInteger(value) && Number(value) > 0) return Number(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function readGrades(part: any): Array<{ graded_by: string; grade: string }> {
  if (!record(part) || !Array.isArray(part.grades)) return [];
  return part.grades
    .filter((grade: any) => record(grade) && typeof grade.graded_by === 'string' && grade.graded_by.trim() && typeof grade.grade === 'string' && grade.grade.trim())
    .map((grade: any) => ({ graded_by: grade.graded_by.trim().slice(0, 160), grade: grade.grade.trim().slice(0, 80) }));
}

function extractSahihHadiths(payload: unknown, gradingPayload?: unknown, referencesPayload?: unknown): HadithItem[] | null {
  if (!record(payload) || !Array.isArray(payload.hadiths) || payload.hadiths.length > 5 || typeof payload.has_more !== 'boolean') return null;

  // Quran Foundation uses language-specific text URNs. Join Arabic and English
  // grade records through the official by-ayah reference pair, not by hadith number.
  const englishGradesByTextUrn = new Map<number, Array<{ graded_by: string; grade: string }>>();
  const englishGradesByReferenceUrn = new Map<number, Array<{ graded_by: string; grade: string }>>();
  const gradingRecords = record(gradingPayload) && Array.isArray(gradingPayload.hadiths) ? gradingPayload.hadiths : [];
  for (const item of gradingRecords) {
    if (!record(item) || !Array.isArray(item.hadith)) continue;
    const english = item.hadith.find((part: any) => record(part) && part.lang === 'en');
    const grades = readGrades(english);
    if (!grades.length) continue;
    const textUrn = safeUrn(english?.urn);
    const referenceUrn = safeUrn(item.urn);
    if (textUrn !== null) englishGradesByTextUrn.set(textUrn, grades);
    if (referenceUrn !== null) englishGradesByReferenceUrn.set(referenceUrn, grades);
  }

  const englishUrnByArabicUrn = new Map<number, number>();
  const referenceRecords = record(referencesPayload) && Array.isArray(referencesPayload.hadith_references) ? referencesPayload.hadith_references : [];
  for (const reference of referenceRecords) {
    if (!record(reference)) continue;
    const arabicUrn = safeUrn(reference.arabic_urn);
    const englishUrn = safeUrn(reference.english_urn);
    if (arabicUrn !== null && englishUrn !== null) englishUrnByArabicUrn.set(arabicUrn, englishUrn);
  }

  const out: HadithItem[] = [];
  for (const item of payload.hadiths) {
    if (!record(item) || typeof item.name !== 'string' || !item.name.trim() || typeof item.collection !== 'string' || !item.collection.trim() || typeof item.hadithNumber !== 'string' || !item.hadithNumber.trim() || !Array.isArray(item.hadith)) return null;
    const arabic = item.hadith.find((part: any) => record(part) && part.lang === 'ar');
    if (!arabic || typeof arabic.body !== 'string' || arabic.body.trim().length === 0 || arabic.body.length > 25_000) continue;

    const arabicGrades = readGrades(arabic);
    const englishTextUrn = safeUrn(arabic.urn);
    const mappedEnglishUrn = englishTextUrn === null ? null : englishUrnByArabicUrn.get(englishTextUrn) ?? null;
    const englishGrades = mappedEnglishUrn !== null
      ? (englishGradesByTextUrn.get(mappedEnglishUrn) || [])
      : (safeUrn(item.urn) !== null ? (englishGradesByReferenceUrn.get(safeUrn(item.urn)!) || []) : []);
    const gradeMap = new Map<string, { graded_by: string; grade: string }>();
    for (const grade of [...arabicGrades, ...englishGrades]) gradeMap.set(`${grade.graded_by.toLocaleLowerCase()}|${grade.grade.toLocaleLowerCase()}`, grade);
    const grades = [...gradeMap.values()];
    const hasExplicitSahihGrade = grades.some(grade => /^(sahih|صحيح)$/i.test(grade.grade.trim()));
    const isSahihCollection = item.collection === 'bukhari' || item.collection === 'muslim';
    if (!hasExplicitSahihGrade && !isSahihCollection) continue;

    const referenceUrn = safeUrn(item.urn);
    const arabicTextUrn = safeUrn(arabic.urn);
    out.push({
      name: item.name.trim().slice(0, 120),
      collection: item.collection.trim().slice(0, 80),
      hadithNumber: item.hadithNumber.trim().slice(0, 50),
      body: arabic.body,
      grades: hasExplicitSahihGrade ? grades : [],
      authenticityBasis: hasExplicitSahihGrade ? 'explicit_grade' : 'sahih_collection',
      ...(typeof item.bookNumber === 'string' && item.bookNumber.trim() ? { bookNumber: item.bookNumber.trim().slice(0, 40) } : {}),
      ...(typeof item.chapterId === 'string' && item.chapterId.trim() ? { chapterId: item.chapterId.trim().slice(0, 40) } : {}),
      ...(typeof arabic.chapterNumber === 'string' && arabic.chapterNumber.trim() ? { chapterNumber: arabic.chapterNumber.trim().slice(0, 40) } : {}),
      ...(typeof arabic.chapterTitle === 'string' && arabic.chapterTitle.trim() ? { chapterTitle: arabic.chapterTitle.trim().slice(0, 240) } : {}),
      ...(referenceUrn !== null ? { referenceUrn } : {}),
      ...(arabicTextUrn !== null ? { urn: arabicTextUrn } : {})
    });
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
    const upstreamGet = async (path: string) => {
      const makeRequest = () => fetcher(`${apiBase()}${path}`, {
        headers: { Accept: 'application/json', 'x-auth-token': token, 'x-client-id': clientId },
        signal: AbortSignal.timeout(10_000)
      });
      let response = await makeRequest();
      if (response.status === 401) {
        cachedToken = null;
        token = await getToken(fetcher);
        response = await makeRequest();
      }
      return response;
    };

    const key = `${surahNumber}:${ayahNumber}`;
    const [referencesResponse, arabicResponse, gradingResponse] = await Promise.all([
      upstreamGet(`/content/api/v4/hadith_references/by_ayah/${key}?language=ar`),
      upstreamGet(`/content/api/v4/hadith_references/by_ayah/${key}/hadiths?language=ar&page=${requestedPage}&limit=5`),
      upstreamGet(`/content/api/v4/hadith_references/by_ayah/${key}/hadiths?language=en&page=${requestedPage}&limit=5`)
    ]);
    if (!arabicResponse.ok) return send(res, arabicResponse.status === 429 ? 429 : 502, { error: arabicResponse.status === 429 ? 'SOURCE_RATE_LIMITED' : 'HADITH_SOURCE_UNAVAILABLE' });

    const [referencesPayload, payload, gradingPayload] = await Promise.all([
      referencesResponse.ok ? parseLimitedJson(referencesResponse) : Promise.resolve(null),
      parseLimitedJson(arabicResponse),
      gradingResponse.ok ? parseLimitedJson(gradingResponse) : Promise.resolve(null)
    ]);
    const hadiths = extractSahihHadiths(payload, gradingPayload, referencesPayload);
    if (!hadiths) return send(res, 502, { error: 'INVALID_HADITH_SOURCE_RESPONSE' });
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return send(res, 200, { verseKey: key, source: 'Quran Foundation Hadith References', hadiths, page: requestedPage, hasMore: Boolean((payload as Record<string, unknown>).has_more) });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, { error: error instanceof Error && error.message === 'CONFIGURATION_MISSING' ? 'HADITH_REFERENCES_NOT_CONFIGURED' : 'HADITH_SOURCE_ERROR' });
  }
}

export const __testing = { extractSahihHadiths, parseLimitedJson, clearTokenCache: () => { cachedToken = null; pendingToken = null; } };
