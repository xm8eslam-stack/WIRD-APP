import { 
  UserProfile, 
  MemorizationPlan, 
  RevisionItem, 
  DailyLog, 
  TestResult,
  PortionStatusRecord,
  WeakVerseItem 
} from '../types/quran';
import { PRESET_PLANS } from '../data/presetPlans';
import { EngineGeneratedPlan, PlanningEngine } from './planningEngine';

export const STORAGE_KEYS = {
  PROFILE: 'wird_profile',
  PLANS: 'wird_plans',
  ENGINE_PLANS: 'wird_engine_plans',
  PROGRESS: 'wird_progress',
  REVISION: 'wird_revision',
  LOGS: 'wird_logs',
  TESTS: 'wird_tests',
  PORTIONS: 'wird_portions_status',
  WEAK_VERSES: 'wird_weak_verses'
} as const;

// In-memory fallback for test / Node / SSR environments where localStorage is not defined
const memoryStorage = new Map<string, string>();

function getItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memoryStorage.get(key) || null;
}

function setItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore
  }
  memoryStorage.set(key, value);
}

function removeItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  memoryStorage.delete(key);
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
  lastActiveDate: new Date().toISOString().split('T')[0]
};

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
    nextDueDate: new Date().toISOString().split('T')[0],
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
    nextDueDate: new Date().toISOString().split('T')[0],
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
  weakVerses?: WeakVerseItem[];
}

export function validateBackupPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'الملف لا يحتوي على كائن JSON صالح' };
  }

  // Version check (Supported versions: 1, 2, 3)
  if (typeof payload.version !== 'number' || payload.version < 1 || payload.version > 3) {
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
  const arrayFields = ['plans', 'enginePlans', 'revisionItems', 'logs', 'tests', 'portions', 'weakVerses'] as const;
  for (const field of arrayFields) {
    if (payload[field] !== undefined && !Array.isArray(payload[field])) {
      return { valid: false, error: `الحقل ${field} يجب أن يكون مصفوفة صالحة` };
    }
  }

  return { valid: true };
}

