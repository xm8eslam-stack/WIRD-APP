import fs from 'fs';
import path from 'path';
import COMPLETE_QURAN_DATA from '../data/completeQuranData.json';
import type { Ayah } from '../types/quran';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runQuranTypographyTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, check: () => void) => {
    try {
      check();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ❌ ${name}: ${(error as Error).message}`);
    }
  };

  test('Regression verse 41:7 retains its canonical hamza and Uthmani spelling exactly', () => {
    const ayah = (COMPLETE_QURAN_DATA as unknown as Record<string, Ayah[]> )['41'].find(item => item.numberInSurah === 7);
    const expected = 'ٱلَّذِينَ لَا يُؤْتُونَ ٱلزَّكَوٰةَ وَهُم بِٱلْءَاخِرَةِ هُمْ كَٰفِرُونَ';
    assert(ayah?.text === expected, `Unexpected canonical text: ${ayah?.text}`);
    assert(Boolean(ayah && [...ayah.text].some(char => char.codePointAt(0) === 0x0621)), 'Standalone hamza U+0621 must remain present');
    assert(Boolean(ayah?.text.includes('ءَا')), 'The hamza+alef sequence must not be normalized or rewritten');
  });

  test('Shared Quran renderer preserves supplied string and isolates RTL without normalization', () => {
    const component = fs.readFileSync(path.resolve(process.cwd(), 'src/components/shared/QuranText.tsx'), 'utf8');
    assert(component.includes('lang="ar"') && component.includes('dir="rtl"'), 'Renderer must declare Arabic RTL semantics');
    assert(component.includes('{displayText}') && component.includes('setDisplayText(children)') && component.includes('displayText ||'), 'Renderer must preserve pre-resolved Simple text when no coordinate is supplied');
    assert(component.includes('تعذر تحميل النص الإملائي المعتمد') && component.includes("setDisplayText('')"), 'Coordinate-based Quran rendering must not silently fall back to Uthmani text when Simple data is unavailable');
    assert(!/normalize\s*\(|replace\s*\(|toLocale|toLowerCase/.test(component), 'Renderer must not mutate Quran text');
  });

  test('Quran typography opts out of letter spacing and uses normal Arabic wrapping', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    const textRules = css.match(/\.quran-text\s*\{[^}]+\}/)?.[0] ?? '';
    const fontRules = css.match(/\.font-quran\s*\{[^}]+\}/)?.[0] ?? '';
    assert(textRules.includes('unicode-bidi: isolate'), 'RTL isolation must not override Arabic ordering');
    assert(fontRules.includes('letter-spacing: normal') && fontRules.includes('word-spacing: normal'), 'Quran text must not inherit expanded tracking');
    assert(fontRules.includes('word-break: normal') && fontRules.includes('overflow-wrap: normal'), 'Words must not be split by emergency wrapping');
    assert(!textRules.includes('bidi-override') && !fontRules.includes('bidi-override'), 'Renderer must not force bidi override');
  });

  test('Connected reading and typography lab use canonical coordinates and disclose missing font assets', () => {
    const library = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranLibraryView.tsx'), 'utf8');
    const lab = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranTypographyLab.tsx'), 'utf8');
    assert(library.includes("'continuous'") && library.includes('aria-pressed={studyLayout ==='), 'Reading layout toggle must expose its selected state accessibly');
    assert(library.includes('continuous-ayah-${ayah.numberInSurah}') && library.includes('setTafsirAyah(ayah)'), 'Continuous ayah action must retain its canonical ayah coordinate');
    assert(library.includes('handlePlayAyah(ayah.numberInSurah)'), 'Continuous audio action must use the same ayah coordinate as the text');
    assert(lab.includes('loadAyahByCoordinate') && lab.includes('{ surah: 41, ayah: 7 }'), 'Typography samples must come from local canonical ayah records');
    assert(lab.includes('available: false') && lab.includes('غير متاح'), 'Missing Quran font assets must be disclosed and not presented as loaded');
  });

  return { passed, failed };
}
