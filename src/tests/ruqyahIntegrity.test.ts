import { 
  RUQYAH_ITEMS, 
  RUQYAH_GUIDELINES, 
  RUQYAH_PROGRAM_AUDIO, 
  getRuqyahItemsByCategory, 
  RuqyahCategory 
} from '../data/ruqyahData';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runRuqyahIntegrityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  test('Ruqyah items contain text, titles, and only valid evidence-based repetition targets', () => {
    assert(RUQYAH_ITEMS.length >= 10, `Expected at least 10 items, got ${RUQYAH_ITEMS.length}`);
    assert(RUQYAH_GUIDELINES.length >= 3, `Expected at least 3 guidelines, got ${RUQYAH_GUIDELINES.length}`);

    RUQYAH_ITEMS.forEach(item => {
      assert(Boolean(item.id), 'Item must have id');
      assert(Boolean(item.title), `Item ${item.id} must have title`);
      assert(Boolean(item.text), `Item ${item.id} must have text`);
      assert(item.repeatTarget === null || (Number.isSafeInteger(item.repeatTarget) && item.repeatTarget > 0), `Item ${item.id} must have a positive fixed target or null when no count is established`);
      assert(item.categories.length > 0, `Item ${item.id} must have categories`);

      if (item.type === 'quran') {
        assert(Boolean(item.surahNumber && item.surahNumber > 0), `Quran item ${item.id} must have surahNumber`);
        assert(Boolean(item.surahName), `Quran item ${item.id} must have surahName`);
        assert(Boolean(item.verseRange), `Quran item ${item.id} must have a verse range for complete playback`);
      }
    });
  });

  test('Fixed repetition counts are limited to narrations that state a number', () => {
    const byId = new Map(RUQYAH_ITEMS.map(item => [item.id, item]));
    for (const id of ['q-fatihah', 'q-baqarah-1-5', 'q-kursi', 'q-baqarah-256-257', 'q-baqarah-last2', 'q-araf-magic', 'q-yunus-magic', 'q-ta-ha-magic', 'q-isra-healing', 'd-1', 'd-2', 'd-3']) {
      assert(byId.get(id)?.repeatTarget === null, id + ' must not impose an unsupported fixed count');
    }
    assert(byId.get('d-6')?.repeatTarget === 7, 'Pain supplication must retain its seven repetitions');
    assert(byId.get('d-4')?.repeatTarget === 3, 'Morning/evening protection remembrance must retain three repetitions');
    assert(byId.get('q-ikhlas')?.repeatTarget === 3 && byId.get('q-falaq')?.repeatTarget === 3 && byId.get('q-nas')?.repeatTarget === 3, 'The three protective surahs must retain their narrated morning/evening count');
    assert(byId.get('d-7')?.type === 'guideline', 'Blessing guidance must not be presented as a fixed-count supplication');
  });

  test('Ruqyah categories filter accurately', () => {
    const categories: RuqyahCategory[] = ['brief', 'medium', 'full', 'eye_envy', 'illness', 'guidelines'];

    categories.forEach(cat => {
      const filtered = getRuqyahItemsByCategory(cat);
      assert(filtered.length > 0, `Category ${cat} must return non-empty list`);
      
      if (cat === 'guidelines') {
        assert(filtered.every(i => i.type === 'guideline'), 'Guidelines category must contain guidelines');
      } else {
        assert(filtered.every(i => i.categories.includes(cat)), `Category ${cat} items must include ${cat}`);
      }
    });
  });

  test('Full-program audio remains disabled until its reciter and complete contents are verified', () => {
    assert(RUQYAH_PROGRAM_AUDIO.length === 3, 'The three future program slots may remain available');
    RUQYAH_PROGRAM_AUDIO.forEach(program => {
      assert(Boolean(program.id) && Boolean(program.name), 'Program metadata must be present');
      assert(program.audioUrl === '', 'No unverified third-party full-program recording may be playable');
    });
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('ruqyahIntegrity.test')) {
  console.log('=== Running Ruqyah Integrity Tests ===');
  const res = runRuqyahIntegrityTests();
  console.log(`Passed: ${res.passed}, Failed: ${res.failed}`);
  if (res.failed > 0) process.exit(1);
}
