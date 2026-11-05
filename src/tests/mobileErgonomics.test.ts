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
  const sidebar = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
  const styles = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
  const library = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranLibraryView.tsx'), 'utf8');
  const dashboard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/DashboardView.tsx'), 'utf8');
  const session = fs.readFileSync(path.resolve(process.cwd(), 'src/components/session/MemorizationSessionView.tsx'), 'utf8');

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
    assert(styles.includes('min-height: 3.55rem'), 'Mobile dock controls must remain comfortably touchable');
    assert(styles.includes('env(safe-area-inset-bottom)'), 'Mobile navigation must respect device safe areas');
  });

  test('WIRD visual system supports theme tokens and reduced-motion preferences', () => {
    assert(styles.includes('--wird-canvas'), 'The visual system must define shared design tokens');
    assert(styles.includes('.dark {'), 'Dark theme tokens must remain defined');
    assert(styles.includes('@media (prefers-reduced-motion: reduce)'), 'Motion must respect reduced-motion preferences');
    assert(styles.includes('.wird-main'), 'The responsive content container must be shared');
  });


  test('Dashboard progress is accessible and uses real user settings', () => {
    assert(dashboard.includes('role="progressbar"'), 'Dashboard progress indicators must expose progressbar semantics');
    assert(dashboard.includes('aria-valuenow={Number(versesPercentage)}'), 'Ayah progress must expose its actual percentage');
    assert(dashboard.includes('aria-valuenow={Number(pagesPercentage)}'), 'Full-page progress must expose its actual percentage');
    assert(dashboard.includes('profile.repetitionTarget || 10'), 'The dashboard must reflect the configured repetition target');
    assert(!dashboard.includes('20 دقيقة'), 'The dashboard must not promise a fixed duration unsupported by the plan');
  });

  test('Quran library Surah selection is keyboard-operable and semantically selected', () => {
    assert(library.includes('wird-surah-select'), 'Surah selection must use a dedicated interactive control');
    assert(library.includes('aria-pressed={isSelected}'), 'Selected Surah state must be announced');
    assert(!library.includes('onClick={() => {\n                  handleStopAudio();\n                  setSelectedSurah(surah);\n                }}'), 'The clickable Surah wrapper must not remain a non-semantic div');
    assert(library.includes('wird-quran-reading-text'), 'Quran reading typography must have a dedicated style hook');
  });


  test('Memorization reveal and step controls support keyboard and assistive technology', () => {
    assert(session.includes('aria-label={`كشف الكلمة رقم ${idx + 1}'), 'Masked words must have descriptive reveal button names');
    assert(session.includes('type="button"'), 'Word reveal controls must be real buttons');
    assert(session.includes("['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']"), 'Space-to-repeat must not hijack interactive controls');
    assert(session.includes('role="list" aria-label="تقدم الآيات"'), 'Ayah progress must be exposed as a labeled list');
    assert(session.includes("aria-current={idx === currentAyahIndex ? 'step' : undefined}"), 'The current ayah step must be announced');
  });

  test('Phase 5E planning and forms share accessible visual hooks', () => {
    const plans = fs.readFileSync(path.resolve(process.cwd(), 'src/components/plans/MemorizationPlansView.tsx'), 'utf8');
    const planning = fs.readFileSync(path.resolve(process.cwd(), 'src/components/plans/PlanningEngineWizard.tsx'), 'utf8');
    const revision = fs.readFileSync(path.resolve(process.cwd(), 'src/components/revision/RevisionCenterView.tsx'), 'utf8');
    const settings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/settings/SettingsView.tsx'), 'utf8');
    const tests = fs.readFileSync(path.resolve(process.cwd(), 'src/components/tests/MemorizationTestsView.tsx'), 'utf8');
    assert(plans.includes('wird-plans'), 'Plans must expose the shared design-system hook');
    assert(planning.includes('wird-planning-wizard'), 'The planning wizard must expose its focused layout hook');
    assert(revision.includes('wird-revision'), 'Revision must expose the shared design-system hook');
    assert(settings.includes('wird-settings'), 'Settings must expose the shared design-system hook');
    assert(tests.includes('wird-tests'), 'Memorization tests must expose the shared design-system hook');
    assert(styles.includes('Phase 5E — consistent planning'), 'Phase 5E surfaces must use shared visual rules');
    assert(styles.includes('min-height: 2.875rem'), 'Mobile form controls must remain comfortably touchable');
    assert(styles.includes('min-height: 2.75rem;\n  touch-action: manipulation;'), 'Planning and revision actions must have touch-sized targets');
  });

  test('Preset plan progress is safe and accessible', () => {
    const plans = fs.readFileSync(path.resolve(process.cwd(), 'src/components/plans/MemorizationPlansView.tsx'), 'utf8');
    assert(plans.includes('totalUnits > 0'), 'Zero-unit plans must not produce NaN progress');
    assert(plans.includes('Math.max(0, Math.round((completedUnits / totalUnits) * 100))'), 'Plan progress must be clamped at zero');
    assert(plans.includes('role="progressbar"'), 'Plan progress must expose progressbar semantics');
    assert(plans.includes('aria-valuenow={percent}'), 'Plan progress must expose its current percentage');
    assert(plans.includes('aria-label={`حذف الخطة ${plan.title}`}'), 'Plan deletion must have a descriptive accessible name');
  });

  test('Revision navigation exposes semantic, labelled tabs and panels', () => {
    const revision = fs.readFileSync(path.resolve(process.cwd(), 'src/components/revision/RevisionCenterView.tsx'), 'utf8');
    assert(revision.includes('role="tablist" aria-label="أقسام مركز المراجعة"'), 'Revision navigation must expose a named tablist');
    assert(revision.includes('role="tab"'), 'Each revision destination must be exposed as a tab');
    assert(revision.includes('aria-selected={activeTab ==='), 'Selected revision tab must be announced');
    assert(revision.includes('aria-controls="revision-panel-'), 'Revision tabs must reference their panels');
    assert(revision.includes('role="tabpanel"'), 'Revision content must expose tabpanel semantics');
    assert((revision.match(/role="dialog"/g) || []).length === 3, 'Revision modals must expose dialog semantics');
    assert(revision.includes('role="status" aria-live="polite"'), 'Revision action feedback must be announced politely');
    assert(revision.includes('aria-labelledby="revision-tab-'), 'Revision panels must reference their controlling tabs');
    assert(revision.includes("event.key === 'ArrowRight'") && revision.includes("event.key === 'ArrowLeft'"), 'Revision tabs must support arrow-key navigation');
    assert(revision.includes("event.key === 'Home'") && revision.includes("event.key === 'End'"), 'Revision tabs must support Home and End navigation');
  });

  test('Review sessions are routed and displayed separately from memorization', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const session = fs.readFileSync(path.resolve(process.cwd(), 'src/components/session/MemorizationSessionView.tsx'), 'utf8');
    const revision = fs.readFileSync(path.resolve(process.cwd(), 'src/components/revision/RevisionCenterView.tsx'), 'utf8');
    assert(app.includes('mode: initialRoute.mode || \'memorize\''), 'Deep links must restore the requested session mode');
    assert(app.includes('mode={sessionParams.mode}'), 'The route mode must reach the session component');
    assert(app.includes('getSessionCompletionMetrics(mode, memorizedAyahs, reviewedPages)'), 'App completion must normalize counts by session mode');
    assert(app.includes('if (completion.shouldRecordMemorization && sessionParams.surahNumber)'), 'Only memorization sessions may advance memorized portions');
    assert(session.includes("mode === 'review' ? Math.max(1, new Set(sessionAyahs.map(ayah => ayah.page)).size) : 0"), 'Review completion must count its actual pages');
    assert(session.includes("mode === 'memorize' ? sessionAyahs.length : 0"), 'Review completion must contribute zero memorized ayahs');
    assert(revision.includes("onStartSession(item.surahNumber, item.startAyah, item.endAyah, 'review')"), 'Revision queue actions must open review mode');
  });

  test('Memorization test result does not double-count the final correct answer', () => {
    const tests = fs.readFileSync(path.resolve(process.cwd(), 'src/components/tests/MemorizationTestsView.tsx'), 'utf8');
    assert(tests.includes('const finalScore = score;'), 'Saved score must use the already-updated score state');
    assert(!tests.includes('score + (selectedOption === currentQ.correctIndex ? 1 : 0)'), 'Final answer must not be added a second time');
  });

  return { passed, failed };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}