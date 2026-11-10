import { 
  UserProfile, 
  MemorizationPlan, 
  RevisionItem, 
  DailyLog, 
  TestResult,
  PortionStatusRecord,
  WeakVerseItem,
  WirdPortion 
} from '../types/quran';
import { ALL_SURAHS } from '../data/quranMeta';
import { EngineGeneratedPlan, PlanningEngine } from './planningEngine';
import { migrateLegacyDataLosslessly, MigrationReport, getLocalDateString, createCanonicalPortionId } from './unifiedPortionService';
import type { JournalEvent } from './indexedDbSyncJournal';
import type { SyncCollection } from './localSyncOutbox';
import { isValidRuqyahProgressSnapshot } from './ruqyahProgressSchema';
import type { RuqyahProgressSnapshot } from './ruqyahProgressSchema';

export interface PreparedDataMigration {
  report: MigrationReport;
  portions: WirdPortion[] | null;
  needsMigration: boolean;
  allowRecoveryOverwrite: boolean;
}

export interface JournalProjectionOperation {
  collection: Exclude<SyncCollection, 'syncMeta'>;
  documentId: string;
  operation: 'upsert';
  payload: Record<string, unknown>;
}

export const STORAGE_KEYS = {
  PROFILE: 'wird_profile',
  PLANS: 'wird_plans',
  ENGINE_PLANS: 'wird_engine_plans',
  PROGRESS: 'wird_progress',
  REVISION: 'wird_revision',
  LOGS: 'wird_logs',
  TESTS: 'wird_tests',
  PORTIONS: 'wird_portions_status',
  WEAK_VERSES: 'wird_weak_verses',
  UNIFIED_PORTIONS: 'wird_portions_v2',
  SCHEMA_VERSION: 'wird_data_schema_version',
  RUQYAH_PROGRESS: 'wird_ruqyah_progress_v1',
  SYNC_OUTBOX: 'wird_sync_outbox_v1'
} as const;

// In-memory fallback for test / Node / SSR environments where localStorage is not defined.
const memoryStorage = new Map<string, string>();
const STORAGE_SCOPE_PREFIX = 'wird_scope_v1';
const STORAGE_OWNER_MARKER = 'wird_storage_owner_v1';
let activeStorageScope = 'legacy';

function resolveStorageKey(key: string, scope = activeStorageScope): string {
  if (scope === 'legacy' || scope === 'guest') return key;
  return `${STORAGE_SCOPE_PREFIX}:${scope}:${key}`;
}

function rawGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    }
  } catch {
    // Fall back to the in-memory copy when browser storage is unavailable.
  }
  return memoryStorage.get(key) ?? null;
}

function rawSetItem(key: string, value: string): boolean {
  const previousMemoryValue = memoryStorage.get(key);
  if (typeof localStorage === 'undefined') {
    memoryStorage.set(key, value);
    return true;
  }

  let previousDurableValue: string | null;
  try {
    previousDurableValue = localStorage.getItem(key);
  } catch (error) {
    console.error(`[WIRD Storage] Cannot snapshot durable value before writing ${key}`, error);
    return false;
  }

  const restorePreviousDurableValue = (): boolean => {
    try {
      if (previousDurableValue === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previousDurableValue);
    } catch {
      // Verify below: a storage adapter may throw after applying the requested state.
    }
    try {
      return localStorage.getItem(key) === previousDurableValue;
    } catch {
      return false;
    }
  };

  const restorePreviousMemoryValue = () => {
    if (previousMemoryValue === undefined) memoryStorage.delete(key);
    else memoryStorage.set(key, previousMemoryValue);
  };

  try {
    localStorage.setItem(key, value);
    const readback = localStorage.getItem(key);
    if (readback !== value) {
      const rollbackVerified = restorePreviousDurableValue();
      restorePreviousMemoryValue();
      console.error(
        `[WIRD Storage] Durable write verification failed for ${key}; previous value restored: ${rollbackVerified}`
      );
      return false;
    }
    memoryStorage.set(key, value);
    return true;
  } catch (error) {
    const rollbackVerified = restorePreviousDurableValue();
    restorePreviousMemoryValue();
    console.error(
      `[WIRD Storage] Durable write to localStorage failed for ${key}; previous value restored: ${rollbackVerified}`,
      error
    );
    return false;
  }
}

function rawRemoveItem(key: string): boolean {
  const previousMemoryValue = memoryStorage.get(key);
  if (typeof localStorage === 'undefined') {
    memoryStorage.delete(key);
    return true;
  }
  try {
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) {
      if (previousMemoryValue === undefined) memoryStorage.delete(key);
      else memoryStorage.set(key, previousMemoryValue);
      console.error(`[WIRD Storage] Durable remove verification failed for ${key}`);
      return false;
    }
    memoryStorage.delete(key);
    return true;
  } catch (error) {
    let removed = false;
    try { removed = localStorage.getItem(key) === null; } catch { /* verification unavailable */ }
    if (removed) memoryStorage.delete(key);
    else if (previousMemoryValue === undefined) memoryStorage.delete(key);
    else memoryStorage.set(key, previousMemoryValue);
    console.error(`[WIRD Storage] Durable remove failed or could not be verified for ${key}`, error);
    return false;
  }
}

/**
 * Authenticated accounts receive isolated local keys. A first account must
 * explicitly choose whether to import legacy device data or keep it in guest
 * mode. Later accounts never silently inherit another account's local data.
 */
function isUserStorageScope(scope: string): boolean {
  const uid = scope.startsWith('user:') ? scope.slice('user:'.length) : '';
  return uid.length > 0 && uid.length <= 128 && !/[\u0000-\u001F]/.test(uid);
}

function hasLegacyStorageData(): boolean {
  return Object.values(STORAGE_KEYS)
    .filter(key => key !== STORAGE_KEYS.SCHEMA_VERSION)
    .some(key => rawGetItem(key) !== null);
}

function needsLegacyDataDecision(scope: string): boolean {
  return isUserStorageScope(scope) &&
    rawGetItem(STORAGE_OWNER_MARKER) === null &&
    hasLegacyStorageData();
}

function readRawStorageValue(key: string): string | null | undefined {
  if (typeof localStorage === 'undefined') return memoryStorage.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function restoreRawStorageValues(snapshot: Map<string, string | null>): boolean {
  if (typeof localStorage === 'undefined') {
    for (const [key, value] of snapshot) {
      if (value === null) memoryStorage.delete(key);
      else memoryStorage.set(key, value);
    }
    return true;
  }

  for (const [key, value] of snapshot) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Some adapters throw after applying a mutation; verify the final bytes below.
    }
  }

  let restored = true;
  for (const [key, value] of snapshot) {
    if (readRawStorageValue(key) !== value) {
      restored = false;
      continue;
    }
    if (value === null) memoryStorage.delete(key);
    else memoryStorage.set(key, value);
  }
  return restored;
}

function setStorageScope(scope: string, legacyChoice?: 'import' | 'keep-guest'): boolean {
  const normalized = scope;
  if (normalized === 'legacy' || normalized === 'guest') {
    activeStorageScope = normalized;
    return true;
  }
  if (!isUserStorageScope(normalized)) return false;

  const owner = readRawStorageValue(STORAGE_OWNER_MARKER);
  if (owner === undefined) return false;
  if (!owner) {
    const legacyKeys = Object.values(STORAGE_KEYS);
    const destinationKeys = legacyKeys.map(key => resolveStorageKey(key, normalized));
    const snapshotKeys = [...new Set([STORAGE_OWNER_MARKER, ...legacyKeys, ...destinationKeys])];
    const snapshot = new Map<string, string | null>();
    for (const key of snapshotKeys) {
      const value = readRawStorageValue(key);
      if (value === undefined) return false;
      snapshot.set(key, value);
    }

    const legacyValues = legacyKeys.map(key => ({ key, value: snapshot.get(key) ?? null }));
    const hasLegacyData = legacyValues.some(item => item.value !== null);

    // Existing unscoped data may belong to a guest or another person using
    // this browser. Require an explicit in-app choice before claiming it.
    if (hasLegacyData && !legacyChoice) return false;

    const rollbackImport = (reason: string): false => {
      const restored = restoreRawStorageValues(snapshot);
      console.error(
        '[WIRD Storage] Legacy account import failed; previous storage snapshot restored: ' + restored,
        reason
      );
      return false;
    };

    if (legacyChoice === 'import') {
      // Reject conflicting destination data before changing either scope.
      for (const item of legacyValues) {
        if (item.value === null) continue;
        const destinationKey = resolveStorageKey(item.key, normalized);
        const destinationValue = snapshot.get(destinationKey) ?? null;
        if (destinationValue !== null && destinationValue !== item.value) return false;
      }

      // Copy and verify every legacy value before removing any source key.
      for (const item of legacyValues) {
        if (item.value === null) continue;
        const destinationKey = resolveStorageKey(item.key, normalized);
        if (snapshot.get(destinationKey) === null) {
          if (!rawSetItem(destinationKey, item.value) || readRawStorageValue(destinationKey) !== item.value) {
            return rollbackImport('Account-scope copy failed for ' + item.key);
          }
        }
      }

      for (const item of legacyValues) {
        if (item.value === null) continue;
        rawRemoveItem(item.key);
        if (readRawStorageValue(item.key) !== null) {
          return rollbackImport('Legacy source removal failed for ' + item.key);
        }
      }
    }

    // keep-guest leaves the legacy dataset untouched and prevents another
    // account from silently claiming it. Marker write is part of the same
    // rollback boundary as import copies and source removals.
    if (!rawSetItem(STORAGE_OWNER_MARKER, normalized) ||
        readRawStorageValue(STORAGE_OWNER_MARKER) !== normalized) {
      return rollbackImport('Storage ownership marker could not be committed');
    }
  }

  activeStorageScope = normalized;
  return true;
}
function getItem(key: string): string | null {
  return rawGetItem(resolveStorageKey(key));
}

function setItem(key: string, value: string): boolean {
  return rawSetItem(resolveStorageKey(key), value);
}

// Unlike getItem, rollback verification must never fall back to memory while
// localStorage exists: an inaccessible durable store is not a verified restore.
function verifyItem(key: string, expected: string | null): boolean {
  const resolved = resolveStorageKey(key);
  if (typeof localStorage === 'undefined') return (memoryStorage.get(resolved) ?? null) === expected;
  try {
    return localStorage.getItem(resolved) === expected;
  } catch {
    return false;
  }
}

function removeItem(key: string): boolean {
  const resolved = resolveStorageKey(key);
  return rawRemoveItem(resolved) && rawGetItem(resolved) === null;
}

function notifyRuqyahProgressUpdated(): void {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wird:ruqyah-progress-updated'));
  }
}

// 1. Clean Initial State for New Users (No fabricated identity, streaks, or fake progress)
export const CLEAN_INITIAL_PROFILE: Readonly<UserProfile> = Object.freeze({
  name: "طالب القرآن",
  email: "",
  memorizationGoal: "حفظ القرآن الكريم وتثبيته والعمل به",
  preferredReciter: "alafasy",
  quranFontSize: "lg",
  audioAutoPlay: true,
  repetitionTarget: 5,
  theme: "light",
  streakDays: 0,
  lastActiveDate: ""
});

// 2. Demo Data (Strictly isolated for explicit Demo Mode only)
export const DEMO_PROFILE: UserProfile = {
  name: "عبد الرحمن (وضع تجريبي)",
  email: "",
  memorizationGoal: "إتقان حفظ كتاب الله كاملاً مع التدبر والتثبيت المستمر",
  preferredReciter: "alafasy",
  quranFontSize: "lg",
  audioAutoPlay: true,
  repetitionTarget: 10,
  theme: "light",
  streakDays: 3,
  lastActiveDate: getLocalDateString()
};
function isValidUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const reciters = ['alafasy', 'husary', 'abdulbasit', 'ghamdi', 'minshawi'];
  const fontSizes = ['sm', 'md', 'lg', 'xl'];
  if (typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 100) return false;
  if (typeof profile.email !== 'string' || profile.email.length > 254) return false;
  if (typeof profile.memorizationGoal !== 'string' || profile.memorizationGoal.length > 500) return false;
  if (typeof profile.preferredReciter !== 'string' || !reciters.includes(profile.preferredReciter)) return false;
  if (typeof profile.quranFontSize !== 'string' || !fontSizes.includes(profile.quranFontSize)) return false;
  if (typeof profile.audioAutoPlay !== 'boolean') return false;
  if (!Number.isSafeInteger(profile.repetitionTarget) || Number(profile.repetitionTarget) < 1 || Number(profile.repetitionTarget) > 100) return false;
  if (profile.theme !== 'light' && profile.theme !== 'dark') return false;
  if (!Number.isSafeInteger(profile.streakDays) || Number(profile.streakDays) < 0 || Number(profile.streakDays) > 100_000) return false;
  if (typeof profile.lastActiveDate !== 'string') return false;
  if (profile.lastActiveDate !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.lastActiveDate)) return false;
    const [year, month, day] = profile.lastActiveDate.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== profile.lastActiveDate) return false;
  }
  return true;
}

