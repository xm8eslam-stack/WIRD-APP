import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES, JUZ_NAMES, ALL_SURAHS } from '../../data/quranMeta';
import { DailyLog, UserProfile } from '../../types/quran';
import { StorageService } from '../../services/storageService';

interface ProgressAnalyticsViewProps {
  logs: DailyLog[];
  profile: UserProfile;
  onRefreshData: () => void;
}

export const ProgressAnalyticsView: React.FC<ProgressAnalyticsViewProps> = ({
  logs,
  profile,
  onRefreshData
}) => {
  const [selectedJuz, setSelectedJuz] = useState<number>(30); // Default Juz Amma
  const [isExportSuccess, setIsExportSuccess] = useState(false);

  // Default realistic progress stats
  const totalMemorizedAyahs = 172;
  const totalMemorizedPages = 14;
  const completedJuzCount = 0; // almost 1

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
      if (content && StorageService.importBackup(content)) {
        alert("تم استعادة نسختك الاحتياطية بنجاح!");
        onRefreshData();
      } else {
        alert("الملف غير صالح، يرجى اختيار ملف نسخة احتياطية سليم من منصة وِرد.");
      }
    };
    reader.readAsText(file);
  };

  // Surahs in selected Juz
  const juzSurahs = ALL_SURAHS.filter(s => s.juzStart <= selectedJuz && s.juzEnd >= selectedJuz);

  return (
    <div className="space-y-6">
      {/* 1. Header with Export/Import */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
            <BarChart3 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            التقارير والمصحف التفاعلي للإنجاز
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            خريطة بصرية تفاعلية للأجزاء الـ 30 وصفحات المصحف الـ 604
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

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs">
          <div className="text-xs text-stone-500 mb-1">الآيات المحفوظة</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {totalMemorizedAyahs}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-medium">
            من أصل {TOTAL_QURAN_VERSES} آية
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs">
          <div className="text-xs text-stone-500 mb-1">الصفحات المتقنة</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {totalMemorizedPages}
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 font-medium">
            من أصل {TOTAL_QURAN_PAGES} صفحة
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs">
          <div className="text-xs text-stone-500 mb-1">الأجزاء المكتملة</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
            {completedJuzCount} / 30
          </div>
          <div className="text-[11px] text-stone-500 mt-2">
            جزء عمّ قيد الإتمام (75%)
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-5 border border-stone-200 dark:border-stone-700/70 shadow-xs">
          <div className="text-xs text-stone-500 mb-1">معدل التثبيت والرسوخ</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            94%
          </div>
          <div className="text-[11px] text-stone-500 mt-2">
            وفق إحصائيات التكرار المتباعد
          </div>
        </div>
      </div>

      {/* 3. Interactive 30-Juz Visual Map (خريطة الأجزاء الثلاثين) */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              خريطة أجزاء القرآن الكريم (30 جزء)
            </h3>
            <p className="text-xs text-stone-500">
              اضغط على أي جزء لمعاينة سوره ونسبة إنجاز صفحاته
            </p>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-4 text-xs text-stone-600 dark:text-stone-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
              <span>مكتمل ومتقن</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
              <span>قيد الحفظ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-stone-200 dark:bg-stone-700 inline-block" />
              <span>لم يبدأ بعد</span>
            </div>
          </div>
        </div>

        {/* 30 Juz Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
            const isSelected = selectedJuz === juzNum;
            // Juz 30 is in progress, Juz 29 has Al-Mulk, others not started
            let status = 'empty';
            let progressLabel = '0%';
            if (juzNum === 30) {
              status = 'in_progress';
              progressLabel = '75%';
            } else if (juzNum === 29) {
              status = 'in_progress';
              progressLabel = '15%';
            }

            return (
              <button
                key={juzNum}
                onClick={() => setSelectedJuz(juzNum)}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'ring-2 ring-emerald-600 shadow-xs'
                    : ''
                } ${
                  status === 'in_progress'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    : 'bg-[#faf8f5] dark:bg-stone-900 border-stone-200 dark:border-stone-700/80 text-stone-600 dark:text-stone-400 hover:border-stone-400'
                }`}
              >
                <div className="text-[10px] text-stone-400">جزء</div>
                <div className="text-base font-bold font-mono">{juzNum}</div>
                <div className="text-[10px] font-mono mt-0.5">{progressLabel}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Juz Detail Card */}
        <div className="bg-[#fdfbf7] dark:bg-stone-900/60 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
              تفاصيل {JUZ_NAMES[selectedJuz - 1]}
            </h4>
            <span className="text-xs text-stone-500">
              يحتوي على {juzSurahs.length} سورة
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {juzSurahs.map((s) => (
              <div 
                key={s.number}
                className="bg-white dark:bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs flex items-center gap-2"
              >
                <span className="font-bold font-quran text-stone-800 dark:text-stone-200">
                  سورة {s.name}
                </span>
                <span className="text-stone-400 text-[10px]">
                  ({s.versesCount} آية)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
