import React, { useEffect, useState } from 'react';
import type { Ayah } from '../../types/quran';
import {
  loadMushafFacsimilePage,
  matchMushafAyahAreas
} from '../../services/mushafFacsimileService';
import type { MushafFacsimilePageData } from '../../services/mushafFacsimileService';

interface QuranMushafFacsimilePageProps {
  page: number;
  ayahs: Ayah[];
  selectedAyah: Ayah | null;
  onSelectAyah: (ayah: Ayah) => void;
  onFallback: () => void;
}

interface MatchedAyahArea {
  area: MushafFacsimilePageData['ayahAreas'][number];
  ayah: Ayah;
}

export const QuranMushafFacsimilePage: React.FC<QuranMushafFacsimilePageProps> = ({
  page,
  ayahs,
  selectedAyah,
  onSelectAyah,
  onFallback
}) => {
  const [pageData, setPageData] = useState<MushafFacsimilePageData | null>(null);
  const [matchedAreas, setMatchedAreas] = useState<MatchedAyahArea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!ayahs.length) return;
    const controller = new AbortController();
    setPageData(null);
    setMatchedAreas([]);
    setError(null);

    loadMushafFacsimilePage(page, controller.signal)
      .then(data => {
        const matched = matchMushafAyahAreas(data.ayahAreas, ayahs);
        if (!controller.signal.aborted) {
          setPageData(data);
          setMatchedAreas(matched);
        }
      })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error
          ? reason.message
          : 'تعذر التحقق من تخطيط الصفحة المطبوعة.');
      });

    return () => controller.abort();
  }, [page, ayahs, retry]);

  const handleImageError = () => {
    setError('تعذر تحميل رسم الصفحة المطبوعة من المصدر المعتمد.');
    setPageData(null);
    setMatchedAreas([]);
  };

  if (!ayahs.length) {
    return (
      <div role="status" className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-12 text-center text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
        جارٍ تجهيز نص الصفحة المحلي للتحقق من مواضع الآيات...
      </div>
    );
  }

  if (error) {
    return (
      <section role="alert" className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-8 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{error}</p>
        <p className="text-xs leading-6 text-amber-900/80 dark:text-amber-200/80">
          لم نستخدم أي نص قرآني من ملف الرسم. يمكنك الرجوع فورًا إلى نص وِرد المحلي، أو إعادة محاولة تحميل تخطيط الصفحة.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900">
            إعادة المحاولة
          </button>
          <button type="button" onClick={onFallback} className="min-h-11 rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-stone-900 dark:text-amber-100">
            متابعة القراءة بالعرض المرن
          </button>
        </div>
      </section>
    );
  }

  if (!pageData || matchedAreas.length === 0) {
    return (
      <div role="status" className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white/80 px-4 py-12 text-center text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" aria-hidden="true" />
        جارٍ تحميل رسم الصفحة والتحقق من تطابق جميع الآيات...
      </div>
    );
  }

  const { viewBox } = pageData;
  return (
    <figure className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[#b99b62]/50 bg-[#f8f5ed] p-2 shadow-xl dark:border-[#8d7449]/70 dark:bg-[#101b19] sm:p-4">
      <svg
        role="group"
        aria-label={`صفحة المصحف المطبوعة رقم ${page}، اختر موضع الآية لفتح تفسيرها`}
        viewBox={viewBox.raw}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full select-none"
      >
        <image
          href={pageData.svgUrl}
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.width}
          height={viewBox.height}
          preserveAspectRatio="none"
          aria-hidden="true"
          onError={handleImageError}
        />
        {matchedAreas.map(({ area, ayah }) => {
          const isSelected = selectedAyah?.surahNumber === ayah.surahNumber &&
            selectedAyah?.numberInSurah === ayah.numberInSurah;
          const surah = ayah.surahNumber;
          return (
            <polygon
              key={`${surah}:${ayah.numberInSurah}`}
              points={area.polygon}
              role="button"
              tabIndex={0}
              aria-label={`تفسير الآية ${ayah.numberInSurah} من سورة ${surah}`}
              aria-pressed={isSelected}
              className="mushaf-ayah-hit-area"
              fill={isSelected ? 'rgba(197, 155, 39, 0.28)' : 'transparent'}
              stroke={isSelected ? '#a87912' : 'transparent'}
              strokeWidth={isSelected ? 1.1 : 0}
              vectorEffect="non-scaling-stroke"
              onClick={() => onSelectAyah(ayah)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectAyah(ayah);
                }
              }}
            />
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#b99b62]/30 px-2 pt-2 text-[10px] text-stone-500 dark:border-[#8d7449]/40 dark:text-stone-400">
        <span>رسم الصفحة: مجمع الملك فهد لطباعة المصحف الشريف</span>
        <span>مواضع الآيات التفاعلية: Quran.ws · الإصدار { '1.1.1' }</span>
      </figcaption>
    </figure>
  );
};
