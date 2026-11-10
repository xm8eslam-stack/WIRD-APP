import { parseHadithMatn, sanitizeHadithHtmlToPlainText } from './hadithSanitizer';

export async function runHadithSanitizerTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('hadith sanitizer removes paragraph and link markup but preserves Arabic matn', () => {
    const raw = '<p>حَدَّثَنَا مُحَمَّدٌ، قَالَ:</p><p><a href="https://quran.com/2/255">‏{‏اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ‏}‏</a></p>';
    const clean = sanitizeHadithHtmlToPlainText(raw);
    assert(!/<[^>]+>/.test(clean), 'rendered hadith text must contain no HTML tags');
    assert(clean.includes('حَدَّثَنَا مُحَمَّدٌ'), 'Arabic matn must be preserved');
    assert(clean.includes('{‏اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ‏}'), 'visible Quran quotation text must remain unchanged');
    assert(clean.includes('\n\n'), 'source paragraph boundaries must remain readable');
  });

  test('hadith sanitizer decodes HTML entities and strips active content', () => {
    const clean = sanitizeHadithHtmlToPlainText('<p>قال &quot;خير&quot; &amp; برّ</p><script>alert(1)</script><style>body{display:none}</style>');
    assert(clean === 'قال "خير" & برّ', 'entities must decode and script/style content must be removed');
  });

  test('hadith Quran citations become validated coordinate segments, not provider text', () => {
    const raw = 'إذا قال العبد [quran sura="1" aya_start="2" aya_end="2"]{‏ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ‏}‏ قال الله';
    const segments = parseHadithMatn(raw);
    assert(segments.length === 3, 'citation must split surrounding prose into three segments');
    assert(segments[0].type === 'text' && segments[0].value === 'إذا قال العبد ', 'leading hadith prose must remain unchanged');
    assert(segments[1].type === 'quran' && segments[1].surahNumber === 1 && segments[1].startAyah === 2 && segments[1].endAyah === 2, 'citation coordinates must be extracted');
    assert(segments[2].type === 'text' && segments[2].value.includes('قال الله'), 'trailing hadith prose must remain unchanged');
    assert(!JSON.stringify(segments).includes('الْحَمْدُ'), 'untrusted provider Quran quotation must never be rendered');
  });

  test('multiple Quran citations and Arabic-Indic coordinates are supported', () => {
    const segments = parseHadithMatn('[quran sura="١" aya_start="٢" aya_end="٢"]{نص}[quran sura="1" aya_start="3" aya_end="3"]{نص}');
    assert(segments.length === 2 && segments.every(segment => segment.type === 'quran'), 'both valid citations must be parsed');
  });

  test('invalid Quran coordinates are hidden behind a verification marker', () => {
    const segments = parseHadithMatn('قبل [quran sura="999" aya_start="1" aya_end="1"]{نص غير موثق} بعد');
    assert(segments.length === 3 && segments[1].type === 'invalid-quran', 'invalid citation must not expose raw tag or quote');
    assert(!JSON.stringify(segments).includes('نص غير موثق'), 'invalid quoted text must be discarded');
  });

  test('incomplete Quran markers never leak raw markup or unverified quoted text', () => {
    const unclosedQuote = parseHadithMatn('قبل [quran sura="1" aya_start="2" aya_end="2"]{نص قرآني غير موثق');
    assert(unclosedQuote.length === 2 && unclosedQuote[1].type === 'invalid-quran', 'unterminated quote must consume the remainder');
    assert(!JSON.stringify(unclosedQuote).includes('نص قرآني'), 'unterminated quote text must not leak');
    const unclosedHeader = parseHadithMatn('قبل [quran sura="1" aya_start="2"');
    assert(unclosedHeader.length === 2 && unclosedHeader[1].type === 'invalid-quran', 'unterminated marker header must be hidden');
    const missingQuote = parseHadithMatn('قبل [quran source="unknown"] وبعد');
    assert(missingQuote[1]?.type === 'invalid-quran', 'marker without coordinates must be rejected');
    assert(!JSON.stringify(missingQuote).includes('[quran'), 'raw citation header must never remain visible');
  });

  test('malformed and empty content are safely handled', () => {
    assert(parseHadithMatn('').length === 0, 'empty matn must return no segments');
    assert(parseHadithMatn('نص بلا مراجع')[0]?.type === 'text', 'ordinary Arabic prose must remain text');
    assert(sanitizeHadithHtmlToPlainText(null as any) === '', 'invalid sanitizer input must fail closed');
  });

  return { passed, failed };
}
