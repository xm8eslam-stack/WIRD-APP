import React from 'react';
import { Flame, Play, Moon, Sun, Menu, BookOpen, ChevronLeft, Download, Smartphone } from 'lucide-react';
import { UserProfile } from '../../types/quran';

interface HeaderProps {
  currentTab: string;
  tabTitle: string;
  profile: UserProfile;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  onStartDailySession: () => void;
  pwaInstallPrompt?: any;
  isStandalone?: boolean;
  onInstallPwa?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tabTitle,
  profile,
  onToggleTheme,
  onOpenMobileMenu,
  onStartDailySession,
  pwaInstallPrompt,
  isStandalone,
  onInstallPwa
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-[#faf8f5]/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 px-4 md:px-8 flex items-center justify-between gap-4 transition-colors">
      {/* Zone 1: Mobile Menu & Semantic RTL Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700"
          aria-label="فتح القائمة الرئيسية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs">
          <span className="font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/60 dark:border-emerald-800/50 px-2.5 py-1 rounded-md tracking-wide">
            وِرد
          </span>
          <ChevronLeft className="w-3.5 h-3.5 text-stone-400 dark:text-stone-600 shrink-0" aria-hidden="true" />
          <h1 className="text-sm md:text-base font-bold text-stone-800 dark:text-stone-100 whitespace-nowrap">
            {tabTitle}
          </h1>
        </nav>
      </div>

      {/* Zone 2: Informational items (Streak & Daily reminder) */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-stone-600 dark:text-stone-400">
        <div className="flex items-center gap-1.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 px-3 py-1.5 rounded-lg text-amber-900 dark:text-amber-200">
          <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500/30" />
          <span>سلسلة الالتزام:</span>
          <span className="font-bold tabular-nums font-mono text-amber-800 dark:text-amber-300">
            {profile.streakDays} يوماً
          </span>
        </div>

        <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
          <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>الورد المقرر: <strong className="text-stone-900 dark:text-stone-200 font-bold font-quran text-sm">وفق خطتك ومحفوظك الحالي</strong></span>
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

        <button
          onClick={onToggleTheme}
          className="p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700"
          title={profile.theme === 'dark' ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"}
          aria-label="تبديل المظهر النهاري والليلي"
        >
          {profile.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-stone-600" />
          )}
        </button>

        <button
          onClick={onStartDailySession}
          className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold text-white bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded-xl shadow-xs transition-all hover:shadow-sm active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>جلسة الوِرد اليومية</span>
        </button>
      </div>
    </header>
  );
};
