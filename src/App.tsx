import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar, NavTabId } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { StorageService } from './services/storageService';
import { RetentionService } from './services/retentionService';
import { UserProfile, MemorizationPlan, RevisionItem, DailyLog, TestResult } from './types/quran';
import { EngineGeneratedPlan } from './services/planningEngine';
import { CheckCircle2, AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import { parseRoute, navigateTo, buildRouteHash } from './services/router';
import { getLocalDateString } from './services/unifiedPortionService';
import { getSessionCompletionMetrics } from './services/sessionCompletion';

// Lazy loaded views for optimal chunking and initial load performance
const QuranLibraryView = React.lazy(() => import('./components/library/QuranLibraryView').then(m => ({ default: m.QuranLibraryView })));
const MemorizationPlansView = React.lazy(() => import('./components/plans/MemorizationPlansView').then(m => ({ default: m.MemorizationPlansView })));
const MemorizationSessionView = React.lazy(() => import('./components/session/MemorizationSessionView').then(m => ({ default: m.MemorizationSessionView })));
const RevisionCenterView = React.lazy(() => import('./components/revision/RevisionCenterView').then(m => ({ default: m.RevisionCenterView })));
const MemorizationTestsView = React.lazy(() => import('./components/tests/MemorizationTestsView').then(m => ({ default: m.MemorizationTestsView })));
const ProgressAnalyticsView = React.lazy(() => import('./components/progress/ProgressAnalyticsView').then(m => ({ default: m.ProgressAnalyticsView })));
const QuranAdvisorView = React.lazy(() => import('./components/assistant/QuranAdvisorView').then(m => ({ default: m.QuranAdvisorView })));
const SettingsView = React.lazy(() => import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView })));

