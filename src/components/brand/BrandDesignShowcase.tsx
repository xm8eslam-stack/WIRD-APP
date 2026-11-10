import React, { useState } from 'react';
import {
  Search,
  Home,
  Menu,
  Bookmark,
  Sparkles,
  BookOpen,
  Award,
  Flame,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Layers,
  Copy,
  Check,
  Compass,
  Sliders,
  CheckCircle2,
  X
} from 'lucide-react';
import { WirdAvatar } from './WirdAvatar';
import { WirdIslamicPattern } from './WirdPattern';

interface BrandDesignShowcaseProps {
  onClose?: () => void;
}

export const BrandDesignShowcase: React.FC<BrandDesignShowcaseProps> = ({ onClose }) => {
  const [viewMode, setViewMode] = useState<'split' | 'day' | 'night'>('split');
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage for split
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [dayActiveBtn, setDayActiveBtn] = useState<'primary' | 'secondary' | 'accent'>('primary');
  const [nightActiveBtn, setNightActiveBtn] = useState<'primary' | 'secondary' | 'accent'>('primary');
  const [daySearchText, setDaySearchText] = useState('سورة الملك');
  const [nightSearchText, setNightSearchText] = useState('سورة الكهف');
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'mushaf' | 'bookmark' | 'profile'>('home');

  const copyHex = (hex: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 2000);
    }
  };

  const daySwatches = [
    { name: 'Naskh Cream', hex: '#F9F6EE', role: 'خلفية القراءة الهادئة' },
    { name: 'Soft Mint Teal', hex: '#1C4E46', role: 'اللون التفاعلي الرئيسي' },
    { name: 'Bright Gold', hex: '#C59B27', role: 'تطعيمات الشعار والإنجاز' },
    { name: 'Warm Ivory', hex: '#F2EDE2', role: 'أسطح البطاقات الثانوية' },
    { name: 'Deep Charcoal', hex: '#142421', role: 'نصوص واضحة مانعة للإجهاد' },
  ];

  const nightSwatches = [
    { name: 'Midnight Navy', hex: '#0B132B', role: 'سكون الليل والتركيز' },
    { name: 'Dark Glass Navy', hex: '#111F36', role: 'أسطح زجاجية شفافة' },
    { name: 'Muted Teal', hex: '#1E4A47', role: 'أزرار تفاعلية متزنة' },
    { name: 'Glowing Amber', hex: '#E0A96D', role: 'توهج الذهب والمحراب' },
    { name: 'Luminous Bronze', hex: '#C59B27', role: 'إطارات مضيئة ناعمة' },
    { name: 'Soft Ivory', hex: '#F5F1E8', role: 'نصوص بيضاء دافئة' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-24 text-right dir-rtl select-none">
      {/* Top Showcase Navigation Bar */}
      <header className="rounded-3xl p-5 md:p-6 bg-white dark:bg-[#111F36] border border-stone-200/90 dark:border-[#E0A96D]/20 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <WirdAvatar size="lg" shape="circle" withRing withGlow />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black font-quran text-[#1C4E46] dark:text-[#F5F1E8]">
                معرض الهوية البصرية والتصميم الرقمي
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#C59B27]/15 text-[#C59B27] dark:bg-[#E0A96D]/15 dark:text-[#E0A96D] border border-[#C59B27]/30">
                WIRD UI/UX
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-[#8B9E9B] mt-0.5">
              عرض متقدم للسمة الثنائية: الوضع النهاري (Naskh Cream & Teal) والوضع الليلي (Midnight Navy & Glowing Amber)
            </p>
          </div>
        </div>

        {/* Mode Switchers */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-2xl bg-stone-100 dark:bg-[#0B132B] border border-stone-200 dark:border-stone-800 flex items-center gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-gradient-to-r from-[#1C4E46] to-[#0B132B] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#C59B27]" />
              <span>عرض ثنائي مقسم</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === 'day'
                  ? 'bg-[#1C4E46] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>الوضع النهاري</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('night')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === 'night'
                  ? 'bg-[#111F36] text-[#E0A96D] border border-[#E0A96D]/30 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-[#E0A96D]" />
              <span>الوضع الليلي</span>
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-[#0B132B] dark:hover:bg-[#162744] text-stone-600 dark:text-stone-300 transition-colors"
              title="إغلاق المعرض"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Showcase Stage */}
      <section className="relative rounded-3xl overflow-hidden border border-stone-300 dark:border-[#E0A96D]/20 shadow-2xl">
        {/* VIEW 1: SPLIT SCREEN (DAY on Left, NIGHT on Right as specified in brief) */}
        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#C59B27]/30 min-h-[780px]">
            {/* [Day Mode - Left Side in LTR, or First Section] */}
            <div className="bg-[#F9F6EE] p-6 md:p-10 space-y-8 text-[#142421] relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#C59B27]/25 pb-4">
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-[#C59B27]" />
                  <span className="font-bold text-sm text-[#1C4E46]">الوضع النهاري · Day Mode</span>
                </div>
                <span className="text-[11px] font-mono text-stone-500">Canvas #F9F6EE · Naskh Cream</span>
              </div>

              {/* Day Header & Logo */}
              <div className="flex items-center justify-between bg-white/90 p-4 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <WirdAvatar size={48} shape="circle" withRing />
                  <div>
                    <h2 className="font-quran text-2xl font-black text-[#1C4E46] leading-none">وِرْد</h2>
                    <span className="text-[10px] tracking-widest text-[#C59B27] font-bold uppercase">WIRD APP</span>
                  </div>
                </div>

                {/* Day Navigation Icons */}
                <div className="flex items-center gap-1 text-[#1C4E46]">
                  <button type="button" className="p-2 rounded-xl hover:bg-stone-100 transition-colors" title="الرئيسية">
                    <Home className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 rounded-xl hover:bg-stone-100 transition-colors" title="العلامات">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 rounded-xl hover:bg-stone-100 transition-colors" title="القائمة">
                    <Menu className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Day Rounded Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={daySearchText}
                  onChange={e => setDaySearchText(e.target.value)}
                  placeholder="ابحث عن آية، سورة، أو قارئ..."
                  className="w-full pl-4 pr-11 py-3.5 bg-white text-stone-900 rounded-full text-xs md:text-sm shadow-xs border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1C4E46] transition-all"
                />
              </div>

              {/* Day User Profile Card ("Sarah Name") */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#1C4E46] to-[#28665B] text-white flex items-center justify-center font-bold text-sm shadow-xs ring-2 ring-[#C59B27]/40">
                      SN
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-stone-900">سارة أحمد (Sarah Name)</h3>
                        <CheckCircle2 className="w-4 h-4 text-[#1C4E46]" />
                      </div>
                      <p className="text-[11px] text-stone-500">طالبة تحفيظ · مسار سورة البقرة</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold font-mono">
                    <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>14 يوم مواظبة</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 text-center text-xs">
                  <div className="p-2 rounded-xl bg-[#F9F6EE]">
                    <div className="text-[10px] text-stone-500">الآيات المتقنة</div>
                    <div className="font-bold font-mono text-[#1C4E46] text-sm mt-0.5">286 آية</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#F9F6EE]">
                    <div className="text-[10px] text-stone-500">دقائق الورد</div>
                    <div className="font-bold font-mono text-[#1C4E46] text-sm mt-0.5">420 دقيقة</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#F9F6EE]">
                    <div className="text-[10px] text-stone-500">نسبة التثبيت</div>
                    <div className="font-bold font-mono text-[#C59B27] text-sm mt-0.5">98.5%</div>
                  </div>
                </div>
              </div>

              {/* Day Interactive Buttons States */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-stone-500">حالات الأزرار التفاعلية (Active & Hover):</span>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDayActiveBtn('primary')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      dayActiveBtn === 'primary'
                        ? 'bg-[#1C4E46] text-white shadow-md'
                        : 'bg-[#1C4E46]/10 text-[#1C4E46] hover:bg-[#C59B27] hover:text-white'
                    }`}
                  >
                    <span>ابدأ التسميع (Soft Teal)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDayActiveBtn('accent')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      dayActiveBtn === 'accent'
                        ? 'bg-[#C59B27] text-white shadow-md'
                        : 'bg-[#C59B27]/15 text-[#8F6E18] hover:bg-[#C59B27] hover:text-white'
                    }`}
                  >
                    <span>تثبيت الآية (Bright Gold)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDayActiveBtn('secondary')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      dayActiveBtn === 'secondary'
                        ? 'border-[#1C4E46] bg-white text-[#1C4E46]'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-[#C59B27]'
                    }`}
                  >
                    <span>تفسير معتمد</span>
                  </button>
                </div>
              </div>

              {/* Day Typography Specimen */}
              <div className="p-4 rounded-2xl bg-white border border-stone-200/80 space-y-2">
                <span className="text-[10px] font-bold text-[#C59B27] uppercase tracking-wider">الخط العربي الأصيل</span>
                <p className="font-quran text-lg md:text-xl text-[#142421] leading-relaxed">
                  ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
                </p>
                <p className="text-xs text-stone-500 font-sans leading-relaxed">
                  خط النسخ العربي المعتمد مع تباعد متزن يمنح القارئ سكينة وسهولة في مراجعة الأوراد اليومية.
                </p>
              </div>
            </div>

            {/* [Night Mode - Right Side in LTR, or Second Section] */}
            <div className="bg-[#0B132B] p-6 md:p-10 space-y-8 text-[#F5F1E8] relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E0A96D]/20 pb-4">
                <div className="flex items-center gap-2">
                  <Moon className="w-5 h-5 text-[#E0A96D]" />
                  <span className="font-bold text-sm text-[#E0A96D]">الوضع الليلي · Night Mode</span>
                </div>
                <span className="text-[11px] font-mono text-[#8B9E9B]">Canvas #0B132B · Midnight Navy</span>
              </div>

              {/* Night Header & Glowing Logo */}
              <div className="flex items-center justify-between bg-[#111F36]/80 backdrop-blur-md p-4 rounded-2xl border border-[#E0A96D]/25 shadow-lg">
                <div className="flex items-center gap-3">
                  <WirdAvatar size={48} shape="circle" withRing withGlow />
                  <div>
                    <h2 className="font-quran text-2xl font-black text-[#F5F1E8] leading-none drop-shadow-[0_0_8px_rgba(224,169,109,0.3)]">وِرْد</h2>
                    <span className="text-[10px] tracking-widest text-[#E0A96D] font-bold uppercase">WIRD APP</span>
                  </div>
                </div>

                {/* Night Navigation Icons */}
                <div className="flex items-center gap-1 text-[#E0A96D]">
                  <button type="button" className="p-2 rounded-xl hover:bg-white/10 transition-colors" title="الرئيسية">
                    <Home className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 rounded-xl hover:bg-white/10 transition-colors" title="العلامات">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 rounded-xl hover:bg-white/10 transition-colors" title="القائمة">
                    <Menu className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Night Rounded Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#8B9E9B] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={nightSearchText}
                  onChange={e => setNightSearchText(e.target.value)}
                  placeholder="ابحث عن آية، سورة، أو قارئ..."
                  className="w-full pl-4 pr-11 py-3.5 bg-[#111F36]/90 backdrop-blur-md text-[#F5F1E8] rounded-full text-xs md:text-sm shadow-md border border-[#E0A96D]/30 focus:outline-none focus:ring-2 focus:ring-[#E0A96D] transition-all"
                />
              </div>

              {/* Night Glassmorphism User Profile Card ("Sarah Name") */}
              <div className="bg-[#111F36]/85 backdrop-blur-xl p-5 rounded-2xl border border-[#E0A96D]/30 shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(224,169,109,0.06)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#1E4A47] to-[#E0A96D] text-[#0B132B] flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-[#E0A96D]/60">
                      SN
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-[#F5F1E8]">سارة أحمد (Sarah Name)</h3>
                        <CheckCircle2 className="w-4 h-4 text-[#E0A96D]" />
                      </div>
                      <p className="text-[11px] text-[#8B9E9B]">طالبة تحفيظ · مسار سورة البقرة</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E0A96D]/15 text-[#E0A96D] border border-[#E0A96D]/35 text-xs font-bold font-mono">
                    <Flame className="w-3.5 h-3.5 fill-[#E0A96D] text-[#E0A96D]" />
                    <span>14 يوم مواظبة</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center text-xs">
                  <div className="p-2 rounded-xl bg-[#0B132B]/70 border border-white/5">
                    <div className="text-[10px] text-[#8B9E9B]">الآيات المتقنة</div>
                    <div className="font-bold font-mono text-[#E0A96D] text-sm mt-0.5">286 آية</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0B132B]/70 border border-white/5">
                    <div className="text-[10px] text-[#8B9E9B]">دقائق الورد</div>
                    <div className="font-bold font-mono text-[#F5F1E8] text-sm mt-0.5">420 دقيقة</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#0B132B]/70 border border-white/5">
                    <div className="text-[10px] text-[#8B9E9B]">نسبة التثبيت</div>
                    <div className="font-bold font-mono text-[#E0A96D] text-sm mt-0.5">98.5%</div>
                  </div>
                </div>
              </div>

              {/* Night Interactive Buttons States */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#8B9E9B]">حالات الأزرار التفاعلية (Muted Teal & Glowing Amber):</span>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNightActiveBtn('primary')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      nightActiveBtn === 'primary'
                        ? 'bg-[#1E4A47] text-white border border-[#1E4A47] shadow-[0_0_15px_rgba(30,74,71,0.5)]'
                        : 'bg-[#111F36] text-[#8B9E9B] hover:bg-[#E0A96D] hover:text-[#0B132B]'
                    }`}
                  >
                    <span>ابدأ التسميع (Dark Teal)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNightActiveBtn('accent')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      nightActiveBtn === 'accent'
                        ? 'bg-gradient-to-r from-[#F3B77B] to-[#E0A96D] text-[#0B132B] shadow-[0_0_20px_rgba(224,169,109,0.4)]'
                        : 'bg-[#E0A96D]/15 text-[#E0A96D] hover:bg-[#E0A96D] hover:text-[#0B132B]'
                    }`}
                  >
                    <span>تثبيت الآية (Glowing Amber)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNightActiveBtn('secondary')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      nightActiveBtn === 'secondary'
                        ? 'border-[#E0A96D] bg-[#111F36] text-[#E0A96D]'
                        : 'border-white/15 bg-[#111F36]/50 text-white/80 hover:border-[#E0A96D]'
                    }`}
                  >
                    <span>تفسير معتمد</span>
                  </button>
                </div>
              </div>

              {/* Night Typography Specimen */}
              <div className="p-4 rounded-2xl bg-[#111F36]/70 border border-[#E0A96D]/20 space-y-2">
                <span className="text-[10px] font-bold text-[#E0A96D] uppercase tracking-wider">توهج الخط القرآني الليلي</span>
                <p className="font-quran text-lg md:text-xl text-[#F5F1E8] leading-relaxed drop-shadow-[0_0_6px_rgba(224,169,109,0.25)]">
                  ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
                </p>
                <p className="text-xs text-[#8B9E9B] font-sans leading-relaxed">
                  سكينة الليل مع تباين ذهبي دافئ على درجات الكحلي الملكي، لإراحة العين أثناء تلاوة أوراد قيام الليل.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* VIEW 2: FULL DAY MODE */}
        {viewMode === 'day' && (
          <div className="bg-[#F9F6EE] p-8 md:p-14 space-y-8 text-[#142421]">
            <div className="flex items-center gap-3">
              <Sun className="w-6 h-6 text-[#C59B27]" />
              <h2 className="text-2xl font-bold font-quran text-[#1C4E46]">الوضع النهاري الكامل (Day Mode Presentation)</h2>
            </div>
            <p className="text-sm text-stone-600 max-w-2xl leading-relaxed">
              يعتمد هذا الوضع على أرضية ناعمة من درجات الكريمة Naskh Cream المريحة التي تُحاكي صفحات المصاحف الكلاسيكية القديمة دون إبهار العين أو انعكاسات قاسية، مع لمسات التيل والذهب.
            </p>
          </div>
        )}

        {/* VIEW 3: FULL NIGHT MODE */}
        {viewMode === 'night' && (
          <div className="bg-[#0B132B] p-8 md:p-14 space-y-8 text-[#F5F1E8]">
            <div className="flex items-center gap-3">
              <Moon className="w-6 h-6 text-[#E0A96D]" />
              <h2 className="text-2xl font-bold font-quran text-[#E0A96D]">الوضع الليلي الكامل (Night Mode Presentation)</h2>
            </div>
            <p className="text-sm text-[#8B9E9B] max-w-2xl leading-relaxed">
              وضع السكينة والخشوع بأسلوب زجاجي داكن (Dark Glassmorphism) على خلفية كحلية عميقة مع حدود مشعة خفيفة بالأمبر والتوهج الذهبي المستوحى من أضواء المحاريب والمآذن.
            </p>
          </div>
        )}
      </section>

      {/* Color Swatches Palette Lab */}
      <section className="bg-white dark:bg-[#111F36] rounded-3xl p-6 md:p-8 border border-stone-200 dark:border-[#E0A96D]/20 shadow-md space-y-6">
        <div>
          <h2 className="text-lg font-bold font-quran text-[#1C4E46] dark:text-[#F5F1E8]">
            لوحة الألوان الرسمية المعتمدة (Design Palette Tokens)
          </h2>
          <p className="text-xs text-stone-500 dark:text-[#8B9E9B] mt-1">
            اضغط على أي كود لنسخه مباشرة (HEX Code Copy)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Day Palette */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#1C4E46] flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-[#C59B27]" />
              <span>ألوان النهار (Day Mode Palette)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {daySwatches.map(swatch => (
                <button
                  type="button"
                  key={swatch.hex}
                  onClick={() => copyHex(swatch.hex)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-stone-200 hover:border-[#C59B27] transition-all bg-stone-50/60 text-right group cursor-pointer"
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0 border border-black/10 shadow-xs"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-stone-900 group-hover:text-[#1C4E46] flex items-center justify-between">
                      <span>{swatch.name}</span>
                      {copiedHex === swatch.hex ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-stone-500">{swatch.hex}</div>
                    <div className="text-[10px] text-stone-400 truncate">{swatch.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Night Palette */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#E0A96D] flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-[#E0A96D]" />
              <span>ألوان الليل (Night Mode Palette)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {nightSwatches.map(swatch => (
                <button
                  type="button"
                  key={swatch.hex}
                  onClick={() => copyHex(swatch.hex)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 hover:border-[#E0A96D] transition-all bg-[#0B132B]/60 text-right group cursor-pointer"
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0 border border-white/15 shadow-xs"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#F5F1E8] group-hover:text-[#E0A96D] flex items-center justify-between">
                      <span>{swatch.name}</span>
                      {copiedHex === swatch.hex ? (
                        <Check className="w-3.5 h-3.5 text-[#E0A96D]" />
                      ) : (
                        <Copy className="w-3 h-3 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-[#8B9E9B]">{swatch.hex}</div>
                    <div className="text-[10px] text-[#8B9E9B] truncate">{swatch.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
