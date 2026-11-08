import { sanitizeHadithHtmlToPlainText } from './hadithSanitizer';

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

  test('hadith sanitizer safely handles empty and non-string values', () => {
    assert(sanitizeHadithHtmlToPlainText('') === '', 'empty input must return empty text');
    assert(sanitizeHadithHtmlToPlainText(null as any) === '', 'invalid input must fail closed');
  });

  return { passed, failed };
}
