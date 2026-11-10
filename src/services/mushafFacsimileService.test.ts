import {
  getMushafFacsimilePageUrls,
  matchMushafAyahAreas,
  parseMushafAyahCoordinates,
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

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="content"><path d="M0 0L1 1Z"/></g>
  <g id="ayah_markers">
    <path class="ayahPolygon" fill-opacity="0" id="verse-1" ayah="1" surah="1" d="M 10 5 L 90 5 L 90 20 Z"/>
    <path class="ayahPolygon" fill-opacity="0" id="verse-2" ayah="2" surah="1" d="M 10 25 L 90 25 L 90 40 Z"/>
  </g>
</svg>`;

export function runMushafFacsimileServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };

  test('Page assets are pinned to the verified Hafs/KFQC release and reject invalid pages', () => {
    const urls = getMushafFacsimilePageUrls(1);
    assert(urls.svgUrl === 'https://raw.githubusercontent.com/quran-ws/quran-svg/v1.1.1/mushafs/hafs/kfqc/svg/001.svg', 'Unexpected pinned SVG source URL');
    expectThrow(() => getMushafFacsimilePageUrls(0), 'Page zero must be rejected');
    expectThrow(() => getMushafFacsimilePageUrls(605), 'Page 605 must be rejected');
    expectThrow(() => getMushafFacsimilePageUrls(1.5), 'Fractional page must be rejected');
  });

  test('SVG viewBox parser preserves publisher coordinates, including opening-spread origins', () => {
    const viewBox = parseMushafViewBox(sampleSvg.replace('0 0 100 100', '-53.3109 -198.4777 345 550'));
    assert(viewBox.x === -53.3109 && viewBox.y === -198.4777 && viewBox.width === 345 && viewBox.height === 550, 'ViewBox values must remain unchanged');
    expectThrow(() => parseMushafViewBox(sampleSvg.replace('0 0 100 100', '0 0 0 550')), 'Zero-width viewBox must be rejected');
    expectThrow(() => parseMushafViewBox('<html>not svg</html>'), 'Non-SVG markup must be rejected');
  });

  test('Native SVG ayah paths support both path geometry and opening-spread coordinates', () => {
    const coordinates = parseMushafAyahCoordinates(sampleSvg);
    assert(coordinates.length === 2, 'Both ayah paths should be extracted');
    assert(coordinates[0].surahNumber === 1 && coordinates[0].ayahNumber === 1, 'First coordinate must remain exact');
    const openingSpread = sampleSvg.replace('M 10 5 L 90 5 L 90 20 Z', '10,5 90,5 90,20 10,20');
    assert(parseMushafAyahCoordinates(openingSpread).length === 2, 'Page 1–2 polygon points must be accepted without parsing their geometry');
    expectThrow(() => parseMushafAyahCoordinates(sampleSvg.replace('ayah="2"', 'ayah="1"')), 'Duplicate coordinates must be rejected');
    expectThrow(() => parseMushafAyahCoordinates(sampleSvg.replace('surah="1"', 'surah="999"')), 'Out-of-range Surah must be rejected');
    expectThrow(() => parseMushafAyahCoordinates('<svg></svg>'), 'Missing ayah hit regions must be rejected');
  });

  test('Every printed-page hit region must match exactly one WIRD-local ayah coordinate', () => {
    const coordinates = parseMushafAyahCoordinates(sampleSvg);
    const local = [
      { surahNumber: 1, numberInSurah: 1, text: 'local text one' },
      { surahNumber: 1, numberInSurah: 2, text: 'local text two' }
    ];
    const matched = matchMushafAyahAreas(coordinates, local);
    assert(matched.length === 2 && matched[0].ayah.text === 'local text one', 'Matched areas must reference WIRD local records');
    expectThrow(() => matchMushafAyahAreas(coordinates, local.slice(0, 1)), 'Incomplete local page coverage must fail closed');
    expectThrow(() => matchMushafAyahAreas(coordinates, [...local, { surahNumber: 1, numberInSurah: 3, text: 'extra' }]), 'Extra local ayahs must fail closed');
  });

  test('The service extracts coordinates only; Quran text is not read from the SVG', () => {
    const svgWithTextTag = sampleSvg.replace('</svg>', '<text>external text</text></svg>');
    const coordinates = parseMushafAyahCoordinates(svgWithTextTag);
    assert(coordinates.every(item => Object.keys(item).sort().join(',') === 'ayahNumber,surahNumber'), 'Geometry parser must return only verse coordinates');
  });

  return { passed, failed };
}
