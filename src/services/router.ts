import { NavTabId } from '../components/layout/Sidebar';

/**
 * ====================================================================
 * WIRD — Lightweight Browser Router & Deep-Link Manager (Phase 3E)
 * ====================================================================
 * 
 * Provides:
 * 1. URL Hash routing supporting Browser Back/Forward navigation.
 * 2. Deep linking for all views, specific Surahs, and interactive Sessions.
 * 3. Query parameter parsing for session mode, Surah, and Ayah ranges.
 * 4. Safe route parsing on refresh (zero broken views or 404s).
 * 5. Session exit confirmation support.
 */

export interface RouteState {
  tab: NavTabId;
  surahNumber?: number;
  startAyah?: number;
  endAyah?: number;
  mode?: 'memorize' | 'review';
}

export const VALID_NAV_TABS: NavTabId[] = [
  'dashboard',
  'library',
  'plans',
  'session',
  'revision',
  'tests',
  'progress',
  'advisor',
  'settings'
];

/**
 * Parse current window.location.hash into a structured RouteState
 */
export function parseRoute(hashString?: string): RouteState {
  const raw = hashString !== undefined 
    ? hashString 
    : (typeof window !== 'undefined' ? window.location.hash : '');

  // Strip leading '#/' or '#'
  const clean = raw.replace(/^#\/?/, '').trim();
  if (!clean) {
    return { tab: 'dashboard' };
  }

  const [pathPart, queryPart] = clean.split('?');
  const path = pathPart.toLowerCase();

  let tab: NavTabId = 'dashboard';
  if (VALID_NAV_TABS.includes(path as NavTabId)) {
    tab = path as NavTabId;
  }

  const searchParams = new URLSearchParams(queryPart || '');

  const surahParam = searchParams.get('surah');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const modeParam = searchParams.get('mode');

  const surahNumber = surahParam && !isNaN(Number(surahParam)) ? Number(surahParam) : undefined;
  const startAyah = startParam && !isNaN(Number(startParam)) ? Number(startParam) : undefined;
  const endAyah = endParam && !isNaN(Number(endParam)) ? Number(endParam) : undefined;
  const mode = modeParam === 'review' ? 'review' : 'memorize';

  return {
    tab,
    surahNumber,
    startAyah,
    endAyah,
    mode
  };
}

/**
 * Build URL hash string from RouteState
 */
export function buildRouteHash(state: RouteState): string {
  const { tab, surahNumber, startAyah, endAyah, mode } = state;
  const params = new URLSearchParams();

  if (surahNumber !== undefined) params.set('surah', String(surahNumber));
  if (startAyah !== undefined) params.set('start', String(startAyah));
  if (endAyah !== undefined) params.set('end', String(endAyah));
  if (mode && tab === 'session') params.set('mode', mode);

  const query = params.toString();
  return `#/${tab}${query ? `?${query}` : ''}`;
}

/**
 * Programmatically navigate to a route
 */
export function navigateTo(target: RouteState | NavTabId, replace: boolean = false): void {
  if (typeof window === 'undefined') return;

  const state: RouteState = typeof target === 'string' ? { tab: target } : target;
  const newHash = buildRouteHash(state);

  if (window.location.hash !== newHash) {
    if (replace) {
      const url = `${window.location.pathname}${window.location.search}${newHash}`;
      window.history.replaceState(null, '', url);
      // Manually dispatch hashchange event for in-app listeners
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = newHash;
    }
  }
}
