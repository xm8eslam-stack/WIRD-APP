import React, { useState, useEffect, useRef } from 'react';
import { 
  Repeat, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Play, 
  Sparkles, 
  Plus,
  BookOpen,
  Filter,
  Check,
  X,
  History,
  TrendingUp,
  Award,
  ChevronLeft,
  Search,
  BookmarkCheck,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { 
  PortionStatusRecord, 
  PortionMemorizationStatus, 
  RevisionRating, 
  WeakVerseItem, 
  UserProfile 
} from '../../types/quran';
import { RetentionService, RetentionMetrics } from '../../services/retentionService';
import { StorageService, STORAGE_KEYS } from '../../services/storageService';
import { persistJournaledSnapshot, persistJournaledTransaction, persistPortionsSnapshot } from '../../services/journaledSnapshotService';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { ALL_SURAHS } from '../../data/quranMeta';
import { loadAyahByCoordinate } from '../../data/quranDataLoader';
import { buildWeakVerseFailureTransaction, buildWeakVerseResolutionSnapshot } from '../../services/weakVerseRecording';
import { createSecureId } from '../../services/secureId';
import type { RevisionRatedEvent, WeakVerseFailedEvent, WeakVerseResolvedEvent } from '../../services/domainEvents';

interface RevisionCenterViewProps {
  profile: UserProfile;
  onStartSession?: (surahNumber: number, startAyah: number, endAyah: number, mode?: 'memorize' | 'review') => void;
}

type RevisionTab = 'daily_queue' | 'weekly_overview' | 'weak_verses' | 'history' | 'retention_dashboard';

const STATUS_LABELS: Record<PortionMemorizationStatus, { label: string; bg: string; text: string; border: string }> = {
  stable: { label: 'راسخ ومتقن', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/60' },
  recently_memorized: { label: 'محفوظ حديثاً', bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800/60' },
  needs_revision: { label: 'يحتاج مراجعة', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/60' },
  weak: { label: 'ضعيف ويتفلت', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800/60' },
  currently_memorizing: { label: 'قيد الحفظ', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/60' },
  not_memorized: { label: 'غير محفوظ', bg: 'bg-stone-50 dark:bg-stone-800/40', text: 'text-stone-600 dark:text-stone-400', border: 'border-stone-200 dark:border-stone-700' }
};

export const RevisionCenterView: React.FC<RevisionCenterViewProps> = ({
  profile,
  onStartSession
}) => {
  const [activeTab, setActiveTab] = useState<RevisionTab>('daily_queue');
  const [portions, setPortions] = useState<PortionStatusRecord[]>(() => RetentionService.getPortions());
  const [weakVerses, setWeakVerses] = useState<WeakVerseItem[]>(() => {
    try { return RetentionService.getWeakVerses(); } catch { return []; }
  });
  const [metrics, setMetrics] = useState<RetentionMetrics>(() => RetentionService.getRetentionDashboardMetrics());
  
  // Feedback toast banner
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'warn' | 'info' } | null>(null);

  // Active review drawer / modal for rating a portion
  const [ratingPortion, setRatingPortion] = useState<PortionStatusRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [weakAyahNum, setWeakAyahNum] = useState<number | ''>('');
  const [isSavingRating, setIsSavingRating] = useState(false);
  const ratingInFlightRef = useRef(false);
  const ratingMutationKeyRef = useRef<string | null>(null);
  const ratingMutationIdRef = useRef<string | null>(null);
  const ratingMutationOccurredAtRef = useRef<string | null>(null);
  const weakVerseMutationIdRef = useRef<string | null>(null);
  const weakVerseMutationOccurredAtRef = useRef<string | null>(null);
  const weakVerseMutationKeyRef = useRef<string | null>(null);
  const weakVerseInFlightRef = useRef(false);
  const [isSavingWeakVerse, setIsSavingWeakVerse] = useState(false);
  const weakVerseResolutionMutationIdsRef = useRef<Map<string, string>>(new Map());
  const weakVerseResolutionOccurredAtRef = useRef<Map<string, string>>(new Map());
  const weakVerseResolutionInFlightRef = useRef<Set<string>>(new Set());

  // Add new portion modal
  const [isAddPortionModalOpen, setIsAddPortionModalOpen] = useState(false);
  const [newSurahNum, setNewSurahNum] = useState(67);
  const [newStartAyah, setNewStartAyah] = useState(1);
  const [newEndAyah, setNewEndAyah] = useState(15);
  const [newStatus, setNewStatus] = useState<PortionMemorizationStatus>('recently_memorized');

  // Add manual weak verse modal
  const [isAddWeakVerseModalOpen, setIsAddWeakVerseModalOpen] = useState(false);
  const [weakSurahNum, setWeakSurahNum] = useState(67);
  const [manualWeakAyahNum, setManualWeakAyahNum] = useState(1);
  const [manualWeakText, setManualWeakText] = useState('');
  const [manualWeakNotes, setManualWeakNotes] = useState('');

  // Search in weak verses
  const [weakSearchQuery, setWeakSearchQuery] = useState('');

  const refreshAll = () => {
    setPortions(RetentionService.getPortions());
    try {
      setWeakVerses(RetentionService.getWeakVerses());
    } catch (error) {
      // Keep the damaged archive untouched and make the recovery state visible.
      setActionFeedback({
        message: error instanceof Error ? error.message : 'تعذر قراءة سجل الآيات المتعثرة؛ لم يتم تغييره.',
        type: 'warn'
      });
    }
    setMetrics(RetentionService.getRetentionDashboardMetrics());
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const todayStr = getLocalDateString();
  const dailyQueue = RetentionService.getDailyRevisionQueue(todayStr);
  const weeklyOverview = RetentionService.getWeeklyRevisionOverview(todayStr);
  const revisionHistory = RetentionService.getRevisionHistory();

  // Journal the canonical portion, activity, profile, and optional weak-verse update as one action.
  const handleRatePortion = async (
    rating: RevisionRating,
    portionOverride?: PortionStatusRecord
  ) => {
    const selectedPortion = portionOverride || ratingPortion;
    if (!selectedPortion || ratingInFlightRef.current) return;

    const mutationKey = [
      selectedPortion.id,
      rating,
      reviewNotes,
      rating === 'failed' ? weakAyahNum : ''
    ].join('|');
    if (ratingMutationKeyRef.current !== mutationKey) {
      ratingMutationKeyRef.current = mutationKey;
      ratingMutationIdRef.current = 'revision-' + createSecureId();
      ratingMutationOccurredAtRef.current = new Date().toISOString();
    }
    const mutationId = ratingMutationIdRef.current || 'revision-' + createSecureId();
    ratingMutationIdRef.current = mutationId;

    ratingInFlightRef.current = true;
    setIsSavingRating(true);
    try {
      let weakDetails: { ayahNumber: number; text: string; notes: string } | undefined;
      if (rating === 'failed' && weakAyahNum) {
        const ayahNumber = Number(weakAyahNum);
        if (!Number.isSafeInteger(ayahNumber) ||
            ayahNumber < selectedPortion.startAyah || ayahNumber > selectedPortion.endAyah) {
          throw new Error('الآية المتعثرة يجب أن تقع داخل نطاق المقطع الذي تتم مراجعته.');
        }
        const foundAyah = await loadAyahByCoordinate(selectedPortion.surahNumber, ayahNumber).catch(() => undefined);
        if (!foundAyah?.text) {
          throw new Error('تعذر تحميل نص الآية من مصدر القرآن؛ لم يتم تسجيل نص بديل أو تعديل تقييم المراجعة.');
        }
        weakDetails = {
          ayahNumber,
          text: foundAyah.text,
          notes: reviewNotes || 'خطأ متكرر أثناء المراجعة'
        };
      }

      const prepared = RetentionService.buildRevisionPerformanceSnapshot(
        selectedPortion.id,
        rating,
        reviewNotes,
        0,
        mutationId
      );
      if (!prepared.success) throw new Error(prepared.messageAr);

      let operations = prepared.operations;
      if (weakDetails) {
        const weakPrepared = buildWeakVerseFailureTransaction({
          surahNumber: selectedPortion.surahNumber,
          surahName: selectedPortion.surahName,
          ayahNumber: weakDetails.ayahNumber,
          text: weakDetails.text,
          notes: weakDetails.notes
        }, mutationId, prepared.operations[0].payload.records as PortionStatusRecord[]);
        if (!weakPrepared.success) throw new Error(weakPrepared.messageAr);

        const isSameSingleVerse =
          selectedPortion.startAyah === weakDetails.ayahNumber &&
          selectedPortion.endAyah === weakDetails.ayahNumber;
        operations = [
          isSameSingleVerse ? prepared.operations[0] : weakPrepared.operations[0],
          weakPrepared.operations[1],
          ...prepared.operations.slice(1)
        ];
      }

      const domainEvent: RevisionRatedEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'revision.rated',
        occurredAt: ratingMutationOccurredAtRef.current || new Date().toISOString(),
        payload: {
          portionId: selectedPortion.id,
          surahNumber: selectedPortion.surahNumber,
          startAyah: selectedPortion.startAyah,
          endAyah: selectedPortion.endAyah,
          rating,
          ...(reviewNotes ? { notes: reviewNotes } : {}),
          ...(weakDetails ? { weakAyahNumber: weakDetails.ayahNumber } : {})
        }
      };
      const result = await persistJournaledTransaction(operations, {}, mutationId, domainEvent);
      const expectedPortions = operations.find(operation => operation.collection === 'portions')?.payload.records;
      const expectedWeakVerses = operations.find(operation => operation.collection === 'weakVerses')?.payload.records;
      const expectedActivity = operations.find(operation => operation.collection === 'activityEvents')?.payload.records;
      const expectedProfile = operations.find(operation => operation.collection === 'profile')?.payload.profile;
      let projectionsMatch = false;
      try {
        projectionsMatch = Boolean(
          expectedPortions && StorageService.verifyRawItem(STORAGE_KEYS.UNIFIED_PORTIONS, (JSON.stringify(expectedPortions) ?? '')) &&
          expectedActivity && StorageService.verifyRawItem(STORAGE_KEYS.LOGS, (JSON.stringify(expectedActivity) ?? '')) &&
          expectedProfile && StorageService.verifyRawItem(STORAGE_KEYS.PROFILE, (JSON.stringify(expectedProfile) ?? '')) &&
          (expectedWeakVerses === undefined ||
            StorageService.verifyRawItem(STORAGE_KEYS.WEAK_VERSES, (JSON.stringify(expectedWeakVerses) ?? '')))
        );
      } catch {
        projectionsMatch = false;
      }

      if (!result.success && !(result.recoveredPriorEvents && projectionsMatch)) {
        if (result.recoveredPriorEvents) refreshAll();
        setActionFeedback({
          message: result.recoveredPriorEvents
            ? 'استعدنا عمليات سابقة وحدّثنا بيانات المراجعة؛ تحقق من حالة المقطع قبل إعادة المحاولة.'
            : result.queued
              ? 'حُفظ تقييم المراجعة في سجل الاستعادة، لكن تعذر تطبيقه محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
              : result.error || 'تعذر حفظ تقييم المراجعة؛ لم يتم تأكيد التغيير.',
          type: 'warn'
        });
        return;
      }

      ratingMutationKeyRef.current = null;
      ratingMutationIdRef.current = null;
      ratingMutationOccurredAtRef.current = null;
      setActionFeedback({
        message: prepared.messageAr,
        type: rating === 'successful' ? 'success' : rating === 'difficult' ? 'info' : 'warn'
      });
      setRatingPortion(null);
      setReviewNotes('');
      setWeakAyahNum('');
      refreshAll();

      setTimeout(() => {
        setActionFeedback(null);
      }, 5000);
    } catch (error) {
      setActionFeedback({
        message: error instanceof Error ? error.message : 'تعذر حفظ تقييم المراجعة؛ لم يتم تأكيد التغيير.',
        type: 'warn'
      });
    } finally {
      ratingInFlightRef.current = false;
      setIsSavingRating(false);
    }
  };

  // Handle adding new portion
  const handleAddNewPortion = async (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find(s => s.number === newSurahNum);
    if (!surah) return;

    let updatedPortions: PortionStatusRecord[];
    try {
      const snapshot = RetentionService.buildAddPortionSnapshot({
        type: 'passage',
        surahNumber: newSurahNum,
        surahName: surah.name,
        startAyah: newStartAyah,
        endAyah: newEndAyah,
        pageNumber: surah.pageStart,
        juzNumber: surah.juzStart,
        status: newStatus,
        lastReviewedDate: todayStr,
        nextDueDate: todayStr,
        intervalDays: newStatus === 'stable' ? 7 : newStatus === 'weak' ? 1 : 2,
        easeFactor: 2.5,
        repetitionCount: newStatus === 'stable' ? 4 : 1,
        mistakesCount: newStatus === 'weak' ? 2 : 0
      });
      updatedPortions = snapshot.portions;
    } catch (error) {
      setActionFeedback({ message: error instanceof Error ? error.message : 'تعذر إعداد المقطع الجديد.', type: 'warn' });
      return;
    }

    const result = await persistPortionsSnapshot(updatedPortions);
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshAll();
      setActionFeedback({
        message: result.recoveredPriorEvents
          ? 'استعدنا تقدمًا سابقًا وحدّثنا بيانات المقاطع؛ لم ننفذ الإضافة الجديدة. راجع الحالة ثم أعد المحاولة.'
          : result.queued
            ? 'تم حفظ إضافة المقطع في سجل الاستعادة، لكن تعذر تطبيقها محلياً.'
            : result.recoveryBlocked
              ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف المقطع الجديد.'
              : 'تعذر حفظ المقطع الجديد في التخزين المحلي؛ لم يتم تأكيد التغيير.',
        type: 'warn'
      });
      return;
    }

    setIsAddPortionModalOpen(false);
    refreshAll();
    setActionFeedback({
      message: `تمت إضافة مقطع سورة ${surah.name} بنجاح إلى منظومة المتابعة.`,
      type: 'success'
    });
  };

  // Resolve a weak verse through a stable, journal-first snapshot mutation.
  const handleResolveWeakVerse = async (id: string, ayahRef: string) => {
    if (weakVerseResolutionInFlightRef.current.has(id)) return;
    const prepared = buildWeakVerseResolutionSnapshot(id);
    if (!prepared.success) {
      setActionFeedback({ message: prepared.messageAr, type: 'warn' });
      return;
    }
    if (!prepared.changed) {
      refreshAll();
      setActionFeedback({
        message: `الآية ${ayahRef} غير موجودة بالفعل في قائمة الآيات الملتبسة؛ لم يتم إنشاء تغيير جديد.`,
        type: 'info'
      });
      return;
    }

    const resolvedWeakVerse = RetentionService.getWeakVerses().find(item => item.id === id);
    if (!resolvedWeakVerse) {
      setActionFeedback({ message: 'لم نعثر على بيانات الآية الأصلية؛ لم يتم تسجيل حدث إزالة غير مكتمل.', type: 'warn' });
      return;
    }
    let mutationId = weakVerseResolutionMutationIdsRef.current.get(id);
    if (!mutationId) {
      mutationId = 'weak-resolve-' + createSecureId();
      weakVerseResolutionMutationIdsRef.current.set(id, mutationId);
      weakVerseResolutionOccurredAtRef.current.set(id, new Date().toISOString());
    }
    weakVerseResolutionInFlightRef.current.add(id);
    let result: Awaited<ReturnType<typeof persistJournaledSnapshot>>;
    try {
      result = await persistJournaledSnapshot(
        {
          mutationId,
          collection: 'weakVerses',
          documentId: 'snapshot',
          operation: 'upsert',
          payload: {
            records: prepared.records,
            domainEvent: {
              schemaVersion: 1,
              id: mutationId,
              type: 'weak_verse.resolved' as const,
              occurredAt: weakVerseResolutionOccurredAtRef.current.get(id) || new Date().toISOString(),
              payload: {
                weakVerseId: id,
                surahNumber: resolvedWeakVerse.surahNumber,
                ayahNumber: resolvedWeakVerse.ayahNumber
              }
            } satisfies WeakVerseResolvedEvent
          }
        },
        () => RetentionService.saveWeakVerses(prepared.records)
      );
    } catch (error) {
      weakVerseResolutionInFlightRef.current.delete(id);
      setActionFeedback({
        message: error instanceof Error ? error.message : 'تعذر حفظ تحديث قائمة الآيات المتعثرة.',
        type: 'warn'
      });
      return;
    }
    weakVerseResolutionInFlightRef.current.delete(id);

    let projectionMatches = false;
    try {
      projectionMatches = JSON.stringify(RetentionService.getWeakVerses()) === JSON.stringify(prepared.records);
    } catch {
      projectionMatches = false;
    }
    if (!result.success && !(result.recoveredPriorEvents && projectionMatches)) {
      if (result.recoveredPriorEvents) refreshAll();
      setActionFeedback({
        message: result.recoveredPriorEvents
          ? 'استعدنا تغييرات سابقة وحدّثنا القائمة؛ تحقق من حالة الآية قبل إعادة المحاولة.'
          : result.queued
            ? 'حُفظ حذف الآية في سجل الاستعادة، لكن تعذر تطبيقه محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
            : result.error || 'تعذر حفظ تحديث قائمة الآيات المتعثرة.',
        type: 'warn'
      });
      return;
    }

    weakVerseResolutionMutationIdsRef.current.delete(id);
    weakVerseResolutionOccurredAtRef.current.delete(id);
    refreshAll();
    setActionFeedback({
      message: `تمت إزالة ${ayahRef} من قائمة الآيات الملتبسة فقط؛ لم يتغير تقييم المقطع أو موعد مراجعته.`,
      type: 'success'
    });
  };

  // Handle adding manual weak verse
  const handleAddManualWeakVerse = async (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find(s => s.number === weakSurahNum);
    if (!surah) return;

    let text = manualWeakText.trim();
    if (!text) {
      const found = await loadAyahByCoordinate(weakSurahNum, manualWeakAyahNum).catch(() => undefined);
      if (!found?.text) {
        setActionFeedback({
          message: 'تعذر تحميل نص الآية من مصدر القرآن؛ أدخل النص القرآني الصحيح أو حاول مجددًا. لم يتم تسجيل نص بديل.',
          type: 'warn'
        });
        return;
      }
      text = found.text;
    }

    if (weakVerseInFlightRef.current) return;
    const mutationKey = [weakSurahNum, manualWeakAyahNum, text, manualWeakNotes].join('|');
    if (weakVerseMutationKeyRef.current !== mutationKey) {
      weakVerseMutationKeyRef.current = mutationKey;
      weakVerseMutationIdRef.current = 'weak-' + createSecureId();
      weakVerseMutationOccurredAtRef.current = new Date().toISOString();
    }
    const mutationId = weakVerseMutationIdRef.current || 'weak-' + createSecureId();
    weakVerseMutationIdRef.current = mutationId;
    const prepared = buildWeakVerseFailureTransaction({
      surahNumber: weakSurahNum,
      surahName: surah.name,
      ayahNumber: manualWeakAyahNum,
      text,
      notes: manualWeakNotes || 'تمت إضافتها يدوياً للتركيز'
    }, mutationId);
    if (!prepared.success) {
      weakVerseMutationIdRef.current = null;
      weakVerseMutationKeyRef.current = null;
      weakVerseMutationOccurredAtRef.current = null;
      setActionFeedback({ message: prepared.messageAr, type: 'warn' });
      return;
    }

    weakVerseInFlightRef.current = true;
    setIsSavingWeakVerse(true);
    let result: Awaited<ReturnType<typeof persistJournaledTransaction>>;
    try {
      const domainEvent: WeakVerseFailedEvent = {
        schemaVersion: 1,
        id: mutationId,
        type: 'weak_verse.failed',
        occurredAt: weakVerseMutationOccurredAtRef.current || new Date().toISOString(),
        payload: {
          surahNumber: weakSurahNum,
          ayahNumber: manualWeakAyahNum,
          ...(manualWeakNotes ? { notes: manualWeakNotes } : {})
        }
      };
      result = await persistJournaledTransaction(prepared.operations, {}, mutationId, domainEvent);
    } catch (error) {
      weakVerseInFlightRef.current = false;
      setActionFeedback({ message: error instanceof Error ? error.message : 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.', type: 'warn' });
      return;
    }
    weakVerseInFlightRef.current = false;
    setIsSavingWeakVerse(false);
    let projectionsMatch = false;
    try {
      projectionsMatch = JSON.stringify(RetentionService.getPortions()) ===
          JSON.stringify(prepared.operations[0].payload.records) &&
        JSON.stringify(RetentionService.getWeakVerses()) ===
          JSON.stringify(prepared.operations[1].payload.records);
    } catch {
      projectionsMatch = false;
    }
    if (!result.success && !(result.recoveredPriorEvents && projectionsMatch)) {
      if (result.recoveredPriorEvents) {
        // Retain the mutation ID: if this action was part of the recovered batch,
        // reusing it prevents a second increment from being recorded.
        refreshAll();
      }
      setActionFeedback({
        message: result.recoveredPriorEvents
          ? 'استعدنا تغييراً سابقاً وحدّثنا البيانات؛ راجع سجل الآية قبل إعادة المحاولة.'
          : result.queued
            ? 'حُفظت العملية في سجل الاستعادة، لكن تعذر تطبيقها محلياً. حدّث الصفحة قبل أي محاولة أخرى.'
            : result.error || 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.',
        type: 'warn'
      });
      return;
    }

    weakVerseMutationIdRef.current = null;
    weakVerseMutationKeyRef.current = null;
    weakVerseMutationOccurredAtRef.current = null;
    setIsAddWeakVerseModalOpen(false);
    setManualWeakText('');
    setManualWeakNotes('');
    refreshAll();
    setActionFeedback({
      message: `تمت إضافة الآية ${manualWeakAyahNum} من سورة ${surah.name} إلى قائمة الآيات الملتبسة.`,
      type: 'info'
    });
  };

  const filteredWeakVerses = weakVerses.filter(v => 
    v.surahName.includes(weakSearchQuery) ||
    v.text.includes(weakSearchQuery) ||
    (v.notes && v.notes.includes(weakSearchQuery))
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
              <Repeat className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              مركز المراجعة ومنظومة قياس جودة الرسوخ
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              خوارزمية التكرار المتباعد التكيفية لمتابعة محفوظك القرآني وتثبيت المتشابهات والمتفلتات
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsAddWeakVerseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 rounded-xl text-xs font-semibold border border-amber-200 dark:border-amber-800/60 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>تسجيل آية ملتبسة</span>
            </button>

            <button
              onClick={() => setIsAddPortionModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مقطع متابعة جديد</span>
            </button>
          </div>
        </div>

        {/* Global Action Feedback Alert */}
        {actionFeedback && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            actionFeedback.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200' 
              : actionFeedback.type === 'warn'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-900 dark:text-blue-200'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionFeedback.message}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs (5 Views) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200 dark:border-stone-700/60 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('daily_queue')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'daily_queue'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>طابور المراجعة اليومي</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              dailyQueue.length > 0 
                ? 'bg-emerald-700 text-white font-bold' 
                : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400'
            }`}>
              {dailyQueue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('weekly_overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'weekly_overview'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>نظرة أسبوعية للمراجعات</span>
          </button>

          <button
            onClick={() => setActiveTab('weak_verses')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'weak_verses'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>الآيات الملتبسة والصعبة</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono">
              {weakVerses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل المراجعات السابقة</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 font-mono">
              {revisionHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('retention_dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'retention_dashboard'
                ? 'border-emerald-700 text-emerald-800 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>لوحة قياس جودة الرسوخ</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-mono">
              %{metrics.retentionScorePercentage}
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 1: DAILY REVISION QUEUE */}
      {activeTab === 'daily_queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>المقاطع المستحقة للمراجعة اليوم (مرتبة حسب الأولوية والحاجة للتثبيت):</span>
            <span>إجمالي المقاطع المستحقة: <strong className="text-stone-800 dark:text-stone-200">{dailyQueue.length}</strong></span>
          </div>

          {dailyQueue.length === 0 ? (
            <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-8 border border-stone-200 dark:border-stone-700/70 text-center space-y-3">
              <Award className="w-12 h-12 text-emerald-700 dark:text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                أحسنت! أتممت جميع مراجعات اليوم بنجاح
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                لا توجد مقاطع قرآنية مستحقة للمراجعة اليوم. تم حفظ جميع الفواصل الزمنية وفق جدول التكرار المتباعد.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyQueue.map((item) => {
                const statusStyle = STATUS_LABELS[item.status];
                const versesCount = (item.endAyah - item.startAyah + 1) || 1;
                return (
                  <div 
                    key={item.id}
                    className={`bg-white dark:bg-stone-800/90 rounded-2xl p-5 border shadow-xs space-y-4 transition-all ${
                      item.status === 'weak' 
                        ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/20' 
                        : 'border-stone-200 dark:border-stone-700/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran">
                            سورة {item.surahName}
                          </h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 mt-1">
                          الآيات: {item.startAyah} إلى {item.endAyah} ({versesCount} آيات)
                          {item.pageNumber && ` • صفحة ${item.pageNumber}`}
                        </div>
                      </div>

                      <div className="text-left font-mono text-[11px] text-stone-400">
                        التكرار: {item.repetitionCount}x
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-3 gap-2 bg-[#faf8f5] dark:bg-stone-900/60 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700/50 text-[11px]">
                      <div>
                        <div className="text-stone-400 text-[10px]">الفاصل الحالي</div>
                        <div className="font-semibold text-stone-700 dark:text-stone-300 font-mono">
                          {item.intervalDays} {item.intervalDays === 1 ? 'يوم' : 'أيام'}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-400 text-[10px]">عامل السهولة (EF)</div>
                        <div className="font-semibold text-stone-700 dark:text-stone-300 font-mono">
                          {item.easeFactor.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-400 text-[10px]">الأخطاء السابقة</div>
                        <div className={`font-semibold font-mono ${(item.mistakesCount || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {item.mistakesCount || 0}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                        تقييم رسوخ المقطع بعد التسميع:
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          disabled={isSavingRating}
                          onClick={() => handleRatePortion('successful', item)}
                          className="py-2 px-1 text-center bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 transition-all flex flex-col items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ناجحة (متقن)</span>
                        </button>

                        <button
                          disabled={isSavingRating}
                          onClick={() => handleRatePortion('difficult', item)}
                          className="py-2 px-1 text-center bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800/60 transition-all flex flex-col items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>صعبة (بتردد)</span>
                        </button>

                        <button
                          disabled={isSavingRating}
                          onClick={() => { setRatingPortion(item); setReviewNotes(''); setWeakAyahNum(''); }}
                          className="py-2 px-1 text-center bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800/60 transition-all flex flex-col items-center gap-1"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>غير متقنة (يتفلت)</span>
                        </button>
                      </div>

                      {/* Launch Interactive Recitation / Session button */}
                      {onStartSession && (
                        <button
                          onClick={() => onStartSession(item.surahNumber, item.startAyah, item.endAyah, 'review')}
                          className="w-full mt-2 py-1.5 px-3 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-[11px] font-semibold border border-stone-200 dark:border-stone-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3 h-3 text-emerald-700" />
                          <span>فتح المقطع في جلسة التسميع التفاعلية</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: WEEKLY REVISION OVERVIEW */}
      {activeTab === 'weekly_overview' && (
        <div className="space-y-4">
          <div className="text-xs text-stone-500">
            توزيع المقاطع المجدولة للأيام السبعة القادمة حسب خوارزمية التكرار المتباعد:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weeklyOverview.map((day, idx) => (
              <div 
                key={day.date}
                className={`bg-white dark:bg-stone-800/90 rounded-2xl p-4 border flex flex-col justify-between min-h-[220px] transition-all ${
                  day.isToday 
                    ? 'border-emerald-700 dark:border-emerald-500 ring-2 ring-emerald-600/20 shadow-xs' 
                    : 'border-stone-200 dark:border-stone-700/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                        اليوم
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono mb-3">
                    {day.date}
                  </div>

                  {/* Scheduled Items list */}
                  <div className="space-y-2">
                    {day.portions.length === 0 ? (
                      <div className="text-[11px] text-stone-400 italic py-4 text-center">
                        لا توجد مراجعات مجدولة
                      </div>
                    ) : (
                      day.portions.map(p => {
                        const statusBadge = STATUS_LABELS[p.status];
                        return (
                          <div 
                            key={p.id}
                            className="p-2 rounded-xl bg-[#faf8f5] dark:bg-stone-900/80 border border-stone-200/60 dark:border-stone-700/50 text-[11px] space-y-1"
                          >
                            <div className="font-bold text-stone-800 dark:text-stone-200 font-quran truncate">
                              {p.surahName} ({p.startAyah}-{p.endAyah})
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={statusBadge.text}>
                                {p.status === 'weak' ? 'ضعيف' : p.status === 'needs_revision' ? 'يحتاج ضبط' : 'مراجعة دورية'}
                              </span>
                              <span className="text-stone-400 font-mono">{p.intervalDays}d</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-stone-700/60 mt-3 text-[11px] text-stone-500 flex justify-between items-center">
                  <span>المجموع:</span>
                  <span className="font-bold font-mono text-stone-900 dark:text-stone-100">
                    {day.portions.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: WEAK-VERSES LIST */}
      {activeTab === 'weak_verses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3 top-3 text-stone-400" />
              <input
                type="text"
                placeholder="ابحث في الآيات الملتبسة أو السور..."
                value={weakSearchQuery}
                onChange={e => setWeakSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-none"
              />
            </div>

            <div className="text-xs text-stone-500">
              إجمالي الآيات المرصودة: <strong className="text-stone-800 dark:text-stone-200">{filteredWeakVerses.length}</strong>
            </div>
          </div>

          {filteredWeakVerses.length === 0 ? (
            <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-8 border border-stone-200 dark:border-stone-700/70 text-center space-y-3">
              <BookmarkCheck className="w-12 h-12 text-emerald-700 mx-auto" />
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                سجل الآيات الملتبسة نظيف ومثبت
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                لم يتم تسجيل أي آيات متعثرة حالياً. يمكنك تسجيل أي آية تلتبس عليك أثناء القراءة أو التسميع لمراجعتها دورياً.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWeakVerses.map(item => (
                <div 
                  key={item.id}
                  className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900 dark:text-stone-100 font-quran">
                          سورة {item.surahName}
                        </span>
                        <span className="text-[11px] font-mono text-stone-500">
                          الآية {item.ayahNumber}
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        آخر تعثر: {item.lastFailedDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[11px] font-bold font-mono">
                      <span>تكرار الخطأ:</span>
                      <span>{item.mistakeCount}x</span>
                    </div>
                  </div>

                  {/* Ayah Text in Uthmani Quranic Font */}
                  <div className="p-3 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200/70 dark:border-stone-700/60 text-sm font-quran leading-loose text-stone-900 dark:text-stone-100">
                    «{item.text}»
                  </div>

                  {item.notes && (
                    <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                      <strong>ملاحظة التثبيت: </strong>{item.notes}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleResolveWeakVerse(item.id, `آية ${item.ayahNumber} من سورة ${item.surahName}`)}
                      className="flex-1 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>إزالة من قائمة الالتباس</span>
                    </button>

                    {onStartSession && (
                      <button
                        onClick={() => onStartSession(item.surahNumber, item.ayahNumber, item.ayahNumber, 'review')}
                        className="py-1.5 px-3 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors"
                      >
                        تكرار وسماع
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: REVISION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-700" />
              <span>سجل التدقيق الزمني لعمليات المراجعة والتسميع السابقة</span>
            </h3>
            <span className="text-xs text-stone-500 font-mono">
              إجمالي السجلات: {revisionHistory.length}
            </span>
          </div>

          {revisionHistory.length === 0 ? (
            <div className="text-center py-10 text-xs text-stone-400">
              لم يتم تسجيل أي مراجعات سابقة بعد. ابدأ مراجعتك الأولى من طابور المراجعة اليومي.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-700 text-stone-400 pb-2">
                    <th className="py-2 px-3 font-semibold">التاريخ</th>
                    <th className="py-2 px-3 font-semibold">المقطع القرآني</th>
                    <th className="py-2 px-3 font-semibold">التقييم المسجل</th>
                    <th className="py-2 px-3 font-semibold">تغير الفاصل الزمني</th>
                    <th className="py-2 px-3 font-semibold">ملاحظات التثبيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-700/60">
                  {revisionHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-stone-50 dark:hover:bg-stone-700/20">
                      <td className="py-3 px-3 font-mono text-stone-500">{entry.date}</td>
                      <td className="py-3 px-3 font-bold font-quran text-stone-900 dark:text-stone-100">
                        سورة {entry.surahName} ({entry.startAyah}-{entry.endAyah})
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          entry.rating === 'successful' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : entry.rating === 'difficult'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {entry.rating === 'successful' ? 'ناجحة (متقن)' : entry.rating === 'difficult' ? 'صعبة (بتردد)' : 'غير متقنة (يتفلت)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-stone-600 dark:text-stone-400">
                        {entry.intervalDaysBefore}d ➔ {entry.intervalDaysAfter}d
                      </td>
                      <td className="py-3 px-3 text-stone-500">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: RETENTION DASHBOARD */}
      {activeTab === 'retention_dashboard' && (
        <div className="space-y-6">
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
              <div className="text-xs text-stone-500">مؤشر جودة الرسوخ التراكمي</div>
              <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                %{metrics.retentionScorePercentage}
              </div>
              <div className="text-[11px] text-stone-400">
                مقياس علمي مبني على استقرار الفواصل
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
              <div className="text-xs text-stone-500">المقاطع المتتبعة</div>
              <div className="text-3xl font-bold text-stone-900 dark:text-stone-100 font-mono">
                {metrics.totalTrackedPortions}
              </div>
              <div className="text-[11px] text-stone-400">
                تشمل {metrics.totalMemorizedAyahs} آية محفوظة
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
              <div className="text-xs text-stone-500">متوسط عامل السهولة (EF)</div>
              <div className="text-3xl font-bold text-stone-900 dark:text-stone-100 font-mono">
                {metrics.averageEaseFactor}
              </div>
              <div className="text-[11px] text-stone-400">
                المعدل الطبيعي: 2.2 - 2.8
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
              <div className="text-xs text-stone-500">الآيات المتعثرة حالياً</div>
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-400 font-mono">
                {metrics.weakVersesCount}
              </div>
              <div className="text-[11px] text-stone-400">
                تحتاج تركيزاً في الأيام القادمة
              </div>
            </div>
          </div>

          {/* Breakdown by 6 Exact Statuses */}
          <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-700" />
                <span>توزيع المحفوظ القرآني حسب الحالات الست الدقيقة</span>
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                تصنيف إحصائي شامل لجميع مقاطع وسور القرآن المتتبعة
              </p>
            </div>

            {/* Visual Multi-Segment Bar */}
            <div className="space-y-2">
              <div className="w-full h-4 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden flex">
                <div style={{ width: `${metrics.statusPercentages.stable}%` }} className="bg-emerald-600" title={`راسخ: ${metrics.statusPercentages.stable}%`} />
                <div style={{ width: `${metrics.statusPercentages.recently_memorized}%` }} className="bg-sky-500" title={`محفوظ حديثاً: ${metrics.statusPercentages.recently_memorized}%`} />
                <div style={{ width: `${metrics.statusPercentages.needs_revision}%` }} className="bg-amber-500" title={`يحتاج مراجعة: ${metrics.statusPercentages.needs_revision}%`} />
                <div style={{ width: `${metrics.statusPercentages.weak}%` }} className="bg-rose-500" title={`ضعيف: ${metrics.statusPercentages.weak}%`} />
                <div style={{ width: `${metrics.statusPercentages.currently_memorizing}%` }} className="bg-purple-500" title={`قيد الحفظ: ${metrics.statusPercentages.currently_memorizing}%`} />
              </div>

              {/* Legend & Count Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2 text-xs">
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300">راسخ ومتقن</div>
                  <div className="text-lg font-bold font-mono mt-1 text-emerald-800">{metrics.statusBreakdown.stable}</div>
                  <div className="text-[10px] text-stone-400 font-mono">%{metrics.statusPercentages.stable}</div>
                </div>

                <div className="p-3 bg-sky-50/70 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800/40">
                  <div className="font-bold text-sky-900 dark:text-sky-300">محفوظ حديثاً</div>
                  <div className="text-lg font-bold font-mono mt-1 text-sky-800">{metrics.statusBreakdown.recently_memorized}</div>
                  <div className="text-[10px] text-stone-400 font-mono">%{metrics.statusPercentages.recently_memorized}</div>
                </div>

                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/40">
                  <div className="font-bold text-amber-900 dark:text-amber-300">يحتاج مراجعة</div>
                  <div className="text-lg font-bold font-mono mt-1 text-amber-800">{metrics.statusBreakdown.needs_revision}</div>
                  <div className="text-[10px] text-stone-400 font-mono">%{metrics.statusPercentages.needs_revision}</div>
                </div>

                <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/40">
                  <div className="font-bold text-rose-900 dark:text-rose-300">ضعيف ويتفلت</div>
                  <div className="text-lg font-bold font-mono mt-1 text-rose-800">{metrics.statusBreakdown.weak}</div>
                  <div className="text-[10px] text-stone-400 font-mono">%{metrics.statusPercentages.weak}</div>
                </div>

                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/40">
                  <div className="font-bold text-purple-900 dark:text-purple-300">قيد الحفظ</div>
                  <div className="text-lg font-bold font-mono mt-1 text-purple-800">{metrics.statusBreakdown.currently_memorizing}</div>
                  <div className="text-[10px] text-stone-400 font-mono">%{metrics.statusPercentages.currently_memorizing}</div>
                </div>

                <div className="p-3 bg-stone-50/70 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="font-bold text-stone-700 dark:text-stone-300">غير محفوظ</div>
                  <div className="text-lg font-bold font-mono mt-1 text-stone-700">{metrics.statusBreakdown.not_memorized}</div>
                  <div className="text-[10px] text-stone-400">باقي المصحف</div>
                </div>
              </div>
            </div>

            {/* Smart Pedagogical Guidance */}
            <div className="p-4 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200/80 dark:border-stone-700 space-y-2 text-xs">
              <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <span>توصية منهجية لمسارك الحالي:</span>
              </div>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-[11px]">
                {metrics.statusBreakdown.weak > 0 
                  ? `لديك ${metrics.statusBreakdown.weak} مقطع بحاجة إلى رعاية عاجلة وتكرار يومي. نوصيك بتقديم مراجعة المقاطع الضعيفة قبل البدء بأي حفظ جديد، تماشياً مع قاعدة الإمام الشاطبي: «والتثبيت مقدم على الاستكثار».`
                  : 'نسبة الرسوخ لديك ممتازة ومستقرة! يمكنك مواصلة إدراج سور جديدة وفق خطتك مع الالتزام بالورد اليومي للتكرار المتباعد.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RATE FAILED REVISION DETAILS */}
      {ratingPortion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran">
                تسجيل تعثر في سورة {ratingPortion.surahName}
              </h3>
              <button disabled={isSavingRating} onClick={() => { setRatingPortion(null); setReviewNotes(''); setWeakAyahNum(''); }} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500">
              سيتم إعادة ضبط فاصل المراجعة إلى يوم واحد للمراجعة غداً. هل ترغب في تحديد رقم الآية التي حدث فيها اللبس لحفظها في قائمة المتشابهات والمتعثرات؟
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  رقم الآية الملتبسة (اختياري، بين {ratingPortion.startAyah} و {ratingPortion.endAyah}):
                </label>
                <input
                  type="number"
                  min={ratingPortion.startAyah}
                  max={ratingPortion.endAyah}
                  value={weakAyahNum}
                  onChange={e => setWeakAyahNum(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="مثال: 8"
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  ملاحظة سبب الخطأ أو الكلمة المشكلة:
                </label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="مثال: نسيان رأس الآية، التباس بآية أخرى..."
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingRating}
                onClick={() => { setRatingPortion(null); setReviewNotes(''); setWeakAyahNum(''); }}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingRating}
                onClick={() => handleRatePortion('failed')}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                تأكيد التسجيل كـ "غير متقن"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW PORTION */}
      {isAddPortionModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran">
                إضافة مقطع حفظ ومراجعة جديد
              </h3>
              <button onClick={() => setIsAddPortionModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewPortion} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  اختر السورة:
                </label>
                <select
                  value={newSurahNum}
                  onChange={e => {
                    const num = Number(e.target.value);
                    setNewSurahNum(num);
                    const s = ALL_SURAHS.find(sur => sur.number === num);
                    if (s) {
                      setNewStartAyah(1);
                      setNewEndAyah(Math.min(15, s.versesCount));
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-quran"
                >
                  {ALL_SURAHS.map(s => (
                    <option key={s.number} value={s.number}>
                      {s.number}. سورة {s.name} ({s.versesCount} آية)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    من الآية:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newStartAyah}
                    onChange={e => setNewStartAyah(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    إلى الآية:
                  </label>
                  <input
                    type="number"
                    min={newStartAyah}
                    value={newEndAyah}
                    onChange={e => setNewEndAyah(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  الحالة المبدئية للمقطع:
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as PortionMemorizationStatus)}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700"
                >
                  <option value="recently_memorized">محفوظ حديثاً (مراجعة قريبة)</option>
                  <option value="stable">راسخ ومتقن (مراجعة دورية متباعدة)</option>
                  <option value="needs_revision">يحتاج مراجعة وتثبيت</option>
                  <option value="weak">ضعيف ويتفلت (مراجعة يومية)</option>
                  <option value="currently_memorizing">قيد الحفظ الآن</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddPortionModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold"
                >
                  إضافة المقطع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MANUAL WEAK VERSE */}
      {isAddWeakVerseModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran">
                تسجيل آية ملتبسة أو متعثرة يدوياً
              </h3>
              <button onClick={() => setIsAddWeakVerseModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualWeakVerse} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  اختر السورة:
                </label>
                <select
                  value={weakSurahNum}
                  onChange={e => {
                    const num = Number(e.target.value);
                    setWeakSurahNum(num);
                    const s = ALL_SURAHS.find(sur => sur.number === num);
                    if (s) {
                      setManualWeakAyahNum(1);
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 font-quran"
                >
                  {ALL_SURAHS.map(s => (
                    <option key={s.number} value={s.number}>
                      {s.number}. سورة {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  رقم الآية:
                </label>
                <input
                  type="number"
                  min={1}
                  value={manualWeakAyahNum}
                  onChange={e => setManualWeakAyahNum(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  نص الآية (اختياري - يتم جلبه تلقائياً إن وُجد):
                </label>
                <textarea
                  value={manualWeakText}
                  onChange={e => setManualWeakText(e.target.value)}
                  placeholder="اكتب نص الآية بالرسم القرآني إن أردت..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 font-quran"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  سبب اللبس أو المتشابه المشكل:
                </label>
                <input
                  type="text"
                  value={manualWeakNotes}
                  onChange={e => setManualWeakNotes(e.target.value)}
                  placeholder="مثال: الخلط مع موضع سورة البقرة، أو تشابه خواتيم الآيات..."
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddWeakVerseModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingWeakVerse}
                  className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold disabled:opacity-60"
                >
                  {isSavingWeakVerse ? 'جارٍ حفظ الآية...' : 'تسجيل الآية الملتبسة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
