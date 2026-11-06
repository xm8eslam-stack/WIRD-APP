import fs from 'node:fs';
import path from 'node:path';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runQuranLazyLoadingTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

  test('Initial application route does not statically import the full Quran database', () => {
    const eagerFiles = [
      'src/App.tsx',
      'src/components/dashboard/DashboardView.tsx',
      'src/services/retentionService.ts',
      'src/services/unifiedPortionService.ts'
    ];
    eagerFiles.forEach(file => assert(!read(file).includes('verifiedAyahs'), file + ' must not import verifiedAyahs'));
  });

  test('Core portion services use the generated page index instead of the full Quran payload', () => {
    const service = read('src/services/unifiedPortionService.ts');
    assert(service.includes('quranPageIndex.generated') && !service.includes('verifiedAyahs'), 'Core page mapping must not import the full Quran text');
  });

  test('Library and memorization session load only the active Surah', () => {
    const library = read('src/components/library/QuranLibraryView.tsx');
    const session = read('src/components/session/MemorizationSessionView.tsx');
    assert(library.includes('loadSurahVerses') && !library.includes('VERIFIED_AYAHS'), 'Library must use the lazy Surah loader');
    assert(session.includes('loadSurahVerses') && !session.includes('VERIFIED_AYAHS'), 'Session must use the lazy Surah loader');
  });

  test('Lazy loader uses Vite glob imports and caches per-Surah requests', () => {
    const loader = read('src/data/quranDataLoader.ts');
    assert(loader.includes("import.meta.glob<{ default: Ayah[] }>") , 'Vite must discover generated Surah chunks');
    assert(loader.includes('surahCache'), 'Repeated requests must reuse the same loaded Surah');
    assert(!loader.includes("from './completeQuranData.json'") && !loader.includes("import('./completeQuranData.json')"), 'Lazy loader must not import the full Quran JSON');
  });

  test('Chunk generator validates the complete 114-Surah, 6,236-ayah source before writing', () => {
    const generator = read('scripts/split-quran-data.mjs');
    assert(generator.includes('surahNumber <= 114'), 'Generator must cover all 114 Surahs');
    assert(generator.includes('totalAyahs !== 6236'), 'Generator must enforce the 6,236-ayah total');
    assert(generator.includes('ayah.numberInSurah !== index + 1'), 'Generator must validate verse coordinates');
    assert(generator.includes('quranPageIndex.generated.ts'), 'Generator must emit the page-to-ayah coordinate index');
    assert(generator.includes('quranNavigationIndex.generated.ts') && generator.includes('hizbQuarterStarts'), 'Generator must emit exact Juz and Hizb-quarter navigation coordinates');
    assert(generator.includes('pageNumber <= 604'), 'Generator must validate all 604 Mushaf pages');
  });

  test('Development and production builds generate chunks before Vite starts', () => {
    const pkg = JSON.parse(read('package.json'));
    assert(pkg.scripts.predev === 'node scripts/split-quran-data.mjs', 'Dev startup must generate Surah chunks');
    assert(pkg.scripts.prebuild === 'node scripts/split-quran-data.mjs', 'Production build must generate Surah chunks');
    assert(pkg.scripts.pretest === 'node scripts/split-quran-data.mjs', 'Tests must generate page-index data before importing it');
    assert(pkg.scripts.prelint === 'node scripts/split-quran-data.mjs', 'TypeScript validation must generate page-index data');
  });

  test('Revision center loads a single ayah on demand instead of importing the full Quran', () => {
    const revision = read('src/components/revision/RevisionCenterView.tsx');
    assert(revision.includes('loadAyahByCoordinate') && !revision.includes('VERIFIED_AYAHS'), 'Revision center must use the lazy coordinate loader');
  });

  test('Quran source attribution metadata is independent from the full text payload', () => {
    const info = read('src/data/quranDataInfo.ts');
    assert(info.includes('Tanzil Project') && info.includes('CC BY 3.0'), 'Source and license attribution must remain available');
    assert(!info.includes('completeQuranData.json'), 'Metadata module must remain lightweight');
  });

  return { passed, failed };
}