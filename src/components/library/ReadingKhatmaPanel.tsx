import React, { useState } from 'react';
import { BookOpenCheck, RotateCcw } from 'lucide-react';
import type { ReadingKhatma } from '../../services/readingKhatmaService';

interface Props {
  khatma: ReadingKhatma | null;
  onStart: () => void;
  onReset: () => void;
  onContinue: (page: number) => void;
  error?: string;
}

export const ReadingKhatmaPanel: React.FC<Props> = ({ khatma, onStart, onReset, onContinue, error }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const count = khatma?.completedPages.length || 0;
  const nextPage = khatma ? Array.from({ length: 604 }, (_, index) => index + 1).find(page => !khatma.completedPages.includes(page)) || 604 : 1;
  return <section aria-labelledby="reading-khatma-title" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 id="reading-khatma-title" className="flex items-center gap-2 font-bold text-emerald-950 dark:text-emerald-100"><BookOpenCheck className="h-5 w-5" /> ختمة القراءة</h2>
        <p className="mt-1 text-xs leading-6 text-stone-600 dark:text-stone-300">متابعة قراءة مستقلة عن خطط الحفظ وسجل المراجعة. علّم الصفحة كمقروءة من داخل المصحف.</p>
      </div>
      {!khatma || khatma.completedAt ? <div className="flex flex-wrap items-center gap-2">{khatma?.completedAt && <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">اكتملت الختمة الحالية</span>}<button type="button" onClick={onStart} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900">{khatma ? 'بدء ختمة جديدة' : 'بدء ختمة قراءة'}</button></div> : <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onContinue(nextPage)} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-900">متابعة من صفحة {nextPage}</button>
        {confirmReset ? <><span role="status" className="max-w-xs text-xs">سيُمسح تقدم القراءة وسجل الختمات السابقة. هل تريد المتابعة؟</span><button type="button" onClick={() => { onReset(); setConfirmReset(false); }} className="min-h-11 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white">مسح</button><button type="button" onClick={() => setConfirmReset(false)} className="min-h-11 rounded-lg border px-3 text-xs">إلغاء</button></> : <button type="button" onClick={() => setConfirmReset(true)} aria-label="إعادة ضبط ختمة القراءة" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-3 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200"><RotateCcw className="h-4 w-4" /> بدء من جديد</button>}
      </div>}
    </div>
    {khatma && <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-200"><span>{khatma.completedAt ? 'اكتملت الختمة، تقبل الله' : `المقروء: ${count} من 604 صفحة`}</span><span>{Math.floor(count / 604 * 100)}٪</span></div>
      <progress aria-label="تقدم ختمة القراءة" value={count} max={604} className="h-2 w-full accent-emerald-700" />
    </div>}
    {khatma && khatma.completedCycles.length > 0 && <p className="mt-3 text-xs text-stone-600 dark:text-stone-300">الختمات المكتملة سابقًا: {khatma.completedCycles.length}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs leading-6 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
  </section>;
};
