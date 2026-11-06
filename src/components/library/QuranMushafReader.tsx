import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Play, Pause, Volume2, BookOpen, RefreshCw } from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { QURAN_PAGE_INDEX } from '../../data/quranPageIndex.generated';
import { QURAN_JUZ_STARTS, QURAN_HIZB_QUARTER_STARTS } from '../../data/quranNavigationIndex.generated';
import { loadSurahVerses } from '../../data/quranDataLoader';
import { RECITERS, formatAyahAudioUrl } from '../../services/audioService';
import { getSavedPlaybackRate, savePlaybackRate } from '../../services/audioPreferences';
import type { PlaybackRate } from '../../services/audioPreferences';
import type { Ayah, ReciterId } from '../../types/quran';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { TafsirSheet } from './TafsirSheet';

interface QuranMushafReaderProps {
  preferredReciter: ReciterId;
  onBack: () => void;
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
    return [...new Set(value.filter((page): page is number => Number.isInteger(page) && page >= 1 && page <= 604))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export const QuranMushafReader: React.FC<QuranMushafReaderProps> = ({ preferredReciter, onBack }) => {
  const [page, setPage] = useState(readLastPage);
  const [pageInput, setPageInput] = useState(String(readLastPage()));
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayNextPageRef = useRef(false);
  const pendingTargetRef = useRef<{ surahNumber: number; ayahNumber: number } | null>(null);

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
    autoPlayNextPageRef.current = false;
    stopAudio();
    setPage(nextPage);
  };

  const jumpToNavigationPoint = (point: NavigationPoint) => {
    pendingTargetRef.current = { surahNumber: point.surahNumber, ayahNumber: point.ayahNumber };
    if (point.page === page && ayahs.length) {
      document.getElementById('wird-ayah-' + point.surahNumber + '-' + point.ayahNumber)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingTargetRef.current = null;
      return;
    }
    changePage(point.page);
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
    if (surah) jumpToNavigationPoint({ surahNumber, ayahNumber: 1, page: surah.pageStart });
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

  const currentBookmark = bookmarks.includes(page);

  return (
    <div className="space-y-5" dir="rtl">
      <header className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/90 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => { stopAudio(); onBack(); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700">
            <ArrowRight className="h-4 w-4" /> العودة إلى مكتبة السور
          </button>
          <div className="text-center">
            <h2 className="font-quran text-xl md:text-2xl font-bold text-emerald-900 dark:text-emerald-200">المصحف الشريف</h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">مصحف المدينة · رواية حفص عن عاصم · 604 صفحة</p>
          </div>
          <button type="button" onClick={toggleBookmark} aria-pressed={currentBookmark} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-800 px-3 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30">
            {currentBookmark ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {currentBookmark ? 'إزالة العلامة' : 'حفظ الصفحة'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 p-2">
            <span className="text-xs text-stone-500 whitespace-nowrap">الصفحة</span>
            <input aria-label="رقم صفحة المصحف" type="number" min={1} max={604} value={pageInput} onChange={event => setPageInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submitPageJump(); }} className="min-w-0 w-full bg-transparent text-sm font-bold tabular-nums outline-none" />
            <button type="button" onClick={submitPageJump} className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white">اذهب</button>
          </div>
          <select aria-label="الانتقال إلى سورة" defaultValue="" onChange={event => { if (event.target.value) jumpToSurah(Number(event.target.value)); event.currentTarget.value = ''; }} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 px-3 py-2 text-xs">
            <option value="">انتقال إلى سورة...</option>
            {ALL_SURAHS.map(surah => <option key={surah.number} value={surah.number}>{surah.number}. سورة {surah.name}</option>)}
          </select>
          <select aria-label="الانتقال إلى جزء" defaultValue="" onChange={event => { if (event.target.value) jumpToJuz(Number(event.target.value)); event.currentTarget.value = ''; }} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 px-3 py-2 text-xs">
            <option value="">انتقال إلى جزء...</option>
            {Array.from({ length: 30 }, (_, index) => index + 1).map(juz => <option key={juz} value={juz}>الجزء {juz}</option>)}
          </select>
          <select aria-label="الانتقال إلى ربع حزب" defaultValue="" onChange={event => { if (event.target.value) jumpToHizbQuarter(Number(event.target.value)); event.currentTarget.value = ''; }} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 px-3 py-2 text-xs">
            <option value="">انتقال إلى ربع حزب...</option>
            {Array.from({ length: 240 }, (_, index) => index + 1).map(quarter => <option key={quarter} value={quarter}>ربع الحزب {quarter}</option>)}
          </select>
          <select aria-label="الانتقال إلى علامة محفوظة" defaultValue="" onChange={event => { if (event.target.value) changePage(Number(event.target.value)); event.currentTarget.value = ''; }} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 px-3 py-2 text-xs">
            <option value="">العلامات المحفوظة ({bookmarks.length})</option>
            {bookmarks.map(savedPage => <option key={savedPage} value={savedPage}>صفحة {savedPage}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 dark:border-stone-700 pt-3">
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-2 text-xs font-semibold disabled:opacity-40"><ChevronRight className="h-4 w-4" /> السابقة</button>
            <span className="text-xs font-bold tabular-nums text-stone-600 dark:text-stone-300">صفحة {page} من 604</span>
            <button type="button" disabled={page >= 604} onClick={() => changePage(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-2 text-xs font-semibold disabled:opacity-40">التالية <ChevronLeft className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-stone-500"><Volume2 className="h-4 w-4" />
              <select aria-label="القارئ" value={activeReciter} onChange={event => { stopAudio(); setActiveReciter(event.target.value as ReciterId); }} className="rounded-lg border border-stone-200 dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 px-2 py-1.5">
                {RECITERS.map(reciter => <option key={reciter.id} value={reciter.id}>{reciter.name}</option>)}
              </select>
            </label>
            <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
            <button type="button" onClick={togglePageAudio} disabled={!ayahs.length || isLoading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'إيقاف مؤقت' : 'استماع للصفحة'}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl rounded-2xl border border-amber-200/80 dark:border-stone-700 bg-[#fffdf8] dark:bg-stone-900 px-5 py-7 md:px-10 md:py-10 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-amber-200/70 dark:border-stone-700 pb-3 text-[11px] text-stone-500">
          <span>{QURAN_DATA_SOURCE_INFO.edition} · {QURAN_DATA_SOURCE_INFO.narration}</span>
          <span>الجزء {ayahs[0]?.juz ?? '—'}</span>
        </div>

        {isLoading && <div className="flex items-center justify-center gap-3 py-20 text-sm text-stone-500"><RefreshCw className="h-5 w-5 animate-spin" /> جارٍ تحميل الصفحة من النص القرآني المحلي...</div>}
        {!isLoading && loadError && <div role="alert" className="space-y-3 py-16 text-center text-sm text-rose-700 dark:text-rose-300"><p>{loadError}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">إعادة المحاولة</button></div>}
        {!isLoading && !loadError && ayahs.length > 0 && (
          <div className="text-right font-quran text-[1.45rem] md:text-[1.8rem] leading-[2.5] md:leading-[2.65] text-stone-900 dark:text-stone-100">
            {ayahs.map((ayah, index) => {
              const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
              const isCurrent = playingIndex === index && isPlaying;
              return (
                <React.Fragment key={ayah.number}>
                  {ayah.numberInSurah === 1 && (
                    <div className="my-5 text-center">
                      <h3 className="font-quran text-xl md:text-2xl font-bold text-emerald-900 dark:text-emerald-200">سورة {surah?.name || ayah.surahNumber}</h3>
                      {ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && <p className="mt-3 text-xl text-stone-700 dark:text-stone-300">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>}
                    </div>
                  )}
                  <button id={\`wird-ayah-\${ayah.surahNumber}-\${ayah.numberInSurah}\`} type="button" onClick={() => setTafsirAyah(ayah)} title={`عرض تفسير سورة ${surah?.name || ayah.surahNumber} الآية ${ayah.numberInSurah}`} className={`inline rounded-lg px-1 text-right transition-colors hover:bg-amber-100/70 dark:hover:bg-stone-800 ${isCurrent ? 'bg-amber-100 dark:bg-amber-950/60' : ''}`}>
                    {ayah.text}{' '}
                    <span className="inline-flex h-7 w-7 translate-y-[-2px] items-center justify-center rounded-full border border-amber-400/70 text-[10px] font-sans text-amber-800 dark:text-amber-300">{ayah.numberInSurah}</span>
                  </button>
                  <button type="button" onClick={() => playAyahAt(index)} aria-label={`استماع للآية ${ayah.numberInSurah} من سورة ${surah?.name || ayah.surahNumber}`} className="mx-1 inline-flex h-7 w-7 translate-y-[-2px] items-center justify-center rounded-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
                    {isCurrent ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/70 dark:border-stone-700 pt-4 text-[10px] text-stone-500">
          <span>النص: مشروع تنزيل · CC BY 3.0</span>
          <span>{ayahs.length ? `من الآية ${ayahs[0].number} إلى ${ayahs[ayahs.length - 1].number} في ترتيب المصحف` : '—'}</span>
        </div>
      </section>

      <div className="text-center text-[11px] text-stone-500 dark:text-stone-400">اضغط على أي آية لفتح التفسير الميسر. يتم حفظ آخر صفحة وعلاماتك المرجعية على هذا الجهاز.</div>
      <TafsirSheet ayah={tafsirAyah} onClose={() => setTafsirAyah(null)} />
    </div>
  );
};
