import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  BookOpen, 
  Download, 
  Upload, 
  CheckCircle2, 
  Flame, 
  Trophy, 
  Calendar,
  Layers,
  Sparkles,
  Filter,
  Check,
  X,
  Play,
  RotateCcw,
  Eye,
  Info
} from 'lucide-react';
import { TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES, JUZ_NAMES, ALL_SURAHS } from '../../data/quranMeta';
import { DailyLog, UserProfile, PortionMemorizationStatus, PortionStatusRecord } from '../../types/quran';
import { StorageService } from '../../services/storageService';
import { RetentionService } from '../../services/retentionService';
import { getAyahsByPage } from '../../data/verifiedAyahs';
import { getLocalDateString } from '../../services/unifiedPortionService';

interface ProgressAnalyticsViewProps {
  logs: DailyLog[];
  profile: UserProfile;
  onRefreshData: () => void;
  onStartSession?: (surahNumber: number, startAyah: number, endAyah: number, mode?: 'memorize' | 'review') => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

const STATUS_CONFIG: Record<PortionMemorizationStatus, { label: string; bg: string; border: string; text: string; dotColor: string }> = {
  stable: { label: 'راسخ ومتقن', bg: 'bg-emerald-100 dark:bg-emerald-950/70', border: 'border-emerald-400 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200', dotColor: 'bg-emerald-600' },
  recently_memorized: { label: 'محفوظ حديثاً', bg: 'bg-sky-100 dark:bg-sky-950/70', border: 'border-sky-400 dark:border-sky-700', text: 'text-sky-900 dark:text-sky-200', dotColor: 'bg-sky-500' },
  needs_revision: { label: 'يحتاج مراجعة', bg: 'bg-amber-100 dark:bg-amber-950/70', border: 'border-amber-400 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200', dotColor: 'bg-amber-500' },
  weak: { label: 'ضعيف ويتفلت', bg: 'bg-rose-100 dark:bg-rose-950/70', border: 'border-rose-400 dark:border-rose-700', text: 'text-rose-900 dark:text-rose-200', dotColor: 'bg-rose-500' },
  currently_memorizing: { label: 'قيد الحفظ', bg: 'bg-purple-100 dark:bg-purple-950/70', border: 'border-purple-400 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200', dotColor: 'bg-purple-500' },
  not_memorized: { label: 'غير محفوظ', bg: 'bg-stone-100 dark:bg-stone-800/40', border: 'border-stone-200 dark:border-stone-700', text: 'text-stone-500 dark:text-stone-400', dotColor: 'bg-stone-300 dark:bg-stone-600' }
};

export const ProgressAnalyticsView: React.FC<ProgressAnalyticsViewProps> = ({
  logs,
  profile,
  onRefreshData,
  onStartSession,
  onToast
}) => {
  const [mapMode, setMapMode] = useState<'juz' | 'pages'>('pages');
  const [selectedJuz, setSelectedJuz] = useState<number>(30); // Default Juz Amma
  const [statusFilter, setStatusFilter] = useState<PortionMemorizationStatus | 'all'>('all');
  const [isExportSuccess, setIsExportSuccess] = useState(false);
  const [portions, setPortions] = useState<PortionStatusRecord[]>(() => RetentionService.getPortions());

  // Page inspection / edit modal
  const [inspectedPage, setInspectedPage] = useState<{
    pageNumber: number;
    surah: typeof ALL_SURAHS[0];
    status: PortionMemorizationStatus;
    portionId?: string;
  } | null>(null);

  useEffect(() => {
    setPortions(RetentionService.getPortions());
  }, []);

  // Derive each Mushaf page exclusively from its canonical ayah coordinates.
  // A page is memorized only when every ayah on it is covered by a tracked portion.
  const getPageStatus = (page: number): { status: PortionMemorizationStatus; surah: typeof ALL_SURAHS[0]; portionId?: string } => {
    const pageAyahs = getAyahsByPage(page);
    const firstAyah = pageAyahs[0];
    const surah = ALL_SURAHS.find(s => s.number === (firstAyah?.surahNumber || 0))
      || ALL_SURAHS.find(s => page >= s.pageStart && page <= s.pageEnd)
      || ALL_SURAHS[0];

    if (pageAyahs.length === 0) return { status: 'not_memorized', surah };

    const statusPriority: Record<PortionMemorizationStatus, number> = {
      weak: 0,
      needs_revision: 1,
      currently_memorizing: 2,
      recently_memorized: 3,
      stable: 4,
      not_memorized: 5
    };

    const matchingPortions = pageAyahs.map(ayah =>
      portions
        .filter(p => p.surahNumber === ayah.surahNumber && p.startAyah <= ayah.numberInSurah && p.endAyah >= ayah.numberInSurah)
        .sort((a, b) => statusPriority[a.status] - statusPriority[b.status])[0]
    );
    const coveredCount = matchingPortions.filter(Boolean).length;

    if (coveredCount === 0) return { status: 'not_memorized', surah };
    if (coveredCount < pageAyahs.length) return { status: 'currently_memorizing', surah };

    const weakestStatus = matchingPortions
      .filter(Boolean)
      .map(p => p!.status)
      .sort((a, b) => statusPriority[a] - statusPriority[b])[0];
    const uniquePortionIds = new Set(matchingPortions.map(p => p!.id));
    const onlyPortion = uniquePortionIds.size === 1 ? matchingPortions[0] : undefined;
    const sameSurah = pageAyahs.every(a => a.surahNumber === firstAyah.surahNumber);
    const exactPageRange = onlyPortion && sameSurah &&
      onlyPortion.surahNumber === firstAyah.surahNumber &&
      onlyPortion.startAyah === pageAyahs[0].numberInSurah &&
      onlyPortion.endAyah === pageAyahs[pageAyahs.length - 1].numberInSurah;

    return {
      status: weakestStatus,
      surah,
      portionId: exactPageRange ? onlyPortion!.id : undefined
    };
  };

  // Change page status without accidentally marking an entire Surah as one page.
  const handleUpdatePageStatus = (pageNumber: number, newStatus: PortionMemorizationStatus) => {
    const pageAyahs = getAyahsByPage(pageNumber);
    if (pageAyahs.length === 0) {
      onToast?.('تعذر تحديد آيات الصفحة من بيانات المصحف المعتمدة.', 'error');
      return;
    }

    const segments: Array<{ surahNumber: number; startAyah: number; endAyah: number }> = [];
    pageAyahs.forEach(ayah => {
      const last = segments[segments.length - 1];
      if (last && last.surahNumber === ayah.surahNumber && last.endAyah + 1 === ayah.numberInSurah) {
        last.endAyah = ayah.numberInSurah;
      } else {
        segments.push({ surahNumber: ayah.surahNumber, startAyah: ayah.numberInSurah, endAyah: ayah.numberInSurah });
      }
    });

    const currentPortions = RetentionService.getPortions();
    const hasUnsafeOverlap = segments.some(segment =>
      currentPortions.some(p =>
        p.surahNumber === segment.surahNumber &&
        p.startAyah <= segment.endAyah &&
        p.endAyah >= segment.startAyah &&
        !(p.startAyah === segment.startAyah && p.endAyah === segment.endAyah)
      )
    );

    if (hasUnsafeOverlap) {
      onToast?.('هذه الصفحة تتداخل مع مقطع محفوظ أكبر أو أصغر. لم نغيّر البيانات حتى لا نعدّل آيات خارج الصفحة.', 'warn');
      return;
    }

    const today = getLocalDateString();
    segments.forEach(segment => {
      const surah = ALL_SURAHS.find(s => s.number === segment.surahNumber)!;
      const existing = currentPortions.find(p =>
        p.surahNumber === segment.surahNumber &&
        p.startAyah === segment.startAyah &&
        p.endAyah === segment.endAyah
      );

      if (existing) {
        RetentionService.updatePortionStatus(existing.id, newStatus);
      } else {
        RetentionService.addPortion({
          type: 'page',
          surahNumber: segment.surahNumber,
          surahName: surah.name,
          startAyah: segment.startAyah,
          endAyah: segment.endAyah,
          pageNumber,
          juzNumber: surah.juzStart,
          status: newStatus,
          lastReviewedDate: today,
          nextDueDate: today,
          intervalDays: newStatus === 'stable' ? 7 : 1,
          easeFactor: 2.5,
          repetitionCount: newStatus === 'stable' ? 3 : 1,
          mistakesCount: 0
        });
      }
    });

    setPortions(RetentionService.getPortions());
    setInspectedPage(null);
    onRefreshData();
  };

  // Handle Export Backup
  const handleExportBackup = () => {
    const json = StorageService.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wird_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setIsExportSuccess(true);
    setTimeout(() => setIsExportSuccess(false), 3000);
  };

  // Handle Import Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = content ? StorageService.importBackup(content) : { success: false, message: 'الملف فارغ' };
      if (result.success) {
        if (onToast) {
          onToast("تم استعادة نسختك الاحتياطية وسجلات الحفظ بنجاح!", "success");
        }
        setPortions(RetentionService.getPortions());
        onRefreshData();
      } else {
        if (onToast) {
          onToast("الملف غير صالح، يرجى اختيار ملف نسخة احتياطية سليم بصيغة JSON من منصة وِرد.", "warn");
        }
      }
    };
    reader.readAsText(file);
  };

  // Surahs in selected Juz
  const juzSurahs = ALL_SURAHS.filter(s => s.juzStart <= selectedJuz && s.juzEnd >= selectedJuz);

  // Stats calculation across the 604 pages
  const pageStats = {
    stable: 0,
    recently_memorized: 0,
    needs_revision: 0,
    weak: 0,
    currently_memorizing: 0,
    not_memorized: 0
  };

  for (let p = 1; p <= 604; p++) {
    const { status } = getPageStatus(p);
    pageStats[status] = (pageStats[status] || 0) + 1;
  }

  const totalMemorizedPagesCount = pageStats.stable + pageStats.recently_memorized + pageStats.needs_revision + pageStats.weak;

  return (
    <div className="space-y-6">
      {/* 1. Header with Export/Import */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
            <BarChart3 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            المصحف البصري التفاعلي وخريطة الحفظ
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            خريطة إلكترونية تفاعلية لـ 604 صفحة و 30 جزء بالترميز اللوني الدقيق للحالات الست
          </p>
        </div>

        {/* Backup export/import */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportSuccess ? 'تم التصدير!' : 'تصدير نسخة احتياطية'}</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>استيراد بيانات</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
          <div className="text-xs text-stone-500">الصفحات المسجلة كمحفوظة</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {totalMemorizedPagesCount}
          </div>
          <div className="text-[11px] text-stone-400">
            من أصل 604 صفحة ({((totalMemorizedPagesCount / 604) * 100).toFixed(1)}%)
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
          <div className="text-xs text-stone-500">صفحات في طور الحفظ</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400 font-mono tabular-nums">
            {pageStats.currently_memorizing}
          </div>
          <div className="text-[11px] text-stone-400">
            قيد المتابعة اليومية
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
          <div className="text-xs text-stone-500">صفحات تحتاج مراجعة أو تثبيت</div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {pageStats.needs_revision + pageStats.weak}
          </div>
          <div className="text-[11px] text-stone-400">
            منها {pageStats.weak} صفحات ضعيفة
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
          <div className="text-xs text-stone-500">معدل التثبيت العام</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            %{totalMemorizedPagesCount > 0 ? Math.round(((pageStats.stable + pageStats.recently_memorized * 0.8 + pageStats.needs_revision * 0.5 + pageStats.weak * 0.2) / totalMemorizedPagesCount) * 100) : 0}
          </div>
          <div className="text-[11px] text-stone-400">
            جودة الرسوخ التراكمية
          </div>
        </div>
      </div>

      {/* 3. Interactive Visual Quran Map Control Bar */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              <span>خريطة المصحف البصرية التفاعلية</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              انقر على أي صفحة لتفقد حالتها، وتغيير تصنيفها، أو بدء جلسة تسميع وتكرار لها
            </p>
          </div>

          {/* Toggle between 30 Juz and 604 Pages */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#faf8f5] dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold">
              <button
                onClick={() => setMapMode('pages')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  mapMode === 'pages'
                    ? 'bg-emerald-800 text-white font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                صفحات المصحف (604)
              </button>
              <button
                onClick={() => setMapMode('juz')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  mapMode === 'juz'
                    ? 'bg-emerald-800 text-white font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                أجزاء القرآن (30)
              </button>
            </div>
          </div>
        </div>

        {/* Status Legend & Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-1 text-xs border-y border-stone-100 dark:border-stone-700/60">
          <span className="text-stone-400 font-medium">تصفية العرض حسب الحالة:</span>
          
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              statusFilter === 'all'
                ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 font-bold'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            الكل (604)
          </button>

          {(Object.keys(STATUS_CONFIG) as PortionMemorizationStatus[]).map(statusKey => {
            const cfg = STATUS_CONFIG[statusKey];
            const count = pageStats[statusKey];
            const isSelected = statusFilter === statusKey;
            return (
              <button
                key={statusKey}
                onClick={() => setStatusFilter(statusKey)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                  isSelected 
                    ? 'ring-2 ring-emerald-600 font-bold' 
                    : ''
                } ${cfg.bg} ${cfg.border} ${cfg.text}`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                <span>{cfg.label}</span>
                <span className="font-mono text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* MAP VIEW: 604 PAGES GRID */}
        {mapMode === 'pages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>انقر على رقم أي صفحة للتعديل أو المراجعة:</span>
              <span className="font-mono text-[11px]">مصحف المدينة المنورة (604 صفحة)</span>
            </div>

            <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 gap-1.5 max-h-[500px] overflow-y-auto p-2 bg-[#faf8f5] dark:bg-stone-900/50 rounded-2xl border border-stone-200/60 dark:border-stone-700/50">
              {Array.from({ length: 604 }, (_, i) => i + 1).map((pageNum) => {
                const { status, surah, portionId } = getPageStatus(pageNum);
                const cfg = STATUS_CONFIG[status];
                const matchesFilter = statusFilter === 'all' || statusFilter === status;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setInspectedPage({ pageNumber: pageNum, surah, status, portionId })}
                    className={`aspect-square rounded-md p-1 border text-center transition-all flex flex-col items-center justify-center relative group ${
                      matchesFilter ? 'opacity-100 hover:scale-110 z-10' : 'opacity-20 hover:opacity-100'
                    } ${cfg.bg} ${cfg.border} shadow-2xs cursor-pointer`}
                    title={`صفحة ${pageNum} - سورة ${surah.name} (${cfg.label})`}
                  >
                    <span className="text-[10px] font-mono font-bold leading-none text-stone-800 dark:text-stone-200">
                      {pageNum}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${cfg.dotColor}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MAP VIEW: 30 JUZ GRID */}
        {mapMode === 'juz' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
                const isSelected = selectedJuz === juzNum;
                // Calculate juz pages status
                const juzStartPage = (juzNum - 1) * 20 + 1;
                const juzEndPage = juzNum === 30 ? 604 : juzNum * 20;
                let memorizedInJuz = 0;

                for (let p = juzStartPage; p <= juzEndPage; p++) {
                  const { status } = getPageStatus(p);
                  if (status !== 'not_memorized' && status !== 'currently_memorizing') memorizedInJuz++;
                }

                const totalInJuz = (juzEndPage - juzStartPage + 1);
                const percent = Math.round((memorizedInJuz / totalInJuz) * 100);

                return (
                  <button
                    key={juzNum}
                    onClick={() => setSelectedJuz(juzNum)}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between min-h-[100px] ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-600/30'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-stone-400 font-mono">الجزء {juzNum}</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">%{percent}</span>
                    </div>

                    <div className="font-bold text-sm text-stone-900 dark:text-stone-100 font-quran truncate">
                      {JUZ_NAMES[juzNum - 1]}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-stone-100 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden mt-2">
                      <div style={{ width: `${percent}%` }} className="h-full bg-emerald-700" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Juz Detail Panel */}
            <div className="bg-[#fdfbf7] dark:bg-stone-900/60 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 font-quran">
                  سور {JUZ_NAMES[selectedJuz - 1]} (الجزء {selectedJuz})
                </h4>
                <span className="text-xs text-stone-500 font-mono">
                  {juzSurahs.length} سور
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {juzSurahs.map((s) => (
                  <div 
                    key={s.number}
                    className="bg-white dark:bg-stone-800 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <span className="font-bold font-quran text-stone-800 dark:text-stone-200">
                      سورة {s.name}
                    </span>
                    <span className="text-stone-400 text-[10px] font-mono">
                      ص {s.pageStart} • {s.versesCount} آية
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: INSPECT & EDIT PAGE STATUS */}
      {inspectedPage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  مصحف المدينة المنورة
                </span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-quran">
                  صفحة رقم {inspectedPage.pageNumber} • سورة {inspectedPage.surah.name}
                </h3>
              </div>
              <button 
                onClick={() => setInspectedPage(null)} 
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200/70 dark:border-stone-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-500">الجزء القرآني:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">الجزء {inspectedPage.surah.juzStart} ({JUZ_NAMES[inspectedPage.surah.juzStart - 1]})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">نوع السورة:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">{inspectedPage.surah.revelationType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">الحالة الحالية:</span>
                <span className={`font-bold ${STATUS_CONFIG[inspectedPage.status].text}`}>
                  {STATUS_CONFIG[inspectedPage.status].label}
                </span>
              </div>
            </div>

            {/* Set New Status Radio Options (6 exact statuses) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                تحديث حالة حفظ ورسوخ هذه الصفحة:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.keys(STATUS_CONFIG) as PortionMemorizationStatus[]).map((key) => {
                  const cfg = STATUS_CONFIG[key];
                  const isCurrent = inspectedPage.status === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleUpdatePageStatus(inspectedPage.pageNumber, key)}
                      className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
                        isCurrent 
                          ? 'ring-2 ring-emerald-600 font-bold shadow-xs' 
                          : 'hover:border-stone-400'
                      } ${cfg.bg} ${cfg.border} ${cfg.text}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                      <span className="text-[11px]">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-700">
              {onStartSession && (
                <button
                  onClick={() => {
                    const pageAyahs = getAyahsByPage(inspectedPage.pageNumber);
                    const firstAyah = pageAyahs[0];
                    const firstSurahAyahs = firstAyah
                      ? pageAyahs.filter(a => a.surahNumber === firstAyah.surahNumber)
                      : [];
                    if (firstAyah && firstSurahAyahs.length > 0) {
                      onStartSession(firstAyah.surahNumber, firstAyah.numberInSurah, firstSurahAyahs[firstSurahAyahs.length - 1].numberInSurah, 'review');
                    }
                    setInspectedPage(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>مراجعة مقطع الصفحة</span>
                </button>
              )}

              <button
                onClick={() => setInspectedPage(null)}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold mr-auto"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
