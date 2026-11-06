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
  try {
    localStorage.setItem(key, value);
    memoryStorage.set(key, value);
    return true;
  } catch (error) {
    // A failed durable write must not appear successful through the memory fallback.
    if (previousMemoryValue === undefined) memoryStorage.delete(key);
    else memoryStorage.set(key, previousMemoryValue);
    console.error(`[WIRD Storage] Durable write to localStorage failed for ${key}`, error);
    return false;
  }
}

function rawRemoveItem(key: string): boolean {
  let success = true;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    success = false;
  }
  memoryStorage.delete(key);
  return success;
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

function readJsonArrayArchive<T>(key: string, label: string): T[] {
  const raw = getItem(key);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Archive root is not an array.');
    return parsed as T[];
  } catch (error) {
    console.error('[WIRD Storage] ' + label + ' archive needs recovery; preserving original bytes:', error);
    return [];
  }
}

function canWriteJsonArrayArchive(key: string): boolean {
  const raw = getItem(key);
  if (raw === null) return true;
  try { return Array.isArray(JSON.parse(raw)); }
  catch { return false; }
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
  return Array.isArray(value) && value.length <= 10000 && value.every(isValidDailyLog);
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
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'الملف لا يحتوي على كائن JSON صالح' };
  }

  // Version check (Supported versions: 1 through 4)
  if (typeof payload.version !== 'number' || payload.version < 1 || payload.version > 4) {
    return { valid: false, error: `إصدار النسخة الاحتياطية (${payload.version}) غير مدعوم` };
  }

  // Profile validation if present
  if (payload.profile !== undefined) {
    if (typeof payload.profile !== 'object' || payload.profile === null) {
      return { valid: false, error: 'بيانات الملف الشخصي (profile) غير صالحة' };
    }
    if (typeof payload.profile.name !== 'string' || !payload.profile.name.trim()) {
      return { valid: false, error: 'اسم الحافظ في الملف الشخصي مفقود أو غير صالح' };
    }
    if (typeof payload.profile.streakDays !== 'number' || payload.profile.streakDays < 0) {
      return { valid: false, error: 'قيمة سلسلة الأيام غير صالحة' };
    }
  }

  // Array checks
  const arrayFields = ['plans', 'enginePlans', 'revisionItems', 'logs', 'tests', 'portions', 'unifiedPortions', 'weakVerses'] as const;
  for (const field of arrayFields) {
    if (payload[field] !== undefined && !Array.isArray(payload[field])) {
      return { valid: false, error: `الحقل ${field} يجب أن يكون مصفوفة صالحة` };
    }
  }

  if (payload.unifiedPortions !== undefined) {
    const validStatuses = new Set(['not_memorized', 'currently_memorizing', 'recently_memorized', 'stable', 'needs_revision', 'weak']);
    const validTypes = new Set(['passage', 'surah', 'page']);
    for (let index = 0; index < payload.unifiedPortions.length; index++) {
      const portion = payload.unifiedPortions[index];
      const surahMeta = portion && ALL_SURAHS.find(surah => surah.number === portion.surahNumber);
      const validDate = typeof portion?.nextDueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(portion.nextDueDate)
        && (() => {
          const [year, month, day] = portion.nextDueDate.split('-').map(Number);
          const date = new Date(Date.UTC(year, month - 1, day));
          return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === portion.nextDueDate;
        })();
      const valid = portion && typeof portion === 'object' && surahMeta &&
        typeof portion.id === 'string' && portion.id === createCanonicalPortionId(portion.surahNumber, portion.startAyah, portion.endAyah) &&
        validTypes.has(portion.type) &&
        typeof portion.surahName === 'string' && portion.surahName.trim().length > 0 &&
        Number.isInteger(portion.startAyah) && portion.startAyah >= 1 && portion.startAyah <= surahMeta.versesCount &&
        Number.isInteger(portion.endAyah) && portion.endAyah >= portion.startAyah && portion.endAyah <= surahMeta.versesCount &&
        validStatuses.has(portion.status) &&
        validDate &&
        Number.isInteger(portion.intervalDays) && portion.intervalDays >= 1 &&
        Number.isFinite(portion.easeFactor) && portion.easeFactor >= 1.3 && portion.easeFactor <= 3 &&
        Number.isInteger(portion.repetitionCount) && portion.repetitionCount >= 0 &&
        (portion.pageNumber === undefined || (Number.isInteger(portion.pageNumber) && portion.pageNumber >= 1 && portion.pageNumber <= 604)) &&
        (portion.pageStart === undefined || (Number.isInteger(portion.pageStart) && portion.pageStart >= 1 && portion.pageStart <= 604)) &&
        (portion.pageEnd === undefined || (Number.isInteger(portion.pageEnd) && portion.pageEnd >= 1 && portion.pageEnd <= 604)) &&
        (portion.juzNumber === undefined || (Number.isInteger(portion.juzNumber) && portion.juzNumber >= 1 && portion.juzNumber <= 30)) &&
        (portion.history === undefined || Array.isArray(portion.history));
      if (!valid) return { valid: false, error: 'بيانات المقطع الموحد رقم ' + (index + 1) + ' غير صالحة أو تتجاوز حدود السورة' };
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

  setRawItem(key: string, value: string): boolean {
    return setItem(key, value);
  },

  removeRawItem(key: string): void {
    removeItem(key);
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
    return readJsonArrayArchive<MemorizationPlan>(STORAGE_KEYS.PLANS, 'Plans');
  },

  savePlans(plans: MemorizationPlan[]): boolean {
    if (!Array.isArray(plans) || !canWriteJsonArrayArchive(STORAGE_KEYS.PLANS)) return false;
    return setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  },

  // Engine Plans
  getEnginePlans(): EngineGeneratedPlan[] {
    return readJsonArrayArchive<EngineGeneratedPlan>(STORAGE_KEYS.ENGINE_PLANS, 'Engine plans');
  },

  saveEnginePlans(plans: EngineGeneratedPlan[]): boolean {
    if (!Array.isArray(plans) || !canWriteJsonArrayArchive(STORAGE_KEYS.ENGINE_PLANS)) return false;
    return setItem(STORAGE_KEYS.ENGINE_PLANS, JSON.stringify(plans));
  },

  // Revision Items
  getRevisionItems(): RevisionItem[] {
    return readJsonArrayArchive<RevisionItem>(STORAGE_KEYS.REVISION, 'Revision items');
  },

  saveRevisionItems(items: RevisionItem[]): boolean {
    if (!Array.isArray(items) || !canWriteJsonArrayArchive(STORAGE_KEYS.REVISION)) return false;
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
        if (legacyPortionsRaw || legacyRevsRaw) {
          console.info('[WIRD Storage] Attempting recovery from preserved legacy storage keys...');
          const legacyPortions: PortionStatusRecord[] = legacyPortionsRaw ? JSON.parse(legacyPortionsRaw) : [];
          const legacyRevs: RevisionItem[] = legacyRevsRaw ? JSON.parse(legacyRevsRaw) : [];
          if (legacyPortions.length === 0 && legacyRevs.length === 0) {
            console.error('[WIRD Storage] Recovery skipped: no non-empty legacy records exist; invalid canonical data was preserved.');
            return [];
          }
          const { portions, report } = migrateLegacyDataLosslessly(legacyPortions, legacyRevs);
          if (report.success && this.saveUnifiedPortions(portions)) {
            return portions;
          }
        }
        return [];
      }

      // If schema version is not 2, run migration first
      const legacyPortionsRaw = getItem(STORAGE_KEYS.PORTIONS);
      const legacyRevsRaw = getItem(STORAGE_KEYS.REVISION);
      if (legacyPortionsRaw || legacyRevsRaw) {
        this.ensureDataMigrated();
        const migrated = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
        if (migrated) return JSON.parse(migrated);
      }
      return [];
    } catch {
      return [];
    }
  },

  saveUnifiedPortions(portions: WirdPortion[]): boolean {
    try {
      const currentSchemaVersion = getItem(STORAGE_KEYS.SCHEMA_VERSION);
      if (currentSchemaVersion === '2') {
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
      
      // Attempt durable write
      const writeOk = setItem(STORAGE_KEYS.UNIFIED_PORTIONS, serialized);
      if (!writeOk) {
        console.error('[WIRD Storage] Write failed: Durable localStorage write failed (quota or storage error)');
        return false;
      }

      // Verified Readback
      const readback = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      if (!readback) {
        console.error('[WIRD Storage] Write verification failed: UNIFIED_PORTIONS readback is null');
        return false;
      }

      let parsed: any[];
      try {
        parsed = JSON.parse(readback);
      } catch {
        console.error('[WIRD Storage] Write verification failed: UNIFIED_PORTIONS readback is corrupt');
        return false;
      }

      if (!Array.isArray(parsed) || parsed.length !== portions.length) {
        console.error('[WIRD Storage] Write verification failed: UNIFIED_PORTIONS record count mismatch');
        return false;
      }

      // Verify the complete serialized payload, including nested history and metadata.
      const isCompletePayloadValid = JSON.stringify(parsed) === serialized;

      if (!isCompletePayloadValid) {
        console.error('[WIRD Storage] Write verification failed: Complete payload content mismatch on readback');
        return false;
      }

      // Update schema version only after persistence and complete payload readback are verified
      const versionOk = setItem(STORAGE_KEYS.SCHEMA_VERSION, '2');
      if (!versionOk) {
        return false;
      }

      // Keep legacy keys in sync for backward compatibility
      try {
        setItem(STORAGE_KEYS.PORTIONS, serialized);
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
        setItem(STORAGE_KEYS.REVISION, JSON.stringify(revItems));
      } catch (e) {
        console.warn('[WIRD Storage] Legacy backward-sync warning', e);
      }

      return true;
    } catch (e) {
      console.error("[WIRD Storage] saveUnifiedPortions write failed", e);
      return false;
    }
  },

  ensureDataMigrated(): MigrationReport {
    try {
      const currentVersion = getItem(STORAGE_KEYS.SCHEMA_VERSION);
      const unifiedData = getItem(STORAGE_KEYS.UNIFIED_PORTIONS);
      const hasInvalidCanonicalPayload = currentVersion === '2' && Boolean(unifiedData);

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
      const legacyPortions: PortionStatusRecord[] = legacyPortionsRaw ? JSON.parse(legacyPortionsRaw) : [];
      const legacyRevsRaw = getItem(STORAGE_KEYS.REVISION);
      const legacyRevs: RevisionItem[] = legacyRevsRaw ? JSON.parse(legacyRevsRaw) : [];

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

      const saved = this.saveUnifiedPortions(portions);
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
    return readJsonArrayArchive<TestResult>(STORAGE_KEYS.TESTS, 'Test results');
  },

  saveTest(test: TestResult): boolean {
    if (!canWriteJsonArrayArchive(STORAGE_KEYS.TESTS)) return false;
    try {
      const current = this.getTests();
      current.unshift(test);
      return setItem(STORAGE_KEYS.TESTS, JSON.stringify(current.slice(0, 50)));
    } catch (e) {
      console.warn("Storage write failed", e);
      return false;
    }
  },

  // Session Completion with rollback if either durable write fails.
  recordSessionCompletion(memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string): boolean {
    if (!Number.isSafeInteger(memorizedAyahs) || memorizedAyahs < 0 || memorizedAyahs > 6236 ||
        !Number.isSafeInteger(reviewedPages) || reviewedPages < 0 || reviewedPages > 604 ||
        !Number.isSafeInteger(minutes) || minutes < 0 || minutes > 1440 ||
        typeof taskName !== 'string' || !taskName.trim() || taskName.length > 200) return false;
    const today = getLocalDateString();
    const previousLogs = getItem(STORAGE_KEYS.LOGS);
    const previousProfile = getItem(STORAGE_KEYS.PROFILE);
    let logs: DailyLog[];
    try { logs = this.getLogs(); } catch (error) {
      console.warn('[WIRD Storage] Refusing to overwrite an invalid daily activity archive:', error);
      return false;
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

    if (!this.saveLogs(logs)) return false;

    const profile = this.getProfile();
    const { newStreak, newDate } = advanceStreakOnCompletion(profile.lastActiveDate, profile.streakDays, today);
    profile.streakDays = newStreak;
    profile.lastActiveDate = newDate;
    if (!this.saveProfile(profile)) {
      // Restore and verify both durable snapshots; never silently claim rollback succeeded.
      const restoreSnapshot = (key: string, previous: string | null): boolean => {
        try {
          if (previous === null) removeItem(key);
          else if (!setItem(key, previous)) return false;
          return getItem(key) === previous;
        } catch {
          return false;
        }
      };
      const logsRestored = restoreSnapshot(STORAGE_KEYS.LOGS, previousLogs);
      const profileRestored = restoreSnapshot(STORAGE_KEYS.PROFILE, previousProfile);
      if (!logsRestored || !profileRestored) {
        console.error('[WIRD Storage] Session activity rollback could not be verified. Export a backup before further edits.');
      }
      return false;
    }

    return true;
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
    const canonicalPortions = this.getUnifiedPortions();
    const backup: BackupPayload = {
      format: 'wird_backup',
      version: 4,
      timestamp: new Date().toISOString(),
      isEncrypted: false,
      unencryptedWarning: "تنبيه أمني: هذا الملف نصي غير مشفر بصيغة JSON صريحة ويحتوي على سجلات الحفظ والإعدادات الشخصية. احتفظ به في مكان آمن.",
      profile: this.getProfile(),
      plans: this.getPlans(),
      enginePlans: this.getEnginePlans(),
      revisionItems: this.getRevisionItems(),
      logs: this.getLogs(),
      tests: this.getTests(),
      portions: canonicalPortions,
      unifiedPortions: canonicalPortions,
      weakVerses: getItem(STORAGE_KEYS.WEAK_VERSES) ? JSON.parse(getItem(STORAGE_KEYS.WEAK_VERSES)!) : []
    };
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

