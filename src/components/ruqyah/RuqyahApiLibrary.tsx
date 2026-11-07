import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  fetchRuqyahApiData,
  resolveApiQuranEntryText,
} from '../../services/ruqyahApiService';
import type { RuqyahApiEntry } from '../../services/ruqyahApiService';

type ProgramId = 'brief-ruqya' | 'a-medium-ruqya' | 'a-long-ruqya';
type SourceId = 'from-quran';

interface RuqyahApiSubcategory {
  subcategory: string;
  'subcategory-slug': string;
  ruqyah: Array<{ id: string | number; title: string }>;
}

interface RuqyahApiProgramCategory {
  title: string;
  subcategories: RuqyahApiSubcategory[];
}

const PROGRAMS: Array<{ id: ProgramId; label: string }> = [
  { id: 'brief-ruqya', label: 'الرقية المختصرة' },
  { id: 'a-medium-ruqya', label: 'الرقية المتوسطة' },
  { id: 'a-long-ruqya', label: 'الرقية المطولة' }
];

const SOURCES: Array<{ id: SourceId; label: string }> = [
  { id: 'from-quran', label: 'فهرس مواضع الآيات القرآنية' }
];

export const RuqyahApiLibrary: React.FC = () => {
  const [program, setProgram] = useState<ProgramId>('brief-ruqya');
  const [source, setSource] = useState<SourceId>('from-quran');
  const [categories, setCategories] = useState<RuqyahApiProgramCategory[]>([]);
  const [entries, setEntries] = useState<RuqyahApiEntry[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCategories(true);
    fetchRuqyahApiData<RuqyahApiProgramCategory[]>({ type: 'instant-category' }, controller.signal)
      .then(data => {
        if (!Array.isArray(data) || data.length !== 3) {
          throw new Error('لم تُرجع المكتبة البرامج الثلاثة بالبنية المتوقعة.');
        }
        setCategories(data);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل مكتبة الرقية الخارجية.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCategories(false);
      });
    return () => controller.abort();
  }, [retryNonce]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingEntries(true);
    setError(null);
    setEntries([]);
    setExpandedEntry(null);
    fetchRuqyahApiData<RuqyahApiEntry[]>({
      type: 'instant',
      program,
      source
    }, controller.signal)
      .then(data => {
        const normalized = Array.isArray(data) ? data : data ? [data as unknown as RuqyahApiEntry] : [];
        if (normalized.length > 300 || normalized.some(entry =>
          !entry || typeof entry.title !== 'string' || typeof entry.arabic !== 'string' || !entry.arabic.trim()
        )) {
          throw new Error('أعاد المصدر عناصر رقية غير مكتملة أو غير صالحة.');
        }
        setEntries(normalized);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل عناصر الرقية.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingEntries(false);
      });
    return () => controller.abort();
  }, [program, source, retryNonce]);

  const selectedProgramCategory = useMemo(() => {
    const index = PROGRAMS.findIndex(item => item.id === program);
    return index >= 0 ? categories[index] : undefined;
  }, [categories, program]);

  const selectedSourceCount = selectedProgramCategory?.subcategories
    ?.find(item => item['subcategory-slug'] === source)?.ruqyah?.length;

  const isMissingApiKey = Boolean(error?.includes('مفتاح API'));

  const retry = () => {
    setError(null);
    setRetryNonce(value => value + 1);
  };

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/25 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-800 text-amber-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">مكتبة الرقية الموسعة</h2>
            <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300 mt-1">
              محتوى إضافي من IslamicAPI: برامج مختصرة ومتوسطة ومطولة، مع فصل آيات القرآن عن أدعية السنة.
              تُعرض الآيات من مصحف وِرد المعتمد بعد مطابقة موضعها، ولا نضيف عدد تكرار غير موثق.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">البرنامج</span>
            <select value={program} onChange={event => setProgram(event.target.value as ProgramId)}
              className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100">
              {PROGRAMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">نوع المحتوى</span>
            <select value={source} onChange={event => setSource(event.target.value as SourceId)}
              className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100">
              {SOURCES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 text-xs text-stone-500 dark:text-stone-400">
          <span>{selectedSourceCount === undefined ? 'عدد العناصر يظهر بعد تحميل الفهرس' : selectedSourceCount + ' عنصر في الفهرس'}</span>
          <span>فهرس خارجي فقط · النص من مصحف وِرد</span>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100">تعذر تحميل المكتبة الخارجية</p>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200 mt-1">{error}</p>
              {isMissingApiKey && (
                <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/80 mt-2">
                  يلزم ضبط ISLAMICAPI_API_KEY كمتغير سري في الخادم. لا تضع المفتاح في ملفات الواجهة أو داخل GitHub، وتحقق من شروط استخدام الخدمة قبل تفعيلها.
                </p>
              )}
              <button type="button" onClick={retry} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-200 dark:bg-amber-900 px-3 py-2 text-xs font-bold text-amber-950 dark:text-amber-100">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingCategories || loadingEntries ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-sm text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin" /> جارٍ تحميل محتوى الرقية...
        </div>
      ) : !error && entries.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center text-sm text-stone-500">
          لا توجد عناصر في هذا القسم من المصدر.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            let text = entry.arabic;
            let validationError: string | null = null;
            if (source === 'from-quran') {
              try { text = resolveApiQuranEntryText(entry); }
              catch (reason) {
                validationError = reason instanceof Error ? reason.message : 'تعذر مطابقة الآية.';
                text = '';
              }
            }
            const expanded = expandedEntry === entry.id;
            return (
              <article key={String(entry.id) + '-' + index}
                className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 md:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">{entry.title}</h3>
                    {entry.reference && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">المرجع: {entry.reference}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1 text-[10px] font-bold text-stone-600 dark:text-stone-300">
                    {index + 1}
                  </span>
                </div>
                {validationError ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">{validationError}</p>
                ) : (
                  <p className="font-quran text-lg md:text-xl leading-[2.2] text-center text-stone-900 dark:text-stone-100">{text}</p>
                )}
                {entry.introduction && <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{entry.introduction}</p>}
                {entry.translation && expanded && <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{entry.translation}</p>}
                {entry.reference && expanded && (
                  <p className="text-xs text-stone-500 dark:text-stone-400">المرجع كما ورد في بيانات المصدر الخارجي، دون إضافة تصنيف حديثي من وِرد.</p>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-stone-100 dark:border-stone-800">
                  <span className="text-[11px] text-stone-400">{source === 'from-quran' ? 'نص مطابق للمصحف المعتمد في وِرد' : 'مرجع من المصدر الخارجي'}</span>
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedEntry(expanded ? null : entry.id)}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                    {expanded ? 'إخفاء التفاصيل' : 'التفاصيل'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
