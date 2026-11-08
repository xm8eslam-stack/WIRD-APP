import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Volume2, 
  BookOpen, 
  ArrowRight,
  Flame,
  Award
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { loadSurahVerses, getAyahWords, loadSimpleAyahText } from '../../data/quranDataLoader';
import { Ayah, UserProfile } from '../../types/quran';
import { formatAyahAudioUrl } from '../../services/audioService';
import { getSavedAudioRepeatCount, getSavedPlaybackRate, saveAudioRepeatCount, savePlaybackRate } from '../../services/audioPreferences';
import type { AudioRepeatCount, PlaybackRate } from '../../services/audioPreferences';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { attachAyahRepeatHandler } from '../../services/audioRepeatController';
import { SessionTafsirPanel } from './SessionTafsirPanel';

interface MemorizationSessionViewProps {
  initialSurahNumber?: number;
  initialStartAyah?: number;
  initialEndAyah?: number;
  mode?: 'memorize' | 'review';
  profile: UserProfile;
  onCompleteSession: (memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string, mode?: 'memorize' | 'review') => boolean | Promise<boolean>;
  onExit: () => void;
  onProgressChange?: (inProgress: boolean) => void;
}

export const MemorizationSessionView: React.FC<MemorizationSessionViewProps> = ({
  initialSurahNumber = 67, // Default Al-Mulk
  initialStartAyah = 1,
  initialEndAyah = 5,
  mode = 'memorize',
  profile,
  onCompleteSession,
  onExit,
  onProgressChange
}) => {
  const [surahNumber, setSurahNumber] = useState(initialSurahNumber);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [allSurahAyahs, setAllSurahAyahs] = useState<Ayah[]>([]);
  const [isLoadingAyahs, setIsLoadingAyahs] = useState(true);
  const [loadRetry, setLoadRetry] = useState(0);
  
  // Load only the active surah's verses into the memorization session.
  const surahMeta = ALL_SURAHS.find(s => s.number === surahNumber) || ALL_SURAHS[66];
  useEffect(() => {
    let cancelled = false;
    setAllSurahAyahs([]);
    setCurrentAyahIndex(0);
    setIsLoadingAyahs(true);
    loadSurahVerses(surahNumber)
      .then(ayahs => { if (!cancelled) setAllSurahAyahs(ayahs); })
      .catch(error => { if (!cancelled) console.error('[WIRD Session] Failed to load Surah ' + surahNumber, error); })
      .finally(() => { if (!cancelled) setIsLoadingAyahs(false); });
    return () => { cancelled = true; };
  }, [surahNumber, loadRetry]);
  
  // Filter ayahs within selected range
  const sessionAyahs = allSurahAyahs.length > 0
    ? allSurahAyahs.filter(a => a.numberInSurah >= initialStartAyah && a.numberInSurah <= (initialEndAyah || 10))
    : [];

  // Pre-cache only the active session's recitation files (bounded in the Service Worker).
  useEffect(() => {
    if (!sessionAyahs.length || currentAyahIndex % 10 !== 0 || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    const urls = sessionAyahs.slice(currentAyahIndex, currentAyahIndex + 20).map(ayah =>
      formatAyahAudioUrl(surahNumber, ayah.numberInSurah, profile.preferredReciter)
    );
    navigator.serviceWorker.ready
      .then(registration => {
        if (cancelled) return;
        const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
        worker?.postMessage({ type: 'WIRD_CACHE_SESSION_AUDIO', urls });
      })
      .catch(error => console.warn('[WIRD Session] Audio cache unavailable:', error));
    return () => { cancelled = true; };
  }, [surahNumber, profile.preferredReciter, allSurahAyahs, currentAyahIndex, initialStartAyah, initialEndAyah]);

  const currentAyah: Ayah | undefined = sessionAyahs[currentAyahIndex];

  // 1. Audio recitation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(() => getSavedPlaybackRate());
  const [audioRepeatCount, setAudioRepeatCount] = useState<AudioRepeatCount>(() => getSavedAudioRepeatCount());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIterationRef = useRef(1);
  const repeatTargetRef = useRef<number | null>(audioRepeatCount === -1 ? null : audioRepeatCount);
  const completionInProgressRef = useRef(false);

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    if (audioRef.current) audioRef.current.playbackRate = savedRate;
  };

  const handleAudioRepeatCountChange = (count: AudioRepeatCount) => {
    const savedCount = saveAudioRepeatCount(count);
    repeatTargetRef.current = savedCount === -1 ? null : savedCount;
    setAudioRepeatCount(savedCount);
  };

  // 2. Progressive word masking: 0 = none, 1 = 30%, 2 = 60%, 3 = 100% (hidden)
  const [maskLevel, setMaskLevel] = useState<number>(0);
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());

  // 3. Repetition counter
  const [repeatCount, setRepeatCount] = useState(0);
  const targetRepeats = profile.repetitionTarget || 10;

  // Session elapsed timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    onProgressChange?.(repeatCount > 0 && !isCompleted);
  }, [repeatCount, isCompleted, onProgressChange]);

  // Keyboard shortcut: Spacebar to repeat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setRepeatCount(c => c + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset revealed words when ayah or mask changes
  useEffect(() => {
    setRevealedWordIndices(new Set());
    setRepeatCount(0);
    handleStopAudio();
  }, [currentAyahIndex, maskLevel]);

  // Audio Playback
  const handleToggleAudio = () => {
    if (!currentAyah) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
      playbackIterationRef.current = 1;
      setIsPlaying(false);
      setIsAudioLoading(false);
      return;
    }

    const url = formatAyahAudioUrl(surahNumber, currentAyah.numberInSurah, profile.preferredReciter);
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audio.playbackRate = getSavedPlaybackRate();
    audio.preload = 'auto';
    audioRef.current = audio;
    playbackIterationRef.current = 1;
    setIsPlaying(true);
    setIsAudioLoading(true);

    audio.onplaying = () => {
      if (audioRef.current === audio) setIsAudioLoading(false);
    };
    audio.onerror = () => {
      if (audioRef.current !== audio) return;
      console.warn('Audio playback failed to load', audio.error);
      audio.onended = null;
      audioRef.current = null;
      playbackIterationRef.current = 1;
      setIsPlaying(false);
      setIsAudioLoading(false);
    };

    audio.play().catch(e => {
      if (audioRef.current !== audio) return;
      console.warn("Audio playback error", e);
      audio.onended = null;
      audioRef.current = null;
      playbackIterationRef.current = 1;
      setIsPlaying(false);
      setIsAudioLoading(false);
    });

    attachAyahRepeatHandler(
      audio,
      playbackIterationRef,
      repeatTargetRef,
      () => setRepeatCount(count => count + 1),
      () => {
        if (audioRef.current !== audio) return;
        audio.onended = null;
        audioRef.current = null;
        setIsPlaying(false);
        setIsAudioLoading(false);
      },
      () => {
        if (audioRef.current !== audio) return;
        audio.onended = null;
        audioRef.current = null;
        playbackIterationRef.current = 1;
        setIsPlaying(false);
        setIsAudioLoading(false);
      }
    );
  };

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
    playbackIterationRef.current = 1;
  };

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const handleExit = () => {
    handleStopAudio();
    onExit();
  };

  // Word Masking Logic
  const [displayWords, setDisplayWords] = useState<string[]>([]);
  const [displayTextError, setDisplayTextError] = useState(false);
  useEffect(() => {
    let active = true;
    if (!currentAyah) { setDisplayWords([]); setDisplayTextError(false); return () => { active = false; }; }
    setDisplayWords([]);
    setDisplayTextError(false);
    loadSimpleAyahText(currentAyah.surahNumber, currentAyah.numberInSurah)
      .then(text => {
        if (!active) return;
        if (text) setDisplayWords(getAyahWords(text));
        else setDisplayTextError(true);
      })
      .catch(error => {
        console.error('[WIRD Memorization] Could not load local Tanzil Simple text:', error);
        if (active) setDisplayTextError(true);
      });
    return () => { active = false; };
  }, [currentAyah?.surahNumber, currentAyah?.numberInSurah, currentAyah?.text]);
  const words = displayWords;
  
  const isWordMasked = (index: number) => {
    if (maskLevel === 0) return false;
    if (revealedWordIndices.has(index)) return false;
    if (maskLevel === 3) return true; // all hidden
    if (maskLevel === 2) return index % 2 === 0; // 50-60% hidden
    if (maskLevel === 1) return index % 3 === 0; // 33% hidden
    return false;
  };

  const handleToggleWordReveal = (index: number) => {
    setRevealedWordIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Next / Previous Ayah (Semantic RTL: Next is on Left, Prev is on Right)
  const handleNextAyah = async () => {
    if (currentAyahIndex < sessionAyahs.length - 1) {
      handleStopAudio();
      setCurrentAyahIndex(prev => prev + 1);
    } else {
      handleStopAudio();
      if (completionInProgressRef.current) return;
      completionInProgressRef.current = true;
      const minutesSpent = Math.max(1, Math.round(secondsElapsed / 60));
      try {
        const saved = await onCompleteSession(
          mode === 'memorize' ? sessionAyahs.length : 0,
          mode === 'review' ? Math.max(1, new Set(sessionAyahs.map(ayah => ayah.page)).size) : 0,
          minutesSpent,
          `${mode === 'review' ? 'مراجعة' : 'إتمام حفظ'} سورة ${surahMeta.name} الآيات (${sessionAyahs[0]?.numberInSurah}-${sessionAyahs[sessionAyahs.length - 1]?.numberInSurah})`,
          mode
        );
        if (!saved) { completionInProgressRef.current = false; return; }
        handleStopAudio();
        setIsCompleted(true);
      } catch (error) {
        completionInProgressRef.current = false;
        console.error('[WIRD Session] Completion persistence failed:', error);
      }
    }
  };

  const handlePrevAyah = () => {
    if (currentAyahIndex > 0) {
      handleStopAudio();
      setCurrentAyahIndex(prev => prev - 1);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isLoadingAyahs) {
    return (
      <div className="bg-white dark:bg-stone-800 rounded-3xl p-8 text-center space-y-3 border border-stone-200 dark:border-stone-700 max-w-lg mx-auto shadow-sm">
        <BookOpen className="w-8 h-8 mx-auto text-emerald-700 animate-pulse" />
        <p className="text-sm font-bold text-stone-700 dark:text-stone-200">جارٍ تحميل سورة {surahMeta.name}...</p>
        <p className="text-xs text-stone-500">يتم تحميل نص السورة المطلوبة فقط.</p>
      </div>
    );
  }

  if (!currentAyah) {
    return (
      <div className="bg-white dark:bg-stone-800 rounded-3xl p-8 text-center space-y-5 border border-stone-200 dark:border-stone-700 max-w-lg mx-auto shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
          <BookOpen className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-full">
            تعذر تحميل النص القرآني
          </span>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 text-lg">
            سورة {surahMeta.name} ({surahMeta.versesCount} آية)
          </h3>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed max-w-md mx-auto">
            تعذر تحميل النص القرآني العثماني لهذه السورة من الملفات المحلية. تحقق من سلامة ملفات التطبيق ثم أعد المحاولة؛ لم يتم استبدال النص بأي مصدر غير موثوق.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setLoadRetry(value => value + 1)}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 text-stone-950 rounded-xl text-xs font-bold shadow-xs hover:bg-amber-400 transition-colors"
          >
            إعادة تحميل النص
          </button>
          <button
            onClick={() => {
              handleStopAudio();
              setSurahNumber(67);
              setCurrentAyahIndex(0);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-900 transition-colors"
          >
            جلسة سورة الملك (الآيات 1-10)
          </button>
          <button
            onClick={() => {
              handleStopAudio();
              setSurahNumber(1);
              setCurrentAyahIndex(0);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold transition-colors"
          >
            سورة الفاتحة (كاملة)
          </button>
        </div>
      </div>
    );
  }

  // Completion Celebration View
  if (isCompleted) {
    return (
      <div className="bg-white dark:bg-stone-800/90 rounded-3xl p-8 border border-stone-200/80 dark:border-stone-700/80 text-center space-y-6 max-w-xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto shadow-inner border border-amber-200 dark:border-amber-800">
          <Award className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            {mode === 'review' ? 'مبارك إتمام المراجعة' : 'مبارك الإنجاز القرآني'}
          </span>
          <h2 className="text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
            {mode === 'review' ? 'أتممت جلسة المراجعة بنجاح!' : 'أتممت وِرد الحفظ اليومي بنجاح!'}
          </h2>
          <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
            {mode === 'review' ? `تمت مراجعة الآيات المحددة من سورة ${surahMeta.name}.` : `تم حفظ وتكرار وتثبيت الآيات المقررة لسورة ${surahMeta.name}. ثبّت الله القرآن في قلبك ونفعك به في الدنيا والآخرة.`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 bg-[#faf8f5] dark:bg-stone-900/60 rounded-xl border border-stone-200/70 dark:border-stone-700/60 text-xs">
          <div>
            <div className="text-stone-400">{mode === 'review' ? 'الآيات المراجعة' : 'الآيات المحفوظة'}</div>
            <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 font-mono">
              {sessionAyahs.length}
            </div>
          </div>
          <div>
            <div className="text-stone-400">زمن الجلسة</div>
            <div className="text-lg font-bold text-stone-800 dark:text-stone-200 font-mono">
              {formatTime(secondsElapsed)}
            </div>
          </div>
          <div>
            <div className="text-stone-400">سلسلة المواظبة</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-amber-500" />
              <span>{profile.streakDays} يوم</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              completionInProgressRef.current = false;
              setIsCompleted(false);
              setCurrentAyahIndex(0);
              setSecondsElapsed(0);
            }}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold"
          >
            {mode === 'review' ? 'إعادة المراجعة' : 'تكرار الجلسة للتثبيت'}
          </button>

          <button
            onClick={handleExit}
            className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Session Navigation & Progress Bar */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-4 border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex items-center justify-between gap-4">
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>خروج من الجلسة</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-stone-900 dark:text-stone-100 font-quran">
            سورة {surahMeta.name}
          </span>
          <span className="text-xs text-stone-500 font-mono tabular-nums">
            الآية {currentAyah.numberInSurah} من {sessionAyahs[sessionAyahs.length - 1]?.numberInSurah || surahMeta.versesCount}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-mono">
            ⏱ {formatTime(secondsElapsed)}
          </span>
        </div>

        {/* Ayah Steps Indicators */}
        <div className="flex items-center gap-1.5">
          {sessionAyahs.map((a, idx) => (
            <div
              key={a.numberInSurah}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx === currentAyahIndex
                  ? 'bg-emerald-600 ring-2 ring-emerald-300 dark:ring-emerald-700 scale-125'
                  : idx < currentAyahIndex
                  ? 'bg-emerald-800'
                  : 'bg-stone-200 dark:bg-stone-700'
              }`}
              title={`آية ${a.numberInSurah}`}
            />
          ))}
        </div>
      </div>

      {/* 2. Main Ayah Display & Word Masking Studio */}
      <div className="bg-[#fdfbf7] dark:bg-stone-800/90 rounded-3xl p-6 md:p-10 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-6 text-center relative">
        {/* Basmala on first ayah if not At-Tawbah */}
        {currentAyah.numberInSurah === 1 && surahNumber !== 9 && (
          <div className="font-quran text-lg text-stone-500 dark:text-stone-400 pb-2 border-b border-stone-200/50 dark:border-stone-700">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </div>
        )}

        {/* Quranic Text with Interactive Word Masking */}
        <div className="min-h-[140px] flex items-center justify-center py-4">
          <p className="quran-text font-quran text-2xl md:text-3xl lg:text-4xl leading-loose text-stone-900 dark:text-stone-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-4">
            {displayTextError ? <span role="alert" className="text-sm text-red-700 dark:text-red-300">تعذر تحميل النص الإملائي المعتمد لهذه الآية؛ أعد المحاولة قبل متابعة التسميع.</span> : words.map((word, idx) => {
              const masked = isWordMasked(idx);

              return (
                <span
                  key={idx}
                  onClick={() => masked ? handleToggleWordReveal(idx) : null}
                  className={`inline-block px-2.5 py-0.5 rounded-lg transition-all select-none ${
                    masked
                      ? 'bg-stone-200 dark:bg-stone-700 text-stone-200 dark:text-stone-700 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-stone-900 dark:hover:text-stone-100 active:scale-95 border border-dashed border-stone-400/80 dark:border-stone-500'
                      : 'cursor-default'
                  }`}
                  title={masked ? "اضغط لإظهار الكلمة للتسميع" : undefined}
                >
                  {word}
                </span>
              );
            })}
            <span className="ayah-number">{currentAyah.numberInSurah}</span>
          </p>
        </div>

        {/* Word Masking Selector Bar */}
        <div className="pt-4 border-t border-stone-200/70 dark:border-stone-700/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
            <EyeOff className="w-4 h-4 text-emerald-700" />
            <span>مستوى إخفاء الكلمات للتسميع الذاتي:</span>
          </div>

          <div className="flex items-center bg-stone-200/60 dark:bg-stone-700/60 p-1 rounded-xl">
            {[
              { level: 0, label: 'إظهار كامل' },
              { level: 1, label: 'إخفاء 30%' },
              { level: 2, label: 'إخفاء 60%' },
              { level: 3, label: 'إخفاء تام' },
            ].map(m => (
              <button
                key={m.level}
                onClick={() => setMaskLevel(m.level)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  maskLevel === m.level
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SessionTafsirPanel ayah={currentAyah} />

      {/* 3. Audio & Repetition Counter Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recitation Audio Control */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-700" />
              <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100">
                الاستماع والترتيل المتقن
              </h4>
            </div>
            <p className="text-[11px] text-stone-500">
              استمع لمخارج الحروف مع كل تكرار لضبط التلاوة
            </p>
          </div>

          <button
            onClick={handleToggleAudio}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs transition-all ${
              isPlaying
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
            title={isPlaying ? "إيقاف مؤقت" : "استماع للآية"}
            aria-label={isPlaying ? "إيقاف مؤقت" : "استماع للآية"}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white mr-0.5" />}
          </button>
          <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
          <label className="inline-flex min-h-11 items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
            <span className="whitespace-nowrap">تكرار التلاوة</span>
            <select
              aria-label="عدد مرات تكرار الصوت"
              value={audioRepeatCount}
              onChange={event => handleAudioRepeatCountChange(Number(event.target.value) as AudioRepeatCount)}
              className="min-h-11 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-emerald-600"
            >
              <option value={1}>مرة واحدة</option>
              <option value={2}>مرتان</option>
              <option value={3}>3 مرات</option>
              <option value={5}>5 مرات</option>
              <option value={10}>10 مرات</option>
              <option value={-1}>حتى الإيقاف</option>
            </select>
          </label>
          {isAudioLoading && <span role="status" className="text-xs text-stone-500">جارٍ تحميل التلاوة…</span>}
        </div>

        {/* Repetition Counter (Traditional Method - طريقة التكرار والتثبيت) */}
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100">
                عدّاد التكرار والتثبيت ({repeatCount} / {targetRepeats})
              </h4>
            </div>
            <p className="text-[11px] text-stone-500">
              اضغط مسافة (Space) في لوحة المفاتيح للتكرار السريع
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRepeatCount(c => Math.max(0, c - 1))}
              className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-bold text-xs flex items-center justify-center"
              title="إنقاص مرة واحدة"
            >
              -1
            </button>

            <button
              onClick={() => setRepeatCount(c => c + 1)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold rounded-xl text-sm shadow-xs transition-transform active:scale-95"
              title="زيادة التكرار (أو اضغط مسافة)"
            >
              + تكرار ({repeatCount})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Session Controls (Semantic RTL: Next is on Left, Previous is on Right) */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrevAyah}
          disabled={currentAyahIndex === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          <span>الآية السابقة</span>
        </button>

        <button
          onClick={handleNextAyah}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>
            {currentAyahIndex === sessionAyahs.length - 1 ? 'إتمام الجلسة وحفظ الورد' : 'أتقنت الآية — التالية'}
          </span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
