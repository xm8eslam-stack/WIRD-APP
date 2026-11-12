import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar, NavTabId } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { StorageService } from './services/storageService';
import { RetentionService } from './services/retentionService';
import { UserProfile, MemorizationPlan, RevisionItem, DailyLog, TestResult } from './types/quran';
import { EngineGeneratedPlan } from './services/planningEngine';
import { PlanLifecycle } from './services/planLifecycle';
import { CheckCircle2, AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import { parseRoute, navigateTo, buildRouteHash } from './services/router';
import { persistJournaledSessionCompletion } from './services/sessionPersistence';
import { resetAllDataJournaled } from './services/backupPersistence';
import { getDailySessionSelection } from './services/dailySessionSelection';
import { buildWeakVerseFailureTransaction } from './services/weakVerseRecording';
import { getLocalDateString } from './services/unifiedPortionService';
import { createSecureId } from './services/secureId';
import { persistEnginePlansSnapshot, persistJournaledTransaction, persistPlansSnapshot, persistProfileSnapshot, persistTestResultSnapshot } from './services/journaledSnapshotService';

// Lazy loaded views for optimal chunking and initial load performance
const QuranLibraryView = React.lazy(() => import('./components/library/QuranLibraryView').then(m => ({ default: m.QuranLibraryView })));\nconst SeerahReaderView = React.lazy(() => import('./components/seerah/SeerahReaderView').then(m => ({ default: m.SeerahReaderView })));
const MemorizationPlansView = React.lazy(() => import('./components/plans/MemorizationPlansView').then(m => ({ default: m.MemorizationPlansView })));
const MemorizationSessionView = React.lazy(() => import('./components/session/MemorizationSessionView').then(m => ({ default: m.MemorizationSessionView })));
const RevisionCenterView = React.lazy(() => import('./components/revision/RevisionCenterView').then(m => ({ default: m.RevisionCenterView })));
const MemorizationTestsView = React.lazy(() => import('./components/tests/MemorizationTestsView').then(m => ({ default: m.MemorizationTestsView })));
const ProgressAnalyticsView = React.lazy(() => import('./components/progress/ProgressAnalyticsView').then(m => ({ default: m.ProgressAnalyticsView })));
const QuranAdvisorView = React.lazy(() => import('./components/assistant/QuranAdvisorView').then(m => ({ default: m.QuranAdvisorView })));
const RuqyahView = React.lazy(() => import('./components/ruqyah/RuqyahView').then(m => ({ default: m.RuqyahView })));
const SettingsView = React.lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const BrandDesignShowcase = React.lazy(() => import('./components/brand/BrandDesignShowcase').then(m => ({ default: m.BrandDesignShowcase })));

export default function App() {
  const initialRoute = parseRoute();
  const [currentTab, setCurrentTab] = useState<NavTabId>(initialRoute.tab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Desktop sidebar collapse/expand state with localStorage persistence
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('wird_desktop_sidebar_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.matchMedia('(min-width: 1024px)').matches;
      setIsDesktop(desktop);
      if (desktop) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = () => {
    if (isDesktop) {
      setIsDesktopSidebarOpen(prev => {
        const next = !prev;
        try {
          localStorage.setItem('wird_desktop_sidebar_open', String(next));
        } catch {}
        return next;
      });
    } else {
      setIsMobileMenuOpen(prev => !prev);
    }
  };

  // Global Ctrl+B / Cmd+B shortcut. KeyboardEvent.code keeps the physical
  // KeyB binding stable when the user switches to an Arabic keyboard layout.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isToggleShortcut = (e.ctrlKey || e.metaKey) &&
        !e.altKey && !e.shiftKey &&
        (e.code === 'KeyB' || e.key === 'b' || e.key === 'B' || e.key === 'لا');
      if (!isToggleShortcut || e.repeat || e.defaultPrevented) return;

      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) {
        return;
      }

      e.preventDefault();
      handleToggleSidebar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop]);

  // Treat the mobile/tablet sidebar as a true modal drawer: lock background
  // scrolling while open. Sidebar owns Escape and focus-trap behavior.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  // App persistent state
  const [profile, setProfile] = useState<UserProfile>(() => StorageService.getProfile());
  const [plans, setPlans] = useState<MemorizationPlan[]>(() => StorageService.getPlans());
  const [enginePlans, setEnginePlans] = useState<EngineGeneratedPlan[]>(() => StorageService.getEnginePlans());
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>(() => StorageService.getRevisionItems());
  const [logs, setLogs] = useState<DailyLog[]>(() => StorageService.getLogsForDisplay());

  // Session specific parameters when started from other views or URL deep link
  const [sessionParams, setSessionParams] = useState<{
    surahNumber: number;
    startAyah: number;
    endAyah: number;
    mode: 'memorize' | 'review';
  }>({
    surahNumber: initialRoute.surahNumber || 67,
    startAyah: initialRoute.startAyah || 1,
    endAyah: initialRoute.endAyah || 10,
    mode: initialRoute.mode || 'memorize'
  });

  // Keep one immutable journal identity across retries of the same session.
  const sessionRunIdRef = useRef<string>(createSecureId());
  const sessionCompletionAttemptRef = useRef<{ runId: string; mutationId: string; occurredAt: string } | null>(null);

  // Track if active session has progress for exit confirmation
  const [sessionInProgress, setSessionInProgress] = useState<boolean>(false);
  const [pendingExitTab, setPendingExitTab] = useState<NavTabId | null>(null);

  // PWA states
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [pwaUpdateRegistration, setPwaUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // PWA event listeners & standalone detection
  useEffect(() => {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaInstallPrompt(e);
    };

    const handlePwaUpdate = (e: any) => {
      if (e.detail?.registration) {
        setPwaUpdateRegistration(e.detail.registration);
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('wird-pwa-update-available', handlePwaUpdate);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('wird-pwa-update-available', handlePwaUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTriggerPwaInstall = () => {
    if (pwaInstallPrompt) {
      pwaInstallPrompt.prompt();
      pwaInstallPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[WIRD PWA] User accepted PWA installation prompt');
        }
        setPwaInstallPrompt(null);
      });
    } else {
      // iOS or prompt unavailable fallback toast
      showToast('لتثبيت تطبيق وِرد على آيفون/آيباد: اضغط زر "مشاركة" (Share) ثم اختر "إضافة إلى الشاشة الرئيسية"', 'info');
    }
  };

  const handleApplyPwaUpdate = () => {
    if (pwaUpdateRegistration && pwaUpdateRegistration.waiting) {
      pwaUpdateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  // Apply theme to document element
  useEffect(() => {
    if (profile.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile.theme]);

  // Tab Title mapping
  const tabTitles: Record<NavTabId, string> = {
    dashboard: 'الرئيسية',
    library: 'القرآن الكريم',\n    seerah: 'حكاية السيرة',
    plans: 'خطط الحفظ',
    session: 'جلسة الحفظ',
    revision: 'المراجعة والتثبيت',
    tests: 'اختبارات الحفظ',
    progress: 'التقدم والإنجاز',
    advisor: 'المستشار القرآني',
    ruqyah: 'الرقية الشرعية',
    settings: 'الإعدادات',
    showcase: 'معرض الهوية والتصميم (Showcase)'
  };

  const refreshJournaledSnapshots = () => {
    setProfile(StorageService.getProfile());
    setPlans(StorageService.getPlans());
    setEnginePlans(StorageService.getEnginePlans());
    setRevisionItems(StorageService.getRevisionItems());
    setLogs(StorageService.getLogsForDisplay());
  };

  // Toggle Theme handler
  const handleToggleTheme = async () => {
    const newTheme: 'light' | 'dark' = profile.theme === 'dark' ? 'light' : 'dark';
    const updated: UserProfile = { ...profile, theme: newTheme };
    const result = await persistProfileSnapshot(updated);
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshJournaledSnapshots();
      showToast(result.recoveredPriorEvents
        ? 'استعدنا تغييراً سابقاً وحدّثنا البيانات الحالية؛ لم ننفذ تغيير المظهر الجديد. راجع الحالة ثم أعد المحاولة.'
        : result.queued
        ? 'تم حفظ تغيير المظهر في سجل الاستعادة، لكن تعذر إسقاطه محلياً.'
        : result.recoveryBlocked
          ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نطبق التغيير الجديد لحماية بياناتك.'
          : 'تعذر حفظ تغيير المظهر في التخزين الدائم. لم يتم تطبيق التغيير.', 'error');
      return;
    }
    setProfile(updated);
  };

  // Synchronize route with URL hash & browser history
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.hash) {
      navigateTo(initialRoute.tab, true);
    }

    const handleHashChange = () => {
      const route = parseRoute();
      if (currentTab === 'session' && sessionInProgress && route.tab !== 'session') {
        setPendingExitTab(route.tab);
        window.history.pushState(null, '', buildRouteHash({ tab: 'session', ...sessionParams }));
        return;
      }

      setCurrentTab(route.tab);
      if (route.surahNumber !== undefined) {
        setSessionParams(prev => ({
          surahNumber: route.surahNumber || prev.surahNumber,
          startAyah: route.startAyah || prev.startAyah,
          endAyah: route.endAyah || prev.endAyah,
          mode: route.tab === 'session' ? (route.mode || prev.mode) : prev.mode
        }));
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentTab, sessionInProgress, sessionParams]);

  const handleNavigate = (tab: NavTabId) => {
    if (currentTab === 'session' && sessionInProgress && tab !== 'session') {
      setPendingExitTab(tab);
      return;
    }
    navigateTo(tab);
  };

  // Start daily session handler with deep link URL
  const handleStartSession = (
    surahNumber: number = 67,
    startAyah: number = 1,
    endAyah: number = 10,
    mode: 'memorize' | 'review' = 'memorize'
  ) => {
    sessionRunIdRef.current = createSecureId();
    sessionCompletionAttemptRef.current = null;
    setSessionParams({ surahNumber, startAyah, endAyah, mode });
    navigateTo({
      tab: 'session',
      surahNumber,
      startAyah,
      endAyah,
      mode
    });
  };

  const handleStartDailySession = () => {
    const selection = getDailySessionSelection(
      plans,
      StorageService.getEnginePlans(),
      RetentionService.getPortions(),
      getLocalDateString()
    );
    if (selection.kind === 'blocked') {
      showToast(selection.messageAr, 'warn');
      return;
    }
    handleStartSession(selection.surahNumber, selection.startAyah, selection.endAyah, selection.mode);
  };

  // Commit session progress, activity, streak, and matching smart-plan task together.
  const handleCompleteSession = async (
    memorizedAyahs: number,
    reviewedPages: number,
    minutes: number,
    taskName: string,
    mode: 'memorize' | 'review' = sessionParams.mode
  ): Promise<boolean> => {
    let updatedEnginePlans: EngineGeneratedPlan[] | undefined;
    if (mode === 'memorize' && sessionParams.surahNumber) {
      const currentEnginePlans = StorageService.getEnginePlans();
      const activeEnginePlan = currentEnginePlans.find(plan => plan.isActive && !plan.isPaused);
      const matchingDay = activeEnginePlan?.schedule.find(day =>
        day.memorizationTask && !day.memorizationTask.completed &&
        day.memorizationTask.surahNumber === sessionParams.surahNumber &&
        day.memorizationTask.startAyah === sessionParams.startAyah &&
        day.memorizationTask.endAyah === sessionParams.endAyah
      );
      if (activeEnginePlan && matchingDay?.memorizationTask) {
        const updatedPlan = PlanLifecycle.updateTask(activeEnginePlan, matchingDay.id, {
          status: ((matchingDay.minorRevisionTask && !matchingDay.minorRevisionTask.completed) ||
            (matchingDay.majorRevisionTask && !matchingDay.majorRevisionTask.completed))
            ? 'partially_completed' : 'completed',
          memorizationTask: { ...matchingDay.memorizationTask, completed: true, completedAt: new Date().toISOString() }
        });
        updatedEnginePlans = currentEnginePlans.map(plan => plan.id === activeEnginePlan.id ? updatedPlan : plan);
      }
    }

    if (!sessionCompletionAttemptRef.current ||
        sessionCompletionAttemptRef.current.runId !== sessionRunIdRef.current) {
      sessionCompletionAttemptRef.current = {
        runId: sessionRunIdRef.current,
        mutationId: 'session-' + createSecureId(),
        occurredAt: new Date().toISOString()
      };
    }
    const completionAttempt = sessionCompletionAttemptRef.current;
    const result = await persistJournaledSessionCompletion({
      mutationId: completionAttempt.mutationId,
      occurredAt: completionAttempt.occurredAt,
      mode, memorizedAyahs, reviewedPages, minutes, taskName,
      surahNumber: sessionParams.surahNumber,
      startAyah: sessionParams.startAyah,
      endAyah: sessionParams.endAyah,
      enginePlansSnapshot: updatedEnginePlans
    });
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshJournaledSnapshots();
      showToast(result.messageAr, 'error');
      setRevisionItems(StorageService.getRevisionItems());
      return false;
    }

    if (updatedEnginePlans) setEnginePlans(updatedEnginePlans);
    setLogs(StorageService.getLogsForDisplay());
    setProfile(StorageService.getProfile());
    setRevisionItems(StorageService.getRevisionItems());
    return true;
  };

  // Save preset plans
  const handleUpdatePlans = async (newPlans: MemorizationPlan[]): Promise<boolean> => {
    const result = await persistPlansSnapshot(newPlans);
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshJournaledSnapshots();
      showToast(result.recoveredPriorEvents
        ? 'استعدنا تغييراً سابقاً وحدّثنا الخطط؛ لم ننفذ تعديل الخطة الجديد. راجع الحالة ثم أعد المحاولة.'
        : result.queued
        ? 'الخطة محفوظة في سجل الاستعادة، لكن تعذر تطبيقها محلياً.'
        : result.recoveryBlocked
          ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف تعديل الخطة الجديد.'
          : result.error || 'تعذر حفظ الخطة في التخزين المحلي.', 'error');
      return false;
    }
    setPlans(newPlans);
    return true;
  };

  // Save engine plans
  const handleUpdateEnginePlans = async (updatedEnginePlans: EngineGeneratedPlan[]): Promise<boolean> => {
    const result = await persistEnginePlansSnapshot(updatedEnginePlans);
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshJournaledSnapshots();
      showToast(result.recoveredPriorEvents
        ? 'استعدنا تغييراً سابقاً وحدّثنا الخطط؛ لم ننفذ تعديل الخطة الذكية الجديد. راجع الحالة ثم أعد المحاولة.'
        : result.queued
        ? 'الخطة الذكية محفوظة في سجل الاستعادة، لكن تعذر تطبيقها محلياً.'
        : result.recoveryBlocked
          ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف تعديل الخطة الذكية الجديد.'
          : result.error || 'تعذر حفظ الخطة الذكية في التخزين المحلي.', 'error');
      return false;
    }
    setEnginePlans(updatedEnginePlans);
    return true;
  };

  const handleSaveProfile = async (updatedProfile: UserProfile): Promise<boolean> => {
    const result = await persistProfileSnapshot(updatedProfile);
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshJournaledSnapshots();
      showToast(result.recoveredPriorEvents
        ? 'استعدنا تغييراً سابقاً وحدّثنا الملف الشخصي؛ لم ننفذ التعديل الجديد. راجع البيانات ثم أعد المحاولة.'
        : result.queued
        ? 'تم حفظ الملف الشخصي في سجل الاستعادة، لكن تعذر تطبيقه محلياً.'
        : result.recoveryBlocked
          ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف تعديل الملف الشخصي الجديد.'
          : 'تعذر حفظ إعدادات الملف الشخصي في التخزين الدائم.', 'error');
      return false;
    }
    setProfile(updatedProfile);
    return true;
  };

  // Test results are append-only journal mutations with a stable result ID.
  const handleSaveTestResult = async (result: TestResult): Promise<boolean> => {
    const write = await persistTestResultSnapshot(result);
    if (!write.success) {
      showToast(write.recoveredPriorEvents
        ? 'استعدنا نتيجة اختبار سابقة وحدّثنا السجل؛ لم نضف النتيجة الجديدة. راجع الحالة ثم أعد المحاولة.'
        : write.queued
          ? 'تم حفظ نتيجة الاختبار في سجل الاستعادة، لكن تعذر تطبيقها محلياً.'
          : write.recoveryBlocked
            ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف نتيجة الاختبار.'
            : write.error || 'تعذر حفظ نتيجة الاختبار في التخزين المحلي.', 'error');
      return false;
    }
    return true;
  };

  // In-app Toast Notification state
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'info' | 'warn' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warn' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  useEffect(() => {
    try {
      StorageService.getLogs();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'سجل النشاط يحتاج إلى استعادة؛ لم يتم تعديل البيانات.', 'warn');
    }
  }, []);

  // Persist the weak portion and weak-verse counter as one journal event.
  const handleAddVerseToRevision = async (
    surahNumber: number,
    surahName: string,
    ayahNumber: number,
    text: string,
    notes: string,
    mutationId: string
  ): Promise<boolean> => {
    const prepared = buildWeakVerseFailureTransaction(
      { surahNumber, surahName, ayahNumber, text, notes },
      mutationId
    );
    if (!prepared.success) {
      showToast(prepared.messageAr, 'error');
      return false;
    }

    let result: Awaited<ReturnType<typeof persistJournaledTransaction>>;
    try {
      result = await persistJournaledTransaction(prepared.operations, {}, mutationId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.', 'error');
      return false;
    }
    let projectionsMatch = false;
    try {
      projectionsMatch = JSON.stringify(StorageService.getUnifiedPortions()) ===
          JSON.stringify(prepared.operations[0].payload.records) &&
        JSON.stringify(RetentionService.getWeakVerses()) ===
          JSON.stringify(prepared.operations[1].payload.records);
    } catch {
      projectionsMatch = false;
    }

    if (!result.success && !(result.recoveredPriorEvents && projectionsMatch)) {
      showToast(result.recoveredPriorEvents
        ? 'استعدنا تغييرًا سابقًا وحدّثنا البيانات؛ راجع سجل الآية قبل إعادة المحاولة.'
        : result.queued
          ? 'حُفظت العملية في سجل الاستعادة، لكن تعذر تطبيقها محليًا. حدّث الصفحة قبل أي محاولة أخرى.'
          : result.error || 'تعذر حفظ الآية المتعثرة؛ لم يتم تأكيد التغيير.', 'error');
      if (result.recoveredPriorEvents) setRevisionItems(StorageService.getRevisionItems());
      return false;
    }

    setRevisionItems(StorageService.getRevisionItems());
    showToast(`تمت إضافة الآية ${ayahNumber} من سورة ${surahName} إلى جدول المراجعة المستعجلة للتثبيت بنجاح.`, 'success');
    return true;
  };

  // Reset all data as one ordered, recoverable journal transaction.
  const handleResetAllData = async (): Promise<boolean> => {
    const result = await resetAllDataJournaled();
    if (!result.success) {
      if (result.recoveredPriorEvents) refreshJournaledSnapshots();
      showToast(result.message, 'error');
      return false;
    }
    setProfile(StorageService.getProfile());
    setPlans(StorageService.getPlans());
    setEnginePlans(StorageService.getEnginePlans());
    setRevisionItems(StorageService.getRevisionItems());
    setLogs(StorageService.getLogsForDisplay());
    return true;
  };

  const todayStr = getLocalDateString();
  const dueRevisionCount = RetentionService.getDailyRevisionQueueDetails(todayStr).totalDueCount;

  return (
    <div className="wird-app-shell min-h-screen text-stone-900 dark:text-stone-100 flex flex-row selection:bg-emerald-800 selection:text-emerald-50">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        isDesktopOpen={isDesktopSidebarOpen}
        onToggleDesktop={handleToggleSidebar}
        profile={profile}
        dueRevisionCount={dueRevisionCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden transition-all duration-300">
        {/* Header */}
        <Header
          currentTab={currentTab}
          tabTitle={tabTitles[currentTab]}
          profile={profile}
          onToggleTheme={handleToggleTheme}
          onStartDailySession={handleStartDailySession}
          pwaInstallPrompt={pwaInstallPrompt}
          isStandalone={isStandalone}
          onInstallPwa={handleTriggerPwaInstall}
          isSidebarOpen={isDesktop ? isDesktopSidebarOpen : isMobileMenuOpen}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* PWA Update Ready Banner */}
        {pwaUpdateRegistration && (
          <div className="bg-emerald-900 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-4 text-xs font-medium border-b border-emerald-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>يتوفر تحديث جديد لتطبيق وِرد!</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyPwaUpdate}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold rounded-lg transition-colors"
              >
                تحديث الآن
              </button>
              <button
                onClick={() => setPwaUpdateRegistration(null)}
                className="p-1 hover:bg-emerald-800 rounded text-emerald-200"
                aria-label="تأجيل التحديث"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Offline Network Warning Banner */}
        {!isOnline && (
          <div className="bg-stone-800 text-stone-200 px-4 py-1.5 flex items-center justify-center gap-2 text-xs border-b border-stone-700">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>أنت تعمل حالياً بدون اتصال بالإنترنت. جميع ميزات المصحف والحفظ والمراجعة والاختبارات تعمل بكفاءة من الذاكرة المحلية.</span>
          </div>
        )}

        {/* Content Viewport with Code Splitting Suspense */}
        <main className={`flex-1 min-w-0 w-full p-4 sm:p-5 md:p-6 xl:p-8 ${currentTab === 'session' ? 'pb-6 md:pb-8' : 'pb-28 md:pb-8'} ${isDesktop && !isDesktopSidebarOpen ? 'max-w-none' : 'max-w-[1440px]'} mx-auto`}>
          <React.Suspense fallback={
            <div className="flex flex-col items-center justify-center py-28 space-y-3 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-700 dark:text-emerald-400" />
              <p className="text-xs font-semibold">جارٍ فتح القسم القرآني...</p>
            </div>
          }>
            {currentTab === 'dashboard' && (
              <DashboardView
                profile={profile}
                plans={plans}
                revisionItems={revisionItems}
                logs={logs}
                onNavigate={handleNavigate}
                onStartSession={handleStartSession}
              />
            )}

            {currentTab === 'library' && (
              <QuranLibraryView
                onStartSession={handleStartSession}
                preferredReciter={profile.preferredReciter}
              />
            )}

            {currentTab === 'seerah' && <SeerahReaderView />}\n\n            {currentTab === 'plans' && (
              <MemorizationPlansView
                plans={plans}
                onUpdatePlans={handleUpdatePlans}
                enginePlans={enginePlans}
                onUpdateEnginePlans={handleUpdateEnginePlans}
                onStartSession={handleStartSession}
                onToast={showToast}
              />
            )}

            {currentTab === 'session' && (
              <MemorizationSessionView
                initialSurahNumber={sessionParams.surahNumber}
                initialStartAyah={sessionParams.startAyah}
                initialEndAyah={sessionParams.endAyah}
                mode={sessionParams.mode}
                profile={profile}
                onCompleteSession={handleCompleteSession}
                onExit={() => handleNavigate('dashboard')}
                onProgressChange={setSessionInProgress}
              />
            )}

            {currentTab === 'revision' && (
              <RevisionCenterView
                profile={profile}
                onStartSession={handleStartSession}
              />
            )}

            {currentTab === 'tests' && (
              <MemorizationTestsView
                onSaveTestResult={handleSaveTestResult}
                onAddVerseToRevision={handleAddVerseToRevision}
              />
            )}

            {currentTab === 'progress' && (
              <ProgressAnalyticsView
                logs={logs}
                profile={profile}
                onStartSession={handleStartSession}
                onToast={showToast}
                onRefreshData={() => {
                  setProfile(StorageService.getProfile());
                  setPlans(StorageService.getPlans());
                  setEnginePlans(StorageService.getEnginePlans());
                  setRevisionItems(StorageService.getRevisionItems());
                  setLogs(StorageService.getLogsForDisplay());
                }}
              />
            )}

            {currentTab === 'advisor' && (
              <QuranAdvisorView
                profile={profile}
                plans={plans}
                logs={logs}
                onStartSessionWithSurah={handleStartSession}
              />
            )}

            {currentTab === 'ruqyah' && (
              <RuqyahView onToast={showToast} />
            )}

            {currentTab === 'settings' && (
              <SettingsView
                profile={profile}
                onUpdateProfile={setProfile}
                onSaveProfile={handleSaveProfile}
                onResetAllData={handleResetAllData}
                onBackupImported={refreshJournaledSnapshots}
                onToast={showToast}
              />
            )}

            {currentTab === 'showcase' && (
              <BrandDesignShowcase onClose={() => handleNavigate('dashboard')} />
            )}
          </React.Suspense>
        </main>
      </div>

      {/* Floating Global Toast Notification */}
      {toastMessage && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-6 z-50 max-w-md bg-stone-900/95 dark:bg-stone-800/95 text-white px-4 py-3 rounded-2xl shadow-xl border border-stone-700/80 backdrop-blur-md flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-4"
        >
          {toastMessage.type === 'success' && (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}
          {toastMessage.type === 'warn' && (
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          {(toastMessage.type === 'info' || !toastMessage.type) && (
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
          )}
          <p className="text-xs font-medium leading-relaxed flex-1 text-right">
            {toastMessage.message}
          </p>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-stone-400 hover:text-white rounded-lg transition-colors"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Session Exit Confirmation Modal */}
      {pendingExitTab && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                  مغادرة جلسة الحفظ الجارية
                </h3>
                <p className="text-xs text-stone-500">
                  لديك تكرارات قيد الإنجاز في هذه الجلسة
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-[#faf8f5] dark:bg-stone-900/60 p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-700/60">
              إذا غادرت الجلسة الآن، سيتم فقدان عدد التكرارات الحالي لهذه الآية. هل تريد بالتأكيد الانتقال إلى {tabTitles[pendingExitTab]}؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingExitTab(null)}
                className="px-4 py-2.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-colors"
              >
                البقاء في الجلسة
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingExitTab;
                  setSessionInProgress(false);
                  setPendingExitTab(null);
                  navigateTo(target);
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors"
              >
                مغادرة الجلسة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
