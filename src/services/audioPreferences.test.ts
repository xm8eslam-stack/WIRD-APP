import fs from 'node:fs';
import path from 'node:path';
import { AUDIO_REPEAT_COUNTS, normalizeAudioRepeatCount, PLAYBACK_RATES, normalizePlaybackRate } from './audioPreferences';
import { attachAyahRepeatHandler } from './audioRepeatController';

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
  test('Audio repeat choices include bounded counts and continuous playback', () => {
    if (AUDIO_REPEAT_COUNTS.join(',') !== '1,2,3,5,10,-1') throw new Error('Unexpected audio repeat choices');
    if (normalizeAudioRepeatCount(5) !== 5 || normalizeAudioRepeatCount(-1) !== -1 || normalizeAudioRepeatCount(0) !== 1 || normalizeAudioRepeatCount('invalid') !== 1) {
      throw new Error('Invalid audio repeat preference normalization');
    }
  });
  test('Ayah repeat controller plays the exact target count', () => {
    let playCalls = 0;
    let completed = 0;
    const counts: number[] = [];
    const audio = {
      currentTime: 4,
      play: () => {
        playCalls++;
        return Promise.resolve();
      },
      onended: null
    } as unknown as HTMLAudioElement;
    const current = { current: 1 };
    const target = { current: 3 };
    const getPlayCalls = () => playCalls;
    const getCurrentRepeat = () => current.current;

    attachAyahRepeatHandler(audio, current, target, count => counts.push(count), () => {
      completed++;
    });

    audio.onended?.(new Event('ended'));
    if (getPlayCalls() !== 1 || getCurrentRepeat() !== 2 || audio.currentTime !== 0) {
      throw new Error('First completion should replay and advance to repeat 2');
    }
    audio.onended?.(new Event('ended'));
    if (getPlayCalls() !== 2 || getCurrentRepeat() !== 3) {
      throw new Error('Second completion should replay and advance to repeat 3');
    }
    audio.onended?.(new Event('ended'));
    if (getPlayCalls() !== 2 || completed !== 1 || getCurrentRepeat() !== 1) {
      throw new Error('Third completion should stop at the exact target and reset the counter');
    }
    if (counts.join(',') !== '2,3,1') throw new Error('Repeat count UI updates are out of order');
  });

  test('Ayah repeat controller reads a target changed during playback', () => {
    let playCalls = 0;
    let completed = 0;
    const audio = {
      currentTime: 0,
      play: () => {
        playCalls++;
        return Promise.resolve();
      },
      onended: null
    } as unknown as HTMLAudioElement;
    const current = { current: 1 };
    const target = { current: 5 };
    attachAyahRepeatHandler(audio, current, target, () => {}, () => {
      completed++;
    });

    audio.onended?.(new Event('ended'));
    target.current = 1;
    audio.onended?.(new Event('ended'));
    if (playCalls !== 1 || completed !== 1 || current.current !== 1) {
      throw new Error('Updated repeat target must be read at the next audio-ended event');
    }
  });

  test('Ayah repeat controller supports continuous playback until detached', () => {
    let playCalls = 0;
    const audio = {
      currentTime: 2,
      play: () => { playCalls++; return Promise.resolve(); },
      onended: null
    } as unknown as HTMLAudioElement;
    const current = { current: 1 };
    const target = { current: null as number | null };
    attachAyahRepeatHandler(audio, current, target, () => {}, () => { throw new Error('Continuous playback ended'); });
    audio.onended?.(new Event('ended'));
    audio.onended?.(new Event('ended'));
    if (playCalls !== 2 || current.current !== 3) throw new Error('Continuous playback should replay each completed ayah');
    audio.onended = null;
    if (audio.onended !== null) throw new Error('Stopped playback must detach its ended callback');
  });

  test('Every existing audio view applies the shared speed and renders the common control', () => {
    const library = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranLibraryView.tsx'), 'utf8');
    if (!library.includes('attachAyahRepeatHandler') || !library.includes('currentRepeatCountRef') || !library.includes('repeatTargetRef')) {
      throw new Error('Quran library must use mutable repeat refs and the tested repeat controller');
    }
    if (library.includes('if (currentRepeatCount < repeatTarget)')) {
      throw new Error('Stale React state must not control the audio ended callback');
    }
    const session = fs.readFileSync(path.resolve(process.cwd(), 'src/components/session/MemorizationSessionView.tsx'), 'utf8');
    const mushaf = fs.readFileSync(path.resolve(process.cwd(), 'src/components/library/QuranMushafReader.tsx'), 'utf8');
    for (const [name, source] of [['Quran library', library], ['Memorization session', session], ['Full Mushaf reader', mushaf]] as const) {
      if (!source.includes('getSavedPlaybackRate') || !source.includes('audio.playbackRate') || !source.includes('AudioPlaybackRateControl')) {
        throw new Error(name + ' is missing the shared playback-speed integration');
      }
    }
    if (!session.includes('عدد مرات تكرار الصوت') || !session.includes('attachAyahRepeatHandler') || !session.includes('handleExit')) {
      throw new Error('Memorization session is missing repeat selection, safe playback wiring, or exit cleanup');
    }
  });
  return { passed, failed };
}

