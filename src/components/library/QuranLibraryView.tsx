import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Play, 
  Pause, 
  Volume2, 
  BookOpen, 
  Sparkles, 
  ChevronLeft,
  Filter,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { ALL_SURAHS, JUZ_NAMES } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { loadSurahVerses } from '../../data/quranDataLoader';
import { TafsirSheet } from './TafsirSheet';
import { Ayah, SurahMeta, ReciterId } from '../../types/quran';
import { RECITERS, formatAyahAudioUrl } from '../../services/audioService';
import { getSavedPlaybackRate, savePlaybackRate } from '../../services/audioPreferences';
import type { PlaybackRate } from '../../services/audioPreferences';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { QuranMushafReader } from './QuranMushafReader';

interface QuranLibraryViewProps {
  onStartSession: (surahNumber: number, startAyah?: number, endAyah?: number) => void;
  preferredReciter: ReciterId;
}

export const QuranLibraryView: React.FC<QuranLibraryViewProps> = ({
  onStartSession,
  preferredReciter: initialReciter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJuz, setSelectedJuz] = useState<number | 'all'>('all');
  const [revelationFilter, setRevelationFilter] = useState<'all' | 'مكية' | 'مدنية'>('all');
  const [selectedSurah, setSelectedSurah] = useState<SurahMeta>(ALL_SURAHS[66]); // Default to Al-Mulk (67)
  const [currentAyahs, setCurrentAyahs] = useState<Ayah[]>([]);
  const [isLoadingSurah, setIsLoadingSurah] = useState(true);
  const [surahLoadError, setSurahLoadError] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [tafsirAyah, setTafsirAyah] = useState<Ayah | null>(null);
  
  // Font size adjustment for Quran text
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('large');
  const [verseFilter, setVerseFilter] = useState('');
  const [showMushafReader, setShowMushafReader] = useState(false);

  // Audio state
  const [activeReciter, setActiveReciter] = useState<ReciterId>(initialReciter || 'alafasy');
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(() => getSavedPlaybackRate());
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filter surahs
  const filteredSurahs = ALL_SURAHS.filter(surah => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = 
      !term ||
      surah.name.includes(term) || 
      surah.englishName.toLowerCase().includes(term) ||
      String(surah.number) === term;
    const matchesJuz = selectedJuz === 'all' || (surah.juzStart <= selectedJuz && surah.juzEnd >= selectedJuz);
    const matchesType = revelationFilter === 'all' || surah.revelationType === revelationFilter;
    return matchesSearch && matchesJuz && matchesType;
  });

  // Load only the selected surah; never import the 2 MB complete dataset here.
  useEffect(() => {
    let cancelled = false;
    if (showMushafReader) return () => { cancelled = true; };
    setCurrentAyahs([]);
    setIsLoadingSurah(true);
    setSurahLoadError(false);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    setPlayingAyah(null);

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
  }, [selectedSurah.number, loadRetry, showMushafReader]);

  // Audio play handler
  const handlePlayAyah = (ayahNumberInSurah: number) => {
    if (playingAyah === ayahNumberInSurah && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const audioUrl = formatAyahAudioUrl(selectedSurah.number, ayahNumberInSurah, activeReciter);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audio.playbackRate = getSavedPlaybackRate();
    audioRef.current = audio;
    setPlayingAyah(ayahNumberInSurah);
    setIsPlaying(true);

    audio.play().catch(e => {
      console.warn("Audio play prevented or unavailable", e);
      setIsPlaying(false);
    });

    audio.onended = () => {
      const nextAyah = ayahNumberInSurah + 1;
      const hasNext = currentAyahs.some(a => a.numberInSurah === nextAyah);
      if (hasNext) {
        handlePlayAyah(nextAyah);
      } else {
        setIsPlaying(false);
        setPlayingAyah(null);
      }
    };
  };

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    if (audioRef.current) audioRef.current.playbackRate = savedRate;
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPlayingAyah(null);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (showMushafReader) {
    return <QuranMushafReader preferredReciter={activeReciter} onBack={() => setShowMushafReader(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Filters Toolbar */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
              <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              المصحف الشريف والمكتبة القرآنية
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              تصفح سور القرآن الـ 114 مع بيانات النزول والصفحات والاستماع المباشر
            </p>
          </div>

          {/* Reciter selector */}
          <div className="flex items-center gap-2 text-xs">
            <Volume2 className="w-4 h-4 text-emerald-700" />
            <span className="text-stone-500 hidden sm:inline">القارئ:</span>
            <select
              value={activeReciter}
              onChange={(e) => {
                handleStopAudio();
                setActiveReciter(e.target.value as ReciterId);
              }}
              className="bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:border-emerald-600"
            >
              {RECITERS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
          <button type="button" onClick={() => { handleStopAudio(); setShowMushafReader(true); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900">
            <BookOpen className="h-4 w-4" /> المصحف بالصفحات
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          {/* Search box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم السورة أو رقمها (مثال: الملك، 67، البقرة)..."
              className="w-full pl-3 pr-10 py-2.5 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* Juz filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedJuz}
              onChange={(e) => setSelectedJuz(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full py-2.5 px-3 bg-[#faf8f5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-emerald-600"
            >
              <option value="all">جميع الأجزاء (30 جزء)</option>
              {JUZ_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Revelation Type Filter */}
          <div className="sm:col-span-3 flex items-center bg-[#faf8f5] dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setRevelationFilter('all')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                revelationFilter === 'all' 
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setRevelationFilter('مكية')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                revelationFilter === 'مكية' 
                  ? 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              مكية
            </button>
            <button
              onClick={() => setRevelationFilter('مدنية')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                revelationFilter === 'مدنية' 
                  ? 'bg-white dark:bg-stone-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs' 
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              مدنية
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Split: Surah List (Right in RTL) & Surah Detail Reader (Left in RTL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Surahs List */}
        <div className="lg:col-span-5 space-y-2 max-h-[720px] overflow-y-auto pr-1">
          <div className="text-xs text-stone-500 px-1 pb-1 flex items-center justify-between">
            <span>نتائج السور ({filteredSurahs.length})</span>
            <span>اختر سورة للمعاينة</span>
          </div>

          {filteredSurahs.map((surah) => {
            const isSelected = selectedSurah.number === surah.number;

            return (
              <div
                key={surah.number}
                onClick={() => {
                  handleStopAudio();
                  setSelectedSurah(surah);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                    : 'bg-white dark:bg-stone-800/90 hover:bg-stone-50 dark:hover:bg-stone-800 border-stone-200/80 dark:border-stone-700/80 text-stone-900 dark:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono tabular-nums ${
                    isSelected
                      ? 'bg-amber-400 text-emerald-950'
                      : 'bg-[#faf8f5] dark:bg-stone-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                  }`}>
                    {surah.number}
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base font-quran">
                        سورة {surah.name}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected 
                          ? 'bg-emerald-700/80 text-emerald-100' 
                          : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                      }`}>
                        {surah.revelationType}
                      </span>
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-emerald-100/90' : 'text-stone-500 dark:text-stone-400'}`}>
                      {surah.versesCount} آيات · الجزء {surah.juzStart} · صفحة {surah.pageStart}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartSession(surah.number, 1, Math.min(10, surah.versesCount));
                    }}
                    title="بدء جلسة حفظ لهذه السورة"
                    className={`p-2 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold'
                        : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <ChevronLeft className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-stone-400'}`} />
                </div>
              </div>
            );
          })}

          {filteredSurahs.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-500 text-xs">
              لا توجد سورة مطابقة لبحثك. جرب كتابة اسم آخر.
            </div>
          )}
        </div>

        {/* Selected Surah Detail & Verses Viewer */}
        <div className="lg:col-span-7 bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-5">
          {/* Surah Header Card */}
          <div className="bg-[#fdfbf7] dark:bg-stone-900/60 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 text-center relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-2">
              <span>الجزء {selectedSurah.juzStart} {selectedSurah.juzEnd !== selectedSurah.juzStart && `إلى ${selectedSurah.juzEnd}`}</span>
              <span>صفحة {selectedSurah.pageStart} - {selectedSurah.pageEnd}</span>
              <span>{selectedSurah.revelationType}</span>
            </div>

            <h3 className="text-3xl font-bold font-quran text-emerald-950 dark:text-emerald-200 my-2">
              سورة {selectedSurah.name}
            </h3>

            <div className="text-xs text-stone-600 dark:text-stone-400">
              عدد الآيات: <strong className="text-stone-900 dark:text-stone-100 font-mono tabular-nums">{selectedSurah.versesCount}</strong> آية
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-stone-200/60 dark:border-stone-800">
              <button
                onClick={() => onStartSession(selectedSurah.number, 1, Math.min(10, selectedSurah.versesCount))}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>بدء حفظ السورة في جلسة تفاعلية</span>
              </button>

              <button
                onClick={() => handlePlayAyah(1)}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#faf8f5] dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold border border-stone-300 dark:border-stone-700 transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-700" />}
                <span>{isPlaying ? 'إيقاف التلاوة' : 'استماع للسورة'}</span>
              </button>
            </div>
          </div>

          {/* Reading Controls Toolbar: Font size & Ayah search within Surah */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-500 font-medium">حجم الخط:</span>
              <div className="flex items-center bg-white dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setFontSize('normal')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    fontSize === 'normal' ? 'bg-emerald-800 text-white' : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                  }`}
                >
                  أ- عادي
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('large')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    fontSize === 'large' ? 'bg-emerald-800 text-white' : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                  }`}
                >
                  أ متوسط
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('huge')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    fontSize === 'huge' ? 'bg-emerald-800 text-white' : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                  }`}
                >
                  أ+ كبير
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={verseFilter}
                onChange={(e) => setVerseFilter(e.target.value)}
                placeholder="تصفية برقم الآية أو كلمة..."
                className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-emerald-600 w-40"
              />
              {verseFilter && (
                <button
                  type="button"
                  onClick={() => setVerseFilter('')}
                  className="text-stone-400 hover:text-stone-600 text-xs px-1"
                >
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Basmala Banner (For all surahs except At-Tawbah) */}
          {selectedSurah.number !== 9 && (
            <div className="text-center font-quran text-xl text-stone-700 dark:text-stone-300 py-2 border-y border-stone-100 dark:border-stone-700/60">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          )}

          {/* Verses Container */}
          <div className="space-y-4 max-h-[520px] overflow-y-auto pl-2">
            {(() => {
              const displayedAyahs = currentAyahs.filter(ayah => {
                if (!verseFilter.trim()) return true;
                const filter = verseFilter.trim();
                return String(ayah.numberInSurah) === filter || ayah.text.includes(filter);
              });

              if (isLoadingSurah) {
                return <div className="text-center py-10 text-stone-500 text-xs">جارٍ تحميل آيات سورة {selectedSurah.name}...</div>;
              }

              if (surahLoadError) {
                return (
                  <div className="text-center py-8 text-rose-700 dark:text-rose-300 text-xs bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800">
                    تعذر تحميل نص السورة. <button type="button" onClick={() => setLoadRetry(value => value + 1)} className="font-bold underline">إعادة المحاولة</button>
                  </div>
                );
              }

              if (displayedAyahs.length === 0) {
                return (
                  <div className="text-center py-8 text-stone-500 text-xs bg-stone-50 dark:bg-stone-900 rounded-xl border border-dashed border-stone-300">
                    لا توجد آيات مطابقة للبحث في سورة {selectedSurah.name}.
                  </div>
                );
              }

              return displayedAyahs.map((ayah) => {
                const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying;
                const fontClass = 
                  fontSize === 'normal' ? 'text-lg md:text-xl leading-relaxed' :
                  fontSize === 'huge' ? 'text-2xl md:text-3xl leading-[2.4]' :
                  'text-xl md:text-2xl leading-loose';

                return (
                  <div
                    key={ayah.numberInSurah}
                    className={`p-4 rounded-xl border transition-all ${
                      isThisPlaying
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-xs'
                        : 'bg-[#faf8f5]/60 dark:bg-stone-900/40 border-stone-200/70 dark:border-stone-700/60 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handlePlayAyah(ayah.numberInSurah)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isThisPlaying
                              ? 'bg-amber-500 text-white'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-emerald-100 hover:text-emerald-800'
                          }`}
                          title="استمع للآية"
                        >
                          {isThisPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTafsirAyah(ayah)}
                          title="اقرأ تفسير الآية"
                          aria-label={`تفسير الآية ${ayah.numberInSurah} من سورة ${selectedSurah.name}`}
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors touch-manipulation"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                        
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300 font-mono bg-stone-200/70 dark:bg-stone-700 px-2 py-0.5 rounded">
                          الآية {ayah.numberInSurah}
                        </span>

                        <span className="text-[11px] text-stone-500 dark:text-stone-400">
                          ص {ayah.page} · ج {ayah.juz} {ayah.hizbQuarter && `· ربع ${ayah.hizbQuarter}`}
                        </span>

                        {ayah.sajda && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-300">
                            سجدة تلاوة
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onStartSession(selectedSurah.number, ayah.numberInSurah, ayah.numberInSurah)}
                        className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-medium shrink-0"
                      >
                        تدريب على هذه الآية
                      </button>
                    </div>

                    {/* Ayah Text in authentic Amiri Uthmanic font */}
                    <p className={`font-quran ${fontClass} text-stone-900 dark:text-stone-100 text-right`}>
                      {ayah.text}
                      <span className="ayah-number">{ayah.numberInSurah}</span>
                    </p>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* 3. Verified Quran Source Attribution & Integrity Footer */}
      <div className="bg-[#fcfaf7] dark:bg-stone-800/80 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-stone-900 dark:text-stone-200 flex items-center gap-2">
              <span>قاعدة البيانات القرآنية الموثقة — 114 سورة كاملة (6,236 آية)</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-1.5 py-0.2 rounded font-mono">
                Hafs 'an Asim
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              النص القرآني معتمد ومطابق لمصحف المدينة النبوية برواية حفص عن عاصم بالرسم العثماني وعلامات الوقف الموثقة.
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] space-y-0.5 shrink-0">
          <div className="text-stone-700 dark:text-stone-300">
            المصدر: <span className="font-medium text-emerald-800 dark:text-emerald-400">{QURAN_DATA_SOURCE_INFO.provider}</span>
          </div>
          <div className="text-stone-400">
            ترخيص {QURAN_DATA_SOURCE_INFO.license} · نص القرآن محلي، والتفسير يُحمّل عند الطلب ويُحفظ محلياً
          </div>
        </div>
      </div>
      <TafsirSheet ayah={tafsirAyah} onClose={() => setTafsirAyah(null)} />
    </div>
  );
};