function readJsonArrayArchive<T>(key: string, label: string, isValidRecord: (value: unknown) => value is T): T[] {
  const raw = getItem(key);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 10000) {
      console.warn('[WIRD Storage] ' + label + ' archive needs recovery; preserving original bytes.');
      return [];
    }
    const valid = parsed.filter(isValidRecord);
    if (valid.length < parsed.length) {
      console.warn('[WIRD Storage] ' + label + ' archive contains malformed records; filtered ' + (parsed.length - valid.length) + ' invalid records while preserving raw storage bytes.');
    }
    return valid;
  } catch {
    console.warn('[WIRD Storage] ' + label + ' archive needs recovery; preserving original bytes.');
    return [];
  }
}

function readStrictJsonArrayArchive<T>(key: string, label: string, isValidRecord: (value: unknown) => boolean): T[] {
  const raw = getItem(key);
  if (raw === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(label + ' archive is corrupt; export stopped to prevent an incomplete backup.'); }
  if (!Array.isArray(parsed) || parsed.length > 10000 || !parsed.every(isValidRecord)) {
    throw new Error(label + ' archive contains invalid records; export stopped to preserve the original data.');
  }
  return parsed;
}

function canWriteJsonArrayArchive(key: string, isValidRecord: (value: unknown) => boolean): boolean {
  const raw = getItem(key);
  if (raw === null) return true;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length <= 10000 && parsed.every(isValidRecord);
  } catch { return false; }
}

function isValidDailyLog(value: unknown): value is DailyLog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const log = value as Record<string, unknown>;
  if (typeof log.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) return false;
  const [year, month, day] = log.date.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== log.date) return false;
  if (!Number.isSafeInteger(log.memorizedAyahsCount) || Number(log.memorizedAyahsCount) < 0 || Number(log.memorizedAyahsCount) > 100_000) return false;
  if (!Number.isSafeInteger(log.reviewedPagesCount) || Number(log.reviewedPagesCount) < 0 || Number(log.reviewedPagesCount) > 100_000) return false;
  if (!Number.isSafeInteger(log.minutesSpent) || Number(log.minutesSpent) < 0 || Number(log.minutesSpent) > 1440) return false;
  if (!Array.isArray(log.completedTasks) || log.completedTasks.length > 100) return false;
  return log.completedTasks.every(task => typeof task === 'string' && task.trim().length > 0 && task.length <= 200);
}

function isValidDailyLogArray(value: unknown): value is DailyLog[] {
  return Array.isArray(value) && value.length <= 10000 && value.every(isValidDailyLog) &&
    new Set(value.map(log => log.date)).size === value.length;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (isPlainRecord(value)) {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableSerialize(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function isIntegerBetween(value: unknown, min: number, max: number): boolean {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return false;
  const num = Number(value);
  return Number.isSafeInteger(num) && num >= min && num <= max;
}

function isFiniteBetween(value: unknown, min: number, max: number): boolean {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max;
}

function isValidSurahRange(surahNumber: unknown, startAyah: unknown, endAyah: unknown): boolean {
  const sNum = Number(surahNumber);
  const sAyah = Number(startAyah);
  const eAyah = Number(endAyah);
  if (!isIntegerBetween(sNum, 1, 114) || !isIntegerBetween(sAyah, 1, 286) ||
      !isIntegerBetween(eAyah, sAyah, 286)) return false;
  const surah = ALL_SURAHS.find(item => item.number === sNum);
  return Boolean(surah && sAyah <= surah.versesCount && eAyah <= surah.versesCount);
}

function isValidOptionalPage(value: unknown): boolean {
  return value === undefined || isIntegerBetween(value, 1, 604);
}

function isValidOptionalJuz(value: unknown): boolean {
  return value === undefined || isIntegerBetween(value, 1, 30);
}

function isValidRevisionLogRecord(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 160 &&
    isValidDateOnly(value.date) &&
    ['successful', 'difficult', 'failed'].includes(value.rating) &&
    isIntegerBetween(value.intervalDaysBefore, 0, 100000) &&
    isIntegerBetween(value.intervalDaysAfter, 0, 100000) &&
    (value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= 2000));
}

function isValidLegacyRevisionLogRecord(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return (value.id === undefined || value.id === '' ||
      (typeof value.id === 'string' && value.id.length <= 160)) &&
    isValidDateOnly(value.date) &&
    ['successful', 'difficult', 'failed'].includes(value.rating) &&
    isIntegerBetween(value.intervalDaysBefore, 0, 100000) &&
    isIntegerBetween(value.intervalDaysAfter, 0, 100000) &&
    (value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= 2000));
}

function isValidMemorizationPlan(value: unknown): value is MemorizationPlan {
  if (!isPlainRecord(value)) return false;
  const validTypes = ['whole_quran', 'juz', 'surahs', 'custom'];
  const validUnits = ['ayah', 'page'];
  const validNumberArray = (items: unknown, max: number) =>
    items === undefined || (Array.isArray(items) && items.length <= max &&
      items.every(item => isIntegerBetween(item, 1, max)) && new Set(items).size === items.length);
  const maxUnits = value.unitType === 'page' ? 604 : 6236;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 160 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200 ||
      typeof value.description !== 'string' || value.description.length > 2000 ||
      !validTypes.includes(value.type) ||
      !validNumberArray(value.targetSurahs, 114) ||
      !validNumberArray(value.targetJuz, 30) ||
      !isValidOptionalPage(value.startPage) || !isValidOptionalPage(value.endPage) ||
      (value.startPage !== undefined && value.endPage !== undefined && value.startPage > value.endPage) ||
      !validUnits.includes(value.unitType) ||
      !isIntegerBetween(value.totalUnits, 1, maxUnits) ||
      !isIntegerBetween(value.completedUnits, 0, value.totalUnits) ||
      !isIntegerBetween(value.dailyTarget, 1, maxUnits) ||
      !isIntegerBetween(value.memorizationDaysPerWeek, 1, 7) ||
      !isIntegerBetween(value.revisionDaysPerWeek, 0, 7) ||
      !isValidDateOnly(value.startDate) || !isValidDateOnly(value.targetEndDate) ||
      value.targetEndDate < value.startDate ||
      typeof value.isActive !== 'boolean' ||
      (value.color !== undefined && (typeof value.color !== 'string' || value.color.length > 64))) return false;
  return true;
}

function isValidRevisionItem(value: unknown): value is RevisionItem {
  if (!isPlainRecord(value) || !isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160 &&
    typeof value.surahName === 'string' && value.surahName.trim().length > 0 && value.surahName.length <= 100 &&
    ['minor', 'major'].includes(value.type) &&
    (value.lastReviewedDate === undefined || value.lastReviewedDate === '' || isValidDateOnly(value.lastReviewedDate)) &&
    isValidDateOnly(value.nextDueDate) &&
    isValidOptionalPage(value.pageNumber) && isValidOptionalJuz(value.juzNumber) &&
    isIntegerBetween(value.intervalDays, 0, 100000) &&
    isFiniteBetween(value.easeFactor, 1.3, 3) &&
    isIntegerBetween(value.repetitionCount, 0, 100000) &&
    ['strong', 'medium', 'weak'].includes(value.strength);
}

function isValidLegacyRevisionItem(value: unknown): boolean {
  if (!isPlainRecord(value) || !isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah)) return false;
  return (value.id === undefined || (typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160)) &&
    (value.surahName === undefined || (typeof value.surahName === 'string' && value.surahName.length <= 100)) &&
    (value.type === undefined || ['minor', 'major'].includes(value.type)) &&
    (value.lastReviewedDate === undefined || value.lastReviewedDate === '' || isValidDateOnly(value.lastReviewedDate)) &&
    (value.nextDueDate === undefined || value.nextDueDate === '' || isValidDateOnly(value.nextDueDate)) &&
    isValidOptionalPage(value.pageNumber) && isValidOptionalJuz(value.juzNumber) &&
    (value.intervalDays === undefined || isIntegerBetween(value.intervalDays, 0, 100000)) &&
    (value.easeFactor === undefined || isFiniteBetween(value.easeFactor, 0, 3)) &&
    (value.repetitionCount === undefined || isIntegerBetween(value.repetitionCount, 0, 100000)) &&
    (value.strength === undefined || ['strong', 'medium', 'weak'].includes(value.strength));
}
function mergeTestResultSnapshots(existing: unknown, incoming: unknown): TestResult[] | null {
  if (!Array.isArray(existing) || !Array.isArray(incoming) ||
      existing.length > 50 || incoming.length > 50 ||
      !existing.every(isValidTestResultRecord) ||
      !incoming.every(isValidTestResultRecord)) return null;

  const byId = new Map<string, TestResult>();
  for (const item of existing as TestResult[]) byId.set(item.id, item);
  for (const item of incoming as TestResult[]) {
    const prior = byId.get(item.id);
    if (prior && stableSerialize(prior) !== stableSerialize(item)) return null;
    byId.set(item.id, item);
  }

  return [...byId.values()]
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id))
    .slice(0, 50);
}

