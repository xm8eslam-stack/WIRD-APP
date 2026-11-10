import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Play,
  Pause,
  Volume2,
  BookOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Bookmark,
  Layers,
  Copy,
  Check,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
  ExternalLink,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { ALL_SURAHS, JUZ_NAMES } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { loadSurahVerses, getAyahDisplayText } from '../../data/quranDataLoader';
import { TafsirSheet } from './TafsirSheet';
import { Ayah, SurahMeta, ReciterId } from '../../types/quran';
import { RECITERS, formatAyahAudioUrl, requestOfflineAudioCache } from '../../services/audioService';
import { attachAyahRepeatHandler } from '../../services/audioRepeatController';
import { getSavedPlaybackRate, savePlaybackRate } from '../../services/audioPreferences';
import type { PlaybackRate } from '../../services/audioPreferences';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { QuranMushafReader } from './QuranMushafReader';
import { QURAN_JUZ_STARTS } from '../../data/quranNavigationIndex.generated';
import {
  clearReadingKhatma,
  markReadingPage,
  pauseReadingKhatma,
  readReadingKhatma,
  resumeReadingKhatma,
  startReadingKhatma,
  updateReadingKhatmaPlan
} from '../../services/readingKhatmaService';
import type { ReadingKhatma } from '../../services/readingKhatmaService';
import { ReadingKhatmaPanel } from './ReadingKhatmaPanel';
import { QuranText } from '../shared/QuranText';
import { QuranBasmala } from '../shared/QuranBasmala';
import { QuranTypographyLab } from './QuranTypographyLab';
import { WirdIslamicPattern } from '../brand/WirdPattern';

interface QuranLibraryViewProps {
  onStartSession: (surahNumber: number, startAyah?: number, endAyah?: number) => void;
  preferredReciter: ReciterId;
}

type MainTab = 'surahs' | 'juz' | 'study';
type StudyLayout = 'ayah-cards' | 'continuous';
type QuranReadingPosition = { surahNumber: number; ayahNumber: number };

const JUZ_INDEX = QURAN_JUZ_STARTS as unknown as Record<string, { surahNumber: number; ayahNumber: number; page: number }>;
const LAST_READING_POSITION_KEY = 'wird.quran.lastReadingPosition.v1';

function readLastReadingPosition(): QuranReadingPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_READING_POSITION_KEY) || 'null') as QuranReadingPosition | null;
    if (!value || !Number.isInteger(value.surahNumber) || !Number.isInteger(value.ayahNumber)) return null;
    const surah = ALL_SURAHS[value.surahNumber - 1];
    return surah && value.ayahNumber >= 1 && value.ayahNumber <= surah.versesCount ? value : null;
  } catch {
    return null;
  }
}

