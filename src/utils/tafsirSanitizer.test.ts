import {
  decodeHtmlEntities,
  formatQuranicBrackets,
  sanitizeTafsirToPlainText,
  parseTafsirToSegments
} from './tafsirSanitizer';

export async function runTafsirSanitizerTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      passed++;
      console.log('  ✅ ' + name);
    } catch (error: any) {
      failed++;
      console.error('  ❌ ' + name + ': ' + (error?.message || error));
    }
  };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  await test('decodeHtmlEntities decodes standard and numeric entities', () => {
    assert(decodeHtmlEntities('&quot;سلام&quot;') === '"سلام"', 'Quotes must decode');
    assert(decodeHtmlEntities('&#39;نور&#39;') === "'نور'", 'Apostrophe must decode');
    assert(decodeHtmlEntities('أ &amp; ب') === 'أ & ب', 'Ampersand must decode');
  });

  await test('formatQuranicBrackets replaces curly braces with Islamic brackets', () => {
    const formatted = formatQuranicBrackets('قوله تعالى: { بِسْمِ اللَّهِ } أي البداءة بالبسملة');
    assert(formatted.includes('﴿ بِسْمِ اللَّهِ ﴾'), 'Curly braces must be replaced with ﴿ ﴾');
    assert(!formatted.includes('{'), 'No raw curly braces should remain');
  });

  await test('sanitizeTafsirToPlainText removes all technical HTML tags completely', () => {
    const raw = '<span class="blue"> لا تأخذه سِنَة أي:</span> نعاس، ولا نوم.<p>وهذه الآية <span class="green">(آية الكرسي)</span>.</p>';
    const plain = sanitizeTafsirToPlainText(raw);
    assert(!plain.includes('<span'), 'No span tags must remain in plain text');
    assert(!plain.includes('</span>'), 'No closing span tags must remain in plain text');
    assert(!plain.includes('<p>'), 'No p tags must remain');
    assert(plain.includes('لا تأخذه سِنَة أي:'), 'Core Arabic text must be preserved');
    assert(plain.includes('(آية الكرسي)'), 'Highlighted name must be preserved');
  });

  await test('parseTafsirToSegments extracts Ayah quotes and highlights as structured segments', () => {
    const raw = '<span class="arabic qpc-hafs brown">{ بِسْمِ اللَّهِ }</span> أي: أبتدئ بكل اسم لله تعالى.';
    const segments = parseTafsirToSegments(raw);
    assert(segments.length >= 2, 'Should have at least an ayah quote segment and commentary segment');
    const quote = segments.find(s => s.type === 'ayah_quote');
    assert(Boolean(quote), 'Must identify ayah_quote segment');
    assert(quote!.text.includes('بِسْمِ اللَّهِ'), 'Ayah text must match');
    assert(!quote!.text.includes('<span'), 'Segment must have no HTML markup');
  });

  return { passed, failed };
}
