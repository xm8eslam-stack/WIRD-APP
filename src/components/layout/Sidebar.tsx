import React, { useEffect, useRef } from 'react';
import { 
  Home, 
  BookOpen, 
  ScrollText,
  Calendar, 
  Sparkles, 
  Repeat, 
  CheckCircle, 
  BarChart3, 
  Compass, 
  Settings, 
  X,
  ShieldCheck,
  MoreHorizontal
} from 'lucide-react';
import { UserProfile } from '../../types/quran';
import { WirdBrandLockup } from '../brand/WirdLogo';
import { WirdAvatar } from '../brand/WirdAvatar';

export type NavTabId = 
  | 'dashboard' 
  | 'library' 
  | 'plans' 
  | 'session' 
  | 'revision' 
  | 'tests' 
  | 'progress' 
  | 'advisor' 
  | 'ruqyah'
  | 'settings'
  | 'showcase';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenMobileMenu: () => void;
  isDesktopOpen?: boolean;
  onToggleDesktop?: () => void;
  profile: UserProfile;
  dueRevisionCount: number;
}

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenMobileMenu,
  isDesktopOpen = true,
  onToggleDesktop,
  profile,
  dueRevisionCount
}) => {
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeMobileHandlerRef = useRef(onCloseMobile);
  const previousDesktopOpenRef = useRef(isDesktopOpen);
  closeMobileHandlerRef.current = onCloseMobile;

  useEffect(() => {
    if (previousDesktopOpenRef.current && !isDesktopOpen) {
      document.querySelector<HTMLButtonElement>('[data-sidebar-toggle="desktop"]')?.focus();
    }
    previousDesktopOpenRef.current = isDesktopOpen;
  }, [isDesktopOpen]);

  useEffect(() => {
    if (!isOpenMobile) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mobileCloseButtonRef.current?.focus();

    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileHandlerRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = mobileDrawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDrawerKeyDown);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
    };
  }, [isOpenMobile]);

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: 'ابدأ',
      items: [
        { id: 'dashboard', label: 'الرئيسية', icon: Home },
        { id: 'library', label: 'القرآن والمصحف', icon: BookOpen },\n        { id: 'seerah', label: 'حكاية السيرة', icon: ScrollText },
      ]
    },
    {
      label: 'الحفظ والتثبيت',
      items: [
        { id: 'session', label: 'جلسة الحفظ', icon: Sparkles },
        { id: 'plans', label: 'خطط الحفظ', icon: Calendar },
        { id: 'revision', label: 'المراجعة', icon: Repeat, badge: dueRevisionCount > 0 ? dueRevisionCount : undefined },
        { id: 'tests', label: 'اختبارات الحفظ', icon: CheckCircle },
      ]
    },
    {
      label: 'المتابعة والمساندة',
      items: [
        { id: 'progress', label: 'التقدم والإنجاز', icon: BarChart3 },
        { id: 'advisor', label: 'المستشار القرآني', icon: Compass },
        { id: 'ruqyah', label: 'الرقية الشرعية', icon: ShieldCheck },
      ]
    },
    {
      label: 'إعدادات التطبيق',
      items: [
        { id: 'settings', label: 'الإعدادات', icon: Settings },
      ]
    }
  ];

  const handleSelect = (id: NavTabId) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-64 bg-[#F9F6EE] dark:bg-[#0B132B] border-l border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex flex-col h-full select-none transition-colors">
      {/* Brand Header with Official WIRD Emblem & Wordmark */}
      <div className="p-4 sm:p-5 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex items-center justify-between">
        <WirdBrandLockup symbolSize={40} textSize="md" showSubtitle={true} />

        <div className="flex items-center gap-1">
          {/* Close / Collapse button for Desktop */}
          {onToggleDesktop && (
            <button 
              type="button"
              onClick={onToggleDesktop}
              className="hidden lg:flex min-h-11 min-w-11 items-center justify-center p-1.5 text-stone-500 hover:text-[#1C4E46] dark:hover:text-[#E0A96D] hover:bg-stone-200/50 dark:hover:bg-stone-800/50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              title="إغلاق الشريط الجانبي (Ctrl+B / Cmd+B)"
              aria-label="إغلاق الشريط الجانبي"
              aria-expanded="true"
              aria-keyshortcuts="Control+B Meta+B"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Close button for Mobile Drawer */}
          {isOpenMobile && (
            <button 
              type="button"
              ref={mobileCloseButtonRef}
              onClick={onCloseMobile}
              className="lg:hidden min-h-11 min-w-11 flex items-center justify-center p-1.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              title="إغلاق القائمة"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Grouped navigation */}
      <nav aria-label="القائمة الرئيسية" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label} className="space-y-1.5">
            <p className="px-3.5 text-[10px] font-bold tracking-wider text-[#5B6F6B] dark:text-[#8B9E9B]">{group.label}</p>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full min-h-11 flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
                    isActive
                      ? 'bg-[#1C4E46] text-white shadow-xs dark:bg-[#1E4A47] ring-1 ring-[#C59B27]/40 dark:ring-[#E0A96D]/40'
                      : 'text-[#142421] dark:text-[#F5F1E8] hover:bg-white/80 dark:hover:bg-[#111F36] hover:text-[#1C4E46] dark:hover:text-[#E0A96D]'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#C59B27] dark:text-[#E0A96D]' : 'text-stone-500 dark:text-stone-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums font-mono ${
                      isActive ? 'bg-[#C59B27] text-[#0B132B]' : 'bg-[#1C4E46]/10 dark:bg-[#1E4A47]/80 text-[#1C4E46] dark:text-[#F5F1E8]'
                    }`}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Mini Profile Card */}
      <div className="p-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
        <div className="bg-white/90 dark:bg-[#111F36]/80 rounded-xl p-3 flex items-center gap-3 border border-stone-200/80 dark:border-[#E0A96D]/20 shadow-2xs">
          <WirdAvatar size="sm" shape="circle" variant="primary" />
          <div className="min-w-0 flex-1 text-right">
            <h4 className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8] truncate">
              {profile.name}
            </h4>
            <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] truncate">
              {profile.memorizationGoal || 'طالب حفظ'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar (Collapsible with smooth transition) */}
      <div
        aria-hidden={!isDesktopOpen}
        className={`hidden lg:block shrink-0 h-screen sticky top-0 transition-all duration-300 ease-in-out ${
          isDesktopOpen 
            ? 'w-64 opacity-100' 
            : 'w-0 opacity-0 pointer-events-none overflow-hidden'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile Drawer (Overlay) */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة الأقسام"
            className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl"
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Keep the memorization workspace distraction-free and controls unobstructed. */}
      {currentTab !== 'session' && (
      <nav className="wird-mobile-nav lg:hidden" aria-label="التنقل السريع">
        {[
          { id: 'dashboard' as NavTabId, label: 'الرئيسية', icon: Home },
          { id: 'library' as NavTabId, label: 'القرآن', icon: BookOpen },
          { id: 'session' as NavTabId, label: 'الحفظ', icon: Sparkles },
          { id: 'revision' as NavTabId, label: 'المراجعة', icon: Repeat },
        ].map(item => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={active ? 'page' : undefined}
              className={active ? 'wird-mobile-nav__item is-active' : 'wird-mobile-nav__item'}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              {item.id === 'revision' && dueRevisionCount > 0 && <span className="wird-mobile-nav__badge">{dueRevisionCount}</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="المزيد من الأقسام"
          aria-expanded={isOpenMobile}
          aria-current={currentTab !== 'dashboard' && currentTab !== 'library' && currentTab !== 'revision' ? 'page' : undefined}
          className={currentTab !== 'dashboard' && currentTab !== 'library' && currentTab !== 'revision'
            ? 'wird-mobile-nav__item is-active'
            : 'wird-mobile-nav__item'}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>المزيد</span>
        </button>
      </nav>
      )}
    </>
  );
};
