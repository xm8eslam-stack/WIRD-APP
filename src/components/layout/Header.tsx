import React from 'react';
import { Flame, Play, Moon, Sun, BookOpen, ChevronLeft, Download, Cloud, CloudCheck, CloudOff, CloudAlert, RefreshCw, Menu } from 'lucide-react';
import { UserProfile } from '../../types/quran';
import { useCloudSync } from '../../hooks/useCloudSync';
import { WirdSymbol } from '../brand/WirdLogo';

interface HeaderProps {
  currentTab: string;
  tabTitle: string;
  profile: UserProfile;
  onToggleTheme: () => void;
  onStartDailySession: () => void;
  pwaInstallPrompt?: any;
  isStandalone?: boolean;
  onInstallPwa?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  tabTitle,
  profile,
  onToggleTheme,
  onStartDailySession,
  pwaInstallPrompt,
  isStandalone,
  onInstallPwa,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const { status, pendingCount, triggerSync } = useCloudSync();
  return (
    <header className="sticky top-0 z-30 h-[68px] bg-[#F9F6EE]/90 dark:bg-[#0B132B]/90 backdrop-blur-xl border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 px-4 md:px-7 flex items-center justify-between gap-3 transition-colors">
      {/* Page context with official WIRD Symbol badge and Sidebar Toggle */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] shrink-0 ${
              !isSidebarOpen
                ? 'bg-[#F2EDE2] dark:bg-[#111F36] text-[#1C4E46] dark:text-[#E0A96D] ring-1 ring-[#C59B27]/40 shadow-2xs'
                : 'text-stone-700 dark:text-stone-300 hover:text-[#1C4E46] dark:hover:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#111F36]'
            }`}
            title={isSidebarOpen
              ? "إغلاق الشريط الجانبي (Ctrl+B / Cmd+B)"
              : "فتح الشريط الجانبي (Ctrl+B / Cmd+B)"}
            aria-label={isSidebarOpen ? "إغلاق الشريط الجانبي" : "فتح الشريط الجانبي"}
            aria-keyshortcuts="Control+B Meta+B"
            aria-expanded={isSidebarOpen}
            data-sidebar-state={isSidebarOpen ? "open" : "closed"}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs min-w-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 font-bold text-[#1C4E46] dark:text-[#F5F1E8] bg-[#F2EDE2] dark:bg-[#111F36] border border-[#C59B27]/30 px-2.5 py-1 rounded-xl shadow-2xs font-quran">
            <WirdSymbol size={20} variant="primary" />
            <span>وِرد</span>
          </span>
          <ChevronLeft className="hidden sm:block w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0" aria-hidden="true" />
          <h1 className="text-sm md:text-base font-bold text-[#142421] dark:text-[#F5F1E8] truncate max-w-[42vw] sm:max-w-none">{tabTitle}</h1>
        </nav>
      </div>

      {/* Zone 2: Informational items (Streak & Daily reminder) */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-stone-600 dark:text-stone-400">
        <div className="flex items-center gap-1.5 bg-[#F2EDE2]/70 dark:bg-[#111F36] border border-[#C59B27]/30 px-3 py-1.5 rounded-xl text-[#142421] dark:text-[#F5F1E8]">
          <Flame className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] fill-[#C59B27]/30" />
          <span>سلسلة الالتزام:</span>
          <span className="font-bold tabular-nums font-mono text-[#C59B27] dark:text-[#E0A96D]">
            {profile.streakDays} يوماً
          </span>
        </div>

        <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
          <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>الورد اليومي يتحدد وفق خطتك والمراجعات المستحقة</span>
        </div>
      </div>

      {/* Zone 3: Actions (PWA Install + Theme Toggle + Start Session CTA) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* PWA Install Button when prompt available */}
        {!isStandalone && (pwaInstallPrompt || onInstallPwa) && (
          <button
            onClick={onInstallPwa}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-800/80 rounded-lg hover:bg-emerald-200/80 transition-colors"
            title="تثبيت التطبيق على الجهاز كبرنامج مستقل"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>تثبيت التطبيق</span>
          </button>
        )}

        {/* Cloud Sync Quick Status */}
        <button
          onClick={() => triggerSync()}
          disabled={status === 'syncing'}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
            status === 'synced'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
              : status === 'syncing'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 animate-pulse'
              : status === 'offline'
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200 dark:border-stone-700'
              : status === 'unverified'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60'
              : 'bg-stone-50 dark:bg-stone-850 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700'
          }`}
          title={
            status === 'synced'
              ? 'المزامنة السحابية مكتملة (انقر لإعادة المزامنة)'
              : status === 'syncing'
              ? 'جاري المزامنة مع السحابة...'
              : status === 'offline'
              ? 'الجهاز غير متصل بالإنترنت'
              : status === 'unverified'
              ? 'بانتظار تفعيل البريد للمزامنة'
              : 'نمط الزائر (محلي فقط)'
          }
        >
          {status === 'syncing' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
          ) : status === 'synced' ? (
            <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
          ) : status === 'offline' ? (
            <CloudOff className="w-3.5 h-3.5 text-stone-400" />
          ) : status === 'unverified' ? (
            <CloudAlert className="w-3.5 h-3.5 text-amber-600" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-stone-500" />
          )}
          <span className="hidden sm:inline">
            {status === 'synced'
              ? 'مُزامن'
              : status === 'syncing'
              ? 'مزامنة...'
              : status === 'offline'
              ? 'أوفلاين'
              : status === 'unverified'
              ? 'تفعيل البريد'
              : 'محلي'}
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-mono px-1 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={onToggleTheme}
          className="p-2 text-stone-600 dark:text-stone-300 hover:bg-[#F2EDE2] dark:hover:bg-[#111F36] rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-[#C59B27]"
          title={profile.theme === 'dark' ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"}
          aria-label="تبديل المظهر النهاري والليلي"
        >
          {profile.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#E0A96D]" />
          ) : (
            <Moon className="w-4 h-4 text-[#1C4E46]" />
          )}
        </button>

        {currentTab !== 'dashboard' && (
          <button
            onClick={onStartDailySession}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold text-white bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] dark:hover:bg-[#235D59] rounded-xl shadow-xs transition-all hover:shadow-sm active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#C59B27] ring-1 ring-[#C59B27]/40 dark:ring-[#E0A96D]/30"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>جلسة اليوم</span>
          </button>
        )}
      </div>
    </header>
  );
};
