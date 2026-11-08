import React, { useEffect, useState } from 'react';
import { loadAyahByCoordinate } from '../../data/quranDataLoader';
import type { Ayah } from '../../types/quran';
import { QuranText } from '../shared/QuranText';

type FontCandidate = 'amiri' | 'system' | 'amiri-quran' | 'uthmanic-hafs' | 'qcf-v2';

const CANDIDATES: Array<{ id: FontCandidate; label: string; family: string; available: boolean; note: string }> = [
  { id: 'amiri', label: 'Amiri', family: 'Amiri, serif', available: true, note: 'محمل حاليًا من Google Fonts في التطبيق.' },
  { id: 'system', label: 'خط النظام الاحتياطي', family: 'serif', available: true, note: 'يختلف حسب نظام التشغيل والمتصفح.' },
  { id: 'amiri-quran', label: 'Amiri Quran', family: 'Amiri Quran, serif', available: false, note: 'غير محمل في المشروع، لذلك لا يمكن تقييمه بصريًا الآن.' },
  { id: 'uthmanic-hafs', label: 'Uthmanic Hafs / QPC Hafs', family: 'UthmanicHafs, serif', available: false, note: 'يتطلب ملف خط مرخصًا ونصًا متوافقًا، وهما غير موجودين محليًا.' },
  { id: 'qcf-v2', label: 'QCF V2', family: 'serif', available: false, note: 'خط صفحي Glyph؛ لا يعمل مع نص Unicode الحالي.' },
];

const SAMPLE_COORDINATES = [
  { surah: 41, ayah: 7 },
  { surah: 2, ayah: 255 },
  { surah: 18, ayah: 1 },
  { surah: 2, ayah: 1 },
];

export function QuranTypographyLab({ onClose }: { onClose: () => void }) {
  const [samples, setSamples] = useState<Ayah[]>([]);
  const [selectedFont, setSelectedFont] = useState<FontCandidate>('amiri');
  const [fontSize, setFontSize] = useState(30);
  const [fontLoaded, setFontLoaded] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(SAMPLE_COORDINATES.map(point => loadAyahByCoordinate(point.surah, point.ayah)))
      .then(ayahs => {
        if (!cancelled) setSamples(ayahs.filter((ayah): ayah is Ayah => Boolean(ayah)));
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const candidate = CANDIDATES.find(item => item.id === selectedFont);
    if (!candidate?.available || selectedFont === 'system') {
      setFontLoaded(null);
      return;
    }
    document.fonts.ready.then(() => {
      if (!cancelled) setFontLoaded(document.fonts.check(`24px "${candidate.label}"`));
    });
    return () => { cancelled = true; };
  }, [selectedFont]);

  const currentCandidate = CANDIDATES.find(item => item.id === selectedFont) ?? CANDIDATES[0];

  return (
    <section aria-labelledby="quran-typography-title" className="space-y-5 rounded-3xl border border-emerald-200 bg-white p-5 shadow-xs dark:border-emerald-900 dark:bg-stone-900 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="quran-typography-title" className="text-xl font-bold text-stone-900 dark:text-stone-100">مختبر الخطوط القرآنية</h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">النماذج أدناه تُحمّل من قاعدة وِرد المعتمدة، ولا يعاد تشكيل نصها برمجيًا.</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200">إغلاق المختبر</button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="الخط المستخدم في المختبر">
        {CANDIDATES.map(candidate => (
          <button
            key={candidate.id}
            type="button"
            disabled={!candidate.available}
            aria-pressed={selectedFont === candidate.id}
            title={candidate.note}
            onClick={() => setSelectedFont(candidate.id)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${selectedFont === candidate.id ? 'border-emerald-700 bg-emerald-800 text-white' : 'border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-200'}`}
          >
            {candidate.label}{candidate.available ? '' : ' · غير متاح'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-800">
        <label htmlFor="quran-lab-font-size" className="text-sm font-medium text-stone-700 dark:text-stone-200">حجم الخط</label>
        <input id="quran-lab-font-size" aria-label="حجم خط المختبر" type="range" min="22" max="48" step="1" value={fontSize} onChange={event => setFontSize(Number(event.target.value))} />
        <output htmlFor="quran-lab-font-size" className="min-w-12 text-sm tabular-nums">{fontSize}px</output>
        <span role="status" className="text-xs text-stone-600 dark:text-stone-300">
          {selectedFont === 'system' ? currentCandidate.note : fontLoaded === null ? currentCandidate.note : fontLoaded ? 'تم تحميل الخط المختار.' : 'الخط غير محمّل؛ سيعرض المتصفح خطًا احتياطيًا.'}
        </span>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">تعذر تحميل نصوص الاختبار من قاعدة وِرد. أعد فتح المختبر للمحاولة مرة أخرى.</p>
      ) : samples.length === 0 ? (
        <p role="status" className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300">جارٍ تحميل نماذج النص القرآني…</p>
      ) : (
        <div className="space-y-3">
          {samples.map(ayah => (
            <article key={`${ayah.surahNumber}:${ayah.numberInSurah}`} className="rounded-2xl border border-stone-200 bg-[#fffefb] p-4 dark:border-stone-700 dark:bg-stone-950">
              <div className="mb-2 font-mono text-xs text-stone-500">{ayah.surahNumber}:{ayah.numberInSurah}</div>
              <p lang="ar" dir="rtl" className="quran-text text-right leading-[2.7] text-stone-950 dark:text-stone-100" style={{ fontFamily: currentCandidate.family, fontSize: `${fontSize}px` }}>
                <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>
              </p>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">لا يحتوي التطبيق حاليًا ملفات Amiri Quran أو Uthmanic Hafs أو QCF V2. خياراتها معطّلة كيلا توحي بمعاينة خط غير مستخدم. فحص التغطية لكل المحارف والمتصفحات يحتاج ملفات مرخصة واختبارًا بصريًا على أجهزة حقيقية.</p>
    </section>
  );
}
