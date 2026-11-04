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
import { VERIFIED_AYAHS } from '../../data/verifiedAyahs';
import { SurahMeta, ReciterId } from '../../types/quran';
import { RECITERS, formatAyahAudioUrl } from '../../services/audioService';

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
  
  // Audio state
  const [activeReciter, setActiveReciter] = useState<ReciterId>(initialReciter || 'alafasy');
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

  // Ayahs for current selected surah
  const currentAyahs = VERIFIED_AYAHS[selectedSurah.number] || [];

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

          {/* Basmala Banner (For all surahs except At-Tawbah) */}
          {selectedSurah.number !== 9 && (
            <div className="text-center font-quran text-xl text-stone-700 dark:text-stone-300 py-2 border-y border-stone-100 dark:border-stone-700/60">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
          )}

          {/* Verses Container */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pl-2">
            {currentAyahs.length > 0 ? (
              currentAyahs.map((ayah) => {
                const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying;

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
                      <div className="flex items-center gap-2">
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
                        <span className="text-xs text-stone-400 font-mono">
                          الآية {ayah.numberInSurah}
                        </span>
                      </div>

                      <button
                        onClick={() => onStartSession(selectedSurah.number, ayah.numberInSurah, ayah.numberInSurah)}
                        className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                      >
                        تدريب على هذه الآية
                      </button>
                    </div>

                    {/* Ayah Text in authentic Amiri Uthmanic font */}
                    <p className="font-quran text-xl md:text-2xl text-stone-900 dark:text-stone-100 leading-loose text-right">
                      {ayah.text}
                      <span className="ayah-number">{ayah.numberInSurah}</span>
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 bg-[#faf8f5] dark:bg-stone-900/40 rounded-xl border border-stone-200/70 dark:border-stone-700/60 space-y-3">
                <BookOpen className="w-8 h-8 text-emerald-700 mx-auto opacity-70" />
                <h4 className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                  سورة {selectedSurah.name} ({selectedSurah.versesCount} آية)
                </h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                  السورة الشريفة تقع في الجزء {selectedSurah.juzStart} بين الصفحتين {selectedSurah.pageStart} و {selectedSurah.pageEnd}. يمكنك الاستماع لتلاوتها الشاملة عبر زر "استماع للسورة" أو البدء الفوري بحفظ مقاطعها في جلسة الحفظ التفاعلية.
                </p>
                <button
                  onClick={() => onStartSession(selectedSurah.number, 1, Math.min(10, selectedSurah.versesCount))}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  بدء جلسة الحفظ لسورة {selectedSurah.name}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
