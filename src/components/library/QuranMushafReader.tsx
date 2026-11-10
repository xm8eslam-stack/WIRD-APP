import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  BookOpen,
  RefreshCw,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { QURAN_PAGE_INDEX } from '../../data/quranPageIndex.generated';
import { QURAN_JUZ_STARTS, QURAN_HIZB_QUARTER_STARTS } from '../../data/quranNavigationIndex.generated';
import { loadSurahVerses } from '../../data/quranDataLoader';
import { findSurahStartPage } from '../../data/quranNavigation';
import { RECITERS, formatAyahAudioUrl } from '../../services/audioService';
import { getSavedPlaybackRate, savePlaybackRate } from '../../services/audioPreferences';
import type { PlaybackRate } from '../../services/audioPreferences';
import type { Ayah, ReciterId } from '../../types/quran';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { TafsirSheet } from './TafsirSheet';
import type { ReadingKhatma } from '../../services/readingKhatmaService';
import { QuranText } from '../shared/QuranText';
import { QuranBasmala } from '../shared/QuranBasmala';
import { QuranMushafFacsimilePage } from './QuranMushafFacsimilePage';

interface QuranMushafReaderProps {
  preferredReciter: ReciterId;
  onBack: () => void;
  initialPage?: number;
  readingKhatma?: ReadingKhatma | null;
  onMarkPageRead?: (page: number) => void;
  readingKhatmaError?: string;
}

