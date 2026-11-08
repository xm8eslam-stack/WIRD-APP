import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  fetchRuqyahApiData,
  resolveApiQuranEntry,
  matchesApiQuranEntry
} from '../../services/ruqyahApiService';
import type { RuqyahApiEntry } from '../../services/ruqyahApiService';
import { QuranText } from '../shared/QuranText';

type ProgramId = 'brief-ruqya' | 'a-medium-ruqya' | 'a-long-ruqya';

const PROGRAMS: Array<{ id: ProgramId; label: string }> = [
  { id: 'brief-ruqya', label: 'فهرس مختصر' },
  { id: 'a-medium-ruqya', label: 'فهرس متوسط' },
  { id: 'a-long-ruqya', label: 'فهرس موسع' }
];

export const RuqyahApiLibrary: React.FC = () => {
  const [program, setProgram] = useState<ProgramId>('brief-ruqya');
  const [entries, setEntries] = useState<RuqyahApiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEntries([]);
    fetchRuqyahApiData<RuqyahApiEntry[]>({
      type: 'instant',
      program,
      source: 'from-quran'
    }, controller.signal)
      .then(data => {
        const normalized = Array.isArray(data) ? data : data ? [data as unknown as RuqyahApiEntry] : [];
        if (normalized.length > 300 || normalized.some(entry =>
          !entry ||
          (typeof entry.id !== 'number' && typeof entry.id !== 'string') ||
          typeof entry.title !== 'string' ||
          !/^[0-9]{1,3}:[0-9]{1,3}(?:-[0-9]{1,3})?$/.test(entry.title)
        )) {
          throw new Error('أعاد فهرس الآيات مواضع غير صالحة؛ لم يتم عرض أي محتوى منه.');
        }
        setEntries(normalized);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل فهرس مواضع الآيات.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [program, retryNonce]);

  const filteredEntries = entries.filter(entry => matchesApiQuranEntry(entry, searchQuery));
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
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">فهرس مواضع الآيات</h2>
            <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300 mt-1">
              نستفيد من الفهرس الخارجي لتحديد أرقام السور والآيات فقط. لا نعرض عناوينه أو ترجماته أو شروحه أو نصوصه؛ جميع الآيات تُستخرج من مصحف وِرد المعتمد. تقسيمات الفهرس تنظيمية وليست ترتيبًا نبويًا أو عددًا لازمًا.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">تقسيم الفهرس</span>
            <select value={program} onChange={event => { setProgram(event.target.value as ProgramId); setSearchQuery(''); }}
              className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
              {PROGRAMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-900/70 px-3 py-2.5 text-xs text-stone-500 dark:text-stone-400">
              فهرس مواضع فقط · نص الآيات من مصحف وِرد
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <label className="block min-w-0">
            <span className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">البحث باسم السورة أو رقمها أو الآية</span>
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="مثال: البقرة أو ٢:٢٥٥"
              aria-label="البحث في فهرس مواضع الآيات"
              className="w-full min-w-0 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </label>
          <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-900/70 px-3 py-2.5 text-xs text-stone-500 dark:text-stone-400" role="status" aria-live="polite">
            {loading ? 'جارٍ تحديث الفهرس' : filteredEntries.length + ' من ' + entries.length + ' موضع'}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100">تعذر تحميل فهرس الآيات</p>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200 mt-1">{error}</p>
              {isMissingApiKey && (
                <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/80 mt-2">
                  يلزم ضبط ISLAMICAPI_API_KEY كمتغير سري في الخادم. لا تضع المفتاح في ملفات الواجهة أو داخل GitHub.
                </p>
              )}
              <button type="button" onClick={retry} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-200 dark:bg-amber-900 px-3 py-2 text-xs font-bold text-amber-950 dark:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 text-sm text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin" /> جارٍ تحميل فهرس مواضع الآيات...
        </div>
      ) : !error && entries.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center text-sm text-stone-500">
          لا توجد مواضع قرآنية في هذا القسم من الفهرس.
        </div>
      ) : !error && filteredEntries.length === 0 ? (
        <div role="status" className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center text-sm text-stone-500">
          {searchQuery.trim() ? 'لا توجد مواضع مطابقة لعبارة البحث.' : 'لا توجد مواضع قرآنية في هذا القسم من الفهرس.'}
        </div>
      ) : !error ? (
        <div className="space-y-3">
          {filteredEntries.map((entry, index) => {
            let resolved: ReturnType<typeof resolveApiQuranEntry> | null = null;
            let validationError: string | null = null;
            try { resolved = resolveApiQuranEntry(entry); }
            catch (reason) {
              validationError = reason instanceof Error ? reason.message : 'تعذر مطابقة موضع الآيات بالمصحف المعتمد.';
            }
            return (
              <article key={String(entry.id) + '-' + index}
                className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 md:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {resolved ? 'سورة ' + resolved.surahName : 'موضع قرآني غير صالح'}
                    </h3>
                    {resolved && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                        الآيات: {resolved.startAyah}{resolved.endAyah !== resolved.startAyah ? '–' + resolved.endAyah : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1 text-[10px] font-bold text-stone-600 dark:text-stone-300">
                    {index + 1}
                  </span>
                </div>
                {validationError ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3">{validationError}</p>
                ) : resolved && (
                  <p className="font-quran text-lg md:text-xl leading-[2.2] text-center text-stone-900 dark:text-stone-100"><QuranText>{resolved.text}</QuranText></p>
                )}
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                  <span className="text-[11px] text-stone-400">النص من مصحف وِرد المعتمد؛ الفهرس الخارجي لا يضيف تفسيرًا أو حكمًا شرعيًا.</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
