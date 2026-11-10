import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Type,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Ayah } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { getTafsir, TAFSIR_EDITIONS, TafsirBookOption } from '../../services/tafsirService';
import { parseTafsirToSegments, sanitizeTafsirToPlainText } from '../../utils/tafsirSanitizer';
import { RelatedHadithPanel } from '../shared/RelatedHadithPanel';
import { QuranText } from '../shared/QuranText';
import { getAyahDisplayText } from '../../data/quranDataLoader';

interface TafsirSheetProps {
  ayah: Ayah | null;
  onClose: () => void;
}

const FONT_SIZE_KEY = 'wird_tafsir_font_size_v1';
const SELECTED_BOOK_KEY = 'wird_tafsir_selected_book_v1';

const FONT_SIZES = [
  { label: 'صغير', sizeClass: 'text-[14px] leading-[2.1]' },
  { label: 'متوسط', sizeClass: 'text-[16px] leading-[2.2]' },
  { label: 'كبير', sizeClass: 'text-[18px] leading-[2.3]' },
  { label: 'كبير جداً', sizeClass: 'text-[21px] leading-[2.4]' }
];

export const TafsirSheet: React.FC<TafsirSheetProps> = ({ ayah, onClose }) => {
  const [selectedBookId, setSelectedBookId] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SELECTED_BOOK_KEY));
      return TAFSIR_EDITIONS.some(b => b.id === saved) ? saved : 16;
    } catch {
      return 16;
    }
  });

  const [fontSizeIndex, setFontSizeIndex] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
      return Number.isInteger(saved) && saved >= 0 && saved < FONT_SIZES.length ? saved : 1;
    } catch {
      return 1;
    }
  });

  const [rawText, setRawText] = useState('');
  const [currentBookName, setCurrentBookName] = useState('التفسير الميسر');
  const [currentAuthor, setCurrentAuthor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const surah = ayah ? ALL_SURAHS.find(item => item.number === ayah.surahNumber) : undefined;

  // Persist preferences
  const handleSelectBook = (bookId: number) => {
    setSelectedBookId(bookId);
    try {
      localStorage.setItem(SELECTED_BOOK_KEY, String(bookId));
    } catch { /* Storage unavailable */ }
  };

  const handleAdjustFontSize = (direction: 'increase' | 'decrease') => {
    setFontSizeIndex(prev => {
      const next = direction === 'increase'
        ? Math.min(FONT_SIZES.length - 1, prev + 1)
        : Math.max(0, prev - 1);
      try {
        localStorage.setItem(FONT_SIZE_KEY, String(next));
      } catch { /* Storage unavailable */ }
      return next;
    });
  };

  useEffect(() => {
    if (!ayah) return;
    const controller = new AbortController();
    setRawText('');
    setError(null);
    setIsCached(false);
    setIsLoading(true);

    getTafsir(ayah.surahNumber, ayah.numberInSurah, selectedBookId, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setRawText(result.text);
        setCurrentBookName(result.bookName);
        setCurrentAuthor(result.author || '');
        setIsCached(result.source === 'cache');
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason?.message || 'تعذر تحميل التفسير من المصدر.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [ayah?.surahNumber, ayah?.numberInSurah, selectedBookId, retry]);

  // Keep keyboard focus inside the modal, support Escape, and return focus to the ayah action.
  useEffect(() => {
    if (!ayah) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      previousFocus?.focus();
    };
  }, [ayah?.surahNumber, ayah?.numberInSurah]);

  // Parse segments safely to prevent raw HTML code display
  const segments = useMemo(() => {
    return parseTafsirToSegments(rawText);
  }, [rawText]);

  // Plain text for clipboard sharing
  const handleCopyTafsir = async () => {
    if (!ayah || !rawText) return;
    const plainTafsir = sanitizeTafsirToPlainText(rawText);
    const surahName = surah?.name || ayah.surahNumber;
    const displayText = await getAyahDisplayText(ayah);
    const shareText = `﴿ ${displayText} ﴾ [سورة ${surahName}، آية ${ayah.numberInSurah}]\n\n📖 ${currentBookName}:\n${plainTafsir}\n\n— عبر تطبيق وِرد القرآني (WIRD)`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (!ayah) return null;

  const currentSizeConfig = FONT_SIZES[fontSizeIndex];

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wird-tafsir-dialog-title"
        onClick={event => event.stopPropagation()}
        className="w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] bg-[#fdfbf7] dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200/90 dark:border-stone-800 overflow-hidden flex flex-col"
      >
        {/* Header with Title and Quick Controls */}
        <div className="flex flex-col border-b border-stone-200/80 dark:border-stone-800 bg-[#faf6ee] dark:bg-stone-900/95 shrink-0 px-5 py-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-800 text-amber-300 flex items-center justify-center shadow-xs shrink-0 border border-emerald-700">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="wird-tafsir-dialog-title" className="font-bold text-stone-900 dark:text-stone-100 text-base md:text-lg">
                    {currentBookName}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                    Quran.com API v4
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah} {currentAuthor ? `· ${currentAuthor}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopyTafsir}
                disabled={isLoading || !rawText}
                aria-label="نسخ الآية والتفسير"
                title="نسخ الآية والتفسير للمشاركة"
                className={`min-h-11 min-w-11 p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 ${
                  copied
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                } disabled:opacity-40`}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-500" />}
                <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                ref={closeButtonRef}
                aria-label="إغلاق التفسير"
                className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-stone-200/70 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Edition Selector & Font Scaler Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/60 dark:border-stone-800 text-xs">
            {/* Tafsir Book Editions */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 shrink-0">الكتاب:</span>
              {TAFSIR_EDITIONS.map(edition => {
                const isSelected = edition.id === selectedBookId;
                return (
                  <button
                    key={edition.id}
                    type="button"
                    onClick={() => handleSelectBook(edition.id)}
                    aria-pressed={isSelected}
                    className={`min-h-11 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-emerald-800 text-white shadow-xs font-bold'
                        : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {edition.name.replace('تفسير ', '')}
                  </button>
                );
              })}
            </div>

            {/* Font Size Adjuster */}
            <div className="flex items-center gap-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => handleAdjustFontSize('decrease')}
                disabled={fontSizeIndex === 0}
                aria-label="تصغير خط التفسير"
                title="تصغير خط التفسير"
                className="min-h-11 min-w-11 p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 rounded disabled:opacity-30"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] font-mono font-medium text-stone-500 dark:text-stone-400">
                {currentSizeConfig.label}
              </span>
              <button
                type="button"
                onClick={() => handleAdjustFontSize('increase')}
                disabled={fontSizeIndex === FONT_SIZES.length - 1}
                aria-label="تكبير خط التفسير"
                title="تكبير خط التفسير"
                className="min-h-11 min-w-11 p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 rounded disabled:opacity-30"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto overscroll-contain p-5 md:p-6 space-y-5">
          {/* Authentic Quranic Ayah Presentation Card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#faf4e6] to-[#f5eedb] dark:from-stone-800/90 dark:to-stone-900 border border-amber-300/80 dark:border-amber-900/40 p-5 md:p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-2 left-3 opacity-10 text-amber-900 dark:text-amber-100 pointer-events-none">
              <Sparkles className="w-20 h-20" />
            </div>

            <div className="flex items-center justify-between gap-2 mb-3 text-xs text-amber-900/80 dark:text-amber-300 font-semibold border-b border-amber-200/80 dark:border-amber-900/50 pb-2">
              <span>نص الآية الكريمة</span>
              <span className="font-sans-ui bg-amber-200/60 dark:bg-amber-950 px-2 py-0.5 rounded-full text-[11px]">
                سورة {surah?.name || ayah.surahNumber} · الآية {ayah.numberInSurah}
              </span>
            </div>

            <p className="font-quran text-2xl md:text-3xl leading-[2.3] text-right text-stone-950 dark:text-stone-100">
              <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>{' '}
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-amber-600 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 font-sans text-xs align-middle font-bold mx-1">
                {ayah.numberInSurah}
              </span>
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-emerald-800 dark:text-emerald-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm font-semibold">جارٍ تحميل التفسير المعتمد من المصدر الرسمي...</p>
            </div>
          )}

          {/* Error State with Graceful Retry */}
          {error && !isLoading && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <p className="text-sm font-bold">تعذر تحميل التفسير</p>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRetry(val => val + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectBook(16)}
                  className="text-xs text-rose-900 dark:text-rose-300 underline font-semibold"
                >
                  التبديل إلى التفسير الميسر
                </button>
              </div>
            </div>
          )}

          {/* Clean Rendered Tafsir Segments (Zero Raw HTML or Code Display) */}
          {!isLoading && !error && segments.length > 0 && (
            <article
              className={`p-1 space-y-3 text-stone-900 dark:text-stone-100 ${currentSizeConfig.sizeClass} text-justify font-sans-ui`}
            >
              <div className="flex items-center gap-2 pb-2 text-xs font-bold text-emerald-800 dark:text-emerald-400 border-b border-stone-200 dark:border-stone-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>بيان المعنى والشرح:</span>
              </div>

              <div className="space-y-4">
                {renderSegmentBlocks(segments)}
              </div>
            </article>
          )}

          {/* Empty Fallback */}
          {!isLoading && !error && segments.length === 0 && (
            <div className="py-12 text-center text-stone-400 text-xs">
              لا يتوفر نص تفسير متاح لهذه الآية في الطبعة المحددة حالياً.
            </div>
          )}

          <RelatedHadithPanel ayah={ayah} />

          {/* Footer Metadata & Status */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{isCached ? 'محفوظ محلياً للرجوع إليه دون إنترنت' : 'تم الجلب مباشرة من Quran.com API v4'}</span>
            </div>
            <a
              href="https://quran.com/ar/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              <span>منصة مطوري Quran.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

/**
 * Helper to group segments into clean readable paragraphs with styled Quranic quotes
 */
function renderSegmentBlocks(segments: ReturnType<typeof parseTafsirToSegments>) {
  const paragraphs: Array<Array<typeof segments[0]>> = [];
  let currentPara: Array<typeof segments[0]> = [];

  segments.forEach(seg => {
    if (seg.type === 'paragraph_break') {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara);
        currentPara = [];
      }
    } else {
      currentPara.push(seg);
    }
  });
  if (currentPara.length > 0) {
    paragraphs.push(currentPara);
  }

  return paragraphs.map((para, pIndex) => (
    <p key={`para-${pIndex}`} className="leading-[2.2] tracking-wide">
      {para.map(seg => {
        if (seg.type === 'ayah_quote') {
          return (
            <span
              key={seg.id}
              className="font-quran text-amber-900 dark:text-amber-300 font-bold bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md inline-block mx-1 shadow-2xs border border-amber-300/60 dark:border-amber-800/60"
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'highlight') {
          return (
            <span
              key={seg.id}
              className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded inline-block mx-0.5"
            >
              {seg.text}
            </span>
          );
        }
        return <span key={seg.id}>{seg.text} </span>;
      })}
    </p>
  ));
}