export const QuranLibraryView: React.FC<QuranLibraryViewProps> = ({
  onStartSession,
  preferredReciter: initialReciter
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('surahs');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJuz, setSelectedJuz] = useState<number | 'all'>('all');
  const [revelationFilter, setRevelationFilter] = useState<'all' | 'مكية' | 'مدنية'>('all');
  const [selectedSurah, setSelectedSurah] = useState<SurahMeta>(ALL_SURAHS[0]); // Default to Al-Fatihah (1)
  const [currentAyahs, setCurrentAyahs] = useState<Ayah[]>([]);
  const [isLoadingSurah, setIsLoadingSurah] = useState(false);
  const [surahLoadError, setSurahLoadError] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [tafsirAyah, setTafsirAyah] = useState<Ayah | null>(null);

  // Font size adjustment for Quran text in Study mode
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('large');
  const [showMushafReader, setShowMushafReader] = useState(false);
  const [studyLayout, setStudyLayout] = useState<StudyLayout>('ayah-cards');
  const [showTypographyLab, setShowTypographyLab] = useState(false);
  const [lastReadingPosition, setLastReadingPosition] = useState<QuranReadingPosition | null>(readLastReadingPosition);
  const [resumeTarget, setResumeTarget] = useState<QuranReadingPosition | null>(null);
  const [mushafInitialPage, setMushafInitialPage] = useState<number | undefined>(undefined);
  const [copiedAyahNumber, setCopiedAyahNumber] = useState<number | null>(null);
  const [readingKhatma, setReadingKhatma] = useState<ReadingKhatma | null>(() => readReadingKhatma());
  const [readingKhatmaError, setReadingKhatmaError] = useState('');

  // Audio state
  const [activeReciter, setActiveReciter] = useState<ReciterId>(initialReciter || 'alafasy');
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(() => getSavedPlaybackRate());
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [repeatTarget, setRepeatTarget] = useState<number>(1);
  const [currentRepeatCount, setCurrentRepeatCount] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRepeatCountRef = useRef(1);
  const repeatTargetRef = useRef(repeatTarget);

  // Filter surahs
  const filteredSurahs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return ALL_SURAHS.filter(surah => {
      const matchesSearch =
        !term ||
        surah.name.includes(term) ||
        surah.englishName.toLowerCase().includes(term) ||
        String(surah.number) === term;
      const matchesJuz = selectedJuz === 'all' || (surah.juzStart <= selectedJuz && surah.juzEnd >= selectedJuz);
      const matchesType = revelationFilter === 'all' || surah.revelationType === revelationFilter;
      return matchesSearch && matchesJuz && matchesType;
    });
  }, [searchTerm, selectedJuz, revelationFilter]);

  // Lazy-load the selected Surah verses only when needed
  useEffect(() => {
    let cancelled = false;
    if (showMushafReader || activeTab !== 'study') return () => { cancelled = true; };

    setCurrentAyahs([]);
    setIsLoadingSurah(true);
    setSurahLoadError(false);

    loadSurahVerses(selectedSurah.number)
      .then(ayahs => {
        if (!cancelled) setCurrentAyahs(ayahs);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('[WIRD Quran Library] Failed to load Surah ' + selectedSurah.number, error);
          setSurahLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSurah(false);
      });

    return () => { cancelled = true; };
  }, [selectedSurah.number, loadRetry, showMushafReader, activeTab]);

  useEffect(() => {
    if (!resumeTarget || activeTab !== 'study' || showMushafReader || selectedSurah.number !== resumeTarget.surahNumber || !currentAyahs.some(ayah => ayah.numberInSurah === resumeTarget.ayahNumber)) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`continuous-ayah-${resumeTarget.ayahNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setResumeTarget(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [resumeTarget, activeTab, showMushafReader, selectedSurah.number, currentAyahs]);

  const rememberReadingPosition = (ayahNumber: number) => {
    const position = { surahNumber: selectedSurah.number, ayahNumber };
    setLastReadingPosition(position);
    try { localStorage.setItem(LAST_READING_POSITION_KEY, JSON.stringify(position)); } catch { /* Keep the current read usable when storage is unavailable. */ }
  };

  const handleResumeReading = () => {
    if (!lastReadingPosition) return;
    const surah = ALL_SURAHS[lastReadingPosition.surahNumber - 1];
    if (!surah) return;
    setResumeTarget(lastReadingPosition);
    setStudyLayout('continuous');
    setSelectedSurah(surah);
    setActiveTab('study');
  };

  // Audio playback uses refs for event-driven repeat state; React state is UI-only.
  const handlePlayAyah = (ayahNumberInSurah: number) => {
    rememberReadingPosition(ayahNumberInSurah);
    if (playingAyah === ayahNumberInSurah && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(error => {
          console.warn('Audio resume failed', error);
          setIsPlaying(false);
        });
      }
      return;
    }

    const audioUrl = formatAyahAudioUrl(selectedSurah.number, ayahNumberInSurah, activeReciter);
    requestOfflineAudioCache(
      currentAyahs.filter(ayah => ayah.numberInSurah >= ayahNumberInSurah).slice(0, 20)
        .map(ayah => formatAyahAudioUrl(selectedSurah.number, ayah.numberInSurah, activeReciter))
    );
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
    }

    currentRepeatCountRef.current = 1;
    repeatTargetRef.current = repeatTarget;
    setCurrentRepeatCount(1);

    const audio = new Audio(audioUrl);
    audio.playbackRate = getSavedPlaybackRate();
    audioRef.current = audio;
    setPlayingAyah(ayahNumberInSurah);
    setIsPlaying(true);

    attachAyahRepeatHandler(
      audio,
      currentRepeatCountRef,
      repeatTargetRef,
      setCurrentRepeatCount,
      () => {
        const nextAyah = ayahNumberInSurah + 1;
        const hasNext = currentAyahs.some(a => a.numberInSurah === nextAyah);
        if (hasNext) {
          handlePlayAyah(nextAyah);
        } else {
          audioRef.current = null;
          setIsPlaying(false);
          setPlayingAyah(null);
        }
      },
      () => {
        audio.onended = null;
        audioRef.current = null;
        currentRepeatCountRef.current = 1;
        setCurrentRepeatCount(1);
        setIsPlaying(false);
        setPlayingAyah(null);
      }
    );

    audio.onerror = () => {
      audio.onended = null;
      audioRef.current = null;
      currentRepeatCountRef.current = 1;
      setCurrentRepeatCount(1);
      setIsPlaying(false);
      setPlayingAyah(null);
    };

    audio.play().catch(error => {
      console.warn('Audio play prevented or unavailable', error);
      audio.onended = null;
      audioRef.current = null;
      currentRepeatCountRef.current = 1;
      setCurrentRepeatCount(1);
      setIsPlaying(false);
      setPlayingAyah(null);
    });
  };

  const handleNextAyah = () => {
    if (!currentAyahs.length) return;
    const current = playingAyah || 1;
    const next = current + 1;
    if (next <= selectedSurah.versesCount) {
      setCurrentRepeatCount(1);
      handlePlayAyah(next);
    }
  };

  const handlePrevAyah = () => {
    if (!currentAyahs.length) return;
    const current = playingAyah || 1;
    const prev = current - 1;
    if (prev >= 1) {
      setCurrentRepeatCount(1);
      handlePlayAyah(prev);
    }
  };

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    if (audioRef.current) audioRef.current.playbackRate = savedRate;
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    currentRepeatCountRef.current = 1;
    setIsPlaying(false);
    setPlayingAyah(null);
    setCurrentRepeatCount(1);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleOpenStudy = (surah: SurahMeta) => {
    handleStopAudio();
    setSelectedSurah(surah);
    setActiveTab('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMushafPage = (pageNumber: number) => {
    handleStopAudio();
    setMushafInitialPage(pageNumber);
    setShowMushafReader(true);
  };

  const handleCopyAyah = async (ayah: Ayah) => {
    const displayText = await getAyahDisplayText(ayah);
    const text = `﴿ ${displayText} ﴾ [سورة ${selectedSurah.name}: ${ayah.numberInSurah}]`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedAyahNumber(ayah.numberInSurah);
      setTimeout(() => setCopiedAyahNumber(null), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  if (showMushafReader) {
    return (
      <QuranMushafReader
        preferredReciter={activeReciter}
        initialPage={mushafInitialPage}
        onBack={() => setShowMushafReader(false)}
        readingKhatma={readingKhatma}
        readingKhatmaError={readingKhatmaError}
        onMarkPageRead={page => { try { setReadingKhatma(markReadingPage(page)); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تسجيل الصفحة.'); } }}
      />
    );
  }

  const activeReciterName = RECITERS.find(r => r.id === activeReciter)?.name || 'مشاري العفاسي';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-24">
      {lastReadingPosition && (
        <button type="button" onClick={handleResumeReading} className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
          متابعة آخر موضع قراءة · سورة {ALL_SURAHS[lastReadingPosition.surahNumber - 1]?.name} · الآية {lastReadingPosition.ayahNumber}
        </button>
      )}
      <ReadingKhatmaPanel
        khatma={readingKhatma}
        error={readingKhatmaError}
        onStart={plan => { try { setReadingKhatma(startReadingKhatma(localStorage, new Date(), plan)); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر بدء الختمة.'); } }}
        onReset={() => { try { clearReadingKhatma(); setReadingKhatma(null); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إعادة ضبط الختمة.'); } }}
        onPause={() => { try { setReadingKhatma(pauseReadingKhatma()); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إيقاف الختمة مؤقتاً.'); } }}
        onResume={() => { try { setReadingKhatma(resumeReadingKhatma()); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر استئناف الختمة.'); } }}
        onUpdatePlan={plan => { try { setReadingKhatma(updateReadingKhatmaPlan(plan)); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تحديث خطة الختمة.'); } }}
        onContinue={page => handleOpenMushafPage(page)}
      />
      {/* 1. Hero Quran.com Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#102D29] via-[#1D4940] to-[#102D29] text-white p-7 md:p-10 shadow-xl border border-[#B99B62]/30">
        <WirdIslamicPattern opacity={0.06} className="text-white" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-radial from-[#B99B62]/20 via-transparent to-transparent rounded-full -translate-x-20 -translate-y-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl text-right">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#DFCAA2] bg-[#102D29]/60 border border-[#B99B62]/40 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#B99B62]" />
              <span>قراءة القرآن الكريم · برواية حفص عن عاصم</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-quran text-[#F6F3EA] tracking-wide leading-tight">
              القرآن الكريم
            </h1>
            <p className="text-[#E8DFC9]/90 text-sm md:text-base leading-relaxed font-sans-ui">
              تصفّح سور القرآن الكريم الـ 114 كاملة مع الاستماع المباشر لكبار القرّاء، وعرض التفسير المعتمد من منصة Quran.com، والقراءة بصفحات المصحف الشريف.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenMushafPage(selectedSurah.pageStart)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl wird-btn-accent text-sm font-bold shadow-lg"
            >
              <BookOpen className="w-4 h-4 fill-[#102D29]" />
              <span>فتح المصحف بالصفحات (604)</span>
            </button>
          </div>
        </div>

        {/* Search Bar (Centered like Quran.com) */}
        <div className="mt-8 max-w-3xl mx-auto relative">
          <Search className="w-5 h-5 text-stone-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن أي سورة، رقمها، أو جزء (مثال: الملك، 67، البقرة، جزء عم)..."
            className="w-full pl-4 pr-12 py-4 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md text-stone-900 dark:text-stone-100 rounded-2xl text-sm md:text-base shadow-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:text-stone-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* 2. Top Segmented Navigation Tabs (Quran.com Style) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-2">
        <div className="flex items-center gap-2 p-1 bg-stone-100 dark:bg-stone-800/80 rounded-2xl border border-stone-200/80 dark:border-stone-700/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('surahs')}
            aria-pressed={activeTab === 'surahs'}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'surahs'
                ? 'bg-[#102D29] dark:bg-[#1D4940] text-white shadow-xs font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            السور ({filteredSurahs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('juz')}
            aria-pressed={activeTab === 'juz'}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === 'juz'
                ? 'bg-[#102D29] dark:bg-[#1D4940] text-white shadow-xs font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            الأجزاء (30 جزء)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('study')}
            aria-pressed={activeTab === 'study'}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'study'
                ? 'bg-[#102D29] dark:bg-[#1D4940] text-white shadow-xs font-bold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>تلاوة ودراسة: سورة {selectedSurah.name}</span>
          </button>
        </div>

        {/* Global Controls in Top Bar: Reciter + Speed */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-white dark:bg-stone-800/90 border border-stone-200 dark:border-stone-700 px-3 py-1.5 rounded-xl shadow-2xs">
            <Volume2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="text-stone-500 hidden sm:inline">القارئ:</span>
            <select
              aria-label="اختيار القارئ"
              value={activeReciter}
              onChange={(e) => {
                handleStopAudio();
                setActiveReciter(e.target.value as ReciterId);
              }}
              className="bg-transparent text-xs font-semibold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
            >
              {RECITERS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
        </div>
      </div>

      {/* 3. TAB 1: SURAHS DIRECTORY GRID (Like Quran.com Home) */}
      {activeTab === 'surahs' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Revelation Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-semibold">تصنيف النزول:</span>
              <div className="inline-flex p-1 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setRevelationFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    revelationFilter === 'all'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setRevelationFilter('مكية')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    revelationFilter === 'مكية'
                      ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-300 shadow-2xs font-bold'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  مكية
                </button>
                <button
                  type="button"
                  onClick={() => setRevelationFilter('مدنية')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    revelationFilter === 'مدنية'
                      ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-300 shadow-2xs font-bold'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  مدنية
                </button>
              </div>
            </div>

            <div className="text-stone-500 text-xs">
              عرض {filteredSurahs.length} من أصل 114 سورة
            </div>
          </div>

          {/* 3-Column Responsive Surahs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSurahs.map((surah) => {
              const isSelected = selectedSurah.number === surah.number;
              return (
                <article
                  key={surah.number}
                  className={`group relative p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#102D29]/5 dark:bg-[#1D4940]/25 border-[#B99B62] shadow-sm ring-1 ring-[#B99B62]/40'
                      : 'bg-white dark:bg-[#122723] border-stone-200/90 dark:border-stone-800 hover:border-[#B99B62] hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Surah Number Badge */}
                      <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-[#18332E] border border-stone-200 dark:border-stone-700/80 flex items-center justify-center font-mono font-bold text-xs text-stone-700 dark:text-[#DFCAA2] group-hover:bg-[#102D29] group-hover:text-white group-hover:border-[#B99B62] transition-colors">
                        {surah.number}
                      </div>

                      <div className="text-right">
                        <h3 className="font-quran text-xl font-bold">
                          <button
                            type="button"
                            onClick={() => handleOpenStudy(surah)}
                            aria-label={`فتح سورة ${surah.name} للدراسة`}
                            aria-pressed={isSelected}
                            className="text-right text-stone-900 dark:text-[#F6F3EA] hover:text-[#102D29] dark:hover:text-[#DFCAA2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B99B62] rounded-md transition-colors"
                          >
                            سورة {surah.name}
                          </button>
                        </h3>
                        <p className="text-xs text-stone-400 font-sans tracking-wide">
                          {surah.englishName}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                      {surah.revelationType}
                    </span>
                  </div>

                  {/* Unboxed Metadata & Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span>{surah.versesCount} آيات</span>
                      <span aria-hidden="true">·</span>
                      <span>صفحة {surah.pageStart}</span>
                      <span aria-hidden="true">·</span>
                      <span>الجزء {surah.juzStart}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenMushafPage(surah.pageStart);
                        }}
                        title="قراءة في المصحف"
                        aria-label={`قراءة سورة ${surah.name} في المصحف`}
                        className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950 text-stone-500 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onStartSession(surah.number, 1, Math.min(10, surah.versesCount));
                        }}
                        title="بدء حفظ السورة"
                        aria-label={`بدء جلسة حفظ لسورة ${surah.name}`}
                        className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950 text-stone-500 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredSurahs.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 text-stone-500 text-sm">
              لم يتم العثور على سور مطابقة لكلمة البحث. جرّب البحث برقم السورة أو كتابة اسم آخر.
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: JUZ DIRECTORY GRID (30 Juz) */}
      {activeTab === 'juz' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 30 }, (_, index) => index + 1).map((juzNumber) => {
              const point = JUZ_INDEX[String(juzNumber)];
              const startSurah = point ? ALL_SURAHS.find(s => s.number === point.surahNumber) : undefined;
              const juzName = JUZ_NAMES[juzNumber - 1] || `الجزء ${juzNumber}`;

              return (
                <div
                  key={juzNumber}
                  className="p-5 rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900/90 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300/60 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
                        {juzNumber}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                          {juzName}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          يبدأ من: سورة {startSurah?.name || '—'} (الآية {point?.ayahNumber || 1})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-stone-500 text-[11px]">
                      صفحة {point?.page || Math.ceil((juzNumber - 1) * 20 + 2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenMushafPage(point?.page || 1)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 font-bold transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>قراءة الجزء</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: VERSE-BY-VERSE STUDY & RECITATION VIEW (Quran.com Style) */}
      {activeTab === 'study' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Surah Header Card with Calligraphy and Metadata */}
          <div className="rounded-3xl border border-amber-300/80 dark:border-stone-800 bg-gradient-to-br from-[#faf4e6] to-[#f4eedb] dark:from-stone-900 dark:to-stone-950 p-6 md:p-8 text-center relative overflow-hidden shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950/80 dark:text-amber-200 font-semibold border-b border-amber-200/80 dark:border-stone-800 pb-3 mb-4">
              <span>الجزء {selectedSurah.juzStart} {selectedSurah.juzEnd !== selectedSurah.juzStart && `إلى ${selectedSurah.juzEnd}`}</span>
              <span className="font-quran text-lg text-emerald-900 dark:text-emerald-300 font-bold">
                سورة {selectedSurah.name} ({selectedSurah.englishName})
              </span>
              <span>{selectedSurah.revelationType} · صفحة {selectedSurah.pageStart}</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black font-quran text-emerald-950 dark:text-emerald-100 my-2">
              سُورَةُ {selectedSurah.name}
            </h2>

            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              عدد آياتها: <strong className="font-mono text-stone-900 dark:text-stone-100">{selectedSurah.versesCount}</strong> آية
            </p>

            {/* Sacred Basmalah */}
            {selectedSurah.number !== 1 && selectedSurah.number !== 9 && (
              <p className="font-quran text-2xl md:text-3xl text-emerald-900 dark:text-emerald-200 py-4 mt-2">
                <QuranBasmala surahNumber={selectedSurah.number} />
              </p>
            )}

            {/* Quick Action Shortcuts */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-amber-200/80 dark:border-stone-800">
              <button
                type="button"
                onClick={() => handlePlayAyah(1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>استماع للسورة من البداية</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenMushafPage(selectedSurah.pageStart)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-100 border border-stone-200 dark:border-stone-700 font-bold text-xs transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                <span>فتح صفحة {selectedSurah.pageStart} في المصحف</span>
              </button>

              <button
                type="button"
                onClick={() => onStartSession(selectedSurah.number, 1, Math.min(10, selectedSurah.versesCount))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-xs transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>بدء حفظ السورة في جلسة تفاعلية</span>
              </button>
            </div>
          </div>

          {/* Verses Container */}
          {isLoadingSurah && (
            <div className="py-24 text-center text-emerald-800 dark:text-emerald-400 space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold">جارٍ تحميل آيات سورة {selectedSurah.name}...</p>
            </div>
          )}

          {!isLoadingSurah && surahLoadError && (
            <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-3xl space-y-3">
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">تعذر تحميل نص السورة حالياً.</p>
              <button
                type="button"
                onClick={() => setLoadRetry(v => v + 1)}
                className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!isLoadingSurah && !surahLoadError && currentAyahs.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
                <p className="text-sm font-bold text-stone-800 dark:text-stone-100">طريقة عرض الآيات</p>
                <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="طريقة عرض آيات السورة" className="inline-flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
                  <button type="button" aria-pressed={studyLayout === 'ayah-cards'} onClick={() => setStudyLayout('ayah-cards')} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${studyLayout === 'ayah-cards' ? 'bg-white text-emerald-900 shadow-xs dark:bg-stone-700 dark:text-emerald-100' : 'text-stone-600 dark:text-stone-300'}`}>
                    آية آية
                  </button>
                  <button type="button" aria-pressed={studyLayout === 'continuous'} onClick={() => setStudyLayout('continuous')} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${studyLayout === 'continuous' ? 'bg-white text-emerald-900 shadow-xs dark:bg-stone-700 dark:text-emerald-100' : 'text-stone-600 dark:text-stone-300'}`}>
                    قراءة متصلة
                  </button>
                </div>
                <button type="button" aria-expanded={showTypographyLab} onClick={() => setShowTypographyLab(value => !value)} className="min-h-11 rounded-xl border border-emerald-700 px-3 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {showTypographyLab ? 'إخفاء مختبر الخطوط' : 'مختبر الخطوط'}
                </button>
                </div>
              </div>

              {showTypographyLab && <QuranTypographyLab onClose={() => setShowTypographyLab(false)} />}

              {studyLayout === 'continuous' ? (
                <div aria-label={`قراءة متصلة لسورة ${selectedSurah.name}`} className="rounded-3xl border border-stone-200 bg-[#fffefb] p-5 text-right shadow-xs dark:border-stone-800 dark:bg-stone-900 md:p-8">
                  <p className="quran-text font-quran text-2xl leading-[2.7] text-stone-950 dark:text-stone-100 md:text-3xl">
                    {currentAyahs.map(ayah => {
                      const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying;
                      return (
                        <React.Fragment key={ayah.number}>
                          <button
                            id={`continuous-ayah-${ayah.numberInSurah}`}
                            type="button"
                            onClick={() => { rememberReadingPosition(ayah.numberInSurah); setTafsirAyah(ayah); }}
                            aria-label={`تفسير سورة ${selectedSurah.name}، الآية ${ayah.numberInSurah}`}
                            className={`inline rounded-lg px-1 text-right align-baseline transition-colors ${isThisPlaying ? 'bg-amber-200/80 dark:bg-amber-950/80' : 'hover:bg-amber-100/70 dark:hover:bg-amber-950/40'}`}
                          >
                            <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>
                            <span className="ayah-number" aria-label={`الآية ${ayah.numberInSurah}`}>{ayah.numberInSurah}</span>
                          </button>{' '}
                          <button
                            type="button"
                            onClick={() => handlePlayAyah(ayah.numberInSurah)}
                            aria-label={`${isThisPlaying ? 'إيقاف' : 'استماع'} الآية ${ayah.numberInSurah} من سورة ${selectedSurah.name}`}
                            className={`mx-1 inline-flex min-h-11 min-w-11 translate-y-1 items-center justify-center rounded-full align-baseline ${isThisPlaying ? 'bg-amber-600 text-white' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'}`}
                          >
                            {isThisPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>{' '}
                        </React.Fragment>
                      );
                    })}
                  </p>
                  <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">اضغط نص الآية لفتح تفسيرها، أو زر الاستماع لبدء التلاوة منها.</p>
                </div>
              ) : (
            <div className="space-y-4">
              {currentAyahs.map((ayah) => {
                const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying;
                const isCopied = copiedAyahNumber === ayah.numberInSurah;

                return (
                  <article
                    key={ayah.numberInSurah}
                    id={`study-ayah-${ayah.numberInSurah}`}
                    className={`p-6 md:p-8 rounded-3xl border transition-all ${
                      isThisPlaying
                        ? 'bg-amber-50/90 dark:bg-stone-900 border-amber-400 dark:border-amber-700 shadow-md ring-2 ring-amber-400/40'
                        : 'bg-white dark:bg-stone-900/90 border-stone-200/90 dark:border-stone-800 hover:border-emerald-300'
                    }`}
                  >
                    {/* Top Verse Toolbar (Quran.com Style: Verse Key, Play, Tafsir, Copy, Memorize) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-100 dark:border-stone-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700">
                          {selectedSurah.number}:{ayah.numberInSurah}
                        </span>

                        <span className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:inline">
                          صفحة {ayah.page} · جزء {ayah.juz}
                        </span>

                        {ayah.sajda && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-300">
                            موضع سجدة
                          </span>
                        )}
                      </div>

                      {/* Action Icons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePlayAyah(ayah.numberInSurah)}
                          aria-label={isThisPlaying ? 'إيقاف تلاوة الآية' : 'استماع لتلاوة الآية'}
                          title={isThisPlaying ? 'إيقاف مؤقت' : 'استمع لتلاوة الآية'}
                          className={`p-2 rounded-xl transition-colors ${
                            isThisPlaying
                              ? 'bg-amber-500 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-emerald-100 hover:text-emerald-900'
                          }`}
                        >
                          {isThisPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => { rememberReadingPosition(ayah.numberInSurah); setTafsirAyah(ayah); }}
                          title="عرض التفسير المعتمد (Quran.com v4)"
                          aria-label={`تفسير الآية ${ayah.numberInSurah}`}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors font-bold text-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>التفسير</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyAyah(ayah)}
                          title="نسخ نص الآية الكريمة"
                          aria-label={`نسخ الآية ${ayah.numberInSurah}`}
                          className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 transition-colors"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onStartSession(selectedSurah.number, ayah.numberInSurah, ayah.numberInSurah)}
                          title="تدريب وحفظ هذه الآية"
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors font-semibold text-xs border border-amber-200/80 dark:border-amber-900/60"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span className="hidden sm:inline">تدريب وحفظ</span>
                        </button>
                      </div>
                    </div>

                    {/* Canonical Ayah Text */}
                    <div className="py-2 text-right">
                      <p className="font-quran text-2xl md:text-3xl leading-[2.6] text-stone-950 dark:text-stone-100 selection:bg-amber-200">
                        <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>{' '}
                        <span className="ayah-number" title={`الآية ${ayah.numberInSurah}`}>
                          {ayah.numberInSurah}
                        </span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Sticky Bottom Audio Player Bar (Quran.com Signature Component) */}
      {(isPlaying || playingAyah !== null) && (
        <aside
          role="region"
          aria-label="مشغل التلاوة الصوتي"
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200/90 dark:border-stone-800 shadow-2xl px-4 py-3 transition-transform animate-in slide-in-from-bottom duration-300"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Playing Context */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                <Volume2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0 text-right">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm truncate font-quran">
                  سورة {selectedSurah.name} · الآية {playingAyah || 1}
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  القارئ: {activeReciterName} {repeatTarget > 1 ? `· التكرار: ${currentRepeatCount}/${repeatTarget}` : ''}
                </p>
              </div>
            </div>

            {/* Playback Controls (Prev, Play/Pause, Next, Repeat) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevAyah}
                aria-label="الآية السابقة"
                title="الآية السابقة"
                className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => playingAyah && handlePlayAyah(playingAyah)}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'استئناف'}
                className="w-11 h-11 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white mr-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleNextAyah}
                aria-label="الآية التالية"
                title="الآية التالية"
                className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Repeat selector for memorization */}
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-xl text-xs">
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                <select
                  aria-label="مرات تكرار الآية للحفظ"
                  value={repeatTarget}
                  onChange={(e) => {
                    const nextTarget = Number(e.target.value);
                    repeatTargetRef.current = nextTarget;
                    setRepeatTarget(nextTarget);
                  }}
                  className="bg-transparent text-xs font-semibold text-stone-800 dark:text-stone-200 cursor-pointer focus:outline-none"
                >
                  <option value={1}>1x</option>
                  <option value={3}>3x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              </div>
            </div>

            {/* Close / Stop */}
            <div className="flex items-center gap-2">
              <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
              <button
                type="button"
                onClick={handleStopAudio}
                aria-label="إغلاق المشغل"
                title="إيقاف وإغلاق المشغل"
                className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 7. Verification & Integrity Footer */}
      <footer className="bg-[#fcfaf7] dark:bg-stone-900 rounded-3xl p-6 border border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-stone-900 dark:text-stone-200 flex items-center gap-2">
              <span>قاعدة البيانات القرآنية الموثقة — 114 سورة كاملة (6,236 آية)</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md font-mono">
                Hafs 'an Asim
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              النص المرجعي العثماني محفوظ دون تغيير، والعرض الافتراضي يستخدم نص Tanzil الرسمي بالرسم الإملائي Simple 1.1 كامل التشكيل.
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] space-y-0.5 shrink-0">
          <div className="text-stone-700 dark:text-stone-300">
              المصدر: <a href={QURAN_DATA_SOURCE_INFO.displaySourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 dark:text-emerald-400 underline underline-offset-2">{QURAN_DATA_SOURCE_INFO.provider}</a>
          <div className="text-stone-400">{QURAN_DATA_SOURCE_INFO.displayVersion} · {QURAN_DATA_SOURCE_INFO.displayLicense}</div>
          </div>
          <div className="text-stone-400">
            التفسير معتمد عبر بوابة مطوري Quran.com API v4
          </div>
        </div>
      </footer>

      {/* Multi-Edition Tafsir Sheet */}
      <TafsirSheet ayah={tafsirAyah} onClose={() => setTafsirAyah(null)} />
    </div>
  );
};