export default function App() {
  const initialRoute = parseRoute();
  const [currentTab, setCurrentTab] = useState<NavTabId>(initialRoute.tab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // App persistent state
  const [profile, setProfile] = useState<UserProfile>(() => StorageService.getProfile());
  const [plans, setPlans] = useState<MemorizationPlan[]>(() => StorageService.getPlans());
  const [enginePlans, setEnginePlans] = useState<EngineGeneratedPlan[]>(() => StorageService.getEnginePlans());
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>(() => StorageService.getRevisionItems());
  const [logs, setLogs] = useState<DailyLog[]>(() => StorageService.getLogs());

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
    dashboard: 'لوحة المتابعة اليومية',
    library: 'المصحف والمكتبة القرآنية',
    plans: 'محرك وخطط حفظ القرآن الكريم',
    session: 'جلسة الحفظ اليومية التفاعلية',
    revision: 'مركز المراجعة والتثبيت (التكرار المتباعد)',
    tests: 'اختبارات الحفظ والتقييم',
    progress: 'المصحف التفاعلي والتقارير',
    advisor: 'المستشار القرآني ومنهجيات الحفظ',
    settings: 'الإعدادات والملف الشخصي'
  };

  // Toggle Theme handler
  const handleToggleTheme = () => {
    const newTheme: 'light' | 'dark' = profile.theme === 'dark' ? 'light' : 'dark';
    const updated: UserProfile = { ...profile, theme: newTheme };
    setProfile(updated);
    StorageService.saveProfile(updated);
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
          mode: route.mode || prev.mode
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
  const handleStartSession = (surahNumber: number = 67, startAyah: number = 1, endAyah: number = 10, mode: 'memorize' | 'review' = 'memorize') => {
    setSessionParams({ surahNumber, startAyah, endAyah, mode });
    navigateTo({
      tab: 'session',
      surahNumber,
      startAyah,
      endAyah,
      mode
    });
  };

  // Session complete callback
  const handleCompleteSession = (memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string, mode: 'memorize' | 'review' = sessionParams.mode) => {
    const completion = getSessionCompletionMetrics(mode, memorizedAyahs, reviewedPages);
    StorageService.recordSessionCompletion(completion.memorizedAyahs, completion.reviewedPages, minutes, taskName);
    if (completion.shouldRecordMemorization && sessionParams.surahNumber) {
      RetentionService.recordMemorizationCompletion(
        sessionParams.surahNumber,
        sessionParams.startAyah,
        sessionParams.endAyah
      );
    }
    setLogs(StorageService.getLogs());
    setProfile(StorageService.getProfile());
    setRevisionItems(StorageService.getRevisionItems());
  };

  // Save revision rating or new items
  const handleUpdateRevisionItems = (items: RevisionItem[]) => {
    setRevisionItems(items);
    StorageService.saveRevisionItems(items);
  };

  const handleRecordRevisionComplete = (pagesCount: number, minutes: number, taskName: string) => {
    StorageService.recordSessionCompletion(0, pagesCount, minutes, taskName);
    setLogs(StorageService.getLogs());
  };

  // Save preset plans
  const handleUpdatePlans = (newPlans: MemorizationPlan[]) => {
    setPlans(newPlans);
    StorageService.savePlans(newPlans);
  };

  // Save engine plans
  const handleUpdateEnginePlans = (updatedEnginePlans: EngineGeneratedPlan[]) => {
    setEnginePlans(updatedEnginePlans);
    StorageService.saveEnginePlans(updatedEnginePlans);
  };

  // Test result saved
  const handleSaveTestResult = (result: TestResult) => {
    StorageService.saveTest(result);
  };

  // In-app Toast Notification state
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'info' | 'warn' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warn' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  // Add verse to revision from test with canonical retention sync
  const handleAddVerseToRevision = (surahNumber: number, surahName: string, ayahNumber: number) => {
    RetentionService.addPortion({
      type: 'passage',
      surahNumber,
      surahName,
      startAyah: ayahNumber,
      endAyah: ayahNumber,
      status: 'weak',
      nextDueDate: getLocalDateString(),
      intervalDays: 1,
      easeFactor: 2.0,
      repetitionCount: 1,
      mistakesCount: 1,
      strength: 'weak'
    });

    setRevisionItems(StorageService.getRevisionItems());

    // Synchronize directly with Retention Service
    RetentionService.addOrIncrementWeakVerse(
      surahNumber,
      ayahNumber,
      surahName,
      `الآية رقم ${ayahNumber} من سورة ${surahName}`,
      'تم تسجيل خطأ أو التباس فيها أثناء اختبار الحفظ'
    );

    showToast(`تمت إضافة الآية ${ayahNumber} من سورة ${surahName} إلى جدول المراجعة المستعجلة للتثبيت بنجاح.`, 'success');
  };

  // Reset all data
  const handleResetAllData = () => {
    StorageService.resetAllData();
    RetentionService.resetAll();
    setProfile(StorageService.getProfile());
    setPlans(StorageService.getPlans());
    setEnginePlans(StorageService.getEnginePlans());
    setRevisionItems(StorageService.getRevisionItems());
    setLogs(StorageService.getLogs());
  };

  const todayStr = getLocalDateString();
  const dueRevisionCount = RetentionService.getDailyRevisionQueueDetails(todayStr).totalDueCount;

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-row selection:bg-emerald-800 selection:text-emerald-50">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        profile={profile}
        dueRevisionCount={dueRevisionCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Header */}
        <Header
          currentTab={currentTab}
          tabTitle={tabTitles[currentTab]}
          profile={profile}
          onToggleTheme={handleToggleTheme}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onStartDailySession={() => handleStartSession(67, 1, 10)}
          pwaInstallPrompt={pwaInstallPrompt}
          isStandalone={isStandalone}
          onInstallPwa={handleTriggerPwaInstall}
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
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
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

            {currentTab === 'plans' && (
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
                  setLogs(StorageService.getLogs());
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

            {currentTab === 'settings' && (
              <SettingsView
                profile={profile}
                onUpdateProfile={setProfile}
                onResetAllData={handleResetAllData}
                onToast={showToast}
              />
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