function isValidTestResultRecord(value: unknown): value is TestResult {
  if (!isPlainRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160 &&
    isValidDateOnly(value.date) &&
    ['complete_verse', 'order_words', 'mutashabihat', 'surah_beginnings', 'random_recall', 'bidirectional_recall'].includes(value.type) &&
    typeof value.surahName === 'string' && value.surahName.trim().length > 0 && value.surahName.length <= 100 &&
    isIntegerBetween(value.totalQuestions, 1, 1000) &&
    isIntegerBetween(value.score, 0, value.totalQuestions) &&
    Array.isArray(value.weakVerses) && value.weakVerses.length <= 200 &&
    value.weakVerses.every((item: unknown) => typeof item === 'string' && item.length <= 300);
}

export function isValidWeakVerseRecord(value: unknown): value is WeakVerseItem {
  if (!isPlainRecord(value) || !isValidSurahRange(value.surahNumber, value.ayahNumber, value.ayahNumber)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 180 &&
    typeof value.surahName === 'string' && value.surahName.trim().length > 0 && value.surahName.length <= 100 &&
    typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= 4000 &&
    isIntegerBetween(value.mistakeCount, 1, 1000000) &&
    isValidDateOnly(value.lastFailedDate) &&
    (value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= 2000));
}

function isValidPortionRecord(value: unknown, requireCanonicalId = false): value is PortionStatusRecord {
  if (!isPlainRecord(value) || !isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah)) return false;
  const expectedId = 's' + value.surahNumber + '_a' + value.startAyah + '_a' + value.endAyah;
  const validStatuses = ['not_memorized', 'currently_memorizing', 'recently_memorized', 'stable', 'needs_revision', 'weak'];
  const validTypes = ['passage', 'surah', 'page'];
  const idValid = requireCanonicalId
    ? value.id === expectedId
    : value.id === undefined || (typeof value.id === 'string' && value.id.length <= 180);
  const nameValid = requireCanonicalId
    ? typeof value.surahName === 'string' && value.surahName.trim().length > 0 && value.surahName.length <= 100
    : value.surahName === undefined || value.surahName === '' ||
      (typeof value.surahName === 'string' && value.surahName.length <= 100);
  const statusValid = requireCanonicalId
    ? validStatuses.includes(value.status)
    : value.status === undefined || validStatuses.includes(value.status);
  const nextDueValid = requireCanonicalId
    ? isValidDateOnly(value.nextDueDate)
    : value.nextDueDate === undefined || value.nextDueDate === '' || isValidDateOnly(value.nextDueDate);
  const intervalValid = requireCanonicalId
    ? isIntegerBetween(value.intervalDays, 1, 100000)
    : value.intervalDays === undefined || isIntegerBetween(value.intervalDays, 0, 100000);
  const easeValid = requireCanonicalId
    ? isFiniteBetween(value.easeFactor, 1.3, 3)
    : value.easeFactor === undefined || isFiniteBetween(value.easeFactor, 0.1, 3);
  const repetitionValid = requireCanonicalId
    ? isIntegerBetween(value.repetitionCount, 0, 100000)
    : value.repetitionCount === undefined || isIntegerBetween(value.repetitionCount, 0, 100000);
  const historyValidator = requireCanonicalId ? isValidRevisionLogRecord : isValidLegacyRevisionLogRecord;
  const historyValid = value.history === undefined ||
    (Array.isArray(value.history) && value.history.length <= 10000 && value.history.every(historyValidator));
  const auditValid = value.conflictAudit === undefined ||
    (Array.isArray(value.conflictAudit) && value.conflictAudit.length <= 1000 &&
      value.conflictAudit.every((item: unknown) => isPlainRecord(item) &&
        typeof item.source === 'string' && item.source.length <= 160 &&
        typeof item.field === 'string' && item.field.length <= 160 &&
        (item.timestamp === undefined || isValidTimestamp(item.timestamp))));
  return idValid && nameValid && statusValid && nextDueValid && intervalValid && easeValid && repetitionValid &&
    (value.type === undefined ? !requireCanonicalId : validTypes.includes(value.type)) &&
    (value.lastReviewedDate === undefined || value.lastReviewedDate === '' || isValidDateOnly(value.lastReviewedDate)) &&
    (value.mistakesCount === undefined || isIntegerBetween(value.mistakesCount, 0, 100000)) &&
    isValidOptionalPage(value.pageNumber) && isValidOptionalPage(value.pageStart) && isValidOptionalPage(value.pageEnd) &&
    (value.pageStart === undefined || value.pageEnd === undefined || value.pageStart <= value.pageEnd) &&
    isValidOptionalJuz(value.juzNumber) &&
    (value.revisionType === undefined || ['minor', 'major'].includes(value.revisionType)) &&
    (value.strength === undefined || ['strong', 'medium', 'weak'].includes(value.strength)) &&
    (value.createdAt === undefined || isValidTimestamp(value.createdAt)) &&
    (value.updatedAt === undefined || isValidTimestamp(value.updatedAt)) &&
    historyValid && auditValid;
}
function readLegacyArrayForMigration<T>(
  raw: string | null,
  label: string,
  isValidRecord: (value: unknown) => boolean
): { valid: true; records: T[] } | { valid: false; error: string } {
  if (raw === null) return { valid: true, records: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return { valid: false, error: 'أرشيف ' + label + ' القديم تالف؛ تم الحفاظ على محتواه دون ترحيل.' }; }
  if (!Array.isArray(parsed) || parsed.length > 10000 || !parsed.every(isValidRecord)) {
    return { valid: false, error: 'أرشيف ' + label + ' القديم يحتوي على سجلات غير صالحة؛ تم الحفاظ عليه دون ترحيل.' };
  }
  return { valid: true, records: parsed as T[] };
}

function isValidPlanGenerationInput(value: unknown): boolean {
  if (value == null) return true;
  if (!isPlainRecord(value)) return false;
  if (value.startSurah != null && value.startAyah != null && value.endSurah != null && value.endAyah != null) {
    if (!isValidSurahRange(value.startSurah, value.startAyah, value.startAyah) ||
        !isValidSurahRange(value.endSurah, value.endAyah, value.endAyah)) return false;
    const startKey = Number(value.startSurah) * 1000 + Number(value.startAyah);
    const endKey = Number(value.endSurah) * 1000 + Number(value.endAyah);
    if (startKey > endKey) return false;
  }
  const validDays = (days: unknown, allowEmpty: boolean) =>
    days == null || (Array.isArray(days) && days.length <= 7 && (allowEmpty || days.length > 0) &&
    days.every(day => isIntegerBetween(day, 0, 6)) && new Set(days.map(Number)).size === days.length);
  const existingValid = value.existingMemorized == null ||
    (Array.isArray(value.existingMemorized) && value.existingMemorized.length <= 6236 &&
      value.existingMemorized.every((range: unknown) => isPlainRecord(range) &&
        isValidSurahRange(range.surahNumber, range.startAyah, range.endAyah)));
  return (value.title == null || typeof value.title === 'string') &&
    (value.startDate == null || isValidDateOnly(value.startDate) || isValidTimestamp(value.startDate)) &&
    (value.targetEndDate == null || value.targetEndDate === '' || isValidDateOnly(value.targetEndDate) || isValidTimestamp(value.targetEndDate)) &&
    (value.level == null || typeof value.level === 'string') &&
    (value.dailyAvailableMinutes == null || isFiniteBetween(value.dailyAvailableMinutes, 0, 1440)) &&
    (value.dailyRevisionMinutes == null || isFiniteBetween(value.dailyRevisionMinutes, 0, 1440)) &&
    (value.paceType == null || typeof value.paceType === 'string') &&
    (value.paceQuantity == null || isFiniteBetween(value.paceQuantity, 0, 6236)) &&
    validDays(value.activeDays, false) &&
    validDays(value.restDays, true) &&
    (value.schedulePreference == null || typeof value.schedulePreference === 'string') &&
    existingValid;
}

function isValidScheduledTaskUnit(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.length <= 2000;
  if (!isPlainRecord(value)) return false;
  const hasFullCoord = value.surahNumber != null && value.startAyah != null && value.endAyah != null;
  if (hasFullCoord && !isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah)) return false;
  return (value.surahName == null || typeof value.surahName === 'string') &&
    (value.versesCount == null || isIntegerBetween(value.versesCount, 0, 6236)) &&
    (value.estimatedMinutes == null || isFiniteBetween(value.estimatedMinutes, 0, 1440)) &&
    (value.completed == null || typeof value.completed === 'boolean') &&
    (value.completedAt == null || value.completedAt === '' || isValidTimestamp(value.completedAt) || isValidDateOnly(value.completedAt)) &&
    (value.userRating == null || typeof value.userRating === 'string');
}

function isValidScheduledRevisionUnit(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.length <= 2000;
  if (!isPlainRecord(value)) return false;
  if (value.description != null && typeof value.description !== 'string') return false;
  if (value.versesCount != null && !isIntegerBetween(value.versesCount, 0, 6236)) return false;
  if (value.estimatedMinutes != null && !isFiniteBetween(value.estimatedMinutes, 0, 1440)) return false;
  if (value.completed != null && typeof value.completed !== 'boolean') return false;
  if (value.type != null && typeof value.type !== 'string') return false;
  const hasFullCoord = value.surahNumber != null && value.startAyah != null && value.endAyah != null;
  if (hasFullCoord && !isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah)) return false;
  return value.surahName == null || typeof value.surahName === 'string';
}

function isValidEngineGeneratedPlan(value: unknown): value is EngineGeneratedPlan {
  if (value == null) return true;
  if (!isPlainRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 160) return false;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200) return false;
  if (Array.isArray(value.schedule) && value.schedule.some((day: unknown) =>
    isPlainRecord(day) && day.dayOfWeek != null && !isIntegerBetween(day.dayOfWeek, 0, 6)
  )) return false;
  return true;
}



export const DEMO_REVISION_ITEMS: RevisionItem[] = [
  {
    id: "rev-demo-1",
    surahNumber: 67,
    surahName: "الملك",
    startAyah: 1,
    endAyah: 15,
    pageNumber: 562,
    juzNumber: 29,
    type: "minor",
    lastReviewedDate: "2026-11-02",
    nextDueDate: getLocalDateString(),
    intervalDays: 2,
    easeFactor: 2.5,
    repetitionCount: 4,
    strength: "strong"
  },
  {
    id: "rev-demo-2",
    surahNumber: 67,
    surahName: "الملك",
    startAyah: 16,
    endAyah: 30,
    pageNumber: 563,
    juzNumber: 29,
    type: "minor",
    lastReviewedDate: "2026-11-01",
    nextDueDate: getLocalDateString(),
    intervalDays: 3,
    easeFactor: 2.2,
    repetitionCount: 3,
    strength: "medium"
  }
];

export const DEMO_LOGS: DailyLog[] = [
  { date: "2026-11-02", memorizedAyahsCount: 5, reviewedPagesCount: 2, minutesSpent: 30, completedTasks: ["حفظ سورة الملك 1-5"] },
  { date: "2026-11-03", memorizedAyahsCount: 5, reviewedPagesCount: 2, minutesSpent: 30, completedTasks: ["حفظ سورة الملك 6-10"] },
  { date: "2026-11-04", memorizedAyahsCount: 5, reviewedPagesCount: 2, minutesSpent: 25, completedTasks: ["حفظ سورة الملك 11-15"] }
];

export function buildDemoEnginePlan(): EngineGeneratedPlan {
  const plan = PlanningEngine.generatePlan({
    title: "خطة سورة الملك (بيانات تجريبية)",
    startSurah: 67,
    startAyah: 1,
    endSurah: 67,
    endAyah: 30,
    startDate: "2026-11-01",
    level: "intermediate",
    dailyAvailableMinutes: 30,
    dailyRevisionMinutes: 15,
    paceType: "verses_per_day",
    paceQuantity: 5,
    activeDays: [0, 1, 2, 3, 4, 6],
    restDays: [5],
    schedulePreference: "single_session"
  });

  if (plan.schedule[0]?.memorizationTask) {
    plan.schedule[0].memorizationTask.completed = true;
    plan.schedule[0].memorizationTask.completedAt = "2026-11-01T10:00:00Z";
    plan.schedule[0].status = 'completed';
  }

  return plan;
}

// 3. Mathematical Daily Streak Engine
export function calculateActiveStreak(lastActiveDate: string, currentStreak: number, todayStr: string): number {
  if (!lastActiveDate || currentStreak <= 0) return 0;
  if (lastActiveDate === todayStr) return currentStreak;

  const prev = new Date(lastActiveDate + 'T00:00:00Z').getTime();
  const today = new Date(todayStr + 'T00:00:00Z').getTime();
  const diffDays = Math.round((today - prev) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return currentStreak;
  } else if (diffDays > 1) {
    return 0;
  }
  return currentStreak;
}

export function advanceStreakOnCompletion(
  lastActiveDate: string,
  currentStreak: number,
  todayStr: string
): { newStreak: number; newDate: string } {
  if (lastActiveDate === todayStr) {
    return { newStreak: Math.max(1, currentStreak), newDate: todayStr };
  }

  if (!lastActiveDate) {
    return { newStreak: 1, newDate: todayStr };
  }

  const prev = new Date(lastActiveDate + 'T00:00:00Z').getTime();
  const today = new Date(todayStr + 'T00:00:00Z').getTime();
  const diffDays = Math.round((today - prev) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return { newStreak: currentStreak + 1, newDate: todayStr };
  } else {
    return { newStreak: 1, newDate: todayStr };
  }
}

// 4. Strict Backup Schema Validation
export interface BackupPayload {
  format: 'wird_backup';
  version: number;
  timestamp: string;
  isEncrypted: boolean;
  unencryptedWarning: string;
  profile?: UserProfile;
  plans?: MemorizationPlan[];
  enginePlans?: EngineGeneratedPlan[];
  revisionItems?: RevisionItem[];
  logs?: DailyLog[];
  tests?: TestResult[];
  portions?: PortionStatusRecord[];
  unifiedPortions?: WirdPortion[];
  weakVerses?: WeakVerseItem[];
  ruqyahProgress?: RuqyahProgressSnapshot;
}

