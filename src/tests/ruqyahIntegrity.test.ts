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

  test('Every published religious item uses an explicitly reviewed Sunni source reference', () => {
    const reviewedSources = new Set([
      'القرآن الكريم، الشعراء 80',
      'صحيح البخاري 5017',
      'إرشاد صحي عام',
      'صحيح مسلم 2200',
      'صحيح البخاري 5736',
      'القرآن الكريم، البقرة 1-5',
      'صحيح البخاري 2311 (معلّق؛ وُصل عند النسائي وابن خزيمة)',
      'القرآن الكريم، البقرة 256-257',
      'صحيح البخاري 5009؛ صحيح مسلم 808a',
      'القرآن الكريم، الأعراف 117-122',
      'القرآن الكريم، يونس 81-82',
      'القرآن الكريم، طه 69',
      'القرآن الكريم، الإسراء 82',
      'صحيح البخاري 5017؛ سنن أبي داود 5082 (حسن، الألباني)',
      'صحيح البخاري 5750',
      'صحيح مسلم 2186',
      'صحيح البخاري 3371',
      'سنن أبي داود 5088 (صحيح، الألباني)؛ حصن المسلم 86',
      'صحيح مسلم 2202'
    ]);
    for (const item of [...RUQYAH_GUIDELINES, ...RUQYAH_ITEMS]) {
      assert(typeof item.source === 'string' && item.source.trim().length > 0,
        item.id + ' must identify its source');
      assert(reviewedSources.has(item.source),
        item.id + ' uses a source reference that has not been explicitly reviewed: ' + item.source);
    }
  });

  test('Fixed repetition counts are limited to narrations that state a number', () => {
    const byId = new Map(RUQYAH_ITEMS.map(item => [item.id, item]));
    for (const id of ['q-fatihah', 'q-baqarah-1-5', 'q-kursi', 'q-baqarah-256-257', 'q-baqarah-last2', 'q-araf-magic', 'q-yunus-magic', 'q-ta-ha-magic', 'q-isra-healing', 'd-1', 'd-2', 'd-3']) {
      assert(byId.get(id)?.repeatTarget === null, id + ' must not impose an unsupported fixed count');
    }
    assert(byId.get('d-6')?.repeatTarget === 7, 'Pain supplication must retain its seven repetitions');
    assert(byId.get('d-4')?.repeatTarget === 3, 'Morning/evening protection remembrance must retain three repetitions');
    assert(byId.get('q-ikhlas')?.repeatTarget === 3 && byId.get('q-falaq')?.repeatTarget === 3 && byId.get('q-nas')?.repeatTarget === 3, 'The three protective surahs must retain their narrated morning/evening count');
    assert(!byId.has('d-7'), 'Unreviewed optional blessing guidance must not be included in the core Ruqyah corpus');
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
