import {
  DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES,
  getMemorizationDisplayPreferences,
  saveMemorizationDisplayPreferences
} from './memorizationDisplayPreferences';

export function runMemorizationDisplayPreferenceTests(): { passed: number; failed: number } {
  let passed = 0, failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }
    }
  });
  try {
    test('memorization display preferences persist on this device and restore exactly', () => {
      const chosen = { fontSize: 40, uiScale: 85, density: 'compact' as const, viewMode: 'page' as const };
      assert(saveMemorizationDisplayPreferences(chosen), 'Valid display preferences should persist');
      assert(JSON.stringify(getMemorizationDisplayPreferences()) === JSON.stringify(chosen),
        'Reloading preferences should restore the selected size, density, and page mode');
    });
    test('overall session interface scale is clamped to a readable range', () => {
      assert(saveMemorizationDisplayPreferences({ fontSize: 32, uiScale: 120, density: 'comfortable', viewMode: 'focused' }),
        'Out-of-range interface scale should be safely normalized');
      assert(getMemorizationDisplayPreferences().uiScale === 110, 'Interface scale must not exceed 110%');
      assert(saveMemorizationDisplayPreferences({ fontSize: 32, uiScale: 60, density: 'comfortable', viewMode: 'focused' }),
        'Below-range interface scale should be safely normalized');
      assert(getMemorizationDisplayPreferences().uiScale === 80, 'Interface scale must not fall below 80%');
    });
    test('invalid or corrupt display preferences safely fall back without affecting user data', () => {
      values.set('wird:memorization-display:v1', '{broken');
      assert(JSON.stringify(getMemorizationDisplayPreferences()) === JSON.stringify(DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES),
        'Corrupt presentation preferences should use safe defaults');
    });
    test('display font size is clamped to the accessible supported range', () => {
      assert(saveMemorizationDisplayPreferences({ fontSize: 100, uiScale: 100, density: 'comfortable', viewMode: 'focused' }),
        'Out-of-range font size should be safely normalized');
      assert(getMemorizationDisplayPreferences().fontSize === 44, 'Font size must not exceed 44px');
    });
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    else delete (globalThis as any).localStorage;
  }
  return { passed, failed };
}
