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
    assert(loader.includes("import.meta.glob<{ default: SimpleSurahChunk }>('./quran-simple-surahs/*.json')") && loader.includes('loadSimpleAyahText') && loader.includes('ayah.surahNumber === surahNumber') && loader.includes('ayah.ayahNumber === ayahNumber') && loader.includes('module.default?.ayahs') && loader.includes('module.default.surahNumber === surahNumber'), 'Tanzil Simple text must be loaded from cached per-Surah chunks');
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
    for (const scriptName of ['predev', 'prebuild', 'pretest', 'prelint']) {
      const command = pkg.scripts[scriptName] || '';
      assert(command.includes('node scripts/validate-quran-simple.mjs'), scriptName + ' must validate the official Simple source');
      assert(command.includes('node scripts/split-quran-data.mjs'), scriptName + ' must generate canonical Surah chunks and page indexes');
      assert(command.includes('node scripts/split-quran-simple-data.mjs'), scriptName + ' must generate the local Simple Surah chunks');
    }
  });

  test('Simple chunk generator preserves source attribution and verifies exact text after serialization', () => {
    const generator = read('scripts/split-quran-simple-data.mjs');
    assert(generator.includes("source: 'Tanzil Project'") && generator.includes('copyright:') && generator.includes('license:') && generator.includes("sourceUrl: 'https://tanzil.net'"), 'Every generated surah chunk must retain Tanzil attribution and license');
    assert(generator.includes('actual.text !== expected.text') && generator.includes('actual.ayahNumber !== index + 1') && generator.includes('actual.bismillah !== expected.bismillah'), 'Generated chunk must be verified character-for-character and coordinate-by-coordinate, including the separate basmala');
    assert(generator.includes('bismillahText: verses[0]?.bismillah ?? null'), 'Official separate basmala must be preserved in the per-Surah chunk');
    const validator = read('scripts/validate-quran-simple.mjs');
    assert(validator.includes('separateBismillahCount !== 112') && validator.includes('UNEXPECTED_SEPARATE_BISMILLAH') && validator.includes('MISSING_SEPARATE_BISMILLAH'), 'Validator must verify separate basmala presence and its absence in Al-Fatihah and At-Tawbah');
    const basmala = read('src/components/shared/QuranBasmala.tsx');
    assert(basmala.includes('loadSimpleBasmala') && basmala.includes('dir="rtl"'), 'Displayed basmala must come from the local official Simple source');
  });

  test('Memorization test generation loads only Surahs in the memorized portions', () => {
    const generator = read('src/services/testQuestionGenerator.ts');
    const view = read('src/components/tests/MemorizationTestsView.tsx');
    assert(generator.includes('loadSurahVerses') && generator.includes('loadAyahByCoordinate') && generator.includes("await import('../data/quranDataLoader')") && !generator.includes('VERIFIED_AYAHS'), 'Test generator must dynamically load only memorized Surahs on demand');
    assert(!view.includes('VERIFIED_AYAHS'), 'Memorization test view must not import the full Quran corpus');
  });

  test('Revision center loads a single ayah on demand instead of importing the full Quran', () => {
    const revision = read('src/components/revision/RevisionCenterView.tsx');
    assert(revision.includes('loadAyahByCoordinate') && revision.includes('loadSimpleAyahText') && revision.includes('weakSimpleTexts') && !revision.includes('VERIFIED_AYAHS'), 'Revision center must use coordinate-based Simple text for weak-ayah display and search');
  });

  test('Ruqyah content service cannot statically reach the full Quran corpus', () => {
    const service = read('src/services/ruqyahContentService.ts');
    assert(!service.includes('verifiedAyahs'), 'Ruqyah service must not import verifiedAyahs directly');
    assert(!service.includes('completeQuranData.json'), 'Ruqyah service must not import completeQuranData.json directly');
    assert(!service.includes("from '../data'") && !service.includes("from '../data/index"), 'Ruqyah service must not route Quran data through a static barrel');
    assert(service.includes("from '../data/quranDataLoader'") && service.includes('loadSurahVerses'), 'Ruqyah service must use the existing per-Surah loader');
    assert(service.includes('await loadSurahVerses'), 'Ruqyah service must resolve local Surah chunks asynchronously');
    const runtimeImports = service.split(String.fromCharCode(10)).filter(line => line.startsWith('import ') && !line.startsWith('import type '));
    assert(runtimeImports.length === 2 && runtimeImports.some(line => line.includes("from '../data/quranDataLoader'")) &&
      runtimeImports.some(line => line.includes("from '../data/quranMeta'")), 'Only the lazy loader and lightweight Quran metadata may be runtime imports');
    assert(!service.includes('new Map('), 'Ruqyah service must reuse the loader cache instead of creating a second global Quran cache');
  });

  test('Quran source attribution metadata is independent from the full text payload', () => {
    const info = read('src/data/quranDataInfo.ts');
    assert(info.includes('Tanzil Project') && info.includes('CC BY 3.0'), 'Source and license attribution must remain available');
    assert(info.includes('displayEdition') && info.includes('Simple') && info.includes('https://tanzil.net'), 'The default Imla’ei display edition and official source URL must be declared');
    assert(!info.includes('completeQuranData.json'), 'Metadata module must remain lightweight');
  });

  return { passed, failed };
}