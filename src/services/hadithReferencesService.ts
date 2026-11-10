export interface RelatedHadith {
  name: string;
  collection: string;
  hadithNumber: string;
  body: string;
  grades: Array<{ graded_by: string; grade: string }>;
  authenticityBasis: 'explicit_grade' | 'sahih_collection';
  bookNumber?: string;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  referenceUrn?: number;
  urn?: number;
}

const CACHE_PREFIX = 'wird_related_hadiths_v1:';
const MAX_CACHED_HADITH_PAGES = 100;
const MAX_CACHED_HADITH_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function validateHadithPayload(payload: unknown, expectedVerseKey: string): { hadiths: RelatedHadith[]; hasMore: boolean } {
  if (!payload || typeof payload !== 'object' || !('verseKey' in payload) || payload.verseKey !== expectedVerseKey ||
      !('hadiths' in payload) || !Array.isArray(payload.hadiths) || payload.hadiths.length > 5 ||
      !('hasMore' in payload) || typeof payload.hasMore !== 'boolean') {
    throw new Error('استجابة مصدر الأحاديث غير صالحة.');
  }
  const hadiths: RelatedHadith[] = [];
  for (const item of payload.hadiths) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim() ||
        typeof item.collection !== 'string' || !item.collection.trim() ||
        typeof item.hadithNumber !== 'string' || !item.hadithNumber.trim() ||
        typeof item.body !== 'string' || !item.body.trim() || item.body.length > 25_000 ||
        !Array.isArray(item.grades) ||
        (item.authenticityBasis !== 'explicit_grade' && item.authenticityBasis !== 'sahih_collection')) {
      throw new Error('استجابة مصدر الأحاديث غير صالحة.');
    }
    const grades = item.grades.filter((grade: any) =>
      grade && typeof grade.graded_by === 'string' && grade.graded_by.trim() &&
      typeof grade.grade === 'string' && grade.grade.trim()
    );
    const hasExplicitSahih = grades.some((grade: any) => /^(sahih|صحيح)$/i.test(grade.grade.trim()));
    const isCanonicalSahihCollection = item.collection === 'bukhari' || item.collection === 'muslim';
    if (item.authenticityBasis === 'explicit_grade' && !hasExplicitSahih) {
      throw new Error('استجابة مصدر الأحاديث لا تتضمن حكمًا صريحًا بالصحة.');
    }
    if (item.authenticityBasis === 'sahih_collection' && (!isCanonicalSahihCollection || grades.length > 0)) {
      throw new Error('أساس التصحيح غير متوافق مع مجموعة الحديث.');
    }
    if (!hasExplicitSahih && !isCanonicalSahihCollection) {
      throw new Error('مصدر الحديث لا يثبت صحته.');
    }
    hadiths.push({
      name: item.name,
      collection: item.collection,
      hadithNumber: item.hadithNumber,
      body: item.body,
      grades,
      authenticityBasis: item.authenticityBasis,
      ...(typeof item.bookNumber === 'string' ? { bookNumber: item.bookNumber } : {}),
      ...(typeof item.chapterId === 'string' ? { chapterId: item.chapterId } : {}),
      ...(typeof item.chapterNumber === 'string' ? { chapterNumber: item.chapterNumber } : {}),
      ...(typeof item.chapterTitle === 'string' ? { chapterTitle: item.chapterTitle } : {}),
      ...(Number.isSafeInteger(item.referenceUrn) && item.referenceUrn > 0 ? { referenceUrn: item.referenceUrn } : {}),
      ...(Number.isSafeInteger(item.urn) && item.urn > 0 ? { urn: item.urn } : {}),
    });
  }
  return { hadiths, hasMore: payload.hasMore };
}

function readCachedHadithPage(key: string, verseKey: string): { hadiths: RelatedHadith[]; hasMore: boolean } | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('cachedAt' in parsed) ||
        !Number.isSafeInteger(parsed.cachedAt) ||
        (parsed.cachedAt as number) < Date.now() - MAX_CACHED_HADITH_AGE_MS ||
        (parsed.cachedAt as number) > Date.now() + 5 * 60 * 1000) {
      throw new Error('Cached hadith page is stale or missing its verification timestamp.');
    }
    return validateHadithPayload(parsed, verseKey);
  } catch {
    try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    return null;
  }
}

function writeCachedHadithPage(key: string, value: { verseKey: string; cachedAt: number; hadiths: RelatedHadith[]; hasMore: boolean }): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const candidate = localStorage.key(index);
      if (candidate?.startsWith(CACHE_PREFIX)) keys.push(candidate);
    }
    if (!keys.includes(key) && keys.length >= MAX_CACHED_HADITH_PAGES) {
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Hadith display must remain usable even when browser storage is unavailable or full.
  }
}

export async function getRelatedSahihHadiths(
  surahNumber: number,
  ayahNumber: number,
  page = 1,
  signal?: AbortSignal
): Promise<{ hadiths: RelatedHadith[]; hasMore: boolean }> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 ||
      !Number.isInteger(ayahNumber) || ayahNumber < 1 ||
      !Number.isSafeInteger(page) || page < 1 || page > 100) {
    throw new RangeError('إحداثيات الآية أو رقم الصفحة غير صحيح.');
  }
  const verseKey = \`\${surahNumber}:\${ayahNumber}\`;
  const cacheKey = \`\${CACHE_PREFIX}\${verseKey}:page:\${page}\`;
  if (signal?.aborted) throw new Error('تم إلغاء طلب الأحاديث.');
  const cached = readCachedHadithPage(cacheKey, verseKey);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(\`/api/hadith-references?surah=\${surahNumber}&ayah=\${ayahNumber}&page=\${page}\`, {
      headers: { Accept: 'application/json' },
      signal
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('لا توجد نسخة محفوظة من هذه الأحاديث على الجهاز، وتعذر الاتصال بمصدرها.');
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : '';
    if (error === 'HADITH_REFERENCES_NOT_CONFIGURED') throw new Error('HADITH_REFERENCES_NOT_CONFIGURED');
    throw new Error('تعذر تحميل الأحاديث المرتبطة بالآية.');
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error('استجابة مصدر الأحاديث غير صالحة.'); }
  const result = validateHadithPayload(payload, verseKey);
  writeCachedHadithPage(cacheKey, { verseKey, cachedAt: Date.now(), ...result });
  return result;
}
