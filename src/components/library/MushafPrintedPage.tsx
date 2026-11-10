import React, { useEffect, useState } from 'react';
import { RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import type { Ayah } from '../../types/quran';
import {
  assertMushafPageAyahCoverage,
  getMushafPageArtworkUrl,
  parseMushafViewBox,
  type MushafAyahPolygon,
  type MushafViewBox
} from '../../services/mushafPrintedPage';

interface MushafPrintedPageProps {
  page: number;
  ayahs: Ayah[];
  selectedAyah: Ayah | null;
  onSelectAyah: (ayah: Ayah) => void;
  onUseFlexibleView: () => void;
}

interface LoadedMushafArtwork {
  imageUrl: string;
  sourceViewBox: MushafViewBox;
  displayViewBox: MushafViewBox;
  polygons: MushafAyahPolygon[];
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ALLOWED_SVG_ELEMENTS = new Set(['svg', 'g', 'path']);
const ALLOWED_SVG_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:ayah', 'version', 'viewBox', 'xml:space',
  'transform', 'id', 'class', 'd', 'fill', 'fill-rule', 'fill-opacity',
  'ayah:x', 'ayah:y', 'number', 'ayah', 'surah'
]);

function sanitizeMushafSvgRoot(root: SVGSVGElement): string {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    if (!ALLOWED_SVG_ELEMENTS.has(element.localName) || element.namespaceURI !== SVG_NAMESPACE) {
      throw new Error('ملف المصحف يحتوي على عنصر رسومي غير مسموح.');
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!ALLOWED_SVG_ATTRIBUTES.has(attribute.name)) {
        if (attribute.name.toLowerCase().startsWith('on')) {
          throw new Error('ملف المصحف يحتوي على معالج أحداث غير مسموح.');
        }
        element.removeAttributeNode(attribute);
        continue;
      }
      if (/javascript:|data:|https?:|url\s*\(/i.test(attribute.value) &&
          attribute.name !== 'xmlns' && attribute.name !== 'xmlns:ayah') {
        throw new Error('ملف المصحف يحتوي على مرجع خارجي غير مسموح.');
      }
    }
  }
  if (root.querySelectorAll('path.ayahPolygon').length === 0) {
    throw new Error('ملف المصحف لا يحتوي على طبقة تحديد الآيات.');
  }
  return new XMLSerializer().serializeToString(root);
}

