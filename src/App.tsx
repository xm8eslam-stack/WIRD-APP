import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar, NavTabId } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { QuranLibraryView } from './components/library/QuranLibraryView';
import { MemorizationPlansView } from './components/plans/MemorizationPlansView';
import { MemorizationSessionView } from './components/session/MemorizationSessionView';
import { RevisionCenterView } from './components/revision/RevisionCenterView';
import { MemorizationTestsView } from './components/tests/MemorizationTestsView';
import { ProgressAnalyticsView } from './components/progress/ProgressAnalyticsView';
import { QuranAdvisorView } from './components/assistant/QuranAdvisorView';
import { SettingsView } from './components/settings/SettingsView';
import { StorageService } from './services/storageService';
import { RetentionService } from './services/retentionService';
import { UserProfile, MemorizationPlan, RevisionItem, DailyLog, TestResult } from './types/quran';
import { EngineGeneratedPlan } from './services/planningEngine';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTabId>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // App persistent state
  const [profile, setProfile] = useState<UserProfile>(() => StorageService.getProfile());
  const [plans, setPlans] = useState<MemorizationPlan[]>(() => StorageService.getPlans());
  const [enginePlans, setEnginePlans] = useState<EngineGeneratedPlan[]>(() => StorageService.getEnginePlans());
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>(() => StorageService.getRevisionItems());
  const [logs, setLogs] = useState<DailyLog[]>(() => StorageService.getLogs());

  // Session specific parameters when started from other views
  const [sessionParams, setSessionParams] = useState<{
    surahNumber: number;
    startAyah: number;
    endAyah: number;
  }>({
    surahNumber: 67,
    startAyah: 1,
    endAyah: 10
  });

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

  // Start daily session handler
  const handleStartSession = (surahNumber: number = 67, startAyah: number = 1, endAyah: number = 10) => {
    setSessionParams({ surahNumber, startAyah, endAyah });
    setCurrentTab('session');
  };

  // Session complete callback
  const handleCompleteSession = (memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string) => {
    StorageService.recordSessionCompletion(memorizedAyahs, reviewedPages, minutes, taskName);
    setLogs(StorageService.getLogs());
    setProfile(StorageService.getProfile());
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

  // Add verse to revision from test
  const handleAddVerseToRevision = (surahNumber: number, surahName: string, ayahNumber: number) => {
    const newItem: RevisionItem = {
      id: `rev-${Date.now()}`,
      surahNumber,
      surahName,
      startAyah: ayahNumber,
      endAyah: ayahNumber,
      type: 'minor',
      nextDueDate: new Date().toISOString().split('T')[0],
      intervalDays: 1,
      easeFactor: 2.0,
      repetitionCount: 1,
      strength: 'weak'
    };
    const updated = [newItem, ...revisionItems];
    setRevisionItems(updated);
    StorageService.saveRevisionItems(updated);
    alert(`تمت إضافة الآية ${ayahNumber} من سورة ${surahName} إلى جدول المراجعة المستعجلة للتثبيت.`);
  };

  // Reset all data
  const handleResetAllData = () => {
    StorageService.resetAllData();
    setProfile(StorageService.getProfile());
    setPlans(StorageService.getPlans());
    setEnginePlans(StorageService.getEnginePlans());
    setRevisionItems(StorageService.getRevisionItems());
    setLogs(StorageService.getLogs());
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const dueQueueCount = RetentionService.getDailyRevisionQueue(todayStr).length;
  const dueRevisionCount = Math.max(dueQueueCount, revisionItems.filter(i => i.nextDueDate <= todayStr).length);

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-row selection:bg-emerald-800 selection:text-emerald-50">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
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
        />

        {/* Content Viewport */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              profile={profile}
              plans={plans}
              revisionItems={revisionItems}
              logs={logs}
              onNavigate={setCurrentTab}
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
            />
          )}

          {currentTab === 'session' && (
            <MemorizationSessionView
              initialSurahNumber={sessionParams.surahNumber}
              initialStartAyah={sessionParams.startAyah}
              initialEndAyah={sessionParams.endAyah}
              profile={profile}
              onCompleteSession={handleCompleteSession}
              onExit={() => setCurrentTab('dashboard')}
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
            />
          )}
        </main>
      </div>
    </div>
  );
}
