import React, { useEffect, useRef, useState } from 'react';
import { ALL_SURAHS } from '../../data/quranMeta';
import type { Ayah } from '../../types/quran';
import { loadSurahVerses } from '../../data/quranDataLoader';
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
  onVerifiedAyahs: (ayahs: Ayah[]) => void;
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
  onVerifiedAyahs,
  onFallback
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
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
      .then(async data => {
        // The local Quran dataset's historical page metadata is not identical
        // to every KFGQPC printed-page boundary. Resolve the exact coordinates
        // from WIRD's own surah chunks rather than assuming the same page split.
        const surahNumbers = [...new Set(data.ayahAreas.map(area => area.surahNumber))];
        const surahGroups = await Promise.all(surahNumbers.map(loadSurahVerses));
        const coordinates = new Set(data.ayahAreas.map(area => `${area.surahNumber}:${area.ayahNumber}`));
        const localPageAyahs = surahGroups.flat()
          .filter(ayah => coordinates.has(`${ayah.surahNumber}:${ayah.numberInSurah}`))
          .sort((a, b) => a.number - b.number);
        const matched = matchMushafAyahAreas(data.ayahAreas, localPageAyahs);
        if (!controller.signal.aborted) {
          setPageData(data);
          setMatchedAreas(matched);
          onVerifiedAyahs(matched.map(item => item.ayah));
        }
      })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error
          ? reason.message
          : 'تعذر التحقق من تخطيط الصفحة المطبوعة.');
      });

    return () => controller.abort();
  }, [page, ayahs, retry, onVerifiedAyahs]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !pageData || matchedAreas.length === 0) return;
    const root = host.querySelector('svg');
    if (!(root instanceof SVGSVGElement)) {
      setError('ملف الصفحة لم ينتج رسمًا متجهيًا صالحًا.');
      return;
    }

    root.removeAttribute('width');
    root.removeAttribute('height');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', `صفحة المصحف المطبوعة رقم ${page}`);
    root.style.width = '100%';
    root.style.height = 'auto';
    root.style.display = 'block';

    const localByCoordinate = new Map(
      matchedAreas.map(({ area, ayah }) => [`${area.surahNumber}:${area.ayahNumber}`, ayah])
    );
    const paths = Array.from(root.querySelectorAll('path.ayahPolygon'));
    if (paths.length !== matchedAreas.length) {
      setError('عدد مواضع الآيات داخل الرسم لا يطابق فهرس الصفحة.');
      return;
    }

    for (const path of paths) {
      const surahNumber = Number(path.getAttribute('surah'));
      const ayahNumber = Number(path.getAttribute('ayah'));
      const ayah = localByCoordinate.get(`${surahNumber}:${ayahNumber}`);
      if (!ayah) {
        setError('تعذر ربط أحد مواضع الرسم بنص وِرد المحلي.');
        return;
      }
      const selected = selectedAyah?.surahNumber === surahNumber &&
        selectedAyah?.numberInSurah === ayahNumber;
      const surah = ALL_SURAHS.find(item => item.number === surahNumber);
      path.setAttribute('class', 'ayahPolygon mushaf-ayah-hit-area');
      path.setAttribute('role', 'button');
      path.setAttribute('tabindex', '0');
      path.setAttribute('aria-label', `تفسير الآية ${ayahNumber} من سورة ${surah?.name || surahNumber}`);
      path.setAttribute('aria-pressed', selected ? 'true' : 'false');
      path.setAttribute('fill', '#c59b27');
      path.setAttribute('fill-opacity', selected ? '0.34' : '0');
      path.setAttribute('pointer-events', 'visiblePainted');
    }

    const resolveTarget = (target: EventTarget | null): Ayah | null => {
      if (!(target instanceof Element)) return null;
      const path = target.closest('path.ayahPolygon');
      if (!path || !root.contains(path)) return null;
      return localByCoordinate.get(`${Number(path.getAttribute('surah'))}:${Number(path.getAttribute('ayah'))}`) || null;
    };

    const handleClick = (event: MouseEvent) => {
      const ayah = resolveTarget(event.target);
      if (ayah) onSelectAyah(ayah);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const ayah = resolveTarget(event.target);
      if (!ayah) return;
      event.preventDefault();
      onSelectAyah(ayah);
    };
    host.addEventListener('click', handleClick);
    host.addEventListener('keydown', handleKeyDown);

    // The opening spread (pages 1–2) has a deliberately oversized viewBox.
    // Fit the rendered ink, as prescribed by the source renderer documentation.
    const frame = requestAnimationFrame(() => {
      try {
        const bounds = root.getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          const padding = Math.max(bounds.width, bounds.height) * 0.04;
          root.setAttribute('viewBox', `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`);
        }
      } catch {
        // Keep the publisher's original viewBox if the browser cannot measure SVG ink.
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener('click', handleClick);
      host.removeEventListener('keydown', handleKeyDown);
    };
  }, [page, pageData, matchedAreas, selectedAyah, onSelectAyah]);

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

  return (
    <figure className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[#b99b62]/50 bg-[#f8f5ed] p-2 shadow-xl dark:border-[#8d7449]/70 dark:bg-[#101b19] sm:p-4">
      <div
        ref={hostRef}
        className="mushaf-facsimile-svg w-full"
        dangerouslySetInnerHTML={{ __html: pageData.svgMarkup }}
      />
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#b99b62]/30 px-2 pt-2 text-[10px] text-stone-500 dark:border-[#8d7449]/40 dark:text-stone-400">
        <span>رسم الصفحة: مجمع الملك فهد لطباعة المصحف الشريف</span>
        <span>مواضع الآيات التفاعلية: Quran.ws · الإصدار 1.1.1</span>
      </figcaption>
    </figure>
  );
};