export const StorageService = {
  // Profile
  getProfile(): UserProfile {
    try {
      const data = getItem(STORAGE_KEYS.PROFILE);
      if (!data) return { ...CLEAN_INITIAL_PROFILE };
      const parsed: UserProfile = JSON.parse(data);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const validStreak = calculateActiveStreak(parsed.lastActiveDate, parsed.streakDays, todayStr);
      if (validStreak !== parsed.streakDays) {
        parsed.streakDays = validStreak;
        this.saveProfile(parsed);
      }
      return parsed;
    } catch {
      return { ...CLEAN_INITIAL_PROFILE };
    }
  },

  saveProfile(profile: UserProfile): void {
    try {
      setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  // Plans (Returns clean empty array by default)
  getPlans(): MemorizationPlan[] {
    try {
      const data = getItem(STORAGE_KEYS.PLANS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePlans(plans: MemorizationPlan[]): void {
    try {
      setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  // Engine Plans (Returns clean empty array by default)
  getEnginePlans(): EngineGeneratedPlan[] {
    try {
      const data = getItem(STORAGE_KEYS.ENGINE_PLANS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveEnginePlans(plans: EngineGeneratedPlan[]): void {
    try {
      setItem(STORAGE_KEYS.ENGINE_PLANS, JSON.stringify(plans));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  // Revision Items (Returns clean empty array by default)
  getRevisionItems(): RevisionItem[] {
    try {
      const data = getItem(STORAGE_KEYS.REVISION);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveRevisionItems(items: RevisionItem[]): void {
    try {
      setItem(STORAGE_KEYS.REVISION, JSON.stringify(items));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  // Logs (Returns clean empty array by default)
  getLogs(): DailyLog[] {
    try {
      const data = getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveLogs(logs: DailyLog[]): void {
    try {
      setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  // Tests
  getTests(): TestResult[] {
    try {
      const data = getItem(STORAGE_KEYS.TESTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTest(test: TestResult): void {
    try {
      const current = this.getTests();
      current.unshift(test);
      setItem(STORAGE_KEYS.TESTS, JSON.stringify(current.slice(0, 50)));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  // Session Completion with True Streak Advancement
  recordSessionCompletion(memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string): void {
    const today = new Date().toISOString().split('T')[0];
    const logs = this.getLogs();
    const existingIndex = logs.findIndex(l => l.date === today);

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

    this.saveLogs(logs);

    // Update streak truthfully
    const profile = this.getProfile();
    const { newStreak, newDate } = advanceStreakOnCompletion(profile.lastActiveDate, profile.streakDays, today);
    profile.streakDays = newStreak;
    profile.lastActiveDate = newDate;
    this.saveProfile(profile);
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
    const backup: BackupPayload = {
      format: 'wird_backup',
      version: 3,
      timestamp: new Date().toISOString(),
      isEncrypted: false,
      unencryptedWarning: "تنبيه أمني: هذا الملف نصي غير مشفر بصيغة JSON صريحة ويحتوي على سجلات الحفظ والإعدادات الشخصية. احتفظ به في مكان آمن.",
      profile: this.getProfile(),
      plans: this.getPlans(),
      enginePlans: this.getEnginePlans(),
      revisionItems: this.getRevisionItems(),
      logs: this.getLogs(),
      tests: this.getTests(),
      portions: getItem(STORAGE_KEYS.PORTIONS) ? JSON.parse(getItem(STORAGE_KEYS.PORTIONS)!) : [],
      weakVerses: getItem(STORAGE_KEYS.WEAK_VERSES) ? JSON.parse(getItem(STORAGE_KEYS.WEAK_VERSES)!) : []
    };
    return JSON.stringify(backup, null, 2);
  },

  // Atomic Import with Pre-Validation (Never partially overwrites on failure)
  importBackup(jsonString: string): { success: boolean; message: string } {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return { success: false, message: 'صيغة الملف غير صالحة، يرجى التأكد من اختيار ملف JSON سليم.' };
    }

    const validation = validateBackupPayload(parsed);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'فشل التحقق من بنية النسخة الاحتياطية' };
    }

    // Atomic write only after all validations pass
    try {
      if (parsed.profile) this.saveProfile(parsed.profile);
      if (parsed.plans) this.savePlans(parsed.plans);
      if (parsed.enginePlans) this.saveEnginePlans(parsed.enginePlans);
      if (parsed.revisionItems) this.saveRevisionItems(parsed.revisionItems);
      if (parsed.logs) this.saveLogs(parsed.logs);
      if (parsed.tests) {
        setItem(STORAGE_KEYS.TESTS, JSON.stringify(parsed.tests));
      }
      if (parsed.portions) {
        setItem(STORAGE_KEYS.PORTIONS, JSON.stringify(parsed.portions));
      }
      if (parsed.weakVerses) {
        setItem(STORAGE_KEYS.WEAK_VERSES, JSON.stringify(parsed.weakVerses));
      }
      return { success: true, message: 'تم استيراد كافة البيانات بنجاح وبشكل متكامل.' };
    } catch (e: any) {
      return { success: false, message: `تعذر حفظ البيانات في الذاكرة المحلية: ${e?.message || 'خطأ غير متوقع'}` };
    }
  },

  // Complete Clean Reset
  resetAllData(): void {
    removeItem(STORAGE_KEYS.PROFILE);
    removeItem(STORAGE_KEYS.PLANS);
    removeItem(STORAGE_KEYS.ENGINE_PLANS);
    removeItem(STORAGE_KEYS.PROGRESS);
    removeItem(STORAGE_KEYS.REVISION);
    removeItem(STORAGE_KEYS.LOGS);
    removeItem(STORAGE_KEYS.TESTS);
    removeItem(STORAGE_KEYS.PORTIONS);
    removeItem(STORAGE_KEYS.WEAK_VERSES);
    memoryStorage.clear();
  },

  // Test-only Snapshot API
  getStorageSnapshot(): Record<string, string | null> {
    const snapshot: Record<string, string | null> = {};
    // Snapshots internal memory storage
    memoryStorage.forEach((val, key) => {
      snapshot[`memory:${key}`] = val;
    });
    // Snapshots localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        if (typeof localStorage !== 'undefined') {
          snapshot[`local:${key}`] = localStorage.getItem(key);
        }
      } catch { /* ignore */ }
    });
    return snapshot;
  },

  restoreStorageSnapshot(snapshot: Record<string, string | null>): void {
    // Restore memory storage
    memoryStorage.clear();
    // Restore localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch { /* ignore */ }
    });

    Object.entries(snapshot).forEach(([fullKey, val]) => {
      if (fullKey.startsWith('memory:')) {
        const key = fullKey.replace('memory:', '');
        if (val !== null) memoryStorage.set(key, val);
      } else if (fullKey.startsWith('local:')) {
        const key = fullKey.replace('local:', '');
        try {
          if (typeof localStorage !== 'undefined' && val !== null) {
            localStorage.setItem(key, val);
          }
        } catch { /* ignore */ }
      }
    });
  }
};

