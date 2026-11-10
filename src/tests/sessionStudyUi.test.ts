import fs from 'fs';
import path from 'path';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export function runSessionStudyUiTests(): { passed: number; failed: number } {
  let passed = 0; let failed = 0;
  const test = (name: string, callback: () => void) => { try { callback(); passed++; console.log(`  ✅ ${name}`); } catch (error) { failed++; console.error(`  ❌ ${name}:`, error); } };
  const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
  test('shared memorize and review session renders cancelable, accessible tafsir and paginated linked hadith', () => { const session = read('src/components/session/MemorizationSessionView.tsx'); const panel = read('src/components/session/SessionTafsirPanel.tsx'); const hadith = read('src/components/shared/RelatedHadithPanel.tsx'); assert(session.includes('<SessionTafsirPanel ayah={currentAyah} />'), 'shared session must show the panel'); assert(panel.includes('getTafsir(ayah.surahNumber, ayah.numberInSurah'), 'query must match current ayah'); assert(panel.includes('controller.abort()'), 'stale requests must cancel'); assert(panel.includes('aria-labelledby="session-tafsir-title"') && panel.includes('role="status"') && panel.includes('role="alert"'), 'panel must announce state accessibly'); assert(panel.includes('<RelatedHadithPanel ayah={ayah} />'), 'session must offer explicit verse-linked hadith'); assert(hadith.includes('تحميل مراجع إضافية') && hadith.includes('result.hasMore'), 'hadith results must support pagination'); });
  test('reading khatma stays separate, retains completed cycles, and marks pages only explicitly', () => { const library = read('src/components/library/QuranLibraryView.tsx'); const reader = read('src/components/library/QuranMushafReader.tsx'); const panel = read('src/components/library/ReadingKhatmaPanel.tsx'); const service = read('src/services/readingKhatmaService.ts'); assert(library.includes('<ReadingKhatmaPanel'), 'library must expose tracker'); assert(library.includes('markReadingPage(page)'), 'page reads must persist separately'); assert(reader.includes('onMarkPageRead?.(page)') && reader.includes('تسجيل الصفحة كمقروءة'), 'reader must expose explicit read control'); assert(panel.includes('aria-label="تقدم ختمة القراءة"') && panel.includes('بدء ختمة جديدة'), 'progress and new cycles must be accessible'); assert(service.includes('completedCycles'), 'new cycles must retain prior completed cycles'); });
  test('paper Mushaf supports touch and button navigation', () => { const reader = read('src/components/library/QuranMushafReader.tsx'); assert(reader.includes('onTouchStart') && reader.includes('onTouchEnd'), 'touch swipe must be available'); assert(reader.includes('الصفحة التالية') && reader.includes('الصفحة السابقة'), 'button navigation remains available'); });
  test('memorization session offers adjustable typography, compact spacing, and whole-session verse navigation', () => {
    const session = read('src/components/session/MemorizationSessionView.tsx');
    const preferences = read('src/services/memorizationDisplayPreferences.ts');
    assert(session.includes('aria-label="حجم خط الآيات"'), 'font size control must be accessible');
    assert(session.includes('aria-label="عرض مساحة صفحة الحفظ"') && session.includes('data-session-page-width={displayPreferences.pageWidth}'), 'session page width must be adjustable and exposed accessibly');
    assert(session.includes('activePageAyahRef.current?.scrollIntoView'), 'direct ayah jumps must keep the selected verse visible in the whole-session view');
    assert(session.includes('إعادة ضبط العرض'), 'display preferences must have a one-action reset');
    assert(preferences.includes('pageWidth: \'comfortable\'') && preferences.includes('MemorizationSessionPageWidth'), 'page width must be persisted as a validated device-local preference');
    assert(session.includes('aria-label="حجم واجهة جلسة الحفظ"') && session.includes('style={{ zoom: displayPreferences.uiScale / 100 }}'), 'overall session interface must be resizable without changing Quran text content');
    assert(session.includes('sticky bottom-2') && session.includes('aria-label="التنقل بين آيات جلسة الحفظ"'), 'previous/next navigation must remain reachable while scrolling');
    assert(session.includes('min-h-14'), 'navigation touch targets must remain at least 44px after the minimum 80% interface scale');
    assert(session.includes('aria-label="كثافة عرض العناصر"') && session.includes("density: 'compact'"), 'compact spacing control must be available');
    assert(session.includes('viewMode === \'page\'') && session.includes('كل آيات الجلسة'), 'whole-session verse view must be available');
    assert(session.includes('aria-pressed={index === currentAyahIndex}'), 'active verse must be announced to assistive technology');
    assert(session.includes('role="progressbar"') && session.includes('aria-valuetext={`الآية'), 'session progress must expose its current ayah and total');
    assert(session.includes('aria-pressed={maskLevel === m.level}'), 'mask level selection must expose its selected state');
    assert(session.includes('words.length === 0 ? <span role="status"'), 'session must announce local ayah text preparation');
    assert(session.includes('loadSimpleAyahRange(') && session.includes('{pageDisplayTexts[index]}'), 'whole-session view must use the same verified Tanzil Simple source as word masking');
    assert(session.includes('لم نعرض نصًا بديلًا'), 'Missing verified page text must fail closed instead of switching Quran text sources');
    assert(preferences.toLowerCase().includes('device-local') && preferences.includes('wird:memorization-display:v1'), 'presentation preferences must remain device-local and separate from cloud sync');
  });
  return { passed, failed };
}
