import React, { useState } from 'react';
import { 
  Repeat, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Play, 
  Sparkles, 
  Volume2, 
  Plus,
  BookOpen,
  Filter,
  Check
} from 'lucide-react';
import { RevisionItem, UserProfile } from '../../types/quran';
import { ALL_SURAHS } from '../../data/quranMeta';
import { formatAyahAudioUrl } from '../../services/audioService';

interface RevisionCenterViewProps {
  revisionItems: RevisionItem[];
  profile: UserProfile;
  onUpdateRevisionItems: (items: RevisionItem[]) => void;
  onRecordRevisionComplete: (pagesCount: number, minutes: number, taskName: string) => void;
}

export const RevisionCenterView: React.FC<RevisionCenterViewProps> = ({
  revisionItems,
  profile,
  onUpdateRevisionItems,
  onRecordRevisionComplete
}) => {
  const [filterType, setFilterType] = useState<'all' | 'due' | 'minor' | 'major'>('due');
  const [activeItem, setActiveItem] = useState<RevisionItem | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form for new revision item
  const [newSurah, setNewSurah] = useState<number>(67);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(15);
  const [revType, setRevType] = useState<'minor' | 'major'>('minor');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredItems = revisionItems.filter(item => {
    if (filterType === 'due') return item.nextDueDate <= todayStr;
    if (filterType === 'minor') return item.type === 'minor';
    if (filterType === 'major') return item.type === 'major';
    return true;
  });

  // Handle rating a revision session (Spaced Repetition Algorithm)
  const handleRateRetention = (itemId: string, strength: 'strong' | 'medium' | 'weak') => {
    const updated = revisionItems.map(item => {
      if (item.id !== itemId) return item;

      let intervalDays = 1;
      let easeFactor = item.easeFactor;

      if (strength === 'strong') {
        easeFactor += 0.15;
        intervalDays = Math.max(4, Math.round(item.intervalDays * 2));
      } else if (strength === 'medium') {
        intervalDays = Math.max(2, Math.round(item.intervalDays * 1.2));
      } else {
        // Weak
        easeFactor = Math.max(1.3, easeFactor - 0.2);
        intervalDays = 1; // review tomorrow
      }

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + intervalDays);

      return {
        ...item,
        lastReviewedDate: todayStr,
        nextDueDate: nextDate.toISOString().split('T')[0],
        intervalDays,
        easeFactor,
        repetitionCount: item.repetitionCount + 1,
        strength
      };
    });

    onUpdateRevisionItems(updated);
    onRecordRevisionComplete(1, 15, `مراجعة سورة ${activeItem?.surahName} (${strength === 'strong' ? 'ممتاز' : strength === 'medium' ? 'متوسط' : 'يحتاج تثبيت'})`);
    setActiveItem(null);
  };

  // Add new revision target
  const handleAddRevisionItem = (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find(s => s.number === newSurah);
    if (!surah) return;

    const newItem: RevisionItem = {
      id: `rev-${Date.now()}`,
      surahNumber: newSurah,
      surahName: surah.name,
      startAyah,
      endAyah,
      pageNumber: surah.pageStart,
      juzNumber: surah.juzStart,
      type: revType,
      nextDueDate: todayStr,
      intervalDays: 1,
      easeFactor: 2.5,
      repetitionCount: 0,
      strength: "medium"
    };

    onUpdateRevisionItems([newItem, ...revisionItems]);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Educational Callout */}
      <div className="bg-white dark:bg-stone-800/90 rounded-2xl p-6 border border-stone-200 dark:border-stone-700/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2 font-quran">
              <Repeat className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              مركز المراجعة والربط (منظومة التكرار المتباعد)
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              «تعاهدوا هذا القرآن، فوالذي نفس محمد بيده لهو أشد تفلتاً من الإبل في عُقُلها»
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة ورد مراجعة جديد</span>
          </button>
        </div>

        {/* Methodology explanation banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/40 space-y-1">
            <div className="font-bold text-blue-900 dark:text-blue-200">
              المراجعة الصغرى (الحفظ الحديث)
            </div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
              مراجعة آخر 5 إلى 10 صفحات تم حفظها حديثاً بشكل يومي لمدة أسبوع إلى أسبوعين حتى تثبت تماماً قبل نقلها للمحفوظ القديم.
            </p>
          </div>

          <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/60 dark:border-purple-900/40 space-y-1">
            <div className="font-bold text-purple-900 dark:text-purple-200">
              المراجعة الكبرى (المحفوظ التراكمي)
            </div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
              مراجعة الأجزاء والسور السابقة عبر دورة أسبوعية أو شهرية منظمة بحسب قوة الرسوخ لمنع نسيان ما مضى من القرآن.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Filters & Status Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-stone-800/90 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700/70 text-xs font-medium">
        <button
          onClick={() => setFilterType('due')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
            filterType === 'due'
              ? 'bg-emerald-800 text-white font-bold shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          المستحق لليوم ({revisionItems.filter(i => i.nextDueDate <= todayStr).length})
        </button>

        <button
          onClick={() => setFilterType('minor')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
            filterType === 'minor'
              ? 'bg-emerald-800 text-white font-bold shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          المراجعة الصغرى
        </button>

        <button
          onClick={() => setFilterType('major')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
            filterType === 'major'
              ? 'bg-emerald-800 text-white font-bold shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          المراجعة الكبرى
        </button>

        <button
          onClick={() => setFilterType('all')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors ${
            filterType === 'all'
              ? 'bg-emerald-800 text-white font-bold shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
          }`}
        >
          الكل ({revisionItems.length})
        </button>
      </div>

      {/* 3. Revision Items Table/List */}
      <div className="space-y-3">
        {filteredItems.map((item) => {
          const isDue = item.nextDueDate <= todayStr;

          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-stone-800/90 rounded-2xl p-5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isDue 
                  ? 'border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-400/20' 
                  : 'border-stone-200 dark:border-stone-700/70'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base font-quran text-stone-900 dark:text-stone-100">
                    سورة {item.surahName}
                  </h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    item.type === 'minor'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                  }`}>
                    {item.type === 'minor' ? 'مراجعة صغرى' : 'مراجعة كبرى'}
                  </span>

                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    item.strength === 'strong'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : item.strength === 'medium'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  }`}>
                    {item.strength === 'strong' ? 'راسخ ومتقن' : item.strength === 'medium' ? 'متوسط' : 'يحتاج تثبيت'}
                  </span>
                </div>

                <div className="text-xs text-stone-500 dark:text-stone-400">
                  الآيات ({item.startAyah} - {item.endAyah}) {item.pageNumber && `· صفحة ${item.pageNumber}`} {item.juzNumber && `· الجزء ${item.juzNumber}`}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-left hidden md:block">
                  <div className="text-stone-400">الموعد المستحق:</div>
                  <div className={`font-mono font-bold ${isDue ? 'text-amber-600 dark:text-amber-400' : 'text-stone-600 dark:text-stone-300'}`}>
                    {isDue ? 'مستحق اليوم' : item.nextDueDate}
                  </div>
                </div>

                <button
                  onClick={() => setActiveItem(item)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold shadow-xs transition-colors shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>بدء المراجعة والتقييم</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-500 text-xs space-y-2">
            <Check className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-stone-800 dark:text-stone-200 text-sm">لا توجد مهام مراجعة مستحقة الآن</h4>
            <p>أتممت جميع مهام المراجعة المجدولة لهذا التصنيف، يمكنك إضافة سور جديدة لتثبيتها.</p>
          </div>
        )}
      </div>

      {/* 4. Active Revision & Spaced Repetition Rating Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveItem(null)}
          />

          <div className="relative z-10 bg-white dark:bg-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-700 space-y-6">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                جلسة مراجعة وتثبيت
              </span>
              <h3 className="text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
                سورة {activeItem.surahName}
              </h3>
              <p className="text-xs text-stone-500">
                الآيات ({activeItem.startAyah} - {activeItem.endAyah}) {activeItem.pageNumber && `· صفحة ${activeItem.pageNumber}`}
              </p>
            </div>

            <div className="bg-[#fcfbf7] dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200 dark:border-stone-700 text-xs space-y-3">
              <div className="font-semibold text-stone-800 dark:text-stone-200">
                خطوات المراجعة الصحيحة:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-stone-600 dark:text-stone-400 leading-relaxed text-[11px]">
                <li>اقرأ الآيات غيباً بصوت مسموع وترتيل متأنٍ.</li>
                <li>تأكد من عدم وجود تردد أو التباس في المتشابهات.</li>
                <li>قيّم مستوى حفظك بصدق ليحدد النظام موعد المراجعة القادم بدقة.</li>
              </ol>
            </div>

            {/* Retention Rating Buttons */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                ما هو مستوى رسوخ الآيات في هذه الجلسة؟
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleRateRetention(activeItem.id, 'strong')}
                  className="p-3 rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-center transition-colors"
                >
                  <div className="font-bold text-sm">ممتاز (راسخ)</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                    بعد 7 - 14 يوماً
                  </div>
                </button>

                <button
                  onClick={() => handleRateRetention(activeItem.id, 'medium')}
                  className="p-3 rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900 text-center transition-colors"
                >
                  <div className="font-bold text-sm">متوسط (تثبيت)</div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                    بعد 3 أيام
                  </div>
                </button>

                <button
                  onClick={() => handleRateRetention(activeItem.id, 'weak')}
                  className="p-3 rounded-xl border border-red-400 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900 text-center transition-colors"
                >
                  <div className="font-bold text-sm">ضعيف (يتفلت)</div>
                  <div className="text-[10px] text-red-700 dark:text-red-400 mt-1">
                    غداً فوراً
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-700">
              <button
                onClick={() => setActiveItem(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Revision Target Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsAddModalOpen(false)}
          />

          <div className="relative z-10 bg-white dark:bg-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-700 space-y-4 text-xs">
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
              إضافة مقطع جديد للمراجعة
            </h3>

            <form onSubmit={handleAddRevisionItem} className="space-y-3">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  اختر السورة:
                </label>
                <select
                  value={newSurah}
                  onChange={(e) => setNewSurah(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl"
                >
                  {ALL_SURAHS.map(s => (
                    <option key={s.number} value={s.number}>
                      {s.number}. سورة {s.name} ({s.versesCount} آية)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    من الآية:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={startAyah}
                    onChange={(e) => setStartAyah(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                    إلى الآية:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={endAyah}
                    onChange={(e) => setEndAyah(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#faf8f5] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-semibold mb-1">
                  نوع المراجعة:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRevType('minor')}
                    className={`py-2 px-3 rounded-lg border font-medium ${
                      revType === 'minor'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-800 dark:text-blue-300 font-bold'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600'
                    }`}
                  >
                    مراجعة صغرى (حديثة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevType('major')}
                    className={`py-2 px-3 rounded-lg border font-medium ${
                      revType === 'major'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-600 text-purple-800 dark:text-purple-300 font-bold'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600'
                    }`}
                  >
                    مراجعة كبرى (تراكمية)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold"
                >
                  إضافة لجدول المراجعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
