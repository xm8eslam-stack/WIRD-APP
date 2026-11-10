import {
  getMushafFacsimilePageUrls,
  matchMushafAyahAreas,
  parseMushafAyahAreas,
  parseMushafViewBox
} from './mushafFacsimileService';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectThrow(run: () => unknown, message: string): void {
  let thrown = false;
  try { run(); } catch { thrown = true; }
  assert(thrown, message);
}

export function runMushafFacsimileServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };

  test('Page assets are pinned to the verified Hafs/KFQC release and reject invalid pages', () => {
    const urls = getMushafFacsimilePageUrls(1);
    assert(urls.svgUrl === 'https://cdn.quran.ws/svg/pages/v1.1.1/hafs-kfqc/001.svg', 'Unexpected SVG source URL');
    assert(urls.jsonUrl === 'https://cdn.quran.ws/svg/pages/v1.1.1/hafs-kfqc/001.json', 'Unexpected ayah geometry URL');
    expectThrow(() => getMushafFacsimilePageUrls(0), 'Page zero must be rejected');
    expectThrow(() => getMushafFacsimilePageUrls(605), 'Page 605 must be rejected');
    expectThrow(() => getMushafFacsimilePageUrls(1.5), 'Fractional page must be rejected');
  });

  test('SVG viewBox parser accepts official geometry and rejects malformed dimensions', () => {
    const viewBox = parseMushafViewBox('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-53.3 -198.4 345 550"><path d="M0 0"/></svg>');
    assert(viewBox.x === -53.3 && viewBox.y === -198.4 && viewBox.width === 345 && viewBox.height === 550, 'ViewBox values must remain unchanged');
    expectThrow(() => parseMushafViewBox('<svg viewBox="0 0 0 550"></svg>'), 'Zero-width viewBox must be rejected');
    expectThrow(() => parseMushafViewBox('<html>not svg</html>'), 'Non-SVG markup must be rejected');
  });

  test('Ayah polygons are validated and contain geometry only, never replacement Quran text', () => {
    const viewBox = parseMushafViewBox('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>');
    const areas = parseMushafAyahAreas([
      { surahNumber: 1, ayahNumber: 1, x: 50, y: 10, polygon: '10,5 90,5 90,20 10,20', text: 'must not be used' },
      { surahNumber: 1, ayahNumber: 2, x: 50, y: 30, polygon: '10,25 90,25 90,40 10,40' }
    ], viewBox);
    assert(areas.length === 2, 'Both valid ayah areas should be accepted');
    assert(!('text' in areas[0]), 'External geometry must not expose or replace local Quran text');
    expectThrow(() => parseMushafAyahAreas([{ surahNumber: 1, ayahNumber: 1, x: 50, y: 10, polygon: '10,5 90,5 90,20' }, { surahNumber: 1, ayahNumber: 1, x: 50, y: 10, polygon: '10,5 90,5 90,20 10,20' }], viewBox), 'Duplicate ayah coordinates must be rejected');
    expectThrow(() => parseMushafAyahAreas([{ surahNumber: 1, ayahNumber: 1, x: 50, y: 10, polygon: '150,5 190,5 190,20 150,20' }], viewBox), 'Out-of-page polygon coordinates must be rejected');
  });

  test('Every printed-page hit region must match exactly one WIRD-local ayah coordinate', () => {
    const viewBox = parseMushafViewBox('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>');
    const areas = parseMushafAyahAreas([
      { surahNumber: 1, ayahNumber: 1, x: 50, y: 10, polygon: '10,5 90,5 90,20 10,20' },
      { surahNumber: 1, ayahNumber: 2, x: 50, y: 30, polygon: '10,25 90,25 90,40 10,40' }
    ], viewBox);
    const local = [
      { surahNumber: 1, numberInSurah: 1, text: 'local text one' },
      { surahNumber: 1, numberInSurah: 2, text: 'local text two' }
    ];
    const matched = matchMushafAyahAreas(areas, local);
    assert(matched.length === 2 && matched[0].ayah.text === 'local text one', 'Matched areas must reference WIRD local records');
    expectThrow(() => matchMushafAyahAreas(areas, local.slice(0, 1)), 'Incomplete local page coverage must fail closed');
    expectThrow(() => matchMushafAyahAreas(areas, [...local, { surahNumber: 1, numberInSurah: 3, text: 'extra' }]), 'Extra local ayahs must fail closed');
  });

  return { passed, failed };
}
