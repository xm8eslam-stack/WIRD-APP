import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getTafsir, TAFSIR_EDITIONS } from '../../services/tafsirService';
import { parseTafsirToSegments } from '../../utils/tafsirSanitizer';
import { RelatedHadithPanel } from '../shared/RelatedHadithPanel';

const SELECTED_BOOK_KEY = 'wird_tafsir_selected_book_v1';
const EXPANDED_KEY = 'wird_session_tafsir_expanded_v1';
export const SessionTafsirPanel: React.FC<{ ayah: Ayah }> = ({ ayah }) => {
  const [isExpanded, setIsExpanded] = useState(() => { try { return localStorage.getItem(EXPANDED_KEY) === '1'; } catch { return false; } });
  const [bookId, setBookId] = useState(() => {
    try { const stored = Number(localStorage.getItem(SELECTED_BOOK_KEY)); return TAFSIR_EDITIONS.some(book => book.id === stored) ? stored : 16; }
    catch { return 16; }
  });
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!isExpanded) { setLoading(false); return; }
    const controller = new AbortController();
    setText(''); setLoading(true); setError(false);
    getTafsir(ayah.surahNumber, ayah.numberInSurah, bookId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setText(result.text); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ayah.surahNumber, ayah.numberInSurah, bookId, retry, isExpanded]);
  const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
  const selectedBook = TAFSIR_EDITIONS.find(book => book.id === bookId);
  const toggleExpanded = () => {
    setIsExpanded(current => {
      const next = !current;
      try { localStorage.setItem(EXPANDED_KEY, next ? '1' : '0'); } catch { /* keep the in-memory preference */ }
      return next;
    });
  };

  return (
    <section aria-labelledby="session-tafsir-title" className={`rounded-2xl border transition-colors ${isExpanded ? 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800/80' : 'border-stone-200/80 bg-stone-50/80 dark:border-stone-700/80 dark:bg-stone-900/40'}`}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls="session-tafsir-content"
        className="w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 text-right rounded-2xl hover:bg-stone-100/70 dark:hover:bg-stone-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span id="session-tafsir-title" className="block text-sm font-bold text-stone-900 dark:text-stone-100">تفسير الآية</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">{isExpanded ? 'اضغط لإخفاء التفسير وتوسيع مساحة القراءة' : 'افتح التفسير عند الحاجة — مخفي لتبقى مساحة الحفظ مريحة'}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {isExpanded ? 'إخفاء' : 'عرض التفسير'}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isExpanded && (
        <div id="session-tafsir-content" className="border-t border-stone-200/80 dark:border-stone-700/80 px-4 pb-4 pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500 dark:text-stone-400">سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}</p>
            <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              <span>مصدر التفسير</span>
              <select aria-label="مصدر التفسير في الجلسة" className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 dark:border-stone-700 dark:bg-stone-900" value={bookId} onChange={event => { const value = Number(event.target.value); setBookId(value); try { localStorage.setItem(SELECTED_BOOK_KEY, String(value)); } catch { /* preference remains in memory */ } }}>
                {TAFSIR_EDITIONS.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-stone-500">{selectedBook?.name}{selectedBook?.author ? ` · ${selectedBook.author}` : ''}</p>
          {loading ? <p role="status" className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل التفسير…</p>
            : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-rose-700 dark:text-rose-300"><span>تعذر تحميل التفسير الآن.</span><button type="button" onClick={() => setRetry(value => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 dark:border-stone-700"><RefreshCw className="h-4 w-4" /> إعادة المحاولة</button></div>
              : <div className="space-y-2 text-sm leading-8 text-stone-800 dark:text-stone-200">{parseTafsirToSegments(text).map(segment => <span key={segment.id}>{segment.text}</span>)}</div>}
          <p className="border-t border-stone-200 pt-3 text-[11px] leading-6 text-stone-500 dark:border-stone-700">التفسير من كتب معتمدة عبر المصدر المحدد؛ يُعرض للتدبر ولا يستبدل الرجوع لأهل العلم.</p>
          <RelatedHadithPanel ayah={ayah} />
        </div>
      )}
    </section>
  );
};
