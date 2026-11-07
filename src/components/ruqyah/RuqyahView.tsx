import React, { useState, useEffect, useRef } from 'react';
import { getRuqyahAudioQueue, getRuqyahDisplayText } from '../../services/ruqyahContentService';
import { buildQuranAyahAudioUrl, FALLBACK_QURAN_RECITERS, fetchQuranReciters } from '../../services/ruqyahAudioService';
import type { QuranReciter } from '../../services/ruqyahAudioService';
import { loadRuqyahProgress } from '../../services/ruqyahProgressService';
import { persistRuqyahProgressSnapshot } from '../../services/journaledSnapshotService';
import { StorageService } from '../../services/storageService';
import { RuqyahApiLibrary } from './RuqyahApiLibrary';
import { 
  ShieldCheck, 
  Volume2, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  BookOpen, 
  Heart, 
  Info,
  Headphones,
  Moon,
} from 'lucide-react';
import { RUQYAH_GUIDELINES, RUQYAH_PROGRAM_AUDIO, getRuqyahItemsByCategory } from '../../data/ruqyahData';
import type { RuqyahCategory, RuqyahItem, RuqyahProgramAudio } from '../../data/ruqyahData';

interface RuqyahViewProps {
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

const CATEGORY_TABS: { id: RuqyahCategory; label: string; iconName: string; duration: string }[] = [
  { id: 'brief', label: 'الرقية المختصرة', iconName: 'Sparkles', duration: 'مختصر' },
  { id: 'medium', label: 'الرقية المتوسطة', iconName: 'BookOpen', duration: 'متوسط' },
  { id: 'full', label: 'الرقية المطولة الكاملة', iconName: 'ShieldCheck', duration: 'مطول' },
  { id: 'eye_envy', label: 'رقية العين والحسد', iconName: 'Heart', duration: 'حسب المحتوى' },
  { id: 'illness', label: 'رقية المرض والألم', iconName: 'Sparkles', duration: 'حسب المحتوى' },
  { id: 'guidelines', label: 'آداب وإرشادات الرقية', iconName: 'Info', duration: 'إرشادات' },
];

export const RuqyahView: React.FC<RuqyahViewProps> = ({ onToast }) => {
  const currentStorageScope = StorageService.getStorageScope();
  const [activeCategory, setActiveCategory] = useState<RuqyahCategory>('brief');
  const [viewMode, setViewMode] = useState<'interactive' | 'audio_stream' | 'api_library'>('interactive');
  
  // Counter states per item (itemId -> current count)
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [progressDirty, setProgressDirty] = useState(false);
  const [progressScope, setProgressScope] = useState(currentStorageScope);
  const [progressCorrupt, setProgressCorrupt] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);

  // Audio Verse Playback State
  const [playingVerseId, setPlayingVerseId] = useState<string | null>(null);
  const [verseLoopCount, setVerseLoopCount] = useState<number>(0);
  const [reciters, setReciters] = useState<QuranReciter[]>(FALLBACK_QURAN_RECITERS);
  const [selectedReciterId, setSelectedReciterId] = useState<string>('husary');
  const verseQueueRef = useRef<number[]>([]);
  const verseQueueIndexRef = useRef<number>(0);
  const verseRepeatTargetRef = useRef<number>(1);
  const verseRepeatCountRef = useRef<number>(1);
  const verseItemRef = useRef<RuqyahItem | null>(null);
  const audioVerseRef = useRef<HTMLAudioElement | null>(null);

