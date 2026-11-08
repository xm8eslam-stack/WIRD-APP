export interface RelatedHadith {
  name: string;
  collection: string;
  hadithNumber: string;
  body: string;
  grades: Array<{ graded_by: string; grade: string }>;
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
  const hadiths = payload.hadiths.filter((item): item is RelatedHadith => Boolean(item && typeof item === 'object' && typeof item.name === 'string' && typeof item.collection === 'string' && typeof item.hadithNumber === 'string' && typeof item.body === 'string' && Array.isArray(item.grades) && item.grades.some((grade: any) => grade && typeof grade.grade === 'string' && /^(sahih|صحيح)$/i.test(grade.grade.trim()))));
  return { hadiths, hasMore: payload.hasMore };
}
