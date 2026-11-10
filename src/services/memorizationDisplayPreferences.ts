export type MemorizationSessionViewMode = 'focused' | 'page';
export type MemorizationSessionDensity = 'comfortable' | 'compact';

export interface MemorizationDisplayPreferences {
  fontSize: number;
  uiScale: number;
  density: MemorizationSessionDensity;
  viewMode: MemorizationSessionViewMode;
}

export const DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES: Readonly<MemorizationDisplayPreferences> = {
  fontSize: 32,
  uiScale: 100,
  density: 'comfortable',
  viewMode: 'focused'
};

const STORAGE_KEY = 'wird:memorization-display:v1';
const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 44;
const MIN_UI_SCALE = 80;
const MAX_UI_SCALE = 110;

function normalizePreferences(value: unknown): MemorizationDisplayPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES };
  }
  const candidate = value as Record<string, unknown>;
  const fontSize = typeof candidate.fontSize === 'number' && Number.isFinite(candidate.fontSize)
    ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(candidate.fontSize / 2) * 2))
    : DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES.fontSize;
  const uiScale = typeof candidate.uiScale === 'number' && Number.isFinite(candidate.uiScale)
    ? Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Math.round(candidate.uiScale / 5) * 5))
    : DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES.uiScale;
  return {
    fontSize,
    uiScale,
    density: candidate.density === 'compact' || candidate.density === 'comfortable'
      ? candidate.density
      : DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES.density,
    viewMode: candidate.viewMode === 'page' || candidate.viewMode === 'focused'
      ? candidate.viewMode
      : DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES.viewMode
  };
}

/** Device-local reading preferences; deliberately excluded from cloud sync and backups. */
export function getMemorizationDisplayPreferences(): MemorizationDisplayPreferences {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES };
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizePreferences(JSON.parse(raw)) : { ...DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES };
  } catch {
    return { ...DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES };
  }
}

/** Persist only presentation settings. A storage failure never blocks a memorization session. */
export function saveMemorizationDisplayPreferences(
  preferences: MemorizationDisplayPreferences
): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const normalized = normalizePreferences(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
