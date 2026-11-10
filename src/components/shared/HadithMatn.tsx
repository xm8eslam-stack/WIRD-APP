import React, { useMemo } from 'react';
import { parseHadithMatn, type HadithMatnSegment } from '../../utils/hadithSanitizer';
import { QuranText } from './QuranText';

function renderSegment(segment: HadithMatnSegment, index: number) {
  if (segment.type === 'text') return <React.Fragment key={index}>{segment.value}</React.Fragment>;
  if (segment.type === 'invalid-quran') {
    return <span key={index} className="mx-1 inline rounded bg-amber-50 px-1.5 py-0.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">[تعذر التحقق من موضع الآية]</span>;
  }
  return (
    <span key={index} className="hadith-quran-quote mx-0.5 inline">
      <QuranText
        className="hadith-quran-text"
        surahNumber={segment.surahNumber}
        ayahNumber={segment.startAyah}
        endAyahNumber={segment.endAyah}
      >
        {''}
      </QuranText>
    </span>
  );
}

export const HadithMatn: React.FC<{ text: string }> = ({ text }) => {
  const segments = useMemo(() => parseHadithMatn(text), [text]);
  return <>{segments.map(renderSegment)}</>;
};
