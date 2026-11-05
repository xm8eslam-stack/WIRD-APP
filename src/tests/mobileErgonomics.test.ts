import fs from 'node:fs';
import path from 'node:path';

export function runMobileErgonomicsTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const progressView = fs.readFileSync(path.resolve(process.cwd(), 'src/components/progress/ProgressAnalyticsView.tsx'), 'utf8');\n  const sidebar = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');

  test('604-page Mushaf map provides at least 48px mobile tap targets', () => {
    assert(progressView.includes('grid-cols-5 sm:grid-cols-8'), 'Mobile grid must use a low enough column count for 48px cells');
    assert(progressView.includes('min-h-12 min-w-12'), 'Every page button must enforce 48px minimum dimensions');
    assert(progressView.includes('touch-manipulation'), 'Page buttons must use touch-friendly interaction');
    assert(progressView.includes('aria-label={`صفحة ${pageNum}'), 'Page buttons must expose descriptive accessible names');
    assert(progressView.includes('length: 604'), 'The full 604-page map must remain available');
    assert(progressView.includes('PAGE_GRID_ZOOM_CLASSES'), 'The map must offer responsive zoom levels');
    assert(progressView.includes("setPageGridZoom('large')"), 'Users must be able to enlarge page cells');
    assert(progressView.includes('getPageAyahSegments'), 'Page edits must use exact Quran ayah boundaries');
    assert(!progressView.includes('Default heuristics based on seed user journey'), 'The map must not fabricate memorization progress');
    assert(!progressView.includes('endAyah: surah.versesCount'), 'Marking one page must not mark the entire Surah');
  });

  test('Mobile navigation dock exposes the five primary destinations accessibly', () => {
    assert(sidebar.includes('wird-mobile-dock'), 'A persistent mobile quick-navigation dock must be present');
    assert(sidebar.includes("['dashboard', 'library', 'session', 'revision', 'progress']"), 'The dock must expose the five primary destinations');
    assert(sidebar.includes('aria-current={isActive ? \'page\' : undefined}'), 'The active destination must be announced to assistive technology');
    assert(sidebar.includes('aria-label="التنقل السريع"'), 'The dock must have a descriptive Arabic navigation label');
    assert(sidebar.includes('dueRevisionCount > 0'), 'Due revisions must remain visible in the dock');
  });

  return { passed, failed };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}