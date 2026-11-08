import React, { useEffect, useState } from 'react';
import { loadSimpleAyahRange } from '../../data/quranDataLoader';

/** Displays the official Tanzil Simple text for the supplied coordinate.
 * The original Uthmani string remains unchanged in the canonical corpus; a missing Simple chunk never falls back to Uthmani.
 */
export function QuranText({
  children,
  className = '',
  surahNumber,
  ayahNumber,
  endAyahNumber,
}: {
  children: string;
  className?: string;
  surahNumber?: number;
  ayahNumber?: number;
  endAyahNumber?: number;
}) {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let active = true;
    const hasCoordinate = Number.isInteger(surahNumber) && Number.isInteger(ayahNumber);
    if (!hasCoordinate) { setDisplayText(children); return () => { active = false; }; }
    setDisplayText('');
    loadSimpleAyahRange(surahNumber as number, ayahNumber as number, endAyahNumber ?? ayahNumber)
      .then(verses => {
        if (active) setDisplayText(verses.length ? verses.join(' ۞ ') : 'تعذر تحميل النص الإملائي المعتمد لهذه الآية.');
      })
      .catch(error => {
        if (active) {
          console.error('[WIRD QuranText] Could not load local Tanzil Simple text:', error);
          setDisplayText('تعذر تحميل النص الإملائي المعتمد لهذه الآية.');
        }
      });
    return () => { active = false; };
  }, [children, surahNumber, ayahNumber, endAyahNumber]);

  return (
    <span lang="ar" dir="rtl" className={`quran-text font-quran ${className}`.trim()}>
      {displayText || (Number.isInteger(surahNumber) && Number.isInteger(ayahNumber) ? '…' : children)}
    </span>
  );
}
