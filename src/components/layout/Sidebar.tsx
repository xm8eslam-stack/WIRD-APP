import React from 'react';
import { 
  Home, 
  BookOpen, 
  Calendar, 
  Sparkles, 
  Repeat, 
  CheckCircle, 
  BarChart3, 
  Compass, 
  Settings, 
  X
} from 'lucide-react';
import { UserProfile } from '../../types/quran';

export type NavTabId = 
  | 'dashboard' 
  | 'library' 
  | 'plans' 
  | 'session' 
  | 'revision' 
  | 'tests' 
  | 'progress' 
  | 'advisor' 
  | 'settings';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
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
  profile,
  dueRevisionCount
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: Home },
    { id: 'library', label: 'المصحف والمكتبة', icon: BookOpen },
    { id: 'plans', label: 'خطط الحفظ', icon: Calendar },
    { id: 'session', label: 'جلسة الحفظ اليومية', icon: Sparkles },
    { id: 'revision', label: 'مركز المراجعة والربط', icon: Repeat, badge: dueRevisionCount > 0 ? dueRevisionCount : undefined },
    { id: 'tests', label: 'اختبارات الحفظ', icon: CheckCircle },
    { id: 'progress', label: 'التقارير والمصحف', icon: BarChart3 },
    { id: 'advisor', label: 'المستشار القرآني', icon: Compass },
    { id: 'settings', label: 'الإعدادات والملف', icon: Settings },
  ];

  const mobileNavItems = navItems.filter(item => ['dashboard', 'library', 'session', 'revision', 'progress'].includes(item.id));
  const mobileLabels: Partial<Record<NavTabId, string>> = {
    dashboard: 'الرئيسية',
    library: 'المصحف',
    session: 'الحفظ',
    revision: 'المراجعة',
    progress: 'التقدم'
  };

  const handleSelect = (id: NavTabId) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <aside className="wird-sidebar w-64 flex flex-col h-full select-none transition-colors">
      {/* Brand Header */}
      <div className="wird-sidebar-brand p-5 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="wird-brand-mark w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-xl font-quran">
            وِ
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="wird-brand-name font-extrabold text-lg tracking-tight font-quran">
                وِرد
              </span>
              <span className="wird-brand-wordmark text-[10px] uppercase font-bold tracking-wider">
                WIRD
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              رفيق الحفظ والتثبيت الذكي
            </p>
          </div>
        </div>

        {isOpenMobile && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-lg transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav aria-label="القائمة الجانبية" className="wird-sidebar-nav flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`wird-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-emerald-900 dark:hover:text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-stone-500 dark:text-stone-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums font-mono ${
                  isActive 
                    ? 'bg-amber-400 text-emerald-950' 
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Mini Profile Card */}
      <div className="p-3 border-t border-stone-200/80 dark:border-stone-800">
        <div className="wird-sidebar-profile rounded-2xl p-3 flex items-center gap-3">
          <div className="wird-profile-avatar w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 font-quran">
            {profile.name.charAt(0) || 'ق'}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <h4 className="wird-profile-name text-xs font-bold truncate">
              {profile.name}
            </h4>
            <p className="wird-profile-caption text-[11px] truncate">
              {profile.memorizationGoal || 'طالب حفظ'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <div className="hidden md:block shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer (Overlay) */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      <nav className="wird-mobile-dock md:hidden" aria-label="التنقل السريع">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className="wird-mobile-dock-item"
            >
              <span className="relative">
                <Icon aria-hidden="true" />
                {item.id === 'revision' && dueRevisionCount > 0 && (
                  <span className="absolute -top-1.5 -left-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] leading-4 font-bold">
                    {dueRevisionCount > 99 ? '99+' : dueRevisionCount}
                  </span>
                )}
              </span>
              <span className="wird-mobile-dock-label">{mobileLabels[item.id]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
