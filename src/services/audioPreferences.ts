export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = typeof PLAYBACK_RATES[number];

const STORAGE_KEY = 'wird.audio.playbackRate.v1';
export const AUDIO_REPEAT_COUNTS = [1, 2, 3, 5, 10, -1] as const;
export type AudioRepeatCount = typeof AUDIO_REPEAT_COUNTS[number];
const REPEAT_STORAGE_KEY = 'wird.audio.repeatCount.v1';

export function normalizeAudioRepeatCount(value: unknown): AudioRepeatCount {
  const numeric = typeof value === 'number' ? value : Number(value);
  return AUDIO_REPEAT_COUNTS.includes(numeric as AudioRepeatCount) ? numeric as AudioRepeatCount : 1;
}

export function getSavedAudioRepeatCount(): AudioRepeatCount {
  try {
    if (typeof localStorage === 'undefined') return 1;
    return normalizeAudioRepeatCount(localStorage.getItem(REPEAT_STORAGE_KEY));
  } catch {
    return 1;
  }
}

export function saveAudioRepeatCount(value: unknown): AudioRepeatCount {
  const count = normalizeAudioRepeatCount(value);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(REPEAT_STORAGE_KEY, String(count));
  } catch {
    // Keep the selected repeat count for the current session if storage is unavailable.
  }
  return count;
}

export function normalizePlaybackRate(value: unknown): PlaybackRate {
  const numeric = typeof value === 'number' ? value : Number(value);
  return PLAYBACK_RATES.includes(numeric as PlaybackRate) ? numeric as PlaybackRate : 1;
}

export function getSavedPlaybackRate(): PlaybackRate {
  try {
    if (typeof localStorage === 'undefined') return 1;
    return normalizePlaybackRate(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 1;
  }
}

export function savePlaybackRate(value: unknown): PlaybackRate {
  const rate = normalizePlaybackRate(value);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // Audio speed remains available for the current view even if storage is unavailable.
  }
  return rate;
}

