import { PLAYBACK_RATES, normalizePlaybackRate } from './audioPreferences';

export function runAudioPreferencesTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  test('Playback rates expose the supported bounded choices', () => {
    if (PLAYBACK_RATES.join(',') !== '0.75,1,1.25,1.5,1.75,2') throw new Error('Unexpected playback-rate options');
  });
  test('Playback rate normalization rejects unsupported values', () => {
    if (normalizePlaybackRate(1.5) !== 1.5 || normalizePlaybackRate(3) !== 1 || normalizePlaybackRate('invalid') !== 1) throw new Error('Invalid playback-rate normalization');
  });
  return { passed, failed };
}
