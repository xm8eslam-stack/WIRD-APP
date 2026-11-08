import React, { useEffect, useState } from 'react';
import { loadSimpleAyahRange } from '../../data/quranDataLoader';

/** Displays the official Tanzil Simple text for the supplied coordinate.
 * The original Uthmani string remains the fallback and is never rewritten.
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
  const [displayText, setDisplayText] = useState(children);

  useEffect(() => {
    let active = true;
    setDisplayText(children);
    if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) return () => { active = false; };
    loadSimpleAyahRange(surahNumber as number, ayahNumber as number, endAyahNumber ?? ayahNumber)
      .then(verses => {
        if (active && verses.length) setDisplayText(verses.join(' ۞ '));
      })
      .catch(error => {
        if (active) console.error('[WIRD QuranText] Could not load local Tanzil Simple text:', error);
      });
    return () => { active = false; };
  }, [children, surahNumber, ayahNumber, endAyahNumber]);

  return (
    <span lang="ar" dir="rtl" className={`quran-text font-quran ${className}`.trim()}>
      {displayText}
    </span>
  );
}
