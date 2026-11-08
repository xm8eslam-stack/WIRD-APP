import React, { useEffect, useState } from 'react';
import { loadSimpleBasmala } from '../../data/quranDataLoader';

export function QuranBasmala({ surahNumber }: { surahNumber: number }) {
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setText('');
    setFailed(false);
    loadSimpleBasmala(surahNumber)
      .then(value => { if (active && value) setText(value); })
      .catch(error => {
        console.error('[WIRD QuranBasmala] Could not load official Tanzil Simple basmala:', error);
        if (active) setFailed(true);
      });
    return () => { active = false; };
  }, [surahNumber]);
  if (failed) return <span role="alert">تعذر تحميل البسملة المعتمدة من مصدرها المحلي.</span>;
  return <span lang="ar" dir="rtl" className="quran-text font-quran">{text || '…'}</span>;
}
