import fs from 'node:fs';
import path from 'node:path';

export function runMobileErgonomicsTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const progressView = fs.readFileSync(path.resolve(process.cwd(), 'src/components/progress/ProgressAnalyticsView.tsx'), 'utf8');

  test('604-page Mushaf map provides at least 48px mobile tap targets', () => {
    assert(progressView.includes('grid-cols-5 sm:grid-cols-8'), 'Mobile grid must use a low enough column count for 48px cells');
    assert(progressView.includes('min-h-12 min-w-12'), 'Every page button must enforce 48px minimum dimensions');
    assert(progressView.includes('touch-manipulation'), 'Page buttons must use touch-friendly interaction');
    assert(progressView.includes('aria-label={`صفحة ${pageNum}'), 'Page buttons must expose descriptive accessible names');
    assert(progressView.includes('length: 604'), 'The full 604-page map must remain available');
  });

  return { passed, failed };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}