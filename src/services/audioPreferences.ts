export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = typeof PLAYBACK_RATES[number];

const STORAGE_KEY = 'wird.audio.playbackRate.v1';

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
