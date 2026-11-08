export interface RelatedHadith {
  name: string;
  collection: string;
  hadithNumber: string;
  body: string;
  grades: Array<{ graded_by: string; grade: string }>;
  bookNumber?: string;
  chapterId?: string;
  chapterNumber?: string;
  chapterTitle?: string;
  urn?: number;
}

export async function getRelatedSahihHadiths(surahNumber: number, ayahNumber: number, page = 1, signal?: AbortSignal): Promise<{ hadiths: RelatedHadith[]; hasMore: boolean }> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 || !Number.isInteger(ayahNumber) || ayahNumber < 1) throw new RangeError('إحداثيات الآية غير صحيحة.');
  const response = await fetch(`/api/hadith-references?surah=${surahNumber}&ayah=${ayahNumber}&page=${page}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : '';
    if (error === 'HADITH_REFERENCES_NOT_CONFIGURED') throw new Error('HADITH_REFERENCES_NOT_CONFIGURED');
    throw new Error('تعذر تحميل الأحاديث المرتبطة بالآية.');
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('verseKey' in payload) || payload.verseKey !== `${surahNumber}:${ayahNumber}` || !('hadiths' in payload) || !Array.isArray(payload.hadiths) || payload.hadiths.length > 5 || !('hasMore' in payload) || typeof payload.hasMore !== 'boolean') throw new Error('استجابة مصدر الأحاديث غير صالحة.');
  const hadiths: RelatedHadith[] = [];
  for (const item of payload.hadiths) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim() || typeof item.collection !== 'string' || !item.collection.trim() || typeof item.hadithNumber !== 'string' || !item.hadithNumber.trim() || typeof item.body !== 'string' || !item.body.trim() || item.body.length > 25_000 || !Array.isArray(item.grades)) {
      throw new Error('استجابة مصدر الأحاديث غير صالحة.');
    }
    const grades = item.grades.filter((grade: any) => grade && typeof grade.graded_by === 'string' && grade.graded_by.trim() && typeof grade.grade === 'string' && grade.grade.trim());
    if (!grades.some((grade: any) => /^(sahih|صحيح)$/i.test(grade.grade.trim()))) {
      throw new Error('استجابة مصدر الأحاديث لا تتضمن حكمًا صريحًا بالصحة.');
    }
    hadiths.push({
      name: item.name,
      collection: item.collection,
      hadithNumber: item.hadithNumber,
      body: item.body,
      grades,
      ...(typeof item.bookNumber === 'string' ? { bookNumber: item.bookNumber } : {}),
      ...(typeof item.chapterId === 'string' ? { chapterId: item.chapterId } : {}),
      ...(typeof item.chapterNumber === 'string' ? { chapterNumber: item.chapterNumber } : {}),
      ...(typeof item.chapterTitle === 'string' ? { chapterTitle: item.chapterTitle } : {}),
      ...(Number.isSafeInteger(item.urn) && item.urn > 0 ? { urn: item.urn } : {}),
    });
  }
  return { hadiths, hasMore: payload.hasMore };
}
