import { resolveSafeSeerahSourceUrl } from './seerahSourcePresentation';

export function runSeerahSourcePresentationTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name, error); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('allows HTTPS citation links without credentials', () => {
    assert(resolveSafeSeerahSourceUrl('https://example.org/book?page=4') === 'https://example.org/book?page=4',
      'A safe HTTPS citation should remain clickable');
  });
  test('rejects script, data, HTTP and credential-bearing source URLs', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.org/book', 'https://user:pass@example.org/book']) {
      assert(resolveSafeSeerahSourceUrl(url) === null, 'Unsafe URL should not become a link: ' + url);
    }
  });
  test('treats missing or malformed source URLs as non-clickable citations', () => {
    assert(resolveSafeSeerahSourceUrl(undefined) === null && resolveSafeSeerahSourceUrl('not a url') === null,
      'Missing or malformed source links should remain plain citation metadata');
  });

  return { passed, failed };
}