interface PageSegment {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

interface NavigationPoint {
  surahNumber: number;
  ayahNumber: number;
  page: number;
}

const LAST_PAGE_KEY = 'wird.quran.lastPage.v1';
const BOOKMARKS_KEY = 'wird.quran.pageBookmarks.v1';
const PAGE_INDEX = QURAN_PAGE_INDEX as unknown as Record<string, PageSegment[]>;
const JUZ_INDEX = QURAN_JUZ_STARTS as unknown as Record<string, NavigationPoint>;
const HIZB_INDEX = QURAN_HIZB_QUARTER_STARTS as unknown as Record<string, NavigationPoint>;

function readLastPage(): number {
  try {
    const value = Number(localStorage.getItem(LAST_PAGE_KEY));
    return Number.isInteger(value) && value >= 1 && value <= 604 ? value : 1;
  } catch {
    return 1;
  }
}

function readBookmarks(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((p): p is number => Number.isInteger(p) && p >= 1 && p <= 604))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export const QuranMushafReader: React.FC<QuranMushafReaderProps> = ({ preferredReciter, onBack, initialPage, readingKhatma, onMarkPageRead, readingKhatmaError }) => {
  const [page, setPage] = useState(() => Number.isInteger(initialPage) && initialPage! >= 1 && initialPage! <= 604 ? initialPage! : readLastPage());
  const [pageInput, setPageInput] = useState(String(Number.isInteger(initialPage) && initialPage! >= 1 && initialPage! <= 604 ? initialPage! : readLastPage()));
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>(readBookmarks);
  const [activeReciter, setActiveReciter] = useState<ReciterId>(preferredReciter || 'alafasy');
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(getSavedPlaybackRate);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [tafsirAyah, setTafsirAyah] = useState<Ayah | null>(null);
  const [readerLayout, setReaderLayout] = useState<'flow' | 'printed'>(() => {
    try { return localStorage.getItem('wird.quran.readerLayout.v1') === 'printed' ? 'printed' : 'flow'; }
    catch { return 'flow'; }
  });
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'previous'>('next');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayNextPageRef = useRef(false);
  const pendingTargetRef = useRef<{ surahNumber: number; ayahNumber: number } | null>(null);
  const touchStartX = useRef<number | null>(null);

  const pageSegments = useMemo(() => PAGE_INDEX[String(page)] || [], [page]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setAyahs([]);
    audioRef.current?.pause();
    setIsPlaying(false);
    setPlayingIndex(null);

    if (!pageSegments.length) {
      setLoadError('لا توجد بيانات موثقة لهذه الصفحة.');
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    Promise.all(pageSegments.map(async segment => {
      const surahAyahs = await loadSurahVerses(segment.surahNumber);
      return surahAyahs.filter(ayah => ayah.numberInSurah >= segment.startAyah && ayah.numberInSurah <= segment.endAyah);
    }))
      .then(groups => {
        if (!cancelled) {
          const result = groups.flat().sort((a, b) => a.number - b.number);
          if (!result.length) throw new Error('لم يتم العثور على آيات الصفحة في الملفات المحلية.');
          setAyahs(result);
        }
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'تعذر تحميل الصفحة.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, retry, pageSegments]);

  useEffect(() => {
    setPageInput(String(page));
    try { localStorage.setItem(LAST_PAGE_KEY, String(page)); } catch { /* Reading remains available without persistence. */ }
  }, [page]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const stopAudio = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setPlayingIndex(null);
  };

  const playAyahAt = (index: number, queue: Ayah[] = ayahs) => {
    const ayah = queue[index];
    if (!ayah) {
      setIsPlaying(false);
      setPlayingIndex(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(formatAyahAudioUrl(ayah.surahNumber, ayah.numberInSurah, activeReciter));
    audio.playbackRate = getSavedPlaybackRate();
    audioRef.current = audio;
    setPlayingIndex(index);
    setIsPlaying(true);

    audio.onended = () => {
      if (index + 1 < queue.length) playAyahAt(index + 1, queue);
      else if (page < 604) {
        autoPlayNextPageRef.current = true;
        setIsPlaying(false);
        setPlayingIndex(null);
        setPage(page + 1);
      } else {
        setIsPlaying(false);
        setPlayingIndex(null);
      }
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setPlayingIndex(null);
    };
    audio.play().catch(error => {
      console.warn('[WIRD Mushaf] Audio playback failed:', error);
      setIsPlaying(false);
      setPlayingIndex(null);
    });
  };

  useEffect(() => {
    if (!isLoading && ayahs.length > 0 && autoPlayNextPageRef.current) {
      autoPlayNextPageRef.current = false;
      playAyahAt(0, ayahs);
    }
  }, [ayahs, isLoading, page]);

  const togglePageAudio = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (audioRef.current && playingIndex !== null) {
      audioRef.current.playbackRate = getSavedPlaybackRate();
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      return;
    }
    if (ayahs.length) playAyahAt(0, ayahs);
  };

  const changePage = (nextPage: number) => {
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > 604) return;
    setPageTurnDirection(nextPage > page ? 'next' : 'previous');
    pendingTargetRef.current = null;
    autoPlayNextPageRef.current = false;
    stopAudio();
    setPage(nextPage);
  };

  const jumpToNavigationPoint = (point: NavigationPoint) => {
    const target = { surahNumber: point.surahNumber, ayahNumber: point.ayahNumber };
    if (point.page === page && ayahs.length) {
      document.getElementById('wird-ayah-' + point.surahNumber + '-' + point.ayahNumber)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingTargetRef.current = null;
      return;
    }
    changePage(point.page);
    pendingTargetRef.current = target;
  };

  const jumpToJuz = (juz: number) => {
    const point = JUZ_INDEX[String(juz)];
    if (point) jumpToNavigationPoint(point);
  };

  const jumpToHizbQuarter = (quarter: number) => {
    const point = HIZB_INDEX[String(quarter)];
    if (point) jumpToNavigationPoint(point);
  };

  const jumpToSurah = (surahNumber: number) => {
    const surah = ALL_SURAHS.find(item => item.number === surahNumber);
    const exactStartPage = findSurahStartPage(surahNumber, PAGE_INDEX);
    if (surah && exactStartPage !== null) {
      jumpToNavigationPoint({ surahNumber, ayahNumber: 1, page: exactStartPage });
    }
  };

  const submitPageJump = () => changePage(Number(pageInput));

  const toggleBookmark = () => {
    setBookmarks(current => {
      const next = current.includes(page) ? current.filter(item => item !== page) : [...current, page].sort((a, b) => a - b);
      try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* Bookmark works for this view if storage is blocked. */ }
      return next;
    });
  };

  useEffect(() => {
    const target = pendingTargetRef.current;
    if (!target || isLoading || !ayahs.length) return;
    if (!ayahs.some(ayah => ayah.surahNumber === target.surahNumber && ayah.numberInSurah === target.ayahNumber)) return;
    document.getElementById('wird-ayah-' + target.surahNumber + '-' + target.ayahNumber)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pendingTargetRef.current = null;
  }, [ayahs, isLoading]);

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    if (audioRef.current) audioRef.current.playbackRate = savedRate;
  };

  const selectReaderLayout = (layout: 'flow' | 'printed') => {
    setReaderLayout(layout);
    try { localStorage.setItem('wird.quran.readerLayout.v1', layout); } catch { /* Layout preference remains available for this view. */ }
  };

  const currentBookmark = bookmarks.includes(page);
  const primarySurah = ayahs.length ? ALL_SURAHS.find(s => s.number === ayahs[0].surahNumber) : undefined;
  const currentJuz = ayahs.length ? ayahs[0].juz : Math.ceil(page / 20);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Control Bar: Elegant, Floating, Responsive */}
      <header className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-[#fffdfa]/95 dark:bg-stone-900/95 backdrop-blur-md p-4 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            >
              <ArrowRight className="h-4 w-4" /> العودة للفهرس
            </button>
            <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-700 mx-1 hidden sm:block" />
            <span className="font-bold text-emerald-800 dark:text-emerald-400 text-sm hidden sm:inline">
              مصحف المدينة المنورة
            </span>
          </div>

          {/* Quick Page Jump & Bookmarks */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-1 text-xs">
              <span className="text-stone-500 px-1.5 text-[11px]">صفحة:</span>
              <input
                type="number"
                min={1}
                max={604}
                value={pageInput}
                onChange={event => setPageInput(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && submitPageJump()}
                aria-label="رقم صفحة المصحف"
                className="w-14 rounded-lg bg-stone-100 dark:bg-stone-700/80 px-2 py-1 text-center font-mono font-bold text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={submitPageJump}
                aria-label="انتقال إلى رقم الصفحة"
                className="rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold transition-colors"
              >
                انتقال
              </button>
            </div>

            <button
              type="button"
              onClick={toggleBookmark}
              aria-label={currentBookmark ? 'إزالة العلامة المحفوظة' : 'حفظ علامة مرجعية'}
              title={currentBookmark ? 'إزالة العلامة من هذه الصفحة' : 'حفظ الصفحة في العلامات المرجعية'}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                currentBookmark
                  ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {currentBookmark ? <BookmarkCheck className="h-4 w-4 text-amber-600" /> : <Bookmark className="h-4 w-4" />}
              <span className="hidden sm:inline">{currentBookmark ? 'محفوظة' : 'حفظ علامة'}</span>
            </button>
          </div>
        </div>

        {/* Dropdowns Row: Surahs, Juz, Hizb */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
          <select
            aria-label="الانتقال إلى سورة"
            value={primarySurah?.number || ''}
            onChange={event => event.target.value && jumpToSurah(Number(event.target.value))}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">انتقال إلى سورة...</option>
            {ALL_SURAHS.map(surah => (
              <option key={surah.number} value={surah.number}>
                {surah.number}. {surah.name} ({surah.englishName})
              </option>
            ))}
          </select>

          <select
            aria-label="الانتقال إلى جزء"
            defaultValue=""
            onChange={event => {
              if (event.target.value) jumpToJuz(Number(event.target.value));
              event.currentTarget.value = '';
            }}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">انتقال إلى جزء...</option>
            {Array.from({ length: 30 }, (_, index) => index + 1).map(juz => (
              <option key={juz} value={juz}>الجزء {juz}</option>
            ))}
          </select>

          <select
            aria-label="الانتقال إلى ربع حزب"
            defaultValue=""
            onChange={event => {
              if (event.target.value) jumpToHizbQuarter(Number(event.target.value));
              event.currentTarget.value = '';
            }}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">انتقال إلى ربع حزب...</option>
            {Array.from({ length: 240 }, (_, index) => index + 1).map(quarter => (
              <option key={quarter} value={quarter}>ربع الحزب {quarter}</option>
            ))}
          </select>

          <select
            aria-label="الانتقال إلى علامة محفوظة"
            defaultValue=""
            onChange={event => {
              if (event.target.value) changePage(Number(event.target.value));
              event.currentTarget.value = '';
            }}
            className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">العلامات المحفوظة ({bookmarks.length})</option>
            {bookmarks.map(savedPage => (
              <option key={savedPage} value={savedPage}>صفحة {savedPage}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">طريقة عرض الصفحة</span>
          <div role="group" aria-label="طريقة عرض المصحف" className="inline-flex rounded-xl border border-stone-200 bg-white p-1 dark:border-stone-700 dark:bg-stone-800">
            <button
              type="button"
              aria-pressed={readerLayout === 'printed'}
              onClick={() => selectReaderLayout('printed')}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${readerLayout === 'printed' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'}`}
            >
              الصفحة المطبوعة
            </button>
            <button
              type="button"
              aria-pressed={readerLayout === 'flow'}
              onClick={() => selectReaderLayout('flow')}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${readerLayout === 'flow' ? 'bg-emerald-800 text-white' : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'}`}
            >
              النص المرن
            </button>
          </div>
        </div>

        {/* Navigation & Audio Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 dark:border-stone-800 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" /> الصفحة السابقة
            </button>
            <span className="text-xs font-bold tabular-nums text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg">
              {page} / 604
            </span>
            <button
              type="button"
              disabled={page >= 604}
              onClick={() => changePage(page + 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 transition-colors"
            >
              الصفحة التالية <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Audio Player Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
              <Volume2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <select
                aria-label="القارئ"
                value={activeReciter}
                onChange={event => {
                  stopAudio();
                  setActiveReciter(event.target.value as ReciterId);
                }}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-2 py-1 text-xs text-stone-800 dark:text-stone-200"
              >
                {RECITERS.map(reciter => (
                  <option key={reciter.id} value={reciter.id}>{reciter.name}</option>
                ))}
              </select>
            </label>

            <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />

            <button
              type="button"
              onClick={togglePageAudio}
              disabled={!ayahs.length || isLoading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white transition-all shadow-xs disabled:opacity-50 ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-800 hover:bg-emerald-900'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'إيقاف مؤقت' : 'استماع للصفحة'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Responsive page-style reading surface; current data does not encode printed line positions. */}
      <main key={page} onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => {
        const startX = touchStartX.current; touchStartX.current = null;
        if (startX === null || event.changedTouches.length === 0) return;
        const delta = event.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 65) changePage(page + (delta > 0 ? -1 : 1));
      }} aria-label={`صفحة المصحف ${page}`} className={readerLayout === 'printed' ? "mx-auto w-full max-w-4xl" : `mushaf-page-frame mx-auto max-w-4xl rounded-3xl bg-[#f6f3ea] dark:bg-[#0d1c19] px-6 py-8 md:px-14 md:py-12 shadow-xl transition-colors animate-mushaf-page-${pageTurnDirection}`}>
        {readerLayout === 'printed' ? (
          <QuranMushafFacsimilePage
            page={page}
            ayahs={ayahs}
            selectedAyah={tafsirAyah}
            onSelectAyah={setTafsirAyah}
            onFallback={() => selectReaderLayout('flow')}
          />
        ) : (
          <div className="space-y-0">
        {/* Top Margins of the Sacred Page: Surah on Right, Page in Center, Juz on Left */}
        <div className="mb-8 flex items-center justify-between border-b-2 border-[#b99b62]/40 dark:border-[#c8ad73]/40 pb-3 text-xs font-bold text-stone-700 dark:text-stone-300">
          <span className="font-quran text-base text-[#102d29] dark:text-[#dfcaa2]">
            {primarySurah?.name ? `سورة ${primarySurah.name}` : 'القرآن الكريم'}
          </span>
          <span className="font-mono text-xs px-3 py-0.5 rounded-full bg-[#e8dfc9] dark:bg-[#18332e] text-[#102d29] dark:text-[#dfcaa2] border border-[#b99b62]/40">
            صفحة {page}
          </span>
          <span className="font-sans-ui text-xs text-stone-600 dark:text-stone-400">
            الجزء {currentJuz}
          </span>
        </div>

        <p className="mb-5 text-center text-xs text-stone-500 dark:text-stone-400">
          توزيع الآيات هنا مرن بحسب الصفحة، وقد يختلف عن أسطر النسخة المطبوعة.
        </p>

        {readingKhatma && !readingKhatma.completedAt && <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/40">
          <span className="text-stone-700 dark:text-stone-200">ختمة القراءة · {readingKhatma.completedPages.length} / 604 صفحة</span>
          <button type="button" onClick={() => onMarkPageRead?.(page)} disabled={readingKhatma.completedPages.includes(page)} className="min-h-11 rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white disabled:bg-emerald-100 disabled:text-emerald-900 dark:disabled:bg-emerald-900 dark:disabled:text-emerald-100">
            {readingKhatma.completedPages.includes(page) ? 'تم تسجيل الصفحة كمقروءة' : 'تسجيل الصفحة كمقروءة'}
          </button>
        </div>}
        {readingKhatmaError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{readingKhatmaError}</p>}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-28 text-emerald-800 dark:text-emerald-300">
            <RefreshCw className="h-7 w-7 animate-spin" />
            <p className="text-sm font-semibold">جارٍ فتح صفحات المصحف الشريف...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && loadError && (
          <div role="alert" className="space-y-4 py-20 text-center text-sm text-rose-700 dark:text-rose-300">
            <p className="font-bold">{loadError}</p>
            <button
              type="button"
              onClick={() => setRetry(val => val + 1)}
              className="rounded-xl bg-rose-700 hover:bg-rose-800 px-5 py-2 text-xs font-bold text-white transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        )}

        {/* Verses Flow with Authentic Typography */}
        {!isLoading && !loadError && ayahs.length > 0 && (
          <div className="text-right font-quran text-[1.55rem] md:text-[1.85rem] leading-[2.55] md:leading-[2.75] text-stone-950 dark:text-stone-100 selection:bg-amber-200 selection:text-stone-950">
            {ayahs.map((ayah, index) => {
              const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
              const isCurrent = playingIndex === index && isPlaying;
              return (
                <React.Fragment key={ayah.number}>
                  {/* Ornate Surah Header Banner when a Surah Starts on this Page */}
                  {ayah.numberInSurah === 1 && (
                    <div className="my-8 text-center">
                      <div className="surah-header-banner rounded-2xl py-4 px-6 text-white my-4 relative overflow-hidden shadow-md">
                        <div className="flex items-center justify-between text-xs text-amber-200/90 font-sans-ui border-b border-amber-400/30 pb-2 mb-2">
                          <span>{surah?.revelationType || 'مكية'}</span>
                          <h3 className="font-quran text-2xl md:text-3xl font-bold text-amber-300 tracking-wide">
                            سورة {surah?.name || ayah.surahNumber}
                          </h3>
                          <span>{surah?.versesCount} آيات</span>
                        </div>
                      </div>

                      {/* Sacred Basmalah Presentation */}
                      {ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && (
                        <p className="font-quran text-2xl md:text-3xl text-emerald-950 dark:text-emerald-100 py-3 text-center tracking-wide">
                          <QuranBasmala surahNumber={ayah.surahNumber} />
                        </p>
                      )}
                    </div>
                  )}

                  {/* Interactive Ayah Button with Hover / Active states */}
                  <button
                    id={'wird-ayah-' + ayah.surahNumber + '-' + ayah.numberInSurah}
                    type="button"
                    onClick={() => setTafsirAyah(ayah)}
                    title={`عرض التفسير المعتمد لسورة ${surah?.name || ayah.surahNumber}، الآية ${ayah.numberInSurah}`}
                    className={`inline rounded-xl px-1.5 py-0.5 text-right transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#e8dfc9] dark:bg-[#1d4940] ring-2 ring-[#b99b62] shadow-xs'
                        : 'hover:bg-[#e8dfc9]/50 dark:hover:bg-[#18332e]/60'
                    }`}
                  >
                    <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>
                    <span
                      className="ayah-number"
                      title={`الآية ${ayah.numberInSurah}`}
                    >
                      {ayah.numberInSurah}
                    </span>
                  </button>

                  {/* Discrete Ayah Audio Button */}
                  <button
                    type="button"
                    onClick={() => playAyahAt(index)}
                    aria-label={`استماع للآية ${ayah.numberInSurah} من سورة ${surah?.name || ayah.surahNumber}`}
                    title={`استماع للآية ${ayah.numberInSurah}`}
                    className={`mx-1 inline-flex h-6 w-6 translate-y-[-2px] items-center justify-center rounded-full text-[10px] transition-colors ${
                      isCurrent
                        ? 'bg-[#b99b62] text-[#102d29]'
                        : 'bg-[#102d29]/5 text-[#102d29] hover:bg-[#102d29]/15 dark:bg-[#18332e] dark:text-[#dfcaa2]'
                    }`}
                  >
                    {isCurrent ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Bottom Margins of the Sacred Page */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#d4af37]/40 dark:border-[#785310]/60 pt-4 text-[11px] text-stone-500 dark:text-stone-400">
          <span className="max-w-[72%]">{QURAN_DATA_SOURCE_INFO.displayEdition} {QURAN_DATA_SOURCE_INFO.displayVersion} · {QURAN_DATA_SOURCE_INFO.displayScript} · CC BY 3.0</span>
          <a href={QURAN_DATA_SOURCE_INFO.displaySourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-800 dark:text-emerald-300 underline underline-offset-2">Tanzil Project</a>
          <span className="font-quran text-sm text-stone-600 dark:text-stone-300 font-bold">
            — {page} —
          </span>
          <span>
            {ayahs.length ? `من الآية ${ayahs[0].number} إلى ${ayahs[ayahs.length - 1].number}` : '—'}
          </span>
        </div>
          </div>
        )}
      </main>

      {/* Helpful Hint */}
      <div className="text-center text-xs text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>انقر على أي آية لفتح التفسير المنقح من Quran.com مع إمكانية التبديل بين أمهات التفاسير والنسخ الفوري.</span>
      </div>

      {/* Multi-Edition Tafsir Sheet */}
      <TafsirSheet ayah={tafsirAyah} onClose={() => setTafsirAyah(null)} />
    </div>
  );
};
