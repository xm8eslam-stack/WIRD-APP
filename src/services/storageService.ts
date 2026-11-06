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
import { PRESET_PLANS } from '../data/presetPlans';
import { ALL_SURAHS } from '../data/quranMeta';
import { EngineGeneratedPlan, PlanningEngine } from './planningEngine';
import { migrateLegacyDataLosslessly, MigrationReport, getLocalDateString, createCanonicalPortionId } from './unifiedPortionService';

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

export interface RawStorageReadResult {
  available: boolean;
  value: string | null;
}

/** Reads the durable backend without silently substituting a stale memory cache. */
function readDurableValue(key: string): RawStorageReadResult {
  try {
    if (typeof localStorage === 'undefined') {
      return { available: true, value: memoryStorage.get(key) ?? null };
    }
    return { available: true, value: localStorage.getItem(key) };
  } catch {
    return { available: false, value: null };
  }
}

function restoreDurableValue(key: string, value: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined') {
      if (value === null) memoryStorage.delete(key);
      else memoryStorage.set(key, value);
      return (memoryStorage.get(key) ?? null) === value;
    }
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

function restoreMemoryValue(key: string, value: string | undefined): void {
  if (value === undefined) memoryStorage.delete(key);
  else memoryStorage.set(key, value);
}

function rawGetItem(key: string): string | null {
  const durable = readDurableValue(key);
  if (durable.available) return durable.value;
  // Memory fallback is only valid when the durable backend is unavailable,
  // never when it authoritatively reports that the key is absent.
  return memoryStorage.get(key) ?? null;
}

function rawSetItem(key: string, value: string): boolean {
  const previousMemoryValue = memoryStorage.get(key);
  const previousDurable = readDurableValue(key);
  if (!previousDurable.available) return false;

  if (typeof localStorage === 'undefined') {
    memoryStorage.set(key, value);
    return memoryStorage.get(key) === value;
  }

  try {
    localStorage.setItem(key, value);
    const readback = readDurableValue(key);
    if (readback.available && readback.value === value) {
      memoryStorage.set(key, value);
      return true;
    }

    const current = readDurableValue(key);
    const rollbackVerified = current.available && current.value === previousDurable.value
      ? true
      : restoreDurableValue(key, previousDurable.value);
    restoreMemoryValue(key, previousMemoryValue);
    if (!rollbackVerified) {
      console.error('[WIRD Storage] Write readback failed and the previous durable value could not be verified for ' + key);
    }
    return false;
  } catch (error) {
    const current = readDurableValue(key);
    const rollbackVerified = current.available && current.value === previousDurable.value
      ? true
      : restoreDurableValue(key, previousDurable.value);
    restoreMemoryValue(key, previousMemoryValue);
    if (!rollbackVerified) {
      console.error('[WIRD Storage] Failed write left an unverified durable value for ' + key, error);
    }
    return false;
  }
}

