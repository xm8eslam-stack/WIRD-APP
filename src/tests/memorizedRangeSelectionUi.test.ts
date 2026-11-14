import fs from 'node:fs';
import path from 'node:path';

export function runMemorizedRangeSelectionUiTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name, error); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  test('Plan wizard offers touch-friendly multi-Surah checkboxes and search', () => {
    const source = fs.readFileSync(path.resolve('src/components/plans/PlanningEngineWizard.tsx'), 'utf8');
    assert(source.includes('type="checkbox"') && source.includes('surahSearch'), 'Surahs should be independently selectable by touch');
    assert(source.includes('ابحث وحدد عدة سور') && source.includes('selectedOptions') === false, 'Multi-select should not require Ctrl/Cmd keyboard modifiers');
  });
  test('Plan wizard exposes full Juz and custom ayah interval selection', () => {
    const source = fs.readFileSync(path.resolve('src/components/plans/PlanningEngineWizard.tsx'), 'utf8');
    assert(source.includes('getJuzMemorizedRanges(juzToAdd)'), 'Complete Juz must use canonical boundaries');
    assert(source.includes('rangeStartAyah') && source.includes('rangeEndAyah'), 'Custom start and end ayahs must be selectable');
    assert(source.includes('normalizeMemorizedRanges(selectedExistingRanges)'), 'Selected ranges must be normalized before plan generation');
  });
  return { passed, failed };
}
