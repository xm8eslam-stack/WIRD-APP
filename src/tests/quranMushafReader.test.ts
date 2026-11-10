import fs from 'node:fs';
import path from 'node:path';
import { QURAN_PAGE_INDEX } from '../data/quranPageIndex.generated';
import { ALL_SURAHS } from '../data/quranMeta';
import { findSurahStartPage } from '../data/quranNavigation';
import { QURAN_JUZ_STARTS, QURAN_HIZB_QUARTER_STARTS } from '../data/quranNavigationIndex.generated';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runQuranMushafReaderTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };

  test('Generated page index contains every Mushaf page from 1 through 604', () => {
    const pages = Object.keys(QURAN_PAGE_INDEX).map(Number).sort((a, b) => a - b);
    assert(pages.length === 604 && pages[0] === 1 && pages[603] === 604, 'Expected exactly 604 consecutive page keys');
    for (const page of pages) {
      const segments = (QURAN_PAGE_INDEX as unknown as Record<string, Array<{ surahNumber: number; startAyah: number; endAyah: number }>>)[String(page)];
      assert(Array.isArray(segments) && segments.length > 0, 'Page ' + page + ' must contain at least one Quran segment');
      for (const segment of segments) {
        assert(segment.surahNumber >= 1 && segment.surahNumber <= 114, 'Invalid Surah coordinate on page ' + page);
        assert(segment.startAyah >= 1 && segment.endAyah >= segment.startAyah, 'Invalid ayah range on page ' + page);
      }
    }
  });

  test('Every Surah opens on the exact page containing its first ayah', () => {
    for (const surah of ALL_SURAHS) {
      const exactPage = findSurahStartPage(surah.number, QURAN_PAGE_INDEX as unknown as Record<string, Array<{ surahNumber: number; startAyah: number; endAyah: number }>>);
      assert(exactPage !== null, 'Missing page for Surah ' + surah.number);
      assert(exactPage === surah.pageStart, 'Surah ' + surah.number + ' metadata page does not match its first ayah');
    }
  });

  test('Generated navigation index contains exact starts for all 30 Juz', () => {
    const index = QURAN_JUZ_STARTS as unknown as Record<string, { surahNumber: number; ayahNumber: number; page: number }>;
    assert(Object.keys(index).length === 30, 'Expected 30 Juz start coordinates');
    for (let juz = 1; juz <= 30; juz++) {
      const point = index[String(juz)];
      assert(Boolean(point), 'Missing Juz ' + juz);
      assert(point.surahNumber >= 1 && point.surahNumber <= 114 && point.ayahNumber >= 1 && point.page >= 1 && point.page <= 604, 'Invalid Juz ' + juz + ' coordinate');
    }
  });

  test('Generated navigation index contains exact starts for all 240 Hizb quarters', () => {
    const index = QURAN_HIZB_QUARTER_STARTS as unknown as Record<string, { surahNumber: number; ayahNumber: number; page: number }>;
    assert(Object.keys(index).length === 240, 'Expected 240 Hizb-quarter start coordinates');
    for (let quarter = 1; quarter <= 240; quarter++) {
      const point = index[String(quarter)];
      assert(Boolean(point), 'Missing Hizb quarter ' + quarter);
      assert(point.surahNumber >= 1 && point.surahNumber <= 114 && point.ayahNumber >= 1 && point.page >= 1 && point.page <= 604, 'Invalid Hizb quarter ' + quarter + ' coordinate');
    }
  });

  test('Mushaf reader loads local Surah chunks and does not eagerly import full Quran JSON', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranMushafReader.tsx'), 'utf8');
    assert(source.includes('loadSurahVerses'), 'Reader must use the lazy Surah loader');
    assert(source.includes('QURAN_PAGE_INDEX') && source.includes('QURAN_JUZ_STARTS') && source.includes('QURAN_HIZB_QUARTER_STARTS'), 'Reader must use generated exact navigation indexes');
    assert(!source.includes('completeQuranData.json') && !source.includes('verifiedAyahs'), 'Reader must not eagerly import the full Quran dataset');
    assert(source.includes('BOOKMARKS_KEY') && source.includes('LAST_PAGE_KEY'), 'Reader must persist bookmarks and last reading position');
    assert(source.includes('MUSHAF_TEXT_SCALE_KEY') && source.includes('MUSHAF_PAGE_WIDTH_KEY'), 'Reader must persist text size and flexible page width preferences');
    assert(source.includes('MUSHAF_TEXT_SCALE_CLASSES') && source.includes('extraLarge'), 'Reader must offer adjustable Quran text sizes');
    assert(source.includes('توسيع مساحة القراءة') && source.includes('تقليل عرض الصفحة'), 'Reader must offer a wider or comfortable reading surface');
    assert(source.includes('ليس محاكاة مطابقة لأسطر المصحف المطبوع') && source.includes('بيانات تخطيط موثّقة'), 'Reader must clearly disclose the flexible non-line-matched layout');
    assert(source.includes('autoPlayNextPageRef') && source.includes('setPage(page + 1)'), 'Page recitation must continue across page boundaries');
    assert(source.includes('QuranMushafFacsimilePage') && source.includes("readerLayout === 'printed'"), 'Reader must offer an explicit printed-page mode');
    assert(source.includes("selectReaderLayout('flow')"), 'Reader must preserve a direct fallback to local flexible text');
    const facsimile = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranMushafFacsimilePage.tsx'), 'utf8');
    assert(facsimile.includes('sanitizeMushafSvgMarkup') === false, 'SVG sanitization must remain centralized in the page data service');
    assert(facsimile.includes('matchMushafAyahAreas') && facsimile.includes('onSelectAyah(ayah)'), 'Printed hit regions must resolve through local ayah coordinates');
    assert(facsimile.includes('dangerouslySetInnerHTML={{ __html: pageData.svgMarkup }}'), 'Only the sanitized SVG markup may be mounted inline');
    const facsimileService = fs.readFileSync(path.resolve(process.cwd(), 'src/services/mushafFacsimileService.ts'), 'utf8');
    assert(facsimileService.includes('ALLOWED_SVG_ELEMENTS') && facsimileService.includes('ALLOWED_SVG_ATTRIBUTES'), 'SVG must be sanitized by strict element and attribute allowlists');
    assert(facsimileService.includes('sanitizeMushafSvgMarkup(svgMarkup)'), 'Fetched SVG must pass through sanitization before rendering');
    assert(facsimileService.includes('matchMushafAyahAreas'), 'Every printed ayah must be checked against WIRD local data');
    const audioControl = fs.readFileSync(path.resolve(process.cwd(), 'src/components/shared/AudioPlaybackRateControl.tsx'), 'utf8');
    assert(audioControl.includes('https://everyayah.com/'), 'Audio controls must provide a visible EveryAyah source link-back');
  });

  return { passed, failed };
}