  // Full Reciter Audio Stream State
  const [selectedProgramAudio, setSelectedProgramAudio] = useState<RuqyahProgramAudio>(RUQYAH_PROGRAM_AUDIO[0]);
  const [isStreamPlaying, setIsStreamPlaying] = useState<boolean>(false);
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [streamDuration, setStreamDuration] = useState<number>(0);
  const [streamVolume, setStreamVolume] = useState<number>(1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const audioStreamRef = useRef<HTMLAudioElement | null>(null);

  const currentItems = getRuqyahItemsByCategory(activeCategory);

  useEffect(() => {
    const controller = new AbortController();
    fetchQuranReciters(controller.signal)
      .then(list => {
        setReciters(list);
        setSelectedReciterId(current => list.some(reciter => reciter.id === current) ? current : list[0].id);
      })
      .catch(error => {
        if (!controller.signal.aborted && onToast) {
          onToast(error instanceof Error ? error.message : 'تعذر تحديث قائمة القراء؛ نستخدم القائمة الاحتياطية.', 'info');
        }
      });
    return () => controller.abort();
  }, []);

  // Hydrate progress whenever WIRD switches guest/account storage namespaces.
  useEffect(() => {
    setProgressHydrated(false);
    setProgressCorrupt(false);
    setProgressDirty(false);
    const saved = loadRuqyahProgress();
    if (saved.status === 'corrupt') {
      setProgressCorrupt(true);
      if (onToast) onToast('تعذر قراءة تقدم الرقية المحفوظ؛ احتفظنا بالبيانات الأصلية ولم نستبدلها.', 'warn');
    } else {
      setCounts(saved.counts);
    }
    setProgressScope(currentStorageScope);
    setProgressHydrated(true);
  }, [currentStorageScope]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshProgress = () => {
      if (StorageService.getStorageScope() !== currentStorageScope) return;
      const saved = loadRuqyahProgress();
      if (saved.status === 'corrupt') {
        setProgressCorrupt(true);
        return;
      }
      setCounts(saved.counts);
      setProgressDirty(false);
    };
    window.addEventListener('wird:ruqyah-progress-updated', refreshProgress);
    window.addEventListener('storage', refreshProgress);
    return () => {
      window.removeEventListener('wird:ruqyah-progress-updated', refreshProgress);
      window.removeEventListener('storage', refreshProgress);
    };
  }, [currentStorageScope]);

  useEffect(() => {
    if (!progressHydrated || !progressDirty || progressCorrupt || progressScope !== currentStorageScope) return;
    let active = true;
    const snapshot = { schemaVersion: 1 as const, updatedAtMs: Date.now(), counts: { ...counts } };
    void persistRuqyahProgressSnapshot(snapshot, { expectedStorageScope: currentStorageScope })
      .then(result => {
        if (active && !result.success && onToast) {
          onToast(result.error || 'تعذر حفظ تقدم الرقية ومزامنته.', 'error');
        }
      })
      .catch(() => {
        if (active && onToast) onToast('تعذر حفظ تقدم الرقية ومزامنته.', 'error');
      });
    return () => { active = false; };
  }, [counts, progressHydrated, progressDirty, progressCorrupt, progressScope, currentStorageScope, onToast]);

  const handleRecoverProgress = () => {
    try {
      setCounts({});
      setProgressCorrupt(false);
      setProgressDirty(true);
      setProgressHydrated(true);
      if (onToast) onToast('تمت إعادة ضبط بيانات تقدم الرقية فقط.', 'success');
    } catch {
      if (onToast) onToast('تعذر إعادة ضبط بيانات تقدم الرقية.', 'error');
    }
  };

  // Initialize audio references
  useEffect(() => {
    audioVerseRef.current = new Audio();
    audioStreamRef.current = new Audio();

    const streamAudio = audioStreamRef.current;
    if (streamAudio) {
      streamAudio.addEventListener('timeupdate', () => {
        setStreamProgress(streamAudio.currentTime);
      });
      streamAudio.addEventListener('loadedmetadata', () => {
        setStreamDuration(streamAudio.duration);
      });
      streamAudio.addEventListener('ended', () => {
        setIsStreamPlaying(false);
        setStreamProgress(0);
      });
    }

    return () => {
      if (audioVerseRef.current) {
        audioVerseRef.current.pause();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.pause();
      }
    };
  }, []);

  // Handle sleep timer countdown
  useEffect(() => {
    if (!sleepTimerMinutes || !isStreamPlaying) return;

    const timer = setTimeout(() => {
      if (audioStreamRef.current) {
        audioStreamRef.current.pause();
        setIsStreamPlaying(false);
      }
      setSleepTimerMinutes(null);
      if (onToast) onToast('تم إيقاف الرقية الصوتية لتأقيت مؤقت النوم.', 'info');
    }, sleepTimerMinutes * 60 * 1000);

    return () => clearTimeout(timer);
  }, [sleepTimerMinutes, isStreamPlaying, onToast]);

