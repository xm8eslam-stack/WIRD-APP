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
import { persistPortionsSnapshot } from '../../services/journaledSnapshotService';
import { importBackupFile } from '../../services/backupPersistence';
import { RetentionService } from '../../services/retentionService';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { buildPageStatusUpdate, getPageAyahSegments, getPageProgressStatus, PageAyahSegment } from '../../services/pageProgressService';

interface ProgressAnalyticsViewProps {
  logs: DailyLog[];
  profile: UserProfile;
  onRefreshData: () => void;
  onStartSession?: (surahNumber: number, startAyah: number, endAyah: number) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}


type PageGridZoom = 'compact' | 'normal' | 'large';
const PAGE_GRID_ZOOM_CLASSES: Record<PageGridZoom, string> = {
  compact: 'grid-cols-5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20',
  normal: 'grid-cols-5 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-14 xl:grid-cols-18',
  large: 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-16'
};

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
  const [pageGridZoom, setPageGridZoom] = useState<PageGridZoom>('normal');
  const [selectedJuz, setSelectedJuz] = useState<number>(30); // Default Juz Amma
  const [statusFilter, setStatusFilter] = useState<PortionMemorizationStatus | 'all'>('all');
  const [isExportSuccess, setIsExportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [portions, setPortions] = useState<PortionStatusRecord[]>(() => RetentionService.getPortions());

  // Page inspection / edit modal
  const [inspectedPage, setInspectedPage] = useState<{
    pageNumber: number;
    surah: typeof ALL_SURAHS[0];
    surahs: typeof ALL_SURAHS;
    segments: PageAyahSegment[];
    status: PortionMemorizationStatus;
    portionId?: string;
    portionIds?: string[];
  } | null>(null);

  useEffect(() => {
    setPortions(RetentionService.getPortions());
  }, []);

  // Page status is derived only from actual tracked ayah/page ranges.
  const getPageStatus = (page: number) => getPageProgressStatus(page, portions);

  // Change page status
  const handleUpdatePageStatus = async (pageNumber: number, newStatus: PortionMemorizationStatus) => {
    const updatedPortions = buildPageStatusUpdate(
      portions,
      pageNumber,
      newStatus,
      getLocalDateString()
    );
    if (!updatedPortions) {
      onToast?.('تعذر تحديد نطاق الآيات لهذه الصفحة؛ لم يتم تسجيل تقدم غير دقيق.', 'error');
      return;
    }

    // Persist the complete page snapshot through the journal before projecting
    // it to the canonical archive and its two legacy compatibility views.
    const result = await persistPortionsSnapshot(updatedPortions);
    if (!result.success) {
      if (result.recoveredPriorEvents) {
        setPortions(RetentionService.getPortions());
        onRefreshData();
      }
      onToast?.(result.recoveredPriorEvents
        ? 'استعدنا تقدمًا سابقًا وحدّثنا البيانات؛ لم ننفذ تغيير الصفحة الجديد. راجع الحالة ثم أعد المحاولة.'
        : result.queued
          ? 'تم حفظ تقدم الصفحة في سجل الاستعادة، لكن تعذر تطبيقه محلياً.'
          : result.recoveryBlocked
            ? 'تعذر تأمين الحفظ أو استعادة سجل سابق؛ لم نضف تغيير الصفحة الجديد.'
            : 'تعذر حفظ تقدم الصفحة في التخزين المحلي؛ لم يتم تأكيد التغيير.', 'error');
      return;
    }

    setPortions(updatedPortions);
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
    a.download = `wird_backup_${getLocalDateString()}.json`;
    a.click();
    setIsExportSuccess(true);
    setTimeout(() => setIsExportSuccess(false), 3000);
  };

  // Handle Import Backup through the same journal-first boundary as Settings.
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const result = await importBackupFile(file);
      if (result.success) {
        setPortions(RetentionService.getPortions());
        onRefreshData();
        onToast?.(result.message, 'success');
      } else {
        if (result.recoveredPriorEvents) onRefreshData();
        onToast?.(result.message, 'error');
      }
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر استيراد النسخة الاحتياطية؛ لم يتم تغيير بياناتك.',
        'error'
      );
    } finally {
      setIsImporting(false);
      input.value = '';
    }
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
    not_memorized: 0,
    completed: 0
  };

  for (let p = 1; p <= 604; p++) {
    const pageProgress = getPageStatus(p);
    pageStats[pageProgress.status] = (pageStats[pageProgress.status] || 0) + 1;
    if (pageProgress.isFullyCovered && pageProgress.status !== 'not_memorized' && pageProgress.status !== 'currently_memorizing') {
      pageStats.completed++;
    }
  }

  const totalMemorizedPagesCount = pageStats.completed;

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
            className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportSuccess ? 'تم التصدير!' : 'تصدير نسخة احتياطية'}</span>
          </button>

          <label className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#faf8f5] dark:bg-stone-900 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? 'جارٍ الاستيراد...' : 'استيراد بيانات'}</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup}
              disabled={isImporting}
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-1">
          <div className="text-xs text-stone-500">الصفحات المتقنة والمحفوظة</div>
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
            %{totalMemorizedPagesCount > 0 ? Math.round(((pageStats.stable + pageStats.recently_memorized * 0.8) / totalMemorizedPagesCount) * 100) : 0}
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
                aria-pressed={mapMode === 'pages'}
                className={`min-h-11 px-3 py-1.5 rounded-lg transition-colors ${
                  mapMode === 'pages'
                    ? 'bg-emerald-800 text-white font-bold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                صفحات المصحف (604)
              </button>
              <button
                onClick={() => setMapMode('juz')}
                aria-pressed={mapMode === 'juz'}
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
            aria-pressed={statusFilter === 'all'}
            className={`min-h-11 px-2.5 py-1 rounded-lg transition-all ${
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
                aria-pressed={isSelected}
                className={`flex min-h-11 items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-500">
              <span>انقر على رقم أي صفحة للتعديل أو المراجعة:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px]">مصحف المدينة المنورة (604 صفحة)</span>
                <div role="group" aria-label="تكبير خريطة الصفحات" className="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                  <button type="button" aria-pressed={pageGridZoom === 'compact'} onClick={() => setPageGridZoom('compact')} className="min-h-11 px-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-stone-700">أصغر</button>
                  <button type="button" aria-pressed={pageGridZoom === 'normal'} onClick={() => setPageGridZoom('normal')} className="px-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-stone-700">متوسط</button>
                  <button type="button" aria-pressed={pageGridZoom === 'large'} onClick={() => setPageGridZoom('large')} className="px-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-stone-700">أكبر</button>
                </div>
              </div>
            </div>

            <div className={`grid ${PAGE_GRID_ZOOM_CLASSES[pageGridZoom]} gap-2 max-h-[600px] overflow-y-auto overscroll-contain touch-pan-y p-2 bg-[#faf8f5] dark:bg-stone-900/50 rounded-2xl border border-stone-200/60 dark:border-stone-700/50`}>
              {Array.from({ length: 604 }, (_, i) => i + 1).map((pageNum) => {
                const { status, surah, surahs, portionId, portionIds } = getPageStatus(pageNum);
                const pageSegments = getPageAyahSegments(pageNum);
                const cfg = STATUS_CONFIG[status];
                const matchesFilter = statusFilter === 'all' || statusFilter === status;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setInspectedPage({ pageNumber: pageNum, surah, surahs, segments: pageSegments, status, portionId, portionIds })}
                    className={`aspect-square ${pageGridZoom === 'large' ? 'min-h-14 min-w-14' : 'min-h-12 min-w-12'} rounded-lg p-1.5 border text-center transition-all flex flex-col items-center justify-center relative group touch-manipulation active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      matchesFilter ? 'opacity-100 hover:scale-110 z-10' : 'opacity-20 hover:opacity-100'
                    } ${cfg.bg} ${cfg.border} shadow-2xs cursor-pointer`}
                    title={`صفحة ${pageNum} - ${surahs.map(item => item.name).join('، ')} (${cfg.label})`}
                    aria-label={`صفحة ${pageNum} - ${surahs.map(item => item.name).join('، ')} - ${cfg.label}`}
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
                  if (status !== 'not_memorized') memorizedInJuz++;
                }

                const totalInJuz = (juzEndPage - juzStartPage + 1);
                const percent = Math.round((memorizedInJuz / totalInJuz) * 100);

                return (
                  <button
                    key={juzNum}
                    onClick={() => setSelectedJuz(juzNum)}
                    aria-pressed={isSelected}
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
          <div role="dialog" aria-modal="true" aria-labelledby="wird-progress-page-title" className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full border border-stone-200 dark:border-stone-700 shadow-xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  مصحف المدينة المنورة
                </span>
                <h3 id="wird-progress-page-title" className="text-lg font-bold text-stone-900 dark:text-stone-100 font-quran">
                  صفحة رقم {inspectedPage.pageNumber} • {inspectedPage.surahs.map(item => item.name).join('، ')}
                </h3>
              </div>
              <button 
                onClick={() => setInspectedPage(null)} 
                aria-label="إغلاق تفاصيل الصفحة"
                className="min-h-11 min-w-11 text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#faf8f5] dark:bg-stone-900 rounded-xl border border-stone-200/70 dark:border-stone-700 text-xs space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-stone-500 shrink-0">السور الموجودة:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200 text-left">{inspectedPage.surahs.map(item => item.name).join('، ')}</span>
              </div>
              <div className="space-y-1 border-y border-stone-200 dark:border-stone-700 py-2">
                {inspectedPage.segments.map((segment, index) => {
                  const segmentSurah = ALL_SURAHS.find(item => item.number === segment.surahNumber);
                  return (
                    <div key={segment.surahNumber + '-' + index} className="flex justify-between gap-3">
                      <span className="text-stone-500">سورة {segmentSurah?.name || segment.surahNumber}</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">الآيات {segment.startAyah}–{segment.endAyah}</span>
                    </div>
                  );
                })}
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
                      aria-pressed={isCurrent}
                      className={`min-h-11 p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
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

            {inspectedPage.segments.length > 1 && (
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-5">
                تحتوي هذه الصفحة على {inspectedPage.segments.length} مقاطع من مواضع قرآنية مختلفة؛ يفتح زر الجلسة المقطع الأول فقط حتى لا ندمج نطاقات غير متصلة.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-700">
              {onStartSession && (
                <button
                  type="button"
                  disabled={!inspectedPage.segments[0]}
                  onClick={() => {
                    const firstSegment = inspectedPage.segments[0];
                    if (!firstSegment) return;
                    onStartSession(firstSegment.surahNumber, firstSegment.startAyah, firstSegment.endAyah);
                    setInspectedPage(null);
                  }}
                  className="flex min-h-11 items-center gap-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{inspectedPage.segments.length > 1 ? 'فتح أول مقطع من الصفحة' : 'فتح الصفحة في جلسة التسميع'}</span>
                </button>
              )}

              <button
                onClick={() => setInspectedPage(null)}
                className="min-h-11 px-4 py-2 bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold mr-auto"
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
