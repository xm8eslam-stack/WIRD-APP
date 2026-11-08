import React, { useEffect, useRef, useState } from 'react';
import { BookMarked, ChevronDown, Loader2, RotateCw } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import { getRelatedSahihHadiths, RelatedHadith } from '../../services/hadithReferencesService';

export const RelatedHadithPanel: React.FC<{ ayah: Ayah }> = ({ ayah }) => {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<RelatedHadith[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const lastVerseKey = useRef(`${ayah.surahNumber}:${ayah.numberInSurah}`);
  useEffect(() => {
    const verseKey = `${ayah.surahNumber}:${ayah.numberInSurah}`;
    const requestPage = lastVerseKey.current === verseKey ? page : 1;
    if (lastVerseKey.current !== verseKey) {
      lastVerseKey.current = verseKey;
      setPage(1); setItems([]); setHasMore(false);
    }
    if (!expanded) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    getRelatedSahihHadiths(ayah.surahNumber, ayah.numberInSurah, requestPage, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setItems(current => {
        if (requestPage === 1) return result.hadiths;
        const existing = new Set(current.map(item => `${item.collection}:${item.hadithNumber}`));
        return [...current, ...result.hadiths.filter(item => !existing.has(`${item.collection}:${item.hadithNumber}`))];
      }); setHasMore(result.hasMore); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الأحاديث.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ayah.surahNumber, ayah.numberInSurah, expanded, page, retry]);
  return <section className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-right text-sm font-bold text-emerald-900 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
      <span className="flex items-center gap-2"><BookMarked className="h-4 w-4" /> مراجع أحاديث لها حكم بالصحة مرتبطة بالآية</span><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
    {expanded && <div className="mt-2 space-y-3">
      {loading && <p role="status" className="flex items-center gap-2 text-xs text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ البحث في المراجع الحديثية…</p>}
      {!loading && error === 'HADITH_REFERENCES_NOT_CONFIGURED' && <p role="status" className="rounded-lg bg-stone-100 p-3 text-xs leading-6 text-stone-600 dark:bg-stone-800 dark:text-stone-300">ميزة الربط بقاعدة الأحاديث تحتاج إعداد بيانات اعتماد خادمية من Quran Foundation. لم يُعرض حديث غير موثق.</p>}
      {!loading && error && error !== 'HADITH_REFERENCES_NOT_CONFIGURED' && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300"><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3"><RotateCw className="h-4 w-4" /> إعادة المحاولة</button></div>}
      {!loading && !error && items.length === 0 && !hasMore && <p role="status" className="text-xs text-stone-500">لا يعرض المصدر حديثًا بدرجة صحيح مرتبطًا صراحةً بهذه الآية.</p>}
      {!loading && !error && items.length === 0 && hasMore && <p role="status" className="text-xs text-stone-500">لا يتضمن هذا الجزء حديثًا بدرجة صحيح؛ توجد مراجع أخرى.</p>}
      {!loading && items.map((item, index) => <article key={`${item.collection}-${item.hadithNumber}-${index}`} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900">
        <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">{item.name} · رقم الحديث {item.hadithNumber}</h3>
        {(item.chapterTitle || item.bookNumber || item.chapterNumber) && <p className="mt-1 text-[11px] leading-6 text-stone-500 dark:text-stone-400">{item.chapterTitle ? `الباب: ${item.chapterTitle}` : ''}{item.chapterNumber ? ` · رقم الباب: ${item.chapterNumber}` : ''}{item.bookNumber ? ` · رقم الكتاب: ${item.bookNumber}` : ''}</p>}
        <p dir="rtl" lang="ar" className="my-3 whitespace-pre-wrap break-words text-justify font-sans-ui text-[15px] leading-[2.4] text-stone-800 dark:text-stone-200">{item.body}</p>
        <div className="rounded-lg bg-emerald-50/80 px-3 py-2 text-[11px] leading-6 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="font-bold">أحكام المحدثين في المصدر: </span>
          {item.grades.map(grade => `${grade.grade} — ${grade.graded_by}`).join('؛ ')}
        </div>
        <p className="mt-2 text-[10px] leading-5 text-stone-500 dark:text-stone-400">المصدر: Quran Foundation{item.urn ? ` · معرّف المصدر: ${item.urn}` : ''} · مرجع الآية: {ayah.surahNumber}:{ayah.numberInSurah}. ظهور حكم بالصحة يعني أن المصدر أورد حكمًا صريحًا بذلك، ولا يعني إجماع جميع المحدثين. اسم الراوي لا يُفصل عن المتن لأن واجهة المصدر لا توفره كحقل مستقل.</p>
      </article>)}
      {hasMore && !loading && !error && <button type="button" disabled={page >= 100} onClick={() => setPage(value => Math.min(100, value + 1))} className="min-h-11 w-full rounded-lg border border-emerald-700 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-200 dark:hover:bg-emerald-950/40">{page >= 100 ? 'اكتمل حد الصفحات' : 'تحميل مراجع إضافية'}</button>}
    </div>}
  </section>;
};