async function getDisplayViewBox(
  root: SVGSVGElement,
  page: number,
  sourceViewBox: MushafViewBox
): Promise<MushafViewBox> {
  if (page > 2) return sourceViewBox;

  // The opening spread uses a two-page coordinate canvas. Fit its actual
  // printed content so page 1 and 2 do not appear as a small drawing in space.
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${sourceViewBox.width}px`;
  host.style.height = `${sourceViewBox.height}px`;
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.overflow = 'hidden';

  const clone = document.importNode(root, true) as SVGSVGElement;
  clone.style.width = `${sourceViewBox.width}px`;
  clone.style.height = `${sourceViewBox.height}px`;
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const groups = ['#content', '#ayah_markers']
      .map(selector => clone.querySelector(selector) as SVGGraphicsElement | null)
      .filter((element): element is SVGGraphicsElement => Boolean(element));
    const boxes = groups.map(element => {
      try { return element.getBBox(); } catch { return null; }
    }).filter(box => box && box.width > 0 && box.height > 0);
    if (!boxes.length) return sourceViewBox;

    const minX = Math.min(...boxes.map(box => box!.x));
    const minY = Math.min(...boxes.map(box => box!.y));
    const maxX = Math.max(...boxes.map(box => box!.x + box!.width));
    const maxY = Math.max(...boxes.map(box => box!.y + box!.height));
    const paddingX = Math.max(8, (maxX - minX) * 0.035);
    const paddingY = Math.max(8, (maxY - minY) * 0.035);
    return {
      x: minX - paddingX,
      y: minY - paddingY,
      width: maxX - minX + paddingX * 2,
      height: maxY - minY + paddingY * 2
    };
  } finally {
    host.remove();
  }
}

export const MushafPrintedPage: React.FC<MushafPrintedPageProps> = ({
  page,
  ayahs,
  selectedAyah,
  onSelectAyah,
  onUseFlexibleView
}) => {
  const [artwork, setArtwork] = useState<LoadedMushafArtwork | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | null = null;
    setArtwork(null);
    setError('');
    setIsLoading(true);

    const load = async () => {
      try {
        const response = await fetch(getMushafPageArtworkUrl(page), {
          signal: controller.signal,
          credentials: 'omit'
        });
        if (!response.ok) throw new Error(`تعذر تحميل صفحة المصحف المطبوعة (HTTP ${response.status}).`);
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const declaredLength = Number(response.headers.get('content-length') || 0);
        if (declaredLength > 5 * 1024 * 1024) {
          throw new Error('حجم ملف الصفحة يتجاوز الحد الآمن للعرض.');
        }
        const svgText = await response.text();
        if (!svgText || svgText.length > 5 * 1024 * 1024) {
          throw new Error('ملف الصفحة المطبوعة فارغ أو يتجاوز الحد الآمن.');
        }
        const svgHeader = svgText.trimStart();
        if (!contentType.includes('svg') && !contentType.includes('xml') &&
            !svgHeader.startsWith('<svg') && !svgHeader.startsWith('<?xml')) {
          throw new Error('ملف الصفحة المستلمة ليس بصيغة SVG المعتمدة.');
        }

        const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        if (parsed.querySelector('parsererror')) throw new Error('تعذر تحليل ملف صفحة المصحف.');
        const root = parsed.documentElement as unknown as SVGSVGElement;
        if (root.localName !== 'svg' || root.namespaceURI !== SVG_NAMESPACE ||
            root.querySelector('script, foreignObject, iframe, object, embed')) {
          throw new Error('ملف صفحة المصحف لا يطابق بنية SVG المسموح بها.');
        }

        const sourceViewBox = parseMushafViewBox(root.getAttribute('viewBox'));
        const polygons: MushafAyahPolygon[] = Array.from(root.querySelectorAll('path.ayahPolygon')).map(path => ({
          surahNumber: Number(path.getAttribute('surah')),
          ayahNumber: Number(path.getAttribute('ayah')),
          path: path.getAttribute('d') || ''
        }));
        assertMushafPageAyahCoverage(ayahs, polygons);

        const safeSvgText = sanitizeMushafSvgRoot(root);
        const displayViewBox = await getDisplayViewBox(root, page, sourceViewBox);
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([safeSvgText], { type: 'image/svg+xml' }));
        setArtwork({ imageUrl: objectUrl, sourceViewBox, displayViewBox, polygons });
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل صفحة المصحف المطبوعة.');
      } finally {
        if (active && !controller.signal.aborted) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [page, ayahs, retry]);

  const selectedKey = selectedAyah
    ? `${selectedAyah.surahNumber}:${selectedAyah.numberInSurah}`
    : null;

  return (
    <section aria-label={`الصفحة المطبوعة رقم ${page} من مصحف المدينة`} className="mx-auto w-full max-w-[560px] space-y-3">
      <div className="rounded-2xl border border-stone-200/80 bg-[#fdfbf7] p-2 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        {isLoading && (
          <div role="status" className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-sm font-semibold text-stone-600 dark:text-stone-300">
            <RefreshCw className="h-7 w-7 animate-spin text-emerald-700" />
            جارٍ تحميل الصفحة المطبوعة والتحقق من مواضع آياتها...
          </div>
        )}

        {!isLoading && error && (
          <div role="alert" className="flex min-h-[300px] flex-col items-center justify-center gap-4 px-4 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <p className="max-w-md text-sm leading-7 text-stone-700 dark:text-stone-200">{error}</p>
            <p className="text-xs text-stone-500">لم نعرض تخطيطًا غير متحقق منه، ولم نستبدل نص وِرد المحلي.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900">
                إعادة المحاولة
              </button>
              <button type="button" onClick={onUseFlexibleView} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200">
                استخدام العرض النصي المرن
              </button>
            </div>
          </div>
        )}

        {!isLoading && artwork && (
          <svg
            viewBox={`${artwork.displayViewBox.x} ${artwork.displayViewBox.y} ${artwork.displayViewBox.width} ${artwork.displayViewBox.height}`}
            role="group"
            aria-label={`صفحة مصحف المدينة المطبوعة، الصفحة ${page}. اختر آية لفتح تفسيرها.`}
            className="block h-auto w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <image
              href={artwork.imageUrl}
              x={artwork.sourceViewBox.x}
              y={artwork.sourceViewBox.y}
              width={artwork.sourceViewBox.width}
              height={artwork.sourceViewBox.height}
              preserveAspectRatio="none"
              aria-hidden="true"
            />
            {artwork.polygons.map(polygon => {
              const key = `${polygon.surahNumber}:${polygon.ayahNumber}`;
              const ayah = ayahs.find(item => item.surahNumber === polygon.surahNumber && item.numberInSurah === polygon.ayahNumber);
              if (!ayah) return null;
              const surah = ALL_SURAHS.find(item => item.number === polygon.surahNumber);
              const selected = key === selectedKey;
              return (
                <path
                  key={key}
                  d={polygon.path}
                  fill="#1C4E46"
                  fillOpacity={selected ? 0.28 : 0}
                  stroke={selected ? "#C59B27" : "transparent"}
                  strokeWidth={selected ? 1.1 : 0}
                  pointerEvents="all"
                  role="button"
                  tabIndex={0}
                  aria-label={`تفسير سورة ${surah?.name || polygon.surahNumber}، الآية ${polygon.ayahNumber}`}
                  aria-pressed={selected}
                  className="cursor-pointer outline-none focus-visible:stroke-[#C59B27] focus-visible:stroke-[2]"
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
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-center text-[11px] text-stone-500 dark:text-stone-400">
        <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
        <span>رسم الصفحة من النسخة الرقمية لمجمع الملك فهد · طبقة الآيات تفتح التفسير من نص وِرد المحلي</span>
      </div>
    </section>
  );
};
