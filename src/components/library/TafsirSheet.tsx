import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Loader2, RefreshCw, X } from 'lucide-react';
import { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getTafsirMuyassar } from '../../services/tafsirService';

interface TafsirSheetProps {
  ayah: Ayah | null;
  onClose: () => void;
}

export const TafsirSheet: React.FC<TafsirSheetProps> = ({ ayah, onClose }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [retry, setRetry] = useState(0);
  const surah = ayah ? ALL_SURAHS.find(item => item.number === ayah.surahNumber) : undefined;

  useEffect(() => {
    if (!ayah) return;
    const controller = new AbortController();
    setText('');
    setError(null);
    setIsLoading(true);
    getTafsirMuyassar(ayah.surahNumber, ayah.numberInSurah, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setText(result.text);
        setIsCached(result.source === 'cache');
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason?.message || 'تعذر تحميل التفسير.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [ayah?.surahNumber, ayah?.numberInSurah, retry]);

  if (!ayah) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wird-tafsir-title"
        onClick={event => event.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[88vh] bg-[#fffdf9] dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 dark:border-stone-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="wird-tafsir-title" className="font-bold text-stone-900 dark:text-stone-100">التفسير الميسر</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق التفسير" className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-5 space-y-5">
          <div className="rounded-2xl bg-[#f5f0e6] dark:bg-stone-800/80 border border-amber-200/70 dark:border-stone-700 p-4">
            <p className="font-quran text-xl md:text-2xl leading-[2.1] text-right text-stone-900 dark:text-stone-100">{ayah.text}</p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-10 text-emerald-800 dark:text-emerald-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">جارٍ تحميل التفسير...</span>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">تعذر تحميل التفسير</p>
              </div>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">{error}</p>
              <p className="text-xs text-stone-600 dark:text-stone-400">إذا لم تكن قد فتحت هذا التفسير من قبل، فستحتاج إلى اتصال بالإنترنت لتحميله أول مرة.</p>
              <button type="button" onClick={() => setRetry(value => value + 1)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
            </div>
          )}

          {!isLoading && !error && text && (
            <article className="text-[15px] md:text-base leading-[2] text-stone-800 dark:text-stone-200 whitespace-pre-wrap text-justify">{text}</article>
          )}

          <div className="pt-4 border-t border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
            <span>{isCached ? 'محفوظ محلياً' : 'التفسير الميسر · بيانات عند الطلب'}</span>
            <a href="https://quranpedia.net" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">المصدر: الموسوعة القرآنية</a>
          </div>
        </div>
      </section>
    </div>
  );
}