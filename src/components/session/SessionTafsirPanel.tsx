import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, RefreshCw } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getTafsir, TAFSIR_EDITIONS } from '../../services/tafsirService';
import { parseTafsirToSegments } from '../../utils/tafsirSanitizer';
import { RelatedHadithPanel } from '../shared/RelatedHadithPanel';

const SELECTED_BOOK_KEY = 'wird_tafsir_selected_book_v1';
export const SessionTafsirPanel: React.FC<{ ayah: Ayah }> = ({ ayah }) => {
  const [bookId, setBookId] = useState(() => {
    try { const stored = Number(localStorage.getItem(SELECTED_BOOK_KEY)); return TAFSIR_EDITIONS.some(book => book.id === stored) ? stored : 16; }
    catch { return 16; }
  });
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setText(''); setLoading(true); setError(false);
    getTafsir(ayah.surahNumber, ayah.numberInSurah, bookId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setText(result.text); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ayah.surahNumber, ayah.numberInSurah, bookId, retry]);
  const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
  const selectedBook = TAFSIR_EDITIONS.find(book => book.id === bookId);
  return <section aria-labelledby="session-tafsir-title" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-right dark:border-amber-900 dark:bg-amber-950/20">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id="session-tafsir-title" className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100"><BookOpen className="h-4 w-4 text-amber-700" /> تفسير الآية</h2>
      <label className="text-xs text-stone-600 dark:text-stone-300">المصدر
        <select aria-label="مصدر التفسير في الجلسة" className="ms-2 min-h-10 rounded-lg border bg-white px-2 dark:border-stone-700 dark:bg-stone-900" value={bookId} onChange={event => { const value = Number(event.target.value); setBookId(value); try { localStorage.setItem(SELECTED_BOOK_KEY, String(value)); } catch { /* preference remains in memory */ } }}>
          {TAFSIR_EDITIONS.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
        </select>
      </label>
    </header>
    <p className="mb-2 text-xs text-stone-500">سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah} · {selectedBook?.name}{selectedBook?.author ? ` · ${selectedBook.author}` : ''}</p>
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل التفسير…</p>
      : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-rose-700 dark:text-rose-300"><span>تعذر تحميل التفسير الآن.</span><button type="button" onClick={() => setRetry(value => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3"><RefreshCw className="h-4 w-4" /> إعادة المحاولة</button></div>
        : <div className="space-y-2 text-sm leading-8 text-stone-800 dark:text-stone-200">{parseTafsirToSegments(text).map(segment => <span key={segment.id}>{segment.text}</span>)}</div>}
    <p className="mt-3 border-t border-amber-200 pt-2 text-[11px] text-stone-500 dark:border-amber-900">التفسير من كتب معتمدة عبر المصدر المحدد؛ يُعرض للتدبر ولا يستبدل الرجوع لأهل العلم.</p>
    <RelatedHadithPanel ayah={ayah} />
  </section>;
};