  // Click counter handler
  const handleItemClick = (item: RuqyahItem) => {
    const current = counts[item.id] || 0;
    if (item.type === 'guideline' || (item.repeatTarget !== null && current >= item.repeatTarget)) return;

    const next = current + 1;
    setCounts(prev => ({ ...prev, [item.id]: next }));
    setProgressDirty(true);

    // Haptic feedback if available
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (_) {}
    }

    // Auto-scroll to next card when target reached
    if (item.repeatTarget !== null && next === item.repeatTarget && autoAdvance) {
      const currentIndex = currentItems.findIndex(i => i.id === item.id);
      if (currentIndex !== -1 && currentIndex < currentItems.length - 1) {
        const nextId = currentItems[currentIndex + 1].id;
        setTimeout(() => {
          const el = document.getElementById(`ruqyah-card-${nextId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  };

  // Reset counters for current active category
  const handleResetCategoryCounts = () => {
    const updated = { ...counts };
    currentItems.forEach(item => {
      delete updated[item.id];
    });
    setCounts(updated);
    setProgressDirty(true);
    if (onToast) onToast('تم إعادة ضبط العدادات لهذه القائمة.', 'info');
  };

  // Play the complete selected Quran passage, verse by verse, using Al Furqan.
  const playVerseQueuePosition = (index: number) => {
    const audio = audioVerseRef.current;
    const queue = verseQueueRef.current;
    if (!audio || queue.length === 0) return;

    if (index >= queue.length) {
      if (verseRepeatCountRef.current < verseRepeatTargetRef.current) {
        verseRepeatCountRef.current += 1;
        setVerseLoopCount(verseRepeatCountRef.current);
        playVerseQueuePosition(0);
        return;
      }
      const completedItem = verseItemRef.current;
      if (completedItem) {
        setCounts(previous => ({ ...previous, [completedItem.id]: completedItem.repeatTarget ?? Math.max(1, previous[completedItem.id] || 0) }));
        setProgressDirty(true);
      }
      setPlayingVerseId(null);
      setVerseLoopCount(0);
      verseItemRef.current = null;
      return;
    }

    verseQueueIndexRef.current = index;
    audio.src = buildQuranAyahAudioUrl(selectedReciterId, queue[index]);
    audio.play().catch(() => {
      if (onToast) onToast('تعذر تشغيل التلاوة. تحقق من الاتصال بالإنترنت أو اختر قارئًا آخر.', 'warn');
      setPlayingVerseId(null);
    });
  };

  const handleToggleVerseAudio = (item: RuqyahItem) => {
    if (playingVerseId === item.id) {
      audioVerseRef.current?.pause();
      setPlayingVerseId(null);
      setVerseLoopCount(0);
      return;
    }

    if (audioStreamRef.current && isStreamPlaying) {
      audioStreamRef.current.pause();
      setIsStreamPlaying(false);
    }

    try {
      const queue = getRuqyahAudioQueue(item).map(ayah => ayah.globalAyahNumber);
      if (queue.length === 0) throw new Error('لا توجد آيات صالحة للتشغيل.');
      verseQueueRef.current = queue;
      verseQueueIndexRef.current = 0;
      verseRepeatTargetRef.current = Math.max(1, item.repeatTarget ?? 1);
      verseRepeatCountRef.current = 1;
      verseItemRef.current = item;
      setPlayingVerseId(item.id);
      setVerseLoopCount(1);
      playVerseQueuePosition(0);

      if (audioVerseRef.current) {
        audioVerseRef.current.onended = () => {
          playVerseQueuePosition(verseQueueIndexRef.current + 1);
        };
      }
    } catch (error) {
      if (onToast) onToast(error instanceof Error ? error.message : 'تعذر تجهيز آيات التلاوة.', 'error');
      setPlayingVerseId(null);
    }
  };

  // Full-program recordings are separate from individual Quran reciter streams.
  const handleToggleStream = (program?: RuqyahProgramAudio) => {
    const target = program || selectedProgramAudio;

    if (audioVerseRef.current && playingVerseId) {
      audioVerseRef.current.pause();
      setPlayingVerseId(null);
    }

    if (selectedProgramAudio.id !== target.id) {
      setSelectedProgramAudio(target);
      if (audioStreamRef.current) {
        audioStreamRef.current.src = target.audioUrl;
        audioStreamRef.current.play().then(() => {
          setIsStreamPlaying(true);
        }).catch(() => {
          if (onToast) onToast('تعذر تشغيل تسجيل البرنامج. تحقق من الاتصال بالإنترنت.', 'warn');
        });
      }
      return;
    }

    if (audioStreamRef.current) {
      if (isStreamPlaying) {
        audioStreamRef.current.pause();
        setIsStreamPlaying(false);
      } else {
        if (!audioStreamRef.current.src || audioStreamRef.current.src !== target.audioUrl) {
          audioStreamRef.current.src = target.audioUrl;
        }
        audioStreamRef.current.play().then(() => {
          setIsStreamPlaying(true);
        }).catch(() => {
          if (onToast) onToast('تعذر تشغيل تسجيل البرنامج.', 'warn');
        });
      }
    }
  };

  const handleSeekStream = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setStreamProgress(newTime);
    if (audioStreamRef.current) {
      audioStreamRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setStreamVolume(vol);
    if (audioStreamRef.current) audioStreamRef.current.volume = vol;
    if (audioVerseRef.current) audioVerseRef.current.volume = vol;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Calculate section progress
  const trackedItems = currentItems.filter(item => item.type !== 'guideline');
  const completedCount = trackedItems.filter(item => item.repeatTarget === null ? (counts[item.id] || 0) > 0 : (counts[item.id] || 0) >= item.repeatTarget).length;
  const progressPercent = trackedItems.length > 0 ? Math.round((completedCount / trackedItems.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {progressCorrupt && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            تعذر قراءة تقدم الرقية المحفوظ. احتفظنا بالبيانات الأصلية دون استبدالها؛ يمكنك متابعة القراءة دون حفظ حتى تختار إعادة ضبط هذا السجل.
          </p>
          <button onClick={handleRecoverProgress} className="shrink-0 rounded-xl bg-amber-200 dark:bg-amber-900 px-3 py-2 text-xs font-bold text-amber-950 dark:text-amber-100">
            إعادة ضبط سجل الرقية
          </button>
        </div>
      )}
      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-stone-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-emerald-700/50">
        <div className="absolute top-0 left-0 translate-x-[-20%] translate-y-[-20%] w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded-full text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>الرقية من القرآن والسنة</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-quran leading-relaxed">
              الرقية الشرعية الكاملة من القرآن والسنة
            </h1>

            <p className="text-xs md:text-sm text-stone-200/90 leading-relaxed font-sans">
              آيات من القرآن وأدعية من السنة، مع أدوات للقراءة والاستماع ومتابعة ما أتممته.
            </p>
          </div>

          {/* Mode Switch Controls */}
          <div className="flex flex-wrap items-center gap-2 p-1 bg-emerald-950/80 rounded-2xl border border-emerald-700/60 shadow-inner self-stretch md:self-auto justify-center">
            <button
              onClick={() => setViewMode('interactive')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'interactive'
                  ? 'bg-amber-400 text-emerald-950 shadow-md scale-[1.02]'
                  : 'text-stone-300 hover:text-white hover:bg-emerald-900/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>القراءة مع العداد</span>
            </button>

            <button
              onClick={() => setViewMode('audio_stream')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'audio_stream'
                  ? 'bg-amber-400 text-emerald-950 shadow-md scale-[1.02]'
                  : 'text-stone-300 hover:text-white hover:bg-emerald-900/60'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>الرقية الصوتية الكاملة</span>
            </button>

            <button
              onClick={() => setViewMode('api_library')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'api_library'
                  ? 'bg-amber-400 text-emerald-950 shadow-md scale-[1.02]'
                  : 'text-stone-300 hover:text-white hover:bg-emerald-900/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>المكتبة الموسعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Mode 1: Interactive Reading with Counter */}
      {viewMode === 'interactive' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
            <div>
              <p className="text-sm font-bold text-stone-800 dark:text-stone-200">قارئ تلاوة الآيات</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">تُشغّل المقاطع متعددة الآيات كاملة وبالترتيب.</p>
            </div>
            <select
              value={selectedReciterId}
              onChange={event => setSelectedReciterId(event.target.value)}
              className="min-w-52 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-100"
              aria-label="اختيار قارئ القرآن"
            >
              {reciters.map(reciter => (
                <option key={reciter.id} value={reciter.id}>{reciter.arabicName}</option>
              ))}
            </select>
          </div>

          {/* Category Tabs Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORY_TABS.map(tab => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                    isActive
                      ? 'bg-emerald-800 text-amber-200 border-emerald-700 shadow-sm'
                      : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200/80 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.duration !== 'إرشادات' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-amber-400/20 text-amber-200' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                    }`}>
                      {tab.duration}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress Header & Settings Control */}
          {activeCategory !== 'guidelines' && (
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200/80 dark:border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200/60 dark:border-emerald-800/60">
                  {progressPercent}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-1">
                    <span>نسبة إنجاز رقية القسم الحالي</span>
                    <span className="text-stone-500 font-mono tabular-nums">{completedCount} من {trackedItems.length} عناصر</span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-700 dark:bg-emerald-500 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 dark:bg-stone-800 dark:border-stone-700"
                  />
                  <span>الانتقال التلقائي للبطاقة التالية عند الإكمال</span>
                </label>

                <button
                  onClick={handleResetCategoryCounts}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold transition-colors"
                  title="إعادة ضبط عداد القسم"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة الضبط</span>
                </button>
              </div>
            </div>
          )}

          {/* Cards List */}
          <div className="space-y-4">
            {currentItems.map((item, idx) => {
              const currentCount = counts[item.id] || 0;
              const isCompleted = item.type !== 'guideline' && (item.repeatTarget === null ? currentCount > 0 : currentCount >= item.repeatTarget);
              const isPlayingVerse = playingVerseId === item.id;

              return (
                <div
                  key={item.id}
                  id={`ruqyah-card-${item.id}`}
                  onClick={item.type === 'guideline' ? undefined : () => handleItemClick(item)}
                  className={`group relative bg-white dark:bg-stone-900 rounded-3xl p-6 md:p-7 border transition-all duration-300 ${item.type === 'guideline' ? 'cursor-default' : 'cursor-pointer'} ${
                    isCompleted
                      ? 'border-emerald-500/60 dark:border-emerald-700/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs'
                      : 'border-stone-200/90 dark:border-stone-800 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md'
                  }`}
                >
                  {/* Card Top Row: Number, Type badge, Title, Audio Button */}
                  <div className="flex items-start justify-between gap-4 mb-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold text-xs flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                            {item.title}
                          </h3>
                          {item.surahName && (
                            <span className="text-[11px] text-emerald-800 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md font-semibold">
                              سورة {item.surahName} [{item.verseRange}]
                            </span>
                          )}
                        </div>
                        {item.source && (
                          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                            المصدر: {item.source}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Audio Play Button for Verse */}
                    {item.type === 'quran' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVerseAudio(item);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          isPlayingVerse
                            ? 'bg-amber-400 text-emerald-950 animate-pulse'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                        }`}
                        title="استماع صوتي مع التكرار التلقائي"
                      >
                        {isPlayingVerse ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        <span>{isPlayingVerse ? (item.repeatTarget === null ? 'تشغيل الآيات' : `تكرار (${verseLoopCount}/${item.repeatTarget})`) : 'استماع للآيات'}</span>
                      </button>
                    )}
                  </div>

                  {/* Text Content */}
                  <div className="my-4 p-4 rounded-2xl bg-[#faf8f5] dark:bg-stone-950/70 border border-stone-200/50 dark:border-stone-800/80">
                    <p className={`text-base md:text-xl text-stone-800 dark:text-stone-100 leading-loose text-center font-quran ${
                      item.type === 'quran' ? 'tracking-normal' : 'font-sans font-medium'
                    }`}>
                      {getRuqyahDisplayText(item)}
                    </p>
                  </div>

                  {/* Explanation Note */}
                  {item.explanation && (
                    <div className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-100 dark:border-stone-800 mb-4">
                      <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{item.explanation}</p>
                    </div>
                  )}

                  {/* Card Bottom Row: Counter Controls */}
                  {item.type !== 'guideline' && (
                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/80 px-3 py-1 rounded-xl">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{item.repeatTarget === null ? 'تم تسجيل القراءة' : `اكتمل التكرار المحدد (${item.repeatTarget})`}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500 font-medium">
                            {item.repeatTarget === null ? 'لا يوجد عدد ثابت؛ اضغط لتسجيل قراءتك' : 'اضغط على البطاقة لزيادة العداد'}
                          </span>
                        )}
                      </div>

                      {/* Repetition Counter Badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-500">{item.repeatTarget === null ? 'عدد القراءات:' : 'المتبقي:'}</span>
                        <div className={`px-4 py-2 rounded-2xl font-mono text-sm font-bold transition-all ${
                          isCompleted
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 group-hover:scale-105'
                        }`}>
                          {item.repeatTarget === null ? currentCount + ' قراءة' : Math.max(0, item.repeatTarget - currentCount) + ' / ' + item.repeatTarget}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Mode 2: Continuous Full Reciter Audio Stream */}
      {viewMode === 'audio_stream' && (
        <div className="space-y-6">
          {/* Audio Player Card */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 md:p-8 border border-stone-200/90 dark:border-stone-800 shadow-md space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-right w-full md:w-auto">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-800 to-stone-900 text-amber-300 flex items-center justify-center shadow-lg shrink-0">
                  <Headphones className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    مشغل الرقية الصوتية المباشر
                  </span>
                  <h2 className="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {selectedProgramAudio.name}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    {selectedProgramAudio.description}
                  </p>
                </div>
              </div>

              {/* Play / Pause Toggle Button */}
              <button
                onClick={() => handleToggleStream()}
                className="w-14 h-14 rounded-full bg-emerald-800 hover:bg-emerald-700 text-amber-200 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
                aria-label={isStreamPlaying ? 'إيقاف مؤقت' : 'تشغيل الرقية'}
              >
                {isStreamPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 translate-x-[-1px]" />}
              </button>
            </div>

            {/* Audio Seeker Timeline */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={streamDuration || 100}
                value={streamProgress}
                onChange={handleSeekStream}
                className="w-full accent-emerald-700 dark:accent-emerald-400 h-2 bg-stone-100 dark:bg-stone-800 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-xs font-mono text-stone-400 dark:text-stone-500">
                <span>{formatTime(streamProgress)}</span>
                <span>{formatTime(streamDuration)}</span>
              </div>
            </div>

            {/* Controls Bar: Volume & Sleep Timer */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stone-100 dark:border-stone-800">
              {/* Volume Slider */}
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-stone-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={streamVolume}
                  onChange={handleVolumeChange}
                  className="w-24 accent-emerald-700 dark:accent-emerald-400 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Sleep Timer Selector */}
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">مؤقت النوم:</span>
                {[15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setSleepTimerMinutes(prev => prev === mins ? null : mins)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      sleepTimerMinutes === mins
                        ? 'bg-amber-400 text-emerald-950'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                    }`}
                  >
                    {mins} دقيقة
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reciter Selector Cards Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              اختر تسجيل البرنامج الصوتي:
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RUQYAH_PROGRAM_AUDIO.map(programAudio => {
                const isSelected = selectedProgramAudio.id === programAudio.id;
                return (
                  <div
                    key={programAudio.id}
                    onClick={() => handleToggleStream(programAudio)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-emerald-900 text-white border-emerald-700 shadow-sm'
                        : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 text-stone-900 dark:text-stone-100 hover:border-emerald-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">{programAudio.name}</h4>
                      <p className={`text-xs ${isSelected ? 'text-stone-200/80' : 'text-stone-500 dark:text-stone-400'}`}>
                        {programAudio.description}
                      </p>
                    </div>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-amber-400 text-emerald-950' : 'bg-stone-100 dark:bg-stone-800 text-stone-600'
                    }`}>
                      {isSelected && isStreamPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'api_library' && <RuqyahApiLibrary />}
    </div>
  );
};