function rawRemoveItem(key: string): boolean {
  const previousMemoryValue = memoryStorage.get(key);
  const previousDurable = readDurableValue(key);
  if (!previousDurable.available) return false;
  if (previousDurable.value === null) {
    memoryStorage.delete(key);
    return true;
  }

  if (typeof localStorage === 'undefined') {
    memoryStorage.delete(key);
    return true;
  }

  try {
    localStorage.removeItem(key);
    const readback = readDurableValue(key);
    if (readback.available && readback.value === null) {
      memoryStorage.delete(key);
      return true;
    }
  } catch {
    // Attempt to restore the pre-operation value below.
  }

  const current = readDurableValue(key);
  const rollbackVerified = current.available && current.value === previousDurable.value
    ? true
    : restoreDurableValue(key, previousDurable.value);
  restoreMemoryValue(key, previousMemoryValue);
  if (!rollbackVerified) {
    console.error('[WIRD Storage] Failed removal left an unverified durable value for ' + key);
  }
  return false;
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

function setStorageScope(scope: string, legacyChoice?: 'import' | 'keep-guest'): boolean {
  const normalized = scope;
  if (normalized === 'legacy' || normalized === 'guest') {
    activeStorageScope = normalized;
    return true;
  }
  if (!isUserStorageScope(normalized)) return false;

  const owner = rawGetItem(STORAGE_OWNER_MARKER);
  if (!owner) {
    const legacyValues = Object.values(STORAGE_KEYS).map(key => ({
      key,
      value: rawGetItem(key)
    }));
    const hasLegacyData = legacyValues.some(item => item.value !== null);

    // Existing unscoped data may belong to a guest or another person using
    // this browser. Require an explicit in-app choice before claiming it.
    if (hasLegacyData && !legacyChoice) return false;

    if (legacyChoice === 'import') {
      // Copy and verify every legacy value before removing any source key.
      for (const item of legacyValues) {
        if (item.value === null) continue;
        const destinationKey = resolveStorageKey(item.key, normalized);
        if (rawGetItem(destinationKey) === null && !rawSetItem(destinationKey, item.value)) return false;
        if (rawGetItem(destinationKey) !== item.value) return false;
      }

      for (const item of legacyValues) {
        if (item.value !== null && !rawRemoveItem(item.key)) return false;
      }
    }

    // keep-guest leaves the legacy dataset untouched and prevents another
    // account from silently claiming it on this device.
    if (!rawSetItem(STORAGE_OWNER_MARKER, normalized)) return false;
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

function removeItem(key: string): boolean {
  const resolved = resolveStorageKey(key);
  return rawRemoveItem(resolved) && rawGetItem(resolved) === null;
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
    if (!Array.isArray(parsed) || parsed.length > 10000 || !parsed.every(isValidRecord)) {
      throw new Error('Archive contains malformed records.');
    }
    return parsed as T[];
  } catch (error) {
    console.error('[WIRD Storage] ' + label + ' archive needs recovery; preserving original bytes:', error);
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

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
}

function isFiniteBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isValidSurahRange(surahNumber: unknown, startAyah: unknown, endAyah: unknown): boolean {
  if (!isIntegerBetween(surahNumber, 1, 114) || !isIntegerBetween(startAyah, 1, 286) ||
      !isIntegerBetween(endAyah, Number(startAyah), 286)) return false;
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  return Boolean(surah && Number(startAyah) <= surah.versesCount && Number(endAyah) <= surah.versesCount);
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
  const historyValid = value.history === undefined ||
    (Array.isArray(value.history) && value.history.length <= 10000 && value.history.every(isValidRevisionLogRecord));
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
  if (!isPlainRecord(value) || !isValidSurahRange(value.startSurah, value.startAyah, value.startAyah) ||
      !isValidSurahRange(value.endSurah, value.endAyah, value.endAyah)) return false;
  const startKey = Number(value.startSurah) * 1000 + Number(value.startAyah);
  const endKey = Number(value.endSurah) * 1000 + Number(value.endAyah);
  const validDays = (days: unknown, allowEmpty: boolean) =>
    Array.isArray(days) && days.length <= 7 && (allowEmpty || days.length > 0) &&
    days.every(day => isIntegerBetween(day, 0, 6)) && new Set(days).size === days.length;
  const existingValid = value.existingMemorized === undefined ||
    (Array.isArray(value.existingMemorized) && value.existingMemorized.length <= 6236 &&
      value.existingMemorized.every((range: unknown) => isPlainRecord(range) &&
        isValidSurahRange(range.surahNumber, range.startAyah, range.endAyah)));
  return typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 200 &&
    startKey <= endKey &&
    isValidDateOnly(value.startDate) &&
    (value.targetEndDate === undefined || (isValidDateOnly(value.targetEndDate) && value.targetEndDate >= value.startDate)) &&
    ['beginner', 'intermediate', 'advanced', 'hafiz'].includes(value.level) &&
    isIntegerBetween(value.dailyAvailableMinutes, 0, 1440) &&
    isIntegerBetween(value.dailyRevisionMinutes, 0, 1440) &&
    ['verses_per_day', 'pages_per_day', 'by_target_date'].includes(value.paceType) &&
    isIntegerBetween(value.paceQuantity, 1, 6236) &&
    (value.paceType !== 'by_target_date' || value.targetEndDate !== undefined) &&
    validDays(value.activeDays, false) && validDays(value.restDays, true) &&
    ['morning_evening', 'single_session'].includes(value.schedulePreference) &&
    existingValid;
}

function isValidScheduledTaskUnit(value: unknown): boolean {
  return isPlainRecord(value) &&
    isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah) &&
    typeof value.surahName === 'string' && value.surahName.trim().length > 0 && value.surahName.length <= 100 &&
    isIntegerBetween(value.versesCount, 1, 6236) &&
    value.versesCount === value.endAyah - value.startAyah + 1 &&
    isFiniteBetween(value.estimatedMinutes, 0, 1440) &&
    typeof value.completed === 'boolean' &&
    (value.completedAt === undefined || isValidTimestamp(value.completedAt)) &&
    (value.userRating === undefined || ['strong', 'medium', 'weak'].includes(value.userRating));
}

function isValidScheduledRevisionUnit(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.description !== 'string' || value.description.length > 500 ||
      !isIntegerBetween(value.versesCount, 0, 6236) ||
      !isFiniteBetween(value.estimatedMinutes, 0, 1440) ||
      typeof value.completed !== 'boolean' || !['minor', 'major'].includes(value.type)) return false;
  const hasAnyCoordinate = value.surahNumber !== undefined || value.startAyah !== undefined || value.endAyah !== undefined;
  if (hasAnyCoordinate && !isValidSurahRange(value.surahNumber, value.startAyah, value.endAyah)) return false;
  return value.surahName === undefined || (typeof value.surahName === 'string' && value.surahName.length <= 100);
}

function isValidEngineGeneratedPlan(value: unknown): value is EngineGeneratedPlan {
  if (!isPlainRecord(value) || !isPlainRecord(value.meta) || !isPlainRecord(value.feasibility) ||
      !isPlainRecord(value.actualVsPlanned) || !Array.isArray(value.schedule) ||
      value.schedule.length > 10000 || !isValidPlanGenerationInput(value.input)) return false;
  const meta = value.meta;
  const feasibility = value.feasibility;
  const actual = value.actualVsPlanned;
  const validCoordinate = (coordinate: unknown) =>
    isPlainRecord(coordinate) && isValidSurahRange(coordinate.surahNumber, coordinate.ayahNumber, coordinate.ayahNumber);
  const scheduleValid = value.schedule.every((day: unknown) => {
    if (!isPlainRecord(day) || typeof day.id !== 'string' || !day.id.trim() || day.id.length > 160 ||
        !isValidDateOnly(day.date) || !isIntegerBetween(day.dayOfWeek, 0, 6) ||
        typeof day.dayNameAr !== 'string' || day.dayNameAr.length > 40 ||
        typeof day.isRestDay !== 'boolean' ||
        !['pending', 'completed', 'skipped', 'partially_completed'].includes(day.status) ||
        (day.notes !== undefined && (typeof day.notes !== 'string' || day.notes.length > 1000))) return false;
    return (day.memorizationTask === undefined || isValidScheduledTaskUnit(day.memorizationTask)) &&
      (day.minorRevisionTask === undefined || isValidScheduledRevisionUnit(day.minorRevisionTask)) &&
      (day.majorRevisionTask === undefined || isValidScheduledRevisionUnit(day.majorRevisionTask));
  });
  return typeof value.id === 'string' && value.id.trim().length > 0 && value.id.length <= 160 &&
    typeof value.title === 'string' && value.title.trim().length > 0 && value.title.length <= 200 &&
    typeof value.rationale === 'string' && value.rationale.length <= 4000 &&
    validCoordinate(meta.startCoordinate) && validCoordinate(meta.endCoordinate) &&
    isIntegerBetween(meta.totalVerses, 1, 6236) &&
    isIntegerBetween(meta.activeStudyDaysCount, 0, 10000) &&
    isIntegerBetween(meta.restDaysCount, 0, 10000) &&
    isIntegerBetween(meta.totalCalendarDays, 1, 10000) &&
    isValidDateOnly(meta.projectedEndDate) &&
    isFiniteBetween(meta.weeklyWorkloadHours, 0, 168) &&
    typeof feasibility.isFeasible === 'boolean' &&
    ['optimal', 'light', 'strenuous', 'impossible'].includes(feasibility.cognitiveLoadScore) &&
    isFiniteBetween(feasibility.requiredMinutesNew, 0, 100000) &&
    isFiniteBetween(feasibility.requiredMinutesRevision, 0, 100000) &&
    isFiniteBetween(feasibility.totalRequiredMinutes, 0, 200000) &&
    isFiniteBetween(feasibility.availableMinutes, 0, 100000) &&
    isIntegerBetween(feasibility.dailyPaceVerses, 1, 6236) &&
    (feasibility.warningMessage === undefined || (typeof feasibility.warningMessage === 'string' && feasibility.warningMessage.length <= 2000)) &&
    scheduleValid &&
    isIntegerBetween(actual.plannedVersesToDate, 0, 6236) &&
    isIntegerBetween(actual.actualVersesMemorized, 0, 6236) &&
    isIntegerBetween(actual.varianceVerses, -6236, 6236) &&
    ['ahead', 'on_track', 'behind'].includes(actual.status) &&
    typeof value.isActive === 'boolean' && typeof value.isPaused === 'boolean' &&
    (value.pausedAt === undefined || isValidTimestamp(value.pausedAt)) &&
    isValidTimestamp(value.createdAt);
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
}

export function validateBackupPayload(payload: any): { valid: boolean; error?: string } {
  if (!isPlainRecord(payload)) {
    return { valid: false, error: 'الملف لا يحتوي على كائن JSON صالح' };
  }
  if (!isIntegerBetween(payload.version, 1, 4)) {
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

  if (payload.version === 4 && Array.isArray(payload.unifiedPortions)) {
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
export interface RawStorageSnapshot {
  available: boolean;
  values: Record<string, string | null>;
  unavailableKeys: string[];
}

export interface RawStorageRestoreResult {
  success: boolean;
  failedKeys: string[];
}

export interface SessionCompletionWriteResult {
  success: boolean;
  rollbackVerified: boolean;
  failureStage?: 'validation' | 'snapshot-read' | 'logs-read' | 'logs-write' | 'profile-write' | 'profile-update';
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

  /** Strict durable read for rollback snapshots; unlike getRawItem, never trusts memory when localStorage read fails. */
  readRawItemForVerification(key: string): RawStorageReadResult {
    return readDurableValue(resolveStorageKey(key));
  },

  verifyRawItem(key: string, expected: string | null): boolean {
    const readback = readDurableValue(resolveStorageKey(key));
    return readback.available && readback.value === expected;
  },

  captureRawSnapshot(keys: readonly string[]): RawStorageSnapshot {
    const values: Record<string, string | null> = {};
    const unavailableKeys: string[] = [];
    for (const key of [...new Set(keys)]) {
      if (typeof key !== 'string' || !key.trim()) {
        unavailableKeys.push(String(key));
        continue;
      }
      const readback = readDurableValue(resolveStorageKey(key));
      if (!readback.available) unavailableKeys.push(key);
      else values[key] = readback.value;
    }
    return { available: unavailableKeys.length === 0, values, unavailableKeys };
  },

  restoreRawSnapshot(snapshot: RawStorageSnapshot): RawStorageRestoreResult {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.values || typeof snapshot.values !== 'object') {
      return { success: false, failedKeys: ['<invalid-snapshot>'] };
    }
    const failedKeys = [...(Array.isArray(snapshot.unavailableKeys) ? snapshot.unavailableKeys : [])];
    const keys = Object.keys(snapshot.values).reverse();
    for (const key of keys) {
      const expected = snapshot.values[key];
      const resolvedKey = resolveStorageKey(key);
      const current = readDurableValue(resolvedKey);
      if (!current.available) {
        failedKeys.push(key);
        continue;
      }
      if (current.value !== expected) {
        if (expected === null) rawRemoveItem(resolvedKey);
        else rawSetItem(resolvedKey, expected);
      }
      const restored = readDurableValue(resolvedKey);
      if (!restored.available || restored.value !== expected) failedKeys.push(key);
    }
    return { success: failedKeys.length === 0, failedKeys: [...new Set(failedKeys)] };
  },

  setRawItem(key: string, value: string): boolean {
    return setItem(key, value);
  },

  removeRawItem(key: string): boolean {
    return removeItem(key);
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
      if (validStreak !== profile.streakDays) {
        profile.streakDays = validStreak;
        if (!this.saveProfile(profile)) {
          console.warn('[WIRD Storage] Profile streak projection could not be persisted; original profile data remains protected.');
        }
      }
      return profile;
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
    if (!Array.isArray(plans) || plans.length > 500 || !plans.every(isValidMemorizationPlan) || !canWriteJsonArrayArchive(STORAGE_KEYS.PLANS, isValidMemorizationPlan)) return false;
    return setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  },

  // Engine Plans
  getEnginePlans(): EngineGeneratedPlan[] {
    return readJsonArrayArchive<EngineGeneratedPlan>(STORAGE_KEYS.ENGINE_PLANS, 'Engine plans', isValidEngineGeneratedPlan);
  },

  saveEnginePlans(plans: EngineGeneratedPlan[]): boolean {
    if (!Array.isArray(plans) || plans.length > 100 || !plans.every(isValidEngineGeneratedPlan) || !canWriteJsonArrayArchive(STORAGE_KEYS.ENGINE_PLANS, isValidEngineGeneratedPlan)) return false;
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

  // Unified Portions (Canonical schema v2)
  getUnifiedPortions(): WirdPortion[] {
    try {
      const version = getItem(STORAGE_KEYS.SCHEMA_VERSION);
      const data = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);

      if (version === '2') {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && validateBackupPayload({ version: 4, unifiedPortions: parsed }).valid) {
              return parsed;
            }
            console.warn('[WIRD Storage] Integrity Error: Unified portions failed canonical Quran and schema validation.');
          } catch {
            console.warn('[WIRD Storage] Integrity Error: Schema version is 2 but UNIFIED_PORTIONS payload is corrupt.');
          }
        } else {
          console.warn('[WIRD Storage] Integrity Error: Schema version is 2 but UNIFIED_PORTIONS payload is missing.');
        }

        // Recoverable Integrity Error (Phase 3.1): Re-attempt recovery from preserved legacy keys
        const legacyPortionsRaw = getItem(STORAGE_KEYS.PORTIONS);
        const legacyRevsRaw = getItem(STORAGE_KEYS.REVISION);
        if (legacyPortionsRaw !== null || legacyRevsRaw !== null) {
          console.info('[WIRD Storage] Attempting recovery from preserved legacy storage keys...');
          const portionsRead = readLegacyArrayForMigration<PortionStatusRecord>(legacyPortionsRaw, 'المقاطع', value => isValidPortionRecord(value, false));
          const revisionsRead = readLegacyArrayForMigration<RevisionItem>(legacyRevsRaw, 'المراجعة', isValidLegacyRevisionItem);
          if (!portionsRead.valid || !revisionsRead.valid) {
            console.error('[WIRD Storage] Legacy recovery stopped:', !portionsRead.valid ? portionsRead.error : revisionsRead.valid ? '' : revisionsRead.error);
            return [];
          }
          const legacyPortions = portionsRead.records;
          const legacyRevs = revisionsRead.records;
          if (legacyPortions.length === 0 && legacyRevs.length === 0) {
            console.error('[WIRD Storage] Recovery skipped: no non-empty legacy records exist; invalid canonical data was preserved.');
            return [];
          }
          const { portions, report } = migrateLegacyDataLosslessly(legacyPortions, legacyRevs);
          if (report.success && this.saveUnifiedPortions(portions, true)) {
            return portions;
          }
        }
        return [];
      }

      // If schema version is not 2, run migration first
      const legacyPortionsRaw = getItem(STORAGE_KEYS.PORTIONS);
      const legacyRevsRaw = getItem(STORAGE_KEYS.REVISION);
      if (legacyPortionsRaw !== null || legacyRevsRaw !== null) {
        this.ensureDataMigrated();
        const migrated = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
        if (migrated) return JSON.parse(migrated);
      }
      return [];
    } catch {
      return [];
    }
  },

  saveUnifiedPortions(portions: WirdPortion[], allowRecoveryOverwrite = false): boolean {
    const snapshotKeys = [
      STORAGE_KEYS.UNIFIED_PORTIONS,
      STORAGE_KEYS.SCHEMA_VERSION,
      STORAGE_KEYS.PORTIONS,
      STORAGE_KEYS.REVISION
    ];
    const snapshot = this.captureRawSnapshot(snapshotKeys);
    if (!snapshot.available) {
      console.error('[WIRD Storage] Refusing canonical portion write because one or more rollback snapshots could not be read:', snapshot.unavailableKeys);
      return false;
    }
    let writeStarted = false;
    const failAndRestore = (reason: string): false => {
      console.error('[WIRD Storage] Canonical portion write failed:', reason);
      const restored = this.restoreRawSnapshot(snapshot);
      if (!restored.success) {
        throw new Error('تعذر التحقق من استعادة أرشيف المقاطع والإسقاطات القديمة (' + restored.failedKeys.join('، ') + '). صدّر نسخة احتياطية قبل أي تعديل آخر.');
      }
      return false;
    };

    try {
      const currentSchemaVersion = snapshot.values[STORAGE_KEYS.SCHEMA_VERSION];
      if (currentSchemaVersion === '2' && !allowRecoveryOverwrite) {
        const currentRaw = snapshot.values[STORAGE_KEYS.UNIFIED_PORTIONS];
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

      writeStarted = true;
      if (!setItem(STORAGE_KEYS.UNIFIED_PORTIONS, serialized) ||
          !this.verifyRawItem(STORAGE_KEYS.UNIFIED_PORTIONS, serialized)) {
        return failAndRestore('canonical archive write/readback failed');
      }

      const canonicalReadback = this.readRawItemForVerification(STORAGE_KEYS.UNIFIED_PORTIONS);
      if (!canonicalReadback.available || canonicalReadback.value === null) {
        return failAndRestore('canonical archive could not be read back');
      }
      let parsed: unknown;
      try { parsed = JSON.parse(canonicalReadback.value); }
      catch { return failAndRestore('canonical archive readback is invalid JSON'); }
      if (!Array.isArray(parsed) || parsed.length !== portions.length ||
          JSON.stringify(parsed) !== serialized) {
        return failAndRestore('canonical archive payload mismatch on readback');
      }

      if (!setItem(STORAGE_KEYS.SCHEMA_VERSION, '2') ||
          !this.verifyRawItem(STORAGE_KEYS.SCHEMA_VERSION, '2')) {
        return failAndRestore('schema version write/readback failed');
      }

      // Legacy projections are part of the same local commit: a partial projection
      // must never be reported as a successful canonical write.
      if (!setItem(STORAGE_KEYS.PORTIONS, serialized) ||
          !this.verifyRawItem(STORAGE_KEYS.PORTIONS, serialized)) {
        return failAndRestore('legacy portions projection write/readback failed');
      }

      const revisionItems: RevisionItem[] = portions
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
      const serializedRevision = JSON.stringify(revisionItems);
      if (!setItem(STORAGE_KEYS.REVISION, serializedRevision) ||
          !this.verifyRawItem(STORAGE_KEYS.REVISION, serializedRevision)) {
        return failAndRestore('legacy revision projection write/readback failed');
      }

      return true;
    } catch (error) {
      if (writeStarted) {
        const restored = this.restoreRawSnapshot(snapshot);
        if (!restored.success) {
          throw new Error('تعذر التحقق من استعادة أرشيف المقاطع والإسقاطات القديمة (' + restored.failedKeys.join('، ') + '). صدّر نسخة احتياطية قبل أي تعديل آخر.');
        }
        console.error('[WIRD Storage] saveUnifiedPortions write failed and was rolled back:', error);
        return false;
      }
      console.error('[WIRD Storage] saveUnifiedPortions validation failed before writes', error);
      return false;
    }
  },

  ensureDataMigrated(): MigrationReport {
    try {
      const currentVersion = getItem(STORAGE_KEYS.SCHEMA_VERSION);
      const unifiedData = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      const hasInvalidCanonicalPayload = currentVersion === '2';

      if (currentVersion === '2' && unifiedData) {
        try {
          const parsed = JSON.parse(unifiedData);
          if (Array.isArray(parsed) && validateBackupPayload({ version: 4, unifiedPortions: parsed }).valid) {
            return {
              success: true,
              legacyPortionsCount: 0,
              legacyRevisionCount: 0,
              migratedPortionsCount: parsed.length,
              totalPreservedLogsCount: 0,
              conflictAuditCount: 0,
              alreadyMigrated: true
            };
          }
        } catch {
          // Corrupt payload, fall through to recovery
        }
      }

      const legacyPortionsRaw = getItem(STORAGE_KEYS.PORTIONS);
      const legacyRevsRaw = getItem(STORAGE_KEYS.REVISION);
      const portionsRead = readLegacyArrayForMigration<PortionStatusRecord>(legacyPortionsRaw, 'المقاطع', value => isValidPortionRecord(value, false));
      const revisionsRead = readLegacyArrayForMigration<RevisionItem>(legacyRevsRaw, 'المراجعة', isValidLegacyRevisionItem);
      if (!portionsRead.valid || !revisionsRead.valid) {
        return {
          success: false,
          legacyPortionsCount: 0,
          legacyRevisionCount: 0,
          migratedPortionsCount: 0,
          totalPreservedLogsCount: 0,
          conflictAuditCount: 0,
          alreadyMigrated: false,
          error: !portionsRead.valid ? portionsRead.error : revisionsRead.valid ? 'تعذر التحقق من أرشيف المراجعة القديم.' : revisionsRead.error
        };
      }
      const legacyPortions = portionsRead.records;
      const legacyRevs = revisionsRead.records;

      if (hasInvalidCanonicalPayload && legacyPortions.length === 0 && legacyRevs.length === 0) {
        return {
          success: false,
          legacyPortionsCount: 0,
          legacyRevisionCount: 0,
          migratedPortionsCount: 0,
          totalPreservedLogsCount: 0,
          conflictAuditCount: 0,
          alreadyMigrated: false,
          error: 'البيانات الموحدة غير صالحة ولا توجد سجلات قديمة غير فارغة للاستعادة؛ تم الحفاظ على النسخة الحالية دون استبدالها.'
        };
      }

      const { portions, report } = migrateLegacyDataLosslessly(legacyPortions, legacyRevs);

      if (!report.success) {
        return report;
      }

      const saved = this.saveUnifiedPortions(portions, hasInvalidCanonicalPayload);
      if (!saved) {
        return {
          success: false,
          legacyPortionsCount: legacyPortions.length,
          legacyRevisionCount: legacyRevs.length,
          migratedPortionsCount: 0,
          totalPreservedLogsCount: 0,
          conflictAuditCount: 0,
          alreadyMigrated: false,
          error: 'فشل حفظ البيانات الموحدة في الذاكرة المحلية (قد تكون المساحة ممتلئة)'
        };
      }

      return report;
    } catch (e: any) {
      return {
        success: false,
        legacyPortionsCount: 0,
        legacyRevisionCount: 0,
        migratedPortionsCount: 0,
        totalPreservedLogsCount: 0,
        conflictAuditCount: 0,
        alreadyMigrated: false,
        error: e?.message || 'Migration exception'
      };
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

  // Session Completion with explicit rollback verification for each durable archive.
  recordSessionCompletion(
    memorizedAyahs: number,
    reviewedPages: number,
    minutes: number,
    taskName: string
  ): boolean {
    const result = this.recordSessionCompletionDetailed(memorizedAyahs, reviewedPages, minutes, taskName);
    if (!result.success && !result.rollbackVerified) {
      console.error('[WIRD Storage] Session completion rollback requires recovery:', result.failureStage);
    }
    return result.success;
  },

  recordSessionCompletionDetailed(
    memorizedAyahs: number,
    reviewedPages: number,
    minutes: number,
    taskName: string
  ): SessionCompletionWriteResult {
    const fail = (
      failureStage: SessionCompletionWriteResult['failureStage'],
      rollbackVerified = true
    ): SessionCompletionWriteResult => ({ success: false, rollbackVerified, failureStage });

    if (!Number.isSafeInteger(memorizedAyahs) || memorizedAyahs < 0 || memorizedAyahs > 6236 ||
        !Number.isSafeInteger(reviewedPages) || reviewedPages < 0 || reviewedPages > 604 ||
        !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440 ||
        typeof taskName !== 'string' || !taskName.trim() || taskName.length > 200) {
      return fail('validation');
    }

    const activitySnapshot = this.captureRawSnapshot([STORAGE_KEYS.LOGS, STORAGE_KEYS.PROFILE]);
    if (!activitySnapshot.available) return fail('snapshot-read');

    const restoreActivitySnapshots = (): boolean => {
      const restored = this.restoreRawSnapshot(activitySnapshot);
      if (!restored.success) {
        console.error('[WIRD Storage] Activity/profile rollback requires recovery:', restored.failedKeys);
      }
      return restored.success;
    };

    let logs: DailyLog[];
    try {
      logs = this.getLogs();
    } catch (error) {
      console.warn('[WIRD Storage] Refusing to overwrite an invalid daily activity archive:', error);
      return fail('logs-read');
    }

    const today = getLocalDateString();
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
      return fail('logs-write', restoreActivitySnapshots());
    }

    try {
      const profile = this.getProfile();
      const { newStreak, newDate } = advanceStreakOnCompletion(profile.lastActiveDate, profile.streakDays, today);
      profile.streakDays = newStreak;
      profile.lastActiveDate = newDate;
      if (!this.saveProfile(profile)) {
        return fail('profile-write', restoreActivitySnapshots());
      }
    } catch (error) {
      console.warn('[WIRD Storage] Profile update failed during session completion:', error);
      return fail('profile-update', restoreActivitySnapshots());
    }

    return { success: true, rollbackVerified: true };
  },

  // Explicit Demo Data Loader (for demo mode only)
  loadDemoData(): void {
    this.saveProfile(DEMO_PROFILE);
    this.savePlans(PRESET_PLANS);
    this.saveEnginePlans([buildDemoEnginePlan()]);
    this.saveRevisionItems(DEMO_REVISION_ITEMS);
    this.saveLogs(DEMO_LOGS);
  },

  // Export with Unencrypted Warning Label
  exportFullBackup(): string {
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
      version: 4,
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
      weakVerses
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

    const snapshot = this.getStorageSnapshot();
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

      if (parsed.unifiedPortions !== undefined) {
        if (!this.saveUnifiedPortions(parsed.unifiedPortions)) throw new Error('فشل حفظ المقاطع القرآنية الموحدة');
        if (JSON.stringify(this.getUnifiedPortions()) !== JSON.stringify(parsed.unifiedPortions)) throw new Error('فشل التحقق من استعادة المقاطع القرآنية الموحدة');
      } else if (parsed.portions !== undefined || parsed.revisionItems !== undefined) {
        const migration = migrateLegacyDataLosslessly(parsed.portions || [], parsed.revisionItems || []);
        if (!migration.report.success || !this.saveUnifiedPortions(migration.portions)) throw new Error(migration.report.error || 'تعذر ترحيل المقاطع من النسخة الاحتياطية القديمة');
        if (JSON.stringify(this.getUnifiedPortions()) !== JSON.stringify(migration.portions)) throw new Error('فشل التحقق من بيانات المقاطع بعد الترحيل');
      }

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

  // Complete Clean Reset — never report success unless every scoped key is absent.
  resetAllData(): boolean {
    const keys = [
      STORAGE_KEYS.PROFILE, STORAGE_KEYS.PLANS, STORAGE_KEYS.ENGINE_PLANS,
      STORAGE_KEYS.PROGRESS, STORAGE_KEYS.REVISION, STORAGE_KEYS.LOGS,
      STORAGE_KEYS.TESTS, STORAGE_KEYS.PORTIONS, STORAGE_KEYS.WEAK_VERSES,
      STORAGE_KEYS.UNIFIED_PORTIONS, STORAGE_KEYS.SCHEMA_VERSION, STORAGE_KEYS.SYNC_OUTBOX
    ];
    let success = true;
    for (const key of keys) {
      if (!removeItem(key)) success = false;
    }
    return success;
  },

  // Test-only Snapshot API
  getStorageSnapshot(): Record<string, string | null> {
    const snapshot: Record<string, string | null> = {};
    const scopedKeys = Object.values(STORAGE_KEYS).map(key => resolveStorageKey(key));
    scopedKeys.forEach(key => {
      const memoryValue = memoryStorage.get(key);
      if (memoryValue !== undefined) snapshot[`memory:${key}`] = memoryValue;
      try {
        if (typeof localStorage !== 'undefined') snapshot[`local:${key}`] = localStorage.getItem(key);
      } catch { /* ignore */ }
    });
    return snapshot;
  },

  restoreStorageSnapshot(snapshot: Record<string, string | null>): boolean {
    let restored = true;
    const scopedKeys = Object.values(STORAGE_KEYS).map(key => resolveStorageKey(key));

    for (const key of scopedKeys) {
      if (!rawRemoveItem(key)) restored = false;
      if (memoryStorage.has(key)) restored = false;
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null) restored = false;
      } catch { restored = false; }
    }

    for (const [fullKey, val] of Object.entries(snapshot)) {
      if (fullKey.startsWith('memory:')) {
        const key = fullKey.slice('memory:'.length);
        if (val === null) memoryStorage.delete(key);
        else memoryStorage.set(key, val);
        if ((memoryStorage.get(key) ?? null) !== val) restored = false;
      } else if (fullKey.startsWith('local:')) {
        const key = fullKey.slice('local:'.length);
        try {
          if (typeof localStorage === 'undefined') {
            if (val !== null) restored = false;
          } else {
            if (val === null) localStorage.removeItem(key);
            else localStorage.setItem(key, val);
            if (localStorage.getItem(key) !== val) restored = false;
          }
        } catch { restored = false; }
      }
    }
    return restored;
  }
};