export function validateBackupPayload(payload: any): { valid: boolean; error?: string } {
  if (!isPlainRecord(payload)) {
    return { valid: false, error: 'الملف لا يحتوي على كائن JSON صالح' };
  }
  if (!isIntegerBetween(payload.version, 1, 5)) {
    return { valid: false, error: 'إصدار النسخة الاحتياطية (' + payload.version + ') غير مدعوم' };
  }
  if (payload.format !== undefined && payload.format !== 'wird_backup') {
    return { valid: false, error: 'صيغة النسخة الاحتياطية غير معروفة' };
  }
  if (payload.timestamp !== undefined && !isValidTimestamp(payload.timestamp)) {
    return { valid: false, error: 'تاريخ إنشاء النسخة الاحتياطية غير صالح' };
  }
  if (payload.isEncrypted !== undefined && typeof payload.isEncrypted !== 'boolean') {
    return { valid: false, error: 'حالة تشفير النسخة الاحتياطية غير صالحة' };
  }
  if (payload.unencryptedWarning !== undefined &&
      (typeof payload.unencryptedWarning !== 'string' || payload.unencryptedWarning.length > 1000)) {
    return { valid: false, error: 'بيان تحذير النسخة الاحتياطية غير صالح' };
  }

  if (payload.ruqyahProgress !== undefined && !isValidRuqyahProgressSnapshot(payload.ruqyahProgress)) {
    return { valid: false, error: 'سجل تقدم الرقية غير صالح أو يتجاوز الحدود المسموحة' };
  }

  if (payload.profile !== undefined && !isValidUserProfile(payload.profile)) {
    return { valid: false, error: 'اسم الحافظ أو أحد حقول الملف الشخصي مفقود أو غير صالح' };
  }

  const arraySpecs: Array<{
    field: string;
    max: number;
    validate: (value: unknown) => boolean;
    label: string;
  }> = [
    { field: 'plans', max: 500, validate: isValidMemorizationPlan, label: 'خطط الحفظ' },
    { field: 'enginePlans', max: 100, validate: isValidEngineGeneratedPlan, label: 'الخطط الذكية' },
    { field: 'revisionItems', max: 10000, validate: isValidLegacyRevisionItem, label: 'عناصر المراجعة' },
    { field: 'logs', max: 10000, validate: isValidDailyLog, label: 'سجل النشاط اليومي' },
    { field: 'tests', max: 50, validate: isValidTestResultRecord, label: 'نتائج الاختبارات' },
    { field: 'portions', max: 10000, validate: value => isValidPortionRecord(value, false), label: 'المقاطع القديمة' },
    { field: 'unifiedPortions', max: 10000, validate: value => isValidPortionRecord(value, true), label: 'المقطع الموحد' },
    { field: 'weakVerses', max: 10000, validate: isValidWeakVerseRecord, label: 'الآيات المتعثرة' }
  ];

  for (const spec of arraySpecs) {
    const value = payload[spec.field];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      return { valid: false, error: 'الحقل ' + spec.field + ' يجب أن يكون مصفوفة صالحة' };
    }
    if (value.length > spec.max) {
      return { valid: false, error: 'عدد السجلات في ' + spec.label + ' يتجاوز الحد المسموح' };
    }
    for (let index = 0; index < value.length; index++) {
      if (!spec.validate(value[index])) {
        return { valid: false, error: 'السجل رقم ' + (index + 1) + ' في ' + spec.label + ' غير صالح' };
      }
    }
  }

  if (Array.isArray(payload.unifiedPortions)) {
    const portionIds = new Set<string>();
    const portionCoordinates = new Set<string>();
    for (const portion of payload.unifiedPortions as WirdPortion[]) {
      const coordinate = portion.surahNumber + ':' + portion.startAyah + ':' + portion.endAyah;
      if (portionIds.has(portion.id) || portionCoordinates.has(coordinate)) {
        return { valid: false, error: 'يحتوي أرشيف المقاطع الموحد على معرف أو نطاق قرآني مكرر' };
      }
      portionIds.add(portion.id);
      portionCoordinates.add(coordinate);
    }
  }

  if (Array.isArray(payload.logs) &&
      new Set(payload.logs.map((log: DailyLog) => log.date)).size !== payload.logs.length) {
    return { valid: false, error: 'يحتوي سجل النشاط اليومي على أكثر من سجل للتاريخ نفسه' };
  }

  if (Array.isArray(payload.weakVerses)) {
    const weakIds = new Set<string>();
    const weakCoordinates = new Set<string>();
    for (const item of payload.weakVerses as WeakVerseItem[]) {
      const coordinate = item.surahNumber + ':' + item.ayahNumber;
      if (weakIds.has(item.id) || weakCoordinates.has(coordinate)) {
        return { valid: false, error: 'يحتوي سجل الآيات المتعثرة على معرف أو موضع قرآني مكرر' };
      }
      weakIds.add(item.id);
      weakCoordinates.add(coordinate);
    }
  }

  if (payload.version >= 4 && Array.isArray(payload.unifiedPortions)) {
    if (payload.portions !== undefined &&
        JSON.stringify(payload.portions) !== JSON.stringify(payload.unifiedPortions)) {
      return { valid: false, error: 'نسخة المقاطع القديمة لا تطابق المقاطع الموحدة؛ يلزم إصلاح التعارض قبل الاستيراد.' };
    }
    if (payload.revisionItems !== undefined) {
      const expectedRevisionItems: RevisionItem[] = payload.unifiedPortions
        .filter((portion: WirdPortion) => portion.status !== 'not_memorized')
        .map((portion: WirdPortion) => ({
          id: portion.id,
          surahNumber: portion.surahNumber,
          surahName: portion.surahName,
          startAyah: portion.startAyah,
          endAyah: portion.endAyah,
          pageNumber: portion.pageNumber,
          juzNumber: portion.juzNumber,
          type: portion.revisionType || 'minor',
          lastReviewedDate: portion.lastReviewedDate,
          nextDueDate: portion.nextDueDate,
          intervalDays: portion.intervalDays,
          easeFactor: portion.easeFactor,
          repetitionCount: portion.repetitionCount,
          strength: portion.strength || (portion.status === 'weak' ? 'weak' : portion.status === 'stable' ? 'strong' : 'medium')
        }));
      if (JSON.stringify(payload.revisionItems) !== JSON.stringify(expectedRevisionItems)) {
        return { valid: false, error: 'سجل المراجعة لا يطابق المقاطع الموحدة؛ يلزم إصلاح التعارض قبل الاستيراد.' };
      }
    }
  }

  return { valid: true };
}
export const StorageService = {
  // Scope and raw-key API used by AuthGate and the retention adapter.
  needsLegacyDataDecision(scope: string): boolean {
    return needsLegacyDataDecision(scope);
  },

  setStorageScope(scope: string, legacyChoice?: 'import' | 'keep-guest'): boolean {
    return setStorageScope(scope, legacyChoice);
  },

  getStorageScope(): string {
    return activeStorageScope;
  },

  getRawItem(key: string): string | null {
    return getItem(key);
  },

  getRuqyahProgressSnapshot(): RuqyahProgressSnapshot | null {
    const raw = getItem(STORAGE_KEYS.RUQYAH_PROGRESS);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isValidRuqyahProgressSnapshot(parsed)) throw new Error('invalid');
      return parsed;
    } catch {
      throw new Error('سجل تقدم الرقية تالف؛ أوقفنا تصدير النسخة الاحتياطية لحماية بياناتك.');
    }
  },

  saveRuqyahProgressSnapshot(snapshot: unknown): boolean {
    if (!isValidRuqyahProgressSnapshot(snapshot)) return false;
    const serialized = JSON.stringify(snapshot);
    if (getItem(STORAGE_KEYS.RUQYAH_PROGRESS) === serialized) return true;
    const saved = setItem(STORAGE_KEYS.RUQYAH_PROGRESS, serialized);
    if (saved) notifyRuqyahProgressUpdated();
    return saved;
  },

  setRawItem(key: string, value: string): boolean {
    return setItem(key, value);
  },

  removeRawItem(key: string): boolean {
    return removeItem(key);
  },

  /** Verify a scoped raw value against durable localStorage without memory fallback. */
  verifyRawItem(key: string, expected: string | null): boolean {
    return verifyItem(key, expected);
  },

  /** @internal Test-only reset; never call from application UI. */
  __resetStorageForTests(): void {
    activeStorageScope = 'legacy';
    const keysToRemove = new Set<string>([
      ...Object.values(STORAGE_KEYS),
      STORAGE_OWNER_MARKER
    ]);
    try {
      if (typeof localStorage !== 'undefined') {
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key?.startsWith(`${STORAGE_SCOPE_PREFIX}:`)) keysToRemove.add(key);
        }
      }
    } catch { /* ignore */ }
    keysToRemove.forEach(key => rawRemoveItem(key));
    memoryStorage.clear();
  },


  // Profile
  getProfile(): UserProfile {
    try {
      const data = getItem(STORAGE_KEYS.PROFILE);
      if (data === null) return { ...CLEAN_INITIAL_PROFILE };
      const parsed: unknown = JSON.parse(data);
      if (!isValidUserProfile(parsed)) throw new Error('بنية الملف الشخصي غير صالحة.');
      const profile = parsed;
      const todayStr = getLocalDateString();
      const validStreak = calculateActiveStreak(profile.lastActiveDate, profile.streakDays, todayStr);
      // A getter must never mutate a domain archive. Session completion is the
      // journaled write boundary; this is only a read-time display projection.
      return validStreak === profile.streakDays ? profile : { ...profile, streakDays: validStreak };
    } catch (error) {
      console.error('[WIRD Storage] Profile archive needs recovery; preserving original bytes:', error);
      return { ...CLEAN_INITIAL_PROFILE };
    }
  },

  saveProfile(profile: UserProfile): boolean {
    if (!isValidUserProfile(profile)) return false;
    const current = getItem(STORAGE_KEYS.PROFILE);
    if (current !== null) {
      try {
        if (!isValidUserProfile(JSON.parse(current))) return false;
      } catch {
        return false;
      }
    }
    return setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },

  // Plans (Returns clean empty array by default)
  getPlans(): MemorizationPlan[] {
    return readJsonArrayArchive<MemorizationPlan>(STORAGE_KEYS.PLANS, 'Plans', isValidMemorizationPlan);
  },

  savePlans(plans: MemorizationPlan[]): boolean {
    if (!Array.isArray(plans) || plans.length > 500) {
      console.error('[WIRD Storage] savePlans rejected: invalid array or length > 500');
      return false;
    }
    const invalidIndex = plans.findIndex(p => !isValidMemorizationPlan(p));
    if (invalidIndex !== -1) {
      console.error('[WIRD Storage] savePlans rejected: record at index ' + invalidIndex + ' is invalid:', plans[invalidIndex]);
      return false;
    }
    if (!canWriteJsonArrayArchive(STORAGE_KEYS.PLANS, isValidMemorizationPlan)) {
      console.error('[WIRD Storage] savePlans rejected: existing archive contains malformed records.');
      return false;
    }
    return setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  },

  // Engine Plans
  getEnginePlans(): EngineGeneratedPlan[] {
    return readJsonArrayArchive<EngineGeneratedPlan>(STORAGE_KEYS.ENGINE_PLANS, 'Engine plans', isValidEngineGeneratedPlan);
  },

  saveEnginePlans(plans: EngineGeneratedPlan[]): boolean {
    if (!Array.isArray(plans) || plans.length > 100) {
      console.error('[WIRD Storage] saveEnginePlans rejected: invalid array or length > 100');
      return false;
    }
    const invalidIndex = plans.findIndex(p => !isValidEngineGeneratedPlan(p));
    if (invalidIndex !== -1) {
      console.error('[WIRD Storage] saveEnginePlans rejected: record at index ' + invalidIndex + ' is invalid:', plans[invalidIndex]);
      return false;
    }
    if (!canWriteJsonArrayArchive(STORAGE_KEYS.ENGINE_PLANS, isValidEngineGeneratedPlan)) {
      console.error('[WIRD Storage] saveEnginePlans rejected: existing engine plans archive contains malformed records.');
      return false;
    }
    return setItem(STORAGE_KEYS.ENGINE_PLANS, JSON.stringify(plans));
  },

  // Revision Items
  getRevisionItems(): RevisionItem[] {
    return readJsonArrayArchive<RevisionItem>(STORAGE_KEYS.REVISION, 'Revision items', isValidRevisionItem);
  },

  saveRevisionItems(items: RevisionItem[]): boolean {
    if (!Array.isArray(items) || items.length > 10000 || !items.every(isValidRevisionItem) || !canWriteJsonArrayArchive(STORAGE_KEYS.REVISION, isValidRevisionItem)) return false;
    return setItem(STORAGE_KEYS.REVISION, JSON.stringify(items));
  },

  // Unified Portions (Canonical schema v2). This getter is deliberately read-only:
  // migration is performed by AuthGate through migrateLegacyPortionsJournaled.
  getUnifiedPortions(): WirdPortion[] {
    const prepared = this.prepareDataMigration();
    return prepared.report.success && prepared.portions ? prepared.portions : [];
  },

  saveUnifiedPortions(portions: WirdPortion[], allowRecoveryOverwrite = false, allowMigrationWrite = false): boolean {
    let transactionSnapshot: Map<string, string | null> | null = null;
    const rollback = (reason: string): false => {
      const restored = transactionSnapshot ? restoreRawStorageValues(transactionSnapshot) : false;
      console.error('[WIRD Storage] Canonical portion transaction failed; previous state restored: ' + restored, reason);
      return false;
    };

    try {
      const currentSchemaVersion = getItem(STORAGE_KEYS.SCHEMA_VERSION);
      if (currentSchemaVersion !== '2' && !allowMigrationWrite) {
        const unversionedCanonical = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
        if (unversionedCanonical !== null) {
          console.error('[WIRD Storage] Refusing to overwrite an unversioned canonical portions archive.');
          return false;
        }
        const migrationState = this.prepareDataMigration();
        if (!migrationState.report.success || migrationState.needsMigration) {
          console.error('[WIRD Storage] Refusing a direct canonical write while legacy migration is pending.');
          return false;
        }
      }
      if (currentSchemaVersion === '2' && !allowRecoveryOverwrite) {
        const currentRaw = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
        if (currentRaw === null) {
          console.error('[WIRD Storage] Refusing to replace a missing canonical portions archive under schema version 2.');
          return false;
        }
        try {
          const currentParsed: unknown = JSON.parse(currentRaw);
          if (!Array.isArray(currentParsed) || !validateBackupPayload({ version: 4, unifiedPortions: currentParsed }).valid) {
            console.error('[WIRD Storage] Refusing to overwrite a damaged canonical portions archive.');
            return false;
          }
        } catch {
          console.error('[WIRD Storage] Refusing to overwrite a corrupt canonical portions archive.');
          return false;
        }
      }

      const validation = validateBackupPayload({ version: 4, unifiedPortions: portions });
      if (!validation.valid) {
        console.error('[WIRD Storage] Refusing to persist invalid canonical portions:', validation.error);
        return false;
      }

      const serialized = JSON.stringify(portions);
      const revItems: RevisionItem[] = portions
        .filter(p => p.status !== 'not_memorized')
        .map(p => ({
          id: p.id,
          surahNumber: p.surahNumber,
          surahName: p.surahName,
          startAyah: p.startAyah,
          endAyah: p.endAyah,
          pageNumber: p.pageNumber,
          juzNumber: p.juzNumber,
          type: p.revisionType || 'minor',
          lastReviewedDate: p.lastReviewedDate,
          nextDueDate: p.nextDueDate,
          intervalDays: p.intervalDays,
          easeFactor: p.easeFactor,
          repetitionCount: p.repetitionCount,
          strength: p.strength || (p.status === 'weak' ? 'weak' : p.status === 'stable' ? 'strong' : 'medium')
        }));
      const revisionSerialized = JSON.stringify(revItems);

      // Canonical data, schema version, and compatibility projections form one
      // logical mutation. Capture all previous durable bytes before the first write.
      const transactionKeys = [
        STORAGE_KEYS.UNIFIED_PORTIONS,
        STORAGE_KEYS.SCHEMA_VERSION,
        STORAGE_KEYS.PORTIONS,
        STORAGE_KEYS.REVISION
      ].map(key => resolveStorageKey(key));
      const snapshot = new Map<string, string | null>();
      for (const key of transactionKeys) {
        const value = readRawStorageValue(key);
        if (value === undefined) {
          console.error('[WIRD Storage] Canonical portion transaction stopped because a complete durable snapshot was unavailable.');
          return false;
        }
        snapshot.set(key, value);
      }
      transactionSnapshot = snapshot;

      const canonicalKey = resolveStorageKey(STORAGE_KEYS.UNIFIED_PORTIONS);
      if (!setItem(STORAGE_KEYS.UNIFIED_PORTIONS, serialized) ||
          readRawStorageValue(canonicalKey) !== serialized) {
        return rollback('Canonical portions archive write/read-back failed.');
      }

      const readback = readRawStorageValue(canonicalKey);
      let parsed: unknown;
      try { parsed = readback === undefined || readback === null ? null : JSON.parse(readback); }
      catch { return rollback('Canonical portions archive read-back was corrupt.'); }
      if (!Array.isArray(parsed) || JSON.stringify(parsed) !== serialized) {
        return rollback('Canonical portions archive content mismatch on read-back.');
      }

      const schemaKey = resolveStorageKey(STORAGE_KEYS.SCHEMA_VERSION);
      if (!setItem(STORAGE_KEYS.SCHEMA_VERSION, '2') || readRawStorageValue(schemaKey) !== '2') {
        return rollback('Schema-version commit failed.');
      }

      const legacyPortionsKey = resolveStorageKey(STORAGE_KEYS.PORTIONS);
      if (!setItem(STORAGE_KEYS.PORTIONS, serialized) || readRawStorageValue(legacyPortionsKey) !== serialized) {
        return rollback('Legacy portions compatibility projection failed.');
      }

      const legacyRevisionKey = resolveStorageKey(STORAGE_KEYS.REVISION);
      if (!setItem(STORAGE_KEYS.REVISION, revisionSerialized) || readRawStorageValue(legacyRevisionKey) !== revisionSerialized) {
        return rollback('Legacy revision compatibility projection failed.');
      }

      return true;
    } catch (e) {
      if (transactionSnapshot) return rollback(e instanceof Error ? e.message : 'Unexpected storage error.');
      console.error('[WIRD Storage] saveUnifiedPortions preflight failed', e);
      return false;
    }
  },
  prepareDataMigration(): PreparedDataMigration {
    const failure = (error: string): PreparedDataMigration => ({
      report: {
        success: false, legacyPortionsCount: 0, legacyRevisionCount: 0,
        migratedPortionsCount: 0, totalPreservedLogsCount: 0,
        conflictAuditCount: 0, alreadyMigrated: false, error
      },
      portions: null,
      needsMigration: false,
      allowRecoveryOverwrite: false
    });
    try {
      const currentVersion = readRawStorageValue(resolveStorageKey(STORAGE_KEYS.SCHEMA_VERSION));
      const unifiedData = readRawStorageValue(resolveStorageKey(STORAGE_KEYS.UNIFIED_PORTIONS));
      if (currentVersion === undefined || unifiedData === undefined) {
        return failure('تعذرت قراءة أرشيف المقاطع الموحد بشكل موثوق؛ لم يتم تنفيذ الترحيل.');
      }
      const hasInvalidCanonicalPayload = currentVersion === '2';
      if (currentVersion !== '2' && unifiedData !== null) {
        return failure('يوجد أرشيف موحد دون علامة إصدار موثوقة؛ تم الحفاظ على بايتاته ومنع الترحيل أو الاستبدال التلقائي.');
      }

      if (currentVersion === '2' && unifiedData) {
        try {
          const parsed: unknown = JSON.parse(unifiedData);
          if (Array.isArray(parsed) && validateBackupPayload({ version: 4, unifiedPortions: parsed }).valid) {
            return {
              report: {
                success: true, legacyPortionsCount: 0, legacyRevisionCount: 0,
                migratedPortionsCount: parsed.length, totalPreservedLogsCount: 0,
                conflictAuditCount: 0, alreadyMigrated: true
              },
              portions: parsed as WirdPortion[],
              needsMigration: false,
              allowRecoveryOverwrite: false
            };
          }
        } catch {
          // Keep the canonical bytes intact; validated legacy recovery is prepared below.
        }
      }

      const legacyPortionsRaw = readRawStorageValue(resolveStorageKey(STORAGE_KEYS.PORTIONS));
      const legacyRevsRaw = readRawStorageValue(resolveStorageKey(STORAGE_KEYS.REVISION));
      if (legacyPortionsRaw === undefined || legacyRevsRaw === undefined) {
        return failure('تعذرت قراءة الأرشيف القديم بشكل موثوق؛ لم يتم تنفيذ الترحيل.');
      }
      if (!hasInvalidCanonicalPayload && legacyPortionsRaw === null && legacyRevsRaw === null) {
        return {
          report: {
            success: true, legacyPortionsCount: 0, legacyRevisionCount: 0,
            migratedPortionsCount: 0, totalPreservedLogsCount: 0,
            conflictAuditCount: 0, alreadyMigrated: true
          },
          portions: [],
          needsMigration: false,
          allowRecoveryOverwrite: false
        };
      }

      const portionsRead = readLegacyArrayForMigration<PortionStatusRecord>(
        legacyPortionsRaw, 'المقاطع', value => isValidPortionRecord(value, false)
      );
      const revisionsRead = readLegacyArrayForMigration<RevisionItem>(
        legacyRevsRaw, 'المراجعة', isValidLegacyRevisionItem
      );
      if (!portionsRead.valid || !revisionsRead.valid) {
        return failure(!portionsRead.valid
          ? portionsRead.error
          : revisionsRead.valid ? 'تعذر التحقق من أرشيف المراجعة القديم.' : revisionsRead.error);
      }

      const legacyPortions = portionsRead.records;
      const legacyRevs = revisionsRead.records;
      if (hasInvalidCanonicalPayload && legacyPortions.length === 0 && legacyRevs.length === 0) {
        return failure('البيانات الموحدة غير صالحة ولا توجد سجلات قديمة غير فارغة للاستعادة؛ تم الحفاظ على النسخة الحالية دون استبدالها.');
      }

      const migrated = migrateLegacyDataLosslessly(legacyPortions, legacyRevs);
      if (!migrated.report.success) {
        return {
          report: migrated.report,
          portions: null,
          needsMigration: false,
          allowRecoveryOverwrite: false
        };
      }
      return {
        report: migrated.report,
        portions: migrated.portions,
        needsMigration: true,
        allowRecoveryOverwrite: hasInvalidCanonicalPayload
      };
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Migration preparation failed.');
    }
  },

  // Logs (Returns clean empty array by default)
  getLogs(): DailyLog[] {
    const data = getItem(STORAGE_KEYS.LOGS);
    if (data === null) return [];
    let parsed: unknown;
    try { parsed = JSON.parse(data); }
    catch { throw new Error('سجل النشاط اليومي تالف؛ تم الحفاظ عليه دون استبدال.'); }
    if (!isValidDailyLogArray(parsed)) {
      throw new Error('بنية سجل النشاط اليومي غير صالحة؛ تم إيقاف التعديل لحماية بياناتك.');
    }
    return parsed;
  },

  /** Safe read-only projection for screens; write paths must continue to use strict getLogs(). */
  getLogsForDisplay(): DailyLog[] {
    try { return this.getLogs(); }
    catch (error) {
      console.error('[WIRD Storage] Daily activity archive needs recovery; preserving original bytes:', error);
      return [];
    }
  },

  saveLogs(logs: DailyLog[]): boolean {
    if (!isValidDailyLogArray(logs)) return false;
    const current = getItem(STORAGE_KEYS.LOGS);
    if (current !== null) {
      try {
        const parsed: unknown = JSON.parse(current);
        if (!isValidDailyLogArray(parsed)) return false;
      } catch {
        return false;
      }
    }
    return setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  },

  // Tests
  getTests(): TestResult[] {
    return readJsonArrayArchive<TestResult>(STORAGE_KEYS.TESTS, 'Test results', isValidTestResultRecord);
  },

  saveTest(test: TestResult): boolean {
    if (!isValidTestResultRecord(test) || !canWriteJsonArrayArchive(STORAGE_KEYS.TESTS, isValidTestResultRecord)) return false;
    try {
      const current = readStrictJsonArrayArchive<TestResult>(STORAGE_KEYS.TESTS, 'Test results', isValidTestResultRecord);
      current.unshift(test);
      return setItem(STORAGE_KEYS.TESTS, JSON.stringify(current.slice(0, 50)));
    } catch (e) {
      console.warn("Storage write failed", e);
      return false;
    }
  },

  /** Replace the complete test-result snapshot during deterministic journal replay. */
  saveTests(tests: TestResult[]): boolean {
    if (!Array.isArray(tests) || tests.length > 50 ||
        !tests.every(isValidTestResultRecord) ||
        !canWriteJsonArrayArchive(STORAGE_KEYS.TESTS, isValidTestResultRecord)) return false;
    return setItem(STORAGE_KEYS.TESTS, JSON.stringify(tests));
  },

  /** Replace the complete weak-verse snapshot after duplicate-coordinate validation. */
  saveWeakVerses(items: WeakVerseItem[]): boolean {
    if (!Array.isArray(items) || items.length > 10000 ||
        !items.every(isValidWeakVerseRecord) ||
        !validateBackupPayload({ version: 4, weakVerses: items }).valid ||
        !canWriteJsonArrayArchive(STORAGE_KEYS.WEAK_VERSES, isValidWeakVerseRecord)) return false;
    return setItem(STORAGE_KEYS.WEAK_VERSES, JSON.stringify(items));
  },

  /** Capture the exact local storage bytes relevant to a blocked remote projection. */
  getLocalProjectionSnapshot(collection: SyncCollection): Record<string, string | null> {
    const keysByCollection: Record<SyncCollection, string[]> = {
      profile: [STORAGE_KEYS.PROFILE],
      plans: [STORAGE_KEYS.PLANS],
      enginePlans: [STORAGE_KEYS.ENGINE_PLANS],
      portions: [STORAGE_KEYS.UNIFIED_PORTIONS, STORAGE_KEYS.PORTIONS, STORAGE_KEYS.REVISION],
      weakVerses: [STORAGE_KEYS.WEAK_VERSES],
      tests: [STORAGE_KEYS.TESTS],
      activityEvents: [STORAGE_KEYS.LOGS],
      ruqyahProgress: [STORAGE_KEYS.RUQYAH_PROGRESS],
      syncMeta: [
        STORAGE_KEYS.PROFILE, STORAGE_KEYS.PLANS, STORAGE_KEYS.ENGINE_PLANS,
        STORAGE_KEYS.UNIFIED_PORTIONS, STORAGE_KEYS.PORTIONS, STORAGE_KEYS.REVISION,
        STORAGE_KEYS.WEAK_VERSES, STORAGE_KEYS.TESTS, STORAGE_KEYS.LOGS, STORAGE_KEYS.RUQYAH_PROGRESS
      ]
    };
    const snapshot: Record<string, string | null> = {};
    for (const key of keysByCollection[collection] || []) snapshot[key] = getItem(key);
    return snapshot;
  },

  /**
   * Conservative first-sync guard. If local data exists, remote projection must
   * prove a matching base revision instead of replacing an unknown local archive.
   */
  isLocalProjectionEmpty(collection: SyncCollection): boolean {
    const emptyArrayArchive = (key: string): boolean => {
      const raw = getItem(key);
      if (raw === null) return true;
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length === 0;
      } catch {
        return false;
      }
    };
    switch (collection) {
      case 'profile':
        return getItem(STORAGE_KEYS.PROFILE) === null;
      case 'plans':
        return emptyArrayArchive(STORAGE_KEYS.PLANS);
      case 'enginePlans':
        return emptyArrayArchive(STORAGE_KEYS.ENGINE_PLANS);
      case 'portions':
        return [STORAGE_KEYS.UNIFIED_PORTIONS, STORAGE_KEYS.PORTIONS, STORAGE_KEYS.REVISION]
          .every(emptyArrayArchive);
      case 'weakVerses':
        return emptyArrayArchive(STORAGE_KEYS.WEAK_VERSES);
      case 'tests':
        return emptyArrayArchive(STORAGE_KEYS.TESTS);
      case 'activityEvents':
        return emptyArrayArchive(STORAGE_KEYS.LOGS);
      case 'ruqyahProgress': {
        const raw = getItem(STORAGE_KEYS.RUQYAH_PROGRESS);
        if (raw === null) return true;
        try {
          const parsed: unknown = JSON.parse(raw);
          return isValidRuqyahProgressSnapshot(parsed) && Object.keys(parsed.counts).length === 0;
        } catch { return false; }
      }
      case 'syncMeta':
        return getItem(STORAGE_KEYS.PROFILE) === null &&
          [STORAGE_KEYS.PLANS, STORAGE_KEYS.ENGINE_PLANS, STORAGE_KEYS.UNIFIED_PORTIONS,
            STORAGE_KEYS.PORTIONS, STORAGE_KEYS.REVISION, STORAGE_KEYS.WEAK_VERSES,
            STORAGE_KEYS.TESTS, STORAGE_KEYS.LOGS].every(emptyArrayArchive) &&
          this.isLocalProjectionEmpty('ruqyahProgress');
      default:
        return false;
    }
  },

  /**
   * Apply one validated full-snapshot event to the local projection. The caller
   * advances the journal cursor only after this method confirms the durable write.
   * Tombstones are intentionally rejected until collection-specific delete semantics exist.
   */
  applyJournalProjection(
    collection: Exclude<SyncCollection, 'syncMeta'>,
    payload: Record<string, unknown>
  ): boolean {
    if (!isPlainRecord(payload)) return false;
    switch (collection) {
      case 'profile':
        return isValidUserProfile(payload.profile) && this.saveProfile(payload.profile);
      case 'plans':
        return Array.isArray(payload.records) && this.savePlans(payload.records as MemorizationPlan[]);
      case 'enginePlans':
        return Array.isArray(payload.records) && this.saveEnginePlans(payload.records as EngineGeneratedPlan[]);
      case 'portions':
        return Array.isArray(payload.records) && this.saveUnifiedPortions(payload.records as WirdPortion[], payload.recoveryFromLegacy === true, payload.migration === true || payload.validatedImport === true);
      case 'weakVerses':
        return Array.isArray(payload.records) && this.saveWeakVerses(payload.records as WeakVerseItem[]);
      case 'tests': {
        if (!Array.isArray(payload.records)) return false;
        const current = this.getTests();
        const merged = mergeTestResultSnapshots(current, payload.records);
        return merged !== null && this.saveTests(merged);
      }
      case 'activityEvents':
        return Array.isArray(payload.records) && this.saveLogs(payload.records as DailyLog[]);
      case 'ruqyahProgress':
        return isValidRuqyahProgressSnapshot(payload.snapshot) && this.saveRuqyahProgressSnapshot(payload.snapshot);
      default:
        return false;
    }
  },

  /**
   * Read-only recovery check for a remote snapshot that may have been applied
   * just before an IndexedDB transaction was interrupted. This lets the
   * journal distinguish an already-applied chosen snapshot from a new local
   * edit before retrying the durable cursor commit.
   */
  matchesJournalProjection(
    collection: SyncCollection,
    payload: Record<string, unknown>
  ): boolean {
    if (!isPlainRecord(payload)) return false;
    const equals = (actual: unknown, expected: unknown) =>
      stableSerialize(actual) === stableSerialize(expected);
    try {
      if (collection === 'syncMeta') {
        if (!isPlainRecord(payload.transaction) || payload.transaction.version !== 1 ||
            !Array.isArray(payload.transaction.operations) ||
            payload.transaction.operations.length < 1 ||
            payload.transaction.operations.length > 8) return false;
        return payload.transaction.operations.every(operation =>
          isPlainRecord(operation) &&
          typeof operation.collection === 'string' &&
          operation.collection !== 'syncMeta' &&
          isPlainRecord(operation.payload) &&
          this.matchesJournalProjection(
            operation.collection as Exclude<SyncCollection, 'syncMeta'>,
            operation.payload
          )
        );
      }
      switch (collection) {
        case 'profile': {
          if (!isValidUserProfile(payload.profile)) return false;
          const raw = getItem(STORAGE_KEYS.PROFILE);
          if (raw === null) return false;
          const current: unknown = JSON.parse(raw);
          return isValidUserProfile(current) && equals(current, payload.profile);
        }
        case 'plans': {
          if (!Array.isArray(payload.records)) return false;
          const raw = getItem(STORAGE_KEYS.PLANS);
          const current: unknown = raw === null ? [] : JSON.parse(raw);
          return Array.isArray(current) && current.length <= 500 &&
            current.every(isValidMemorizationPlan) && equals(current, payload.records);
        }
        case 'enginePlans': {
          if (!Array.isArray(payload.records)) return false;
          const raw = getItem(STORAGE_KEYS.ENGINE_PLANS);
          const current: unknown = raw === null ? [] : JSON.parse(raw);
          return Array.isArray(current) && current.length <= 100 &&
            current.every(isValidEngineGeneratedPlan) && equals(current, payload.records);
        }
        case 'portions': {
          if (!Array.isArray(payload.records)) return false;
          const prepared = this.prepareDataMigration();
          return prepared.report.success && Array.isArray(prepared.portions) &&
            equals(prepared.portions, payload.records);
        }
        case 'weakVerses': {
          if (!Array.isArray(payload.records)) return false;
          const raw = getItem(STORAGE_KEYS.WEAK_VERSES);
          const current: unknown = raw === null ? [] : JSON.parse(raw);
          return Array.isArray(current) && current.length <= 10000 &&
            current.every(isValidWeakVerseRecord) && equals(current, payload.records);
        }
        case 'tests': {
          if (!Array.isArray(payload.records)) return false;
          const raw = getItem(STORAGE_KEYS.TESTS);
          const current: unknown = raw === null ? [] : JSON.parse(raw);
          const merged = mergeTestResultSnapshots(current, payload.records);
          return merged !== null && equals(current, merged);
        }
        case 'activityEvents': {
          if (!Array.isArray(payload.records)) return false;
          const raw = getItem(STORAGE_KEYS.LOGS);
          const current: unknown = raw === null ? [] : JSON.parse(raw);
          return isValidDailyLogArray(current) && equals(current, payload.records);
        }
        case 'ruqyahProgress': {
          if (!isValidRuqyahProgressSnapshot(payload.snapshot)) return false;
          const raw = getItem(STORAGE_KEYS.RUQYAH_PROGRESS);
          const current: unknown = raw === null ? null : JSON.parse(raw);
          return isValidRuqyahProgressSnapshot(current) && equals(current, payload.snapshot);
        }
        default:
          return false;
      }
    } catch {
      return false;
    }
  },

  applyJournalEvent(event: JournalEvent): boolean {
    if (!isPlainRecord(event) || event.eventType !== 'domain-mutation' || event.schemaVersion !== 1 ||
        !Number.isSafeInteger(event.sequence) || event.sequence < 1 ||
        event.operation !== 'upsert' || !isPlainRecord(event.payload)) return false;
    const scope = this.getStorageScope();
    const uid = scope.startsWith('user:') ? scope.slice('user:'.length) : '';
    if (!uid || event.uid !== uid) return false;

    if (event.collection === 'syncMeta') {
      const payload = event.payload;
      if (payload.transaction === undefined) return true;
      if (!isPlainRecord(payload.transaction) || payload.transaction.version !== 1 ||
          !Array.isArray(payload.transaction.operations)) return false;
      return this.applyJournalTransaction(payload.transaction.operations);
    }
    return this.applyJournalProjection(event.collection, event.payload);
  },

  /**
   * Apply several projections as one logical local transaction. All affected
   * durable keys are snapshotted before the first write; any failed projection
   * restores and verifies the complete pre-transaction byte set. This method
   * also supports guest/no-IndexedDB local-only operations.
   */
  applyJournalTransaction(operations: unknown): boolean {
    if (!Array.isArray(operations) || operations.length < 1 || operations.length > 8) return false;

    const keysByCollection: Record<string, string[]> = {
      profile: [STORAGE_KEYS.PROFILE],
      plans: [STORAGE_KEYS.PLANS],
      enginePlans: [STORAGE_KEYS.ENGINE_PLANS],
      portions: [
        STORAGE_KEYS.UNIFIED_PORTIONS,
        STORAGE_KEYS.SCHEMA_VERSION,
        STORAGE_KEYS.PORTIONS,
        STORAGE_KEYS.REVISION
      ],
      weakVerses: [STORAGE_KEYS.WEAK_VERSES],
      tests: [STORAGE_KEYS.TESTS],
      activityEvents: [STORAGE_KEYS.LOGS],
      ruqyahProgress: [STORAGE_KEYS.RUQYAH_PROGRESS]
    };
    const seenCollections = new Set<string>();
    const snapshotKeys = new Set<string>();

    for (const operation of operations) {
      if (!isPlainRecord(operation) ||
          typeof operation.collection !== 'string' ||
          !Object.prototype.hasOwnProperty.call(keysByCollection, operation.collection) ||
          operation.operation !== 'upsert' ||
          typeof operation.documentId !== 'string' ||
          operation.documentId.length < 1 || operation.documentId.length > 128 ||
          /[\u0000-\u001F]/.test(operation.documentId) ||
          !isPlainRecord(operation.payload) ||
          seenCollections.has(operation.collection)) return false;
      seenCollections.add(operation.collection);
      for (const key of keysByCollection[operation.collection]) snapshotKeys.add(resolveStorageKey(key));
    }

    const snapshot = new Map<string, string | null>();
    for (const key of snapshotKeys) {
      const value = readRawStorageValue(key);
      if (value === undefined) {
        console.error('[WIRD Storage] Grouped journal transaction stopped because a complete durable snapshot was unavailable.');
        return false;
      }
      snapshot.set(key, value);
    }

    const rollback = (reason: string): false => {
      const restored = restoreRawStorageValues(snapshot);
      console.error('[WIRD Storage] Grouped journal transaction failed; complete previous state restored: ' + restored, reason);
      return false;
    };

    try {
      for (const operation of operations as JournalProjectionOperation[]) {
        if (!this.applyJournalProjection(operation.collection, operation.payload)) {
          return rollback('A child projection rejected the grouped transaction.');
        }
      }
      return true;
    } catch (error) {
      return rollback(error instanceof Error ? error.message : 'Unknown grouped projection error.');
    }
  },

  /**
   * Prepare the activity-log and profile projections for a session/revision
   * without writing. Journal-first callers commit both snapshots together.
   */
  buildSessionCompletionSnapshot(
    memorizedAyahs: number,
    reviewedPages: number,
    minutes: number,
    taskName: string
  ):
    | { success: true; logs: DailyLog[]; profile: UserProfile }
    | { success: false; error: string } {
    if (!Number.isSafeInteger(memorizedAyahs) || memorizedAyahs < 0 || memorizedAyahs > 6236 ||
        !Number.isSafeInteger(reviewedPages) || reviewedPages < 0 || reviewedPages > 604 ||
        !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440 ||
        typeof taskName !== 'string' || !taskName.trim() || taskName.length > 200) {
      return { success: false, error: 'بيانات جلسة الحفظ أو المراجعة غير صالحة؛ لم يتم إعداد أي تغيير.' };
    }

    const logsRaw = getItem(STORAGE_KEYS.LOGS);
    const profileRaw = getItem(STORAGE_KEYS.PROFILE);
    if (!verifyItem(STORAGE_KEYS.LOGS, logsRaw) || !verifyItem(STORAGE_KEYS.PROFILE, profileRaw)) {
      return { success: false, error: 'تعذر التحقق من القراءة الدائمة لسجل النشاط والملف الشخصي؛ لم يتم إعداد التغيير.' };
    }

    let logs: DailyLog[];
    let profile: UserProfile;
    try {
      logs = this.getLogs().map(log => ({ ...log, completedTasks: [...log.completedTasks] }));
      if (profileRaw === null) {
        profile = { ...CLEAN_INITIAL_PROFILE };
      } else {
        const parsed: unknown = JSON.parse(profileRaw);
        if (!isValidUserProfile(parsed)) throw new Error('بنية الملف الشخصي غير صالحة.');
        profile = { ...parsed };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'تعذر قراءة سجل النشاط أو الملف الشخصي؛ تم الحفاظ على البيانات الأصلية.'
      };
    }

    const today = getLocalDateString();
    const existingIndex = logs.findIndex(log => log.date === today);
    if (existingIndex >= 0) {
      logs[existingIndex] = {
        ...logs[existingIndex],
        memorizedAyahsCount: logs[existingIndex].memorizedAyahsCount + memorizedAyahs,
        reviewedPagesCount: logs[existingIndex].reviewedPagesCount + reviewedPages,
        minutesSpent: logs[existingIndex].minutesSpent + minutes,
        completedTasks: logs[existingIndex].completedTasks.includes(taskName)
          ? [...logs[existingIndex].completedTasks]
          : [...logs[existingIndex].completedTasks, taskName]
      };
    } else {
      logs.push({
        date: today,
        memorizedAyahsCount: memorizedAyahs,
        reviewedPagesCount: reviewedPages,
        minutesSpent: minutes,
        completedTasks: [taskName]
      });
    }

    if (!isValidDailyLogArray(logs)) {
      return { success: false, error: 'نتيجة تجميع النشاط اليومي تجاوزت الحدود أو تحتوي على بيانات غير صالحة؛ لم يتم تعديل السجل.' };
    }

    const { newStreak, newDate } = advanceStreakOnCompletion(profile.lastActiveDate, profile.streakDays, today);
    const updatedProfile: UserProfile = {
      ...profile,
      streakDays: newStreak,
      lastActiveDate: newDate
    };
    if (!isValidUserProfile(updatedProfile)) {
      return { success: false, error: 'نتيجة تحديث سلسلة النشاط غير صالحة؛ لم يتم تعديل الملف الشخصي.' };
    }

    return { success: true, logs, profile: updatedProfile };
  },

  // Detailed result lets callers report when a multi-key rollback could not be verified.
  recordSessionCompletionDetailed(
    memorizedAyahs: number,
    reviewedPages: number,
    minutes: number,
    taskName: string
  ): { success: boolean; rollbackVerified: boolean } {
    if (!Number.isSafeInteger(memorizedAyahs) || memorizedAyahs < 0 || memorizedAyahs > 6236 ||
        !Number.isSafeInteger(reviewedPages) || reviewedPages < 0 || reviewedPages > 604 ||
        !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440 ||
        typeof taskName !== 'string' || !taskName.trim() || taskName.length > 200) {
      return { success: false, rollbackVerified: true };
    }

    const today = getLocalDateString();
    const previousLogs = getItem(STORAGE_KEYS.LOGS);
    const previousProfile = getItem(STORAGE_KEYS.PROFILE);
    const restorePreviousSnapshot = (): boolean => {
      const restoreKey = (key: string, previous: string | null): boolean => {
        try {
          if (previous === null) removeItem(key);
          else setItem(key, previous);
          return verifyItem(key, previous);
        } catch {
          return false;
        }
      };
      const logsRestored = restoreKey(STORAGE_KEYS.LOGS, previousLogs);
      const profileRestored = restoreKey(STORAGE_KEYS.PROFILE, previousProfile);
      if (!logsRestored || !profileRestored) {
        console.error('[WIRD Storage] Session activity rollback could not be verified. Export a backup before further edits.');
      }
      return logsRestored && profileRestored;
    };

    let logs: DailyLog[];
    try {
      logs = this.getLogs();
    } catch (error) {
      console.warn('[WIRD Storage] Refusing to overwrite an invalid daily activity archive:', error);
      return { success: false, rollbackVerified: true };
    }
    const existingIndex = logs.findIndex(log => log.date === today);

    if (existingIndex >= 0) {
      logs[existingIndex].memorizedAyahsCount += memorizedAyahs;
      logs[existingIndex].reviewedPagesCount += reviewedPages;
      logs[existingIndex].minutesSpent += minutes;
      if (!logs[existingIndex].completedTasks.includes(taskName)) {
        logs[existingIndex].completedTasks.push(taskName);
      }
    } else {
      logs.push({
        date: today,
        memorizedAyahsCount: memorizedAyahs,
        reviewedPagesCount: reviewedPages,
        minutesSpent: minutes,
        completedTasks: [taskName]
      });
    }

    if (!this.saveLogs(logs)) {
      return { success: false, rollbackVerified: restorePreviousSnapshot() };
    }

    const profile = this.getProfile();
    const { newStreak, newDate } = advanceStreakOnCompletion(profile.lastActiveDate, profile.streakDays, today);
    profile.streakDays = newStreak;
    profile.lastActiveDate = newDate;
    if (!this.saveProfile(profile)) {
      return { success: false, rollbackVerified: restorePreviousSnapshot() };
    }

    return { success: true, rollbackVerified: true };
  },

  // Backward-compatible boolean API for callers that do not need rollback detail.
  recordSessionCompletion(memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string): boolean {
    return this.recordSessionCompletionDetailed(memorizedAyahs, reviewedPages, minutes, taskName).success;
  },

  // Export with Unencrypted Warning Label
  exportFullBackup(): string {
    try {
      // A backup must reflect durable browser storage, not a partial in-memory fallback.
      this.getStorageSnapshot();
    } catch (error) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: لم يمكن التحقق من قراءة التخزين الدائم بالكامل؛ أُوقف التصدير لمنع إنشاء نسخة ناقصة. ' +
        (error instanceof Error ? error.message : 'خطأ غير معروف في التخزين.'));
    }
    const profileRaw = getItem(STORAGE_KEYS.PROFILE);
    let profile: UserProfile;
    if (profileRaw === null) {
      profile = { ...CLEAN_INITIAL_PROFILE };
    } else {
      try {
        const parsed: unknown = JSON.parse(profileRaw);
        if (!isValidUserProfile(parsed)) throw new Error('الملف الشخصي يحتوي على سجل غير صالح.');
        profile = parsed;
      } catch {
        throw new Error('تعذر تصدير النسخة الاحتياطية: بيانات الملف الشخصي تالفة أو غير صالحة. تم الحفاظ على البيانات الأصلية.');
      }
    }

    const plans = readStrictJsonArrayArchive<MemorizationPlan>(STORAGE_KEYS.PLANS, 'Plans', isValidMemorizationPlan);
    const enginePlans = readStrictJsonArrayArchive<EngineGeneratedPlan>(STORAGE_KEYS.ENGINE_PLANS, 'Engine plans', isValidEngineGeneratedPlan);
    const logs = readStrictJsonArrayArchive<DailyLog>(STORAGE_KEYS.LOGS, 'Daily logs', isValidDailyLog);
    if (new Set(logs.map(log => log.date)).size !== logs.length) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: يحتوي سجل النشاط اليومي على تواريخ مكررة.');
    }
    const tests = readStrictJsonArrayArchive<TestResult>(STORAGE_KEYS.TESTS, 'Test results', isValidTestResultRecord);

    const canonicalPortions = this.getUnifiedPortions();
    const canonicalRaw = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
    const schemaVersion = getItem(STORAGE_KEYS.SCHEMA_VERSION);
    const legacyPortionsRaw = getItem(STORAGE_KEYS.PORTIONS);
    const legacyRevisionRaw = getItem(STORAGE_KEYS.REVISION);

    if (schemaVersion !== '2' && (legacyPortionsRaw !== null || legacyRevisionRaw !== null)) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: توجد سجلات قديمة لم يكتمل ترحيلها؛ تم إيقاف التصدير لمنع إنشاء نسخة ناقصة.');
    }
    if (schemaVersion === '2' && canonicalRaw === null) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: سجل المقاطع الموحد مفقود رغم إعلان الإصدار الثاني؛ لم يتم إنشاء نسخة ناقصة.');
    }
    if (schemaVersion !== '2' && canonicalRaw !== null) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: يوجد سجل موحد دون علامة إصدار متوافقة؛ يلزم فحص التخزين قبل التصدير.');
    }
    if (canonicalRaw !== null) {
      let parsedCanonical: unknown;
      try { parsedCanonical = JSON.parse(canonicalRaw); }
      catch { throw new Error('تعذر تصدير النسخة الاحتياطية: سجل المقاطع الموحد تالف وتم الحفاظ عليه.'); }
      if (!Array.isArray(parsedCanonical) || parsedCanonical.length > 10000 ||
          !parsedCanonical.every((item: unknown) => isValidPortionRecord(item, true)) ||
          JSON.stringify(parsedCanonical) !== JSON.stringify(canonicalPortions)) {
        throw new Error('تعذر تصدير النسخة الاحتياطية: سجل المقاطع الموحد يحتوي على بيانات غير صالحة أو تعذر قراءته بالكامل.');
      }
    }

    const storedLegacyPortions = readStrictJsonArrayArchive<PortionStatusRecord>(
      STORAGE_KEYS.PORTIONS, 'Legacy portions', value => isValidPortionRecord(value, false)
    );
    const storedLegacyRevisions = readStrictJsonArrayArchive<RevisionItem>(
      STORAGE_KEYS.REVISION, 'Revision items', isValidLegacyRevisionItem
    );
    const projectedLegacyRevisions: RevisionItem[] = canonicalPortions
      .filter(portion => portion.status !== 'not_memorized')
      .map(portion => ({
        id: portion.id,
        surahNumber: portion.surahNumber,
        surahName: portion.surahName,
        startAyah: portion.startAyah,
        endAyah: portion.endAyah,
        pageNumber: portion.pageNumber,
        juzNumber: portion.juzNumber,
        type: portion.revisionType || 'minor',
        lastReviewedDate: portion.lastReviewedDate,
        nextDueDate: portion.nextDueDate,
        intervalDays: portion.intervalDays,
        easeFactor: portion.easeFactor,
        repetitionCount: portion.repetitionCount,
        strength: portion.strength || (portion.status === 'weak' ? 'weak' : portion.status === 'stable' ? 'strong' : 'medium')
      }));
    if (schemaVersion === '2' && storedLegacyPortions.length > 0 &&
        JSON.stringify(storedLegacyPortions) !== JSON.stringify(canonicalPortions)) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: نسخة المقاطع القديمة لا تطابق السجل الموحد؛ يلزم فحص التعارض قبل التصدير.');
    }
    if (schemaVersion === '2' && storedLegacyRevisions.length > 0 &&
        JSON.stringify(storedLegacyRevisions) !== JSON.stringify(projectedLegacyRevisions)) {
      throw new Error('تعذر تصدير النسخة الاحتياطية: نسخة المراجعة القديمة لا تطابق السجل الموحد؛ يلزم فحص التعارض قبل التصدير.');
    }

    const revisionItems = schemaVersion === '2' ? projectedLegacyRevisions : [];
    const portions = canonicalPortions;

    const weakRaw = getItem(STORAGE_KEYS.WEAK_VERSES);
    let weakVerses: WeakVerseItem[] = [];
    if (weakRaw !== null) {
      let parsedWeak: unknown;
      try { parsedWeak = JSON.parse(weakRaw); }
      catch { throw new Error('تعذر تصدير النسخة الاحتياطية: سجل الآيات المتعثرة تالف وتم الحفاظ عليه.'); }
      if (!Array.isArray(parsedWeak) || parsedWeak.length > 10000 || !parsedWeak.every(isValidWeakVerseRecord)) {
        throw new Error('تعذر تصدير النسخة الاحتياطية: سجل الآيات المتعثرة يحتوي على عناصر غير صالحة.');
      }
      weakVerses = parsedWeak;
    }

    const backup: BackupPayload = {
      format: 'wird_backup',
      version: 5,
      timestamp: new Date().toISOString(),
      isEncrypted: false,
      unencryptedWarning: "تنبيه أمني: هذا الملف نصي غير مشفر بصيغة JSON صريحة ويحتوي على سجلات الحفظ والإعدادات الشخصية. احتفظ به في مكان آمن.",
      profile,
      plans,
      enginePlans,
      revisionItems,
      logs,
      tests,
      portions,
      unifiedPortions: canonicalPortions,
      weakVerses,
      ruqyahProgress: this.getRuqyahProgressSnapshot() ?? undefined
    };
    const validation = validateBackupPayload(backup);
    if (!validation.valid) {
      throw new Error('تعذر إنشاء نسخة احتياطية مكتملة: ' + (validation.error || 'بيانات غير صالحة'));
    }
    return JSON.stringify(backup, null, 2);
  },

  // Atomic Import with Pre-Validation (Never partially overwrites on failure)
  importBackup(jsonString: string): { success: boolean; message: string } {
    let parsed: any;
    try { parsed = JSON.parse(jsonString); }
    catch { return { success: false, message: 'صيغة الملف غير صالحة، يرجى التأكد من اختيار ملف JSON سليم.' }; }

    const validation = validateBackupPayload(parsed);
    if (!validation.valid) return { success: false, message: validation.error || 'فشل التحقق من بنية النسخة الاحتياطية' };

    let snapshot: Record<string, string | null>;
    try {
      snapshot = this.getStorageSnapshot();
    } catch (error) {
      return {
        success: false,
        message: 'تم إيقاف الاستيراد قبل تعديل أي بيانات؛ تعذر أخذ لقطة موثوقة من التخزين الدائم. ' +
          (error instanceof Error ? error.message : 'خطأ غير معروف في التخزين.')
      };
    }
    let ruqyahProgressChanged = false;
    const writeAndVerify = (key: string, value: unknown): void => {
      const serialized = JSON.stringify(value);
      if (!setItem(key, serialized) || getItem(key) !== serialized) throw new Error('تعذر التحقق من حفظ الحقل ' + key);
    };

    try {
      if (parsed.profile !== undefined) writeAndVerify(STORAGE_KEYS.PROFILE, parsed.profile);
      if (parsed.plans !== undefined) writeAndVerify(STORAGE_KEYS.PLANS, parsed.plans);
      if (parsed.enginePlans !== undefined) writeAndVerify(STORAGE_KEYS.ENGINE_PLANS, parsed.enginePlans);
      if (parsed.revisionItems !== undefined) writeAndVerify(STORAGE_KEYS.REVISION, parsed.revisionItems);
      if (parsed.logs !== undefined) writeAndVerify(STORAGE_KEYS.LOGS, parsed.logs);
      if (parsed.tests !== undefined) writeAndVerify(STORAGE_KEYS.TESTS, parsed.tests);
      if (parsed.weakVerses !== undefined) writeAndVerify(STORAGE_KEYS.WEAK_VERSES, parsed.weakVerses);
      if (parsed.ruqyahProgress !== undefined) {
        writeAndVerify(STORAGE_KEYS.RUQYAH_PROGRESS, parsed.ruqyahProgress);
        ruqyahProgressChanged = true;
      }

      if (parsed.unifiedPortions !== undefined) {
        if (!this.saveUnifiedPortions(parsed.unifiedPortions, false, true)) throw new Error('فشل حفظ المقاطع القرآنية الموحدة');
        if (JSON.stringify(this.getUnifiedPortions()) !== JSON.stringify(parsed.unifiedPortions)) throw new Error('فشل التحقق من استعادة المقاطع القرآنية الموحدة');
      } else if (parsed.portions !== undefined || parsed.revisionItems !== undefined) {
        const migration = migrateLegacyDataLosslessly(parsed.portions || [], parsed.revisionItems || []);
        if (!migration.report.success || !this.saveUnifiedPortions(migration.portions, false, true)) throw new Error(migration.report.error || 'تعذر ترحيل المقاطع من النسخة الاحتياطية القديمة');
        if (JSON.stringify(this.getUnifiedPortions()) !== JSON.stringify(migration.portions)) throw new Error('فشل التحقق من بيانات المقاطع بعد الترحيل');
      }

      if (ruqyahProgressChanged) notifyRuqyahProgressUpdated();
      return { success: true, message: 'تم استيراد البيانات والتحقق من حفظها بنجاح.' };
    } catch (e: any) {
      const rollbackVerified = this.restoreStorageSnapshot(snapshot);
      return {
        success: false,
        message: rollbackVerified
          ? 'تعذر إكمال الاستيراد؛ تم التحقق من استعادة البيانات السابقة: ' + (e?.message || 'خطأ غير متوقع')
          : 'تعذر إكمال الاستيراد، ولم ينجح التحقق الكامل من استعادة البيانات السابقة. لا تتابع التعديل؛ احتفظ بالملف الحالي وصدّر ما يمكن استعادته فوراً. السبب: ' + (e?.message || 'خطأ غير متوقع')
      };
    }
  },

  // Complete Clean Reset — capture a trustworthy snapshot first and roll back
  // every earlier removal if any durable deletion cannot be verified.
  resetAllData(): boolean {
    let snapshot: Record<string, string | null>;
    try {
      snapshot = this.getStorageSnapshot();
    } catch (error) {
      console.error('[WIRD Storage] Reset stopped before deleting data because a complete snapshot was unavailable.', error);
      return false;
    }

    const keys = [
      STORAGE_KEYS.PROFILE, STORAGE_KEYS.PLANS, STORAGE_KEYS.ENGINE_PLANS,
      STORAGE_KEYS.PROGRESS, STORAGE_KEYS.REVISION, STORAGE_KEYS.LOGS,
      STORAGE_KEYS.TESTS, STORAGE_KEYS.PORTIONS, STORAGE_KEYS.WEAK_VERSES,
      STORAGE_KEYS.UNIFIED_PORTIONS, STORAGE_KEYS.SCHEMA_VERSION, STORAGE_KEYS.RUQYAH_PROGRESS, STORAGE_KEYS.SYNC_OUTBOX
    ];
    for (const key of keys) {
      if (!removeItem(key) || !verifyItem(key, null) || memoryStorage.has(resolveStorageKey(key))) {
        const rollbackVerified = this.restoreStorageSnapshot(snapshot);
        console.error(
          '[WIRD Storage] Reset failed; previous data restoration verified: ' + rollbackVerified
        );
        return false;
      }
    }
    notifyRuqyahProgressUpdated();
    return true;
  },

  // Test-only Snapshot API
  getStorageSnapshot(): Record<string, string | null> {
    const snapshot: Record<string, string | null> = {};
    const scopedKeys = Object.values(STORAGE_KEYS).map(key => resolveStorageKey(key));
    scopedKeys.forEach(key => {
      const memoryValue = memoryStorage.get(key);
      if (memoryValue !== undefined) snapshot[`memory:${key}`] = memoryValue;
      if (typeof localStorage !== 'undefined') {
        try {
          const durableValue = localStorage.getItem(key);
          snapshot[`local:${key}`] = durableValue;
          if (memoryValue !== undefined && memoryValue !== durableValue) {
            throw new Error('ذاكرة التطبيق لا تطابق القيمة الدائمة للمفتاح ' + key);
          }
        } catch (error) {
          throw new Error('تعذرت قراءة القيمة الدائمة للمفتاح ' + key + ': ' +
            (error instanceof Error ? error.message : 'خطأ غير معروف'));
        }
      }
    });
    return snapshot;
  },

  restoreStorageSnapshot(snapshot: Record<string, string | null>): boolean {
    const scopedKeys = Object.values(STORAGE_KEYS).map(key => resolveStorageKey(key));

    // Clear the known scope first, but judge success from the final state rather
    // than an intermediate remove result: a failed remove is harmless when the
    // durable value already equals the snapshot value.
    for (const key of scopedKeys) rawRemoveItem(key);

    for (const [fullKey, val] of Object.entries(snapshot)) {
      if (fullKey.startsWith('memory:')) {
        const key = fullKey.slice('memory:'.length);
        if (val === null) memoryStorage.delete(key);
        else memoryStorage.set(key, val);
      } else if (fullKey.startsWith('local:')) {
        const key = fullKey.slice('local:'.length);
        try {
          if (typeof localStorage === 'undefined') {
            if (val !== null) return false;
          } else {
            if (val === null) localStorage.removeItem(key);
            else localStorage.setItem(key, val);
          }
        } catch {
          // The final durable read-back below decides whether restoration succeeded.
        }
      }
    }

    for (const key of scopedKeys) {
      const expectedMemory = snapshot['memory:' + key] ?? null;
      if ((memoryStorage.get(key) ?? null) !== expectedMemory) return false;

      const expectedDurable = snapshot['local:' + key] ?? null;
      if (typeof localStorage === 'undefined') {
        if (expectedDurable !== null) return false;
      } else {
        try {
          if (localStorage.getItem(key) !== expectedDurable) return false;
        } catch {
          return false;
        }
      }
    }
    return true;
  }
};

