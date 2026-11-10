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
import { loadSurahVerses, getAyahWords, loadSimpleAyahText, loadSimpleAyahRange } from '../../data/quranDataLoader';
import { QuranBasmala } from '../shared/QuranBasmala';
import { Ayah, UserProfile } from '../../types/quran';
import { formatAyahAudioUrl } from '../../services/audioService';
import { getSavedAudioRepeatCount, getSavedPlaybackRate, saveAudioRepeatCount, savePlaybackRate } from '../../services/audioPreferences';
import type { AudioRepeatCount, PlaybackRate } from '../../services/audioPreferences';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { attachAyahRepeatHandler } from '../../services/audioRepeatController';
import { SessionTafsirPanel } from './SessionTafsirPanel';
import {
  getMemorizationDisplayPreferences,
  saveMemorizationDisplayPreferences,
  type MemorizationDisplayPreferences
} from '../../services/memorizationDisplayPreferences';

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

  const [displayPreferences, setDisplayPreferences] = useState<MemorizationDisplayPreferences>(
    () => getMemorizationDisplayPreferences()
  );
  useEffect(() => {
    saveMemorizationDisplayPreferences(displayPreferences);
  }, [displayPreferences]);
  const updateDisplayPreferences = (updates: Partial<MemorizationDisplayPreferences>) => {
    setDisplayPreferences(previous => ({ ...previous, ...updates }));
  };

  const [pageDisplayTexts, setPageDisplayTexts] = useState<string[]>([]);
  const [pageDisplayError, setPageDisplayError] = useState(false);
  useEffect(() => {
    if (displayPreferences.viewMode !== 'page') {
      setPageDisplayTexts([]);
      setPageDisplayError(false);
      return;
    }
    let cancelled = false;
    setPageDisplayTexts([]);
    setPageDisplayError(false);
    loadSimpleAyahRange(surahNumber, initialStartAyah, initialEndAyah || 10)
      .then(texts => {
        if (cancelled) return;
        if (texts.length !== sessionAyahs.length) {
          throw new Error('Verified Tanzil Simple range did not match the selected memorization range.');
        }
        setPageDisplayTexts(texts);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('[WIRD Session] Whole-session verified text unavailable:', error);
        setPageDisplayError(true);
      });
    return () => { cancelled = true; };
  }, [displayPreferences.viewMode, surahNumber, initialStartAyah, initialEndAyah, sessionAyahs.length]);

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

  // Keyboard shortcut: Spacebar repeats only when focus is outside interactive controls.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('button, a, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"]')) return;
      event.preventDefault();
      setRepeatCount(count => count + 1);
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
    <div className="space-y-6 max-w-4xl mx-auto" style={{ zoom: displayPreferences.uiScale / 100 }}>
      {/* 1. Session Navigation & Progress Bar */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-4 border border-stone-200/80 dark:border-stone-700/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={handleExit}
          className="min-h-11 inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>خروج من الجلسة</span>
        </button>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-sm text-stone-900 dark:text-stone-100 font-quran">
            سورة {surahMeta.name}
          </span>
          <span aria-live="polite" className="text-xs text-stone-500 font-mono tabular-nums">
            الآية {currentAyah.numberInSurah} من {sessionAyahs[sessionAyahs.length - 1]?.numberInSurah || surahMeta.versesCount}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 font-mono">
            ⏱ {formatTime(secondsElapsed)}
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="تقدم جلسة الحفظ"
          aria-valuemin={0}
          aria-valuemax={sessionAyahs.length}
          aria-valuenow={currentAyahIndex + 1}
          aria-valuetext={`الآية ${currentAyah.numberInSurah} من ${sessionAyahs.length}`}
          className="h-2 w-full sm:w-28 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
        >
          <div className="h-full rounded-full bg-emerald-700 transition-all duration-300" style={{ width: `${((currentAyahIndex + 1) / Math.max(1, sessionAyahs.length)) * 100}%` }} />
        </div>
      </div>

      {/* Session display controls: local-only presentation preferences */}
      <section
        aria-label="إعدادات عرض جلسة الحفظ"
        className="bg-white dark:bg-stone-800/90 rounded-2xl p-4 border border-stone-200/80 dark:border-stone-700/80 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <label htmlFor="session-ui-scale" className="text-xs font-bold text-stone-700 dark:text-stone-200 whitespace-nowrap">
            حجم واجهة الجلسة
          </label>
          <input
            id="session-ui-scale"
            aria-label="حجم واجهة جلسة الحفظ"
            type="range"
            min={80}
            max={110}
            step={5}
            value={displayPreferences.uiScale}
            onChange={event => updateDisplayPreferences({ uiScale: Number(event.target.value) })}
            className="w-full accent-emerald-700"
          />
          <output htmlFor="session-ui-scale" className="text-xs font-mono tabular-nums text-stone-600 dark:text-stone-300 min-w-12 text-center">
            {displayPreferences.uiScale}%
          </output>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <label htmlFor="session-ayah-font-size" className="text-xs font-bold text-stone-700 dark:text-stone-200 whitespace-nowrap">
            حجم خط الآيات
          </label>
          <input
            id="session-ayah-font-size"
            aria-label="حجم خط الآيات"
            type="range"
            min={20}
            max={44}
            step={2}
            value={displayPreferences.fontSize}
            onChange={event => updateDisplayPreferences({ fontSize: Number(event.target.value) })}
            className="w-full accent-emerald-700"
          />
          <output htmlFor="session-ayah-font-size" className="text-xs font-mono tabular-nums text-stone-600 dark:text-stone-300 min-w-12 text-center">
            {displayPreferences.fontSize}px
          </output>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div role="group" aria-label="كثافة عرض العناصر" className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500">المسافات:</span>
            <button
              type="button"
              aria-pressed={displayPreferences.density === 'comfortable'}
              onClick={() => updateDisplayPreferences({ density: 'comfortable' })}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${displayPreferences.density === 'comfortable' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'}`}
            >
              مريحة
            </button>
            <button
              type="button"
              aria-pressed={displayPreferences.density === 'compact'}
              onClick={() => updateDisplayPreferences({ density: 'compact' })}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${displayPreferences.density === 'compact' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'}`}
            >
              مضغوطة
            </button>
          </div>

          <div role="group" aria-label="طريقة عرض الآيات" className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500">عرض الآيات:</span>
            <button
              type="button"
              aria-pressed={displayPreferences.viewMode === 'focused'}
              onClick={() => updateDisplayPreferences({ viewMode: 'focused' })}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${displayPreferences.viewMode === 'focused' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'}`}
            >
              آية واحدة
            </button>
            <button
              type="button"
              aria-pressed={displayPreferences.viewMode === 'page'}
              onClick={() => updateDisplayPreferences({ viewMode: 'page' })}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${displayPreferences.viewMode === 'page' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'}`}
            >
              كل آيات الجلسة
            </button>
          </div>
        </div>
        <p className="text-[11px] text-stone-500 dark:text-stone-400">
          تُحفظ هذه الاختيارات على هذا الجهاز فقط، ولا تدخل ضمن مزامنة بيانات الحفظ.
        </p>
      </section>

      {displayPreferences.viewMode === 'page' && (
        <section
          aria-label="كل آيات الجلسة"
          className="bg-[#fdfbf7] dark:bg-stone-800/90 rounded-2xl p-3 sm:p-4 border border-stone-200/80 dark:border-stone-700/80 shadow-xs"
        >
          <div className="flex items-center justify-between gap-3 px-2 pb-3">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">كل آيات الجلسة</h3>
            <span className="text-[11px] text-stone-500">اضغط على أي آية للانتقال إليها</span>
          </div>
          {pageDisplayError ? (
            <p role="alert" className="px-3 py-5 text-sm text-red-700 dark:text-red-300">
              تعذر تحميل النص القرآني المعتمد لهذا النطاق؛ لم نعرض نصًا بديلًا. أعد المحاولة أو استخدم عرض الآية الواحدة.
            </p>
          ) : pageDisplayTexts.length !== sessionAyahs.length ? (
            <p role="status" className="px-3 py-5 text-sm text-stone-500">جارٍ تحميل نص الآيات المعتمد...</p>
          ) : (
          <div className={`max-h-[55vh] overflow-y-auto overscroll-contain ${displayPreferences.density === 'compact' ? 'space-y-1' : 'space-y-3'}`}>
            {sessionAyahs.map((ayah, index) => (
              <button
                type="button"
                key={ayah.numberInSurah}
                aria-pressed={index === currentAyahIndex}
                onClick={() => {
                  if (index === currentAyahIndex) return;
                  handleStopAudio();
                  setCurrentAyahIndex(index);
                }}
                className={`w-full text-right rounded-xl border px-3 sm:px-4 transition-colors ${displayPreferences.density === 'compact' ? 'py-2' : 'py-4'} ${index === currentAyahIndex ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-900/40 hover:border-emerald-400'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 min-w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center text-xs font-bold">
                    {ayah.numberInSurah}
                  </span>
                  <span
                    className="font-quran quran-text text-stone-900 dark:text-stone-100 flex-1"
                    style={{
                      fontSize: `${displayPreferences.fontSize}px`,
                      lineHeight: displayPreferences.density === 'compact' ? 1.8 : 2.25
                    }}
                  >
                    {pageDisplayTexts[index]}
                  </span>
                </div>
              </button>
            ))}
          </div>
          )}
        </section>
      )}

      {/* 2. Main Ayah Display & Word Masking Studio */}
      <div className={`bg-[#fdfbf7] dark:bg-stone-800/90 rounded-3xl ${displayPreferences.density === 'compact' ? 'p-4 md:p-6 space-y-4' : 'p-6 md:p-10 space-y-6'} border border-stone-200/80 dark:border-stone-700/80 shadow-xs text-center relative`}>
        {/* Basmala on first ayah if not At-Tawbah */}
        {currentAyah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9 && (
          <div className="font-quran text-lg text-stone-500 dark:text-stone-400 pb-2 border-b border-stone-200/50 dark:border-stone-700">
            <QuranBasmala surahNumber={surahNumber} />
          </div>
        )}

        {/* Quranic Text with Interactive Word Masking */}
        <div className="min-h-[140px] flex items-center justify-center py-4">
          <p
            className="quran-text font-quran text-stone-900 dark:text-stone-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-4"
            style={{
              fontSize: `${displayPreferences.fontSize}px`,
              lineHeight: displayPreferences.density === 'compact' ? 1.8 : 2.25
            }}
          >
            {displayTextError ? <span role="alert" className="text-sm text-red-700 dark:text-red-300">تعذر تحميل النص الإملائي المعتمد لهذه الآية؛ أعد المحاولة قبل متابعة التسميع.</span> : words.length === 0 ? <span role="status" className="text-sm text-stone-500">جارٍ تجهيز نص الآية للتسميع...</span> : words.map((word, idx) => {
              const masked = isWordMasked(idx);
              return masked ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleToggleWordReveal(idx)}
                  aria-label={`إظهار الكلمة رقم ${idx + 1}`}
                  className="inline-flex min-h-11 items-center justify-center px-2.5 py-0.5 rounded-lg transition-all select-none bg-stone-200 dark:bg-stone-700 text-stone-200 dark:text-stone-700 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-stone-900 dark:hover:text-stone-100 active:scale-95 border border-dashed border-stone-400/80 dark:border-stone-500"
                  title="اضغط لإظهار الكلمة للتسميع"
                >
                  {word}
                </button>
              ) : (
                <span key={idx} className="inline-block px-2.5 py-0.5 select-none">{word}</span>
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
                type="button"
                aria-pressed={maskLevel === m.level}
                onClick={() => setMaskLevel(m.level)}
                className={`min-h-11 px-3 py-1.5 rounded-lg font-medium transition-colors ${
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
              type="button"
              onClick={() => setRepeatCount(c => Math.max(0, c - 1))}
              className="min-h-11 min-w-11 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-bold text-xs flex items-center justify-center"
              title="إنقاص مرة واحدة"
            >
              -1
            </button>

            <button
              type="button"
              onClick={() => setRepeatCount(c => c + 1)}
              className="min-h-11 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold rounded-xl text-sm shadow-xs transition-transform active:scale-95"
              title="زيادة التكرار (أو اضغط مسافة)"
            >
              + تكرار ({repeatCount})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Sticky session navigation — always reachable while reading */}
      <div
        role="group"
        aria-label="التنقل بين آيات جلسة الحفظ"
        className="sticky bottom-2 z-30 flex items-center justify-between gap-2 rounded-2xl border border-stone-200/90 dark:border-stone-700 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md p-2 sm:p-3 shadow-lg"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handlePrevAyah}
          disabled={currentAyahIndex === 0}
          className="min-h-14 flex flex-1 items-center justify-center gap-2 px-3 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span>السابقة</span>
        </button>

        <span className="shrink-0 px-2 text-[11px] sm:text-xs font-bold text-stone-500 tabular-nums" aria-live="polite">
          {currentAyahIndex + 1} / {sessionAyahs.length}
        </span>

        <button
          onClick={handleNextAyah}
          className="min-h-14 flex flex-[1.4] items-center justify-center gap-2 px-3 sm:px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors active:scale-[0.98]"
        >
          <span>
            {currentAyahIndex === sessionAyahs.length - 1 ? 'إتمام الجلسة' : 'الآية التالية'}
          </span>
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
