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

  test('Ruqyah items contain complete Uthmani text, titles, and positive repeat targets', () => {
    assert(RUQYAH_ITEMS.length >= 10, `Expected at least 10 items, got ${RUQYAH_ITEMS.length}`);
    assert(RUQYAH_GUIDELINES.length >= 3, `Expected at least 3 guidelines, got ${RUQYAH_GUIDELINES.length}`);

    RUQYAH_ITEMS.forEach(item => {
      assert(Boolean(item.id), 'Item must have id');
      assert(Boolean(item.title), `Item ${item.id} must have title`);
      assert(Boolean(item.text), `Item ${item.id} must have text`);
      assert(item.repeatTarget > 0, `Item ${item.id} must have repeatTarget > 0`);
      assert(item.categories.length > 0, `Item ${item.id} must have categories`);

      if (item.type === 'quran') {
        assert(Boolean(item.surahNumber && item.surahNumber > 0), `Quran item ${item.id} must have surahNumber`);
        assert(Boolean(item.surahName), `Quran item ${item.id} must have surahName`);
        assert(Boolean(item.audioVerseKey && /^\d{6}$/.test(item.audioVerseKey)), `Quran item ${item.id} must have 6-digit audioVerseKey`);
      }
    });
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

  test('Full Ruqyah program recordings use documented program audio, not unrelated Surah 1 streams', () => {
    assert(RUQYAH_PROGRAM_AUDIO.length === 3, 'Brief, medium, and long program recordings must exist');
    const expected = [
      'https://islamicapi.com/audio/ruqyah/total_brief_ruqyah.mp3',
      'https://islamicapi.com/audio/ruqyah/total_med_ruqyah.mp3',
      'https://islamicapi.com/audio/ruqyah/total_long_ruqyah.mp3'
    ];
    RUQYAH_PROGRAM_AUDIO.forEach((program, index) => {
      assert(Boolean(program.id) && Boolean(program.name), 'Program metadata must be present');
      assert(program.audioUrl === expected[index], 'Program must use the documented full Ruqyah audio URL');
      assert(!/\/001\.mp3$/.test(program.audioUrl), 'A Quran Surah 1 recording must not be mislabeled as full Ruqyah');
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
