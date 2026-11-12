import React from 'react';
import type { SeerahSourceReference } from '../../services/seerahContentContract';
import { resolveSafeSeerahSourceUrl } from '../../services/seerahSourcePresentation';

interface SeerahSourcePanelProps {
  sources: readonly SeerahSourceReference[];
}

export const SeerahSourcePanel: React.FC<SeerahSourcePanelProps> = ({ sources }) => (
  <section aria-label="المراجع المعتمدة" className="mt-4">
    <h5 className="text-xs font-extrabold text-stone-800 dark:text-stone-100">المراجع والإحالات</h5>
    {sources.length === 0 ? (
      <p className="mt-2 rounded-xl border border-dashed border-stone-300 p-3 text-xs leading-6 text-stone-500 dark:border-stone-700 dark:text-stone-400">
        لا توجد إحالات معتمدة لهذا الموضع بعد. لن نعرض رواية تاريخية دون مرجع محدد وطبعة وموضع إحالة قابل للمراجعة.
      </p>
    ) : (
      <ol className="mt-3 space-y-2">
        {sources.map(source => {
          const safeUrl = resolveSafeSeerahSourceUrl(source.url);
          return (
            <li key={source.id} className="rounded-xl border border-stone-200 bg-white/70 p-3 dark:border-stone-700 dark:bg-stone-900/30">
              <p className="text-xs font-bold leading-6 text-stone-900 dark:text-stone-100">{source.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-stone-600 dark:text-stone-300">{source.author} · {source.work}</p>
              <p className="mt-1 text-[11px] leading-5 text-stone-500 dark:text-stone-400">{source.edition} · موضع الإحالة: {source.locator}</p>
              {safeUrl ? (
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs font-bold text-emerald-800 underline underline-offset-4 dark:text-emerald-300">
                  فتح المرجع
                </a>
              ) : (
                <span className="mt-2 inline-block text-[10px] text-stone-400">لا يوجد رابط إلكتروني آمن لهذا المرجع</span>
              )}
            </li>
          );
        })}
      </ol>
    )}
  </section>
);
