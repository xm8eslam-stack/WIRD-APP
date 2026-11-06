import fs from 'node:fs';
import path from 'node:path';
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
  test('Every existing audio view applies the shared speed and renders the common control', () => {
    const library = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranLibraryView.tsx'), 'utf8');
    const session = fs.readFileSync(path.resolve(process.cwd(), 'src/components/session/MemorizationSessionView.tsx'), 'utf8');
    for (const [name, source] of [['Quran library', library], ['Memorization session', session]] as const) {
      if (!source.includes('getSavedPlaybackRate') || !source.includes('audio.playbackRate') || !source.includes('AudioPlaybackRateControl')) {
        throw new Error(name + ' is missing the shared playback-speed integration');
      }
    }
  });
  return { passed, failed };
}
