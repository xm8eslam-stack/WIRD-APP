import React from 'react';

/** Renders the supplied canonical Quran string without rewriting or normalizing it. */
export function QuranText({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return (
    <span lang="ar" dir="rtl" className={`quran-text font-quran ${className}`.trim()}>
      {children}
    </span>
  );
}
