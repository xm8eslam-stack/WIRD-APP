import { RUQYAH_ITEMS } from '../data/ruqyahData';
import {
  getRuqyahAudioQueue,
  getRuqyahAyahs,
  getRuqyahDisplayText,
  parseRuqyahVerseRange
} from './ruqyahContentService';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runRuqyahContentServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };

  test('Verse range parser accepts single verses and common dash variants', () => {
    assert(JSON.stringify(parseRuqyahVerseRange('255')) === JSON.stringify({ start: 255, end: 255 }), 'Single verse parsing failed');
    assert(JSON.stringify(parseRuqyahVerseRange(' 1 - 5 ')) === JSON.stringify({ start: 1, end: 5 }), 'Hyphen range parsing failed');
    assert(JSON.stringify(parseRuqyahVerseRange('1–5')) === JSON.stringify({ start: 1, end: 5 }), 'En dash range parsing failed');
    assert(JSON.stringify(parseRuqyahVerseRange('1—5')) === JSON.stringify({ start: 1, end: 5 }), 'Em dash range parsing failed');
  });

  test('Verse range parser rejects malformed, reversed, zero, and unsafe coordinates', () => {
    for (const value of ['', '1-', '-5', '0', '5-1', '1-2-3', '1.5', '9007199254740992']) {
      let rejected = false;
      try { parseRuqyahVerseRange(value); } catch { rejected = true; }
      assert(rejected, 'Expected invalid range to be rejected: ' + value);
    }
  });

  test('Every Quran Ruqyah item resolves to the exact canonical verse count', () => {
    const items = RUQYAH_ITEMS.filter(item => item.type === 'quran');
    assert(items.length > 0, 'Quran Ruqyah items must exist');
    for (const item of items) {
      const range = parseRuqyahVerseRange(item.verseRange || '');
      const ayahs = getRuqyahAyahs(item);
      assert(ayahs.length === range.end - range.start + 1, item.id + ' has an incomplete canonical range');
      assert(ayahs[0].numberInSurah === range.start, item.id + ' starts at the wrong ayah');
      assert(ayahs[ayahs.length - 1].numberInSurah === range.end, item.id + ' ends at the wrong ayah');
      assert(getRuqyahDisplayText(item) === ayahs.map(ayah => ayah.text).join(' ۞ '), item.id + ' is not rendered from canonical Quran data');
    }
  });

  test('Audio queue contains every ayah in order, not only the first verse', () => {
    const multiVerseItems = RUQYAH_ITEMS.filter(item => item.type === 'quran' && item.verseRange?.includes('-'));
    assert(multiVerseItems.length > 0, 'At least one multi-verse Quran item must exist');
    for (const item of multiVerseItems) {
      const queue = getRuqyahAudioQueue(item);
      const ayahs = getRuqyahAyahs(item);
      assert(queue.length === ayahs.length, item.id + ' audio queue omitted verses');
      assert(queue.every((entry, index) =>
        entry.surahNumber === item.surahNumber &&
        entry.ayahNumber === ayahs[index].numberInSurah &&
        entry.globalAyahNumber === ayahs[index].number
      ), item.id + ' audio queue is not in canonical verse order');
    }
  });

  test('Non-Quran material retains its own supplied text', () => {
    const dua = RUQYAH_ITEMS.find(item => item.type === 'dua');
    assert(Boolean(dua), 'A dua item must exist');
    assert(getRuqyahDisplayText(dua!) === dua!.text, 'Dua text must not be replaced by Quran lookup');
  });

  test('Invalid Quran coordinates fail closed instead of displaying stale hand-entered text', () => {
    const valid = RUQYAH_ITEMS.find(item => item.type === 'quran');
    assert(Boolean(valid), 'A Quran item must exist');
    let rejected = false;
    try { getRuqyahAyahs({ ...valid!, surahNumber: 115 }); } catch { rejected = true; }
    assert(rejected, 'Invalid Surah coordinates must be rejected');
  });

  return { passed, failed };
}
