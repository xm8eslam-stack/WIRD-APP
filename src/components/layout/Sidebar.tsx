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
  X,
  ShieldCheck,
  MoreHorizontal
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
  | 'ruqyah'
  | 'settings';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenMobileMenu: () => void;
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
  profile,
  dueRevisionCount
}) => {
  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: 'ابدأ',
      items: [
        { id: 'dashboard', label: 'الرئيسية', icon: Home },
        { id: 'library', label: 'القرآن والمصحف', icon: BookOpen },
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
      label: 'التطبيق',
      items: [{ id: 'settings', label: 'الإعدادات', icon: Settings }]
    }
  ];

  const handleSelect = (id: NavTabId) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-64 bg-[#f8f6f0] dark:bg-stone-900 border-l border-stone-200/80 dark:border-stone-800 flex flex-col h-full select-none transition-colors">
      {/* Brand Header */}
      <div className="p-5 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-200 flex items-center justify-center font-bold text-xl shadow-xs border border-emerald-700 font-quran">
            وِ
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-emerald-950 dark:text-emerald-100 tracking-tight font-quran">
                وِرد
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                WIRD
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              رفيق القرآن والورد اليومي
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

      {/* Grouped navigation */}
      <nav aria-label="القائمة الرئيسية" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label} className="space-y-1.5">
            <p className="px-3.5 text-[10px] font-bold tracking-wide text-stone-400 dark:text-stone-500">{group.label}</p>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full min-h-11 flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-sm dark:bg-emerald-700'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-white/80 dark:hover:bg-stone-800 hover:text-emerald-900 dark:hover:text-emerald-300'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-300' : 'text-stone-500 dark:text-stone-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums ${
                      isActive ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    }`}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Mini Profile Card */}
      <div className="p-3 border-t border-stone-200/80 dark:border-stone-800">
        <div className="bg-stone-100/90 dark:bg-stone-800/80 rounded-xl p-3 flex items-center gap-3 border border-stone-200/60 dark:border-stone-700/60">
          <div className="w-9 h-9 rounded-full bg-emerald-900 text-amber-200 flex items-center justify-center font-bold text-sm shrink-0 font-quran">
            {profile.name.charAt(0) || 'ق'}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
              {profile.name}
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
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

      {/* Keep the memorization workspace distraction-free and controls unobstructed. */}
      {currentTab !== 'session' && (
      <nav className="wird-mobile-nav md:hidden" aria-label="التنقل السريع">
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
        <button type="button" onClick={onOpenMobileMenu} className="wird-mobile-nav__item" aria-label="المزيد من الأقسام">
          <MoreHorizontal className="h-5 w-5" />
          <span>المزيد</span>
        </button>
      </nav>
      )}
    </>
  );
};
