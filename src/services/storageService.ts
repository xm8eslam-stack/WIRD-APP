import { 
  UserProfile, 
  MemorizationPlan, 
  RevisionItem, 
  AyahProgress, 
  DailyLog, 
  TestResult 
} from '../types/quran';
import { PRESET_PLANS } from '../data/presetPlans';

const STORAGE_KEYS = {
  PROFILE: 'wird_profile',
  PLANS: 'wird_plans',
  PROGRESS: 'wird_progress',
  REVISION: 'wird_revision',
  LOGS: 'wird_logs',
  TESTS: 'wird_tests'
};

const DEFAULT_PROFILE: UserProfile = {
  name: "عبد الرحمن",
  email: "abdurrahman@example.com",
  memorizationGoal: "إتقان حفظ كتاب الله كاملاً مع التدبر والتثبيت المستمر",
  preferredReciter: "alafasy",
  quranFontSize: "lg",
  audioAutoPlay: true,
  repetitionTarget: 10,
  theme: "light",
  streakDays: 14,
  lastActiveDate: new Date().toISOString().split('T')[0]
};

const DEFAULT_REVISION_ITEMS: RevisionItem[] = [
  {
    id: "rev-1",
    surahNumber: 67,
    surahName: "الملك",
    startAyah: 1,
    endAyah: 15,
    pageNumber: 562,
    juzNumber: 29,
    type: "minor",
    lastReviewedDate: "2026-11-02",
    nextDueDate: "2026-11-04",
    intervalDays: 2,
    easeFactor: 2.5,
    repetitionCount: 4,
    strength: "strong"
  },
  {
    id: "rev-2",
    surahNumber: 67,
    surahName: "الملك",
    startAyah: 16,
    endAyah: 30,
    pageNumber: 563,
    juzNumber: 29,
    type: "minor",
    lastReviewedDate: "2026-11-01",
    nextDueDate: "2026-11-04",
    intervalDays: 3,
    easeFactor: 2.2,
    repetitionCount: 3,
    strength: "medium"
  },
  {
    id: "rev-3",
    surahNumber: 78,
    surahName: "النبأ",
    startAyah: 1,
    endAyah: 20,
    pageNumber: 582,
    juzNumber: 30,
    type: "major",
    lastReviewedDate: "2026-10-28",
    nextDueDate: "2026-11-04",
    intervalDays: 7,
    easeFactor: 2.6,
    repetitionCount: 6,
    strength: "strong"
  },
  {
    id: "rev-4",
    surahNumber: 18,
    surahName: "الكهف",
    startAyah: 1,
    endAyah: 10,
    pageNumber: 293,
    juzNumber: 15,
    type: "major",
    lastReviewedDate: "2026-10-31",
    nextDueDate: "2026-11-05",
    intervalDays: 5,
    easeFactor: 2.4,
    repetitionCount: 5,
    strength: "strong"
  },
  {
    id: "rev-5",
    surahNumber: 2,
    surahName: "البقرة (آية الكرسي والخواتيم)",
    startAyah: 255,
    endAyah: 255,
    pageNumber: 42,
    juzNumber: 3,
    type: "minor",
    lastReviewedDate: "2026-10-25",
    nextDueDate: "2026-11-04",
    intervalDays: 1,
    easeFactor: 1.8,
    repetitionCount: 2,
    strength: "weak"
  }
];

const DEFAULT_LOGS: DailyLog[] = [
  { date: "2026-10-29", memorizedAyahsCount: 6, reviewedPagesCount: 3, minutesSpent: 35, completedTasks: ["حفظ سورة النبأ 1-6", "مراجعة سورة الملك"] },
  { date: "2026-10-30", memorizedAyahsCount: 6, reviewedPagesCount: 2, minutesSpent: 30, completedTasks: ["حفظ سورة النبأ 7-12"] },
  { date: "2026-10-31", memorizedAyahsCount: 8, reviewedPagesCount: 4, minutesSpent: 45, completedTasks: ["حفظ سورة النبأ 13-20", "مراجعة الكهف"] },
  { date: "2026-11-01", memorizedAyahsCount: 0, reviewedPagesCount: 5, minutesSpent: 40, completedTasks: ["يوم مراجعة أسبوعية وتثبيت"] },
  { date: "2026-11-02", memorizedAyahsCount: 7, reviewedPagesCount: 2, minutesSpent: 35, completedTasks: ["حفظ سورة النبأ 21-27"] },
  { date: "2026-11-03", memorizedAyahsCount: 8, reviewedPagesCount: 4, minutesSpent: 45, completedTasks: ["حفظ سورة النبأ 28-35", "مراجعة الملك"] },
  { date: "2026-11-04", memorizedAyahsCount: 5, reviewedPagesCount: 3, minutesSpent: 25, completedTasks: ["حفظ سورة النبأ 36-40"] }
];

export const StorageService = {
  getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? JSON.parse(data) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  getPlans(): MemorizationPlan[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLANS);
      return data ? JSON.parse(data) : PRESET_PLANS;
    } catch {
      return PRESET_PLANS;
    }
  },

  savePlans(plans: MemorizationPlan[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  getRevisionItems(): RevisionItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REVISION);
      return data ? JSON.parse(data) : DEFAULT_REVISION_ITEMS;
    } catch {
      return DEFAULT_REVISION_ITEMS;
    }
  },

  saveRevisionItems(items: RevisionItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REVISION, JSON.stringify(items));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  getLogs(): DailyLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      return data ? JSON.parse(data) : DEFAULT_LOGS;
    } catch {
      return DEFAULT_LOGS;
    }
  },

  saveLogs(logs: DailyLog[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

  getTests(): TestResult[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TESTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTest(test: TestResult): void {
    try {
      const current = this.getTests();
      current.unshift(test);
      localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(current.slice(0, 50)));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  },

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

    // Update streak and profile
    const profile = this.getProfile();
    if (profile.lastActiveDate !== today) {
      profile.streakDays += 1;
      profile.lastActiveDate = today;
      this.saveProfile(profile);
    }
  },

  exportFullBackup(): string {
    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      profile: this.getProfile(),
      plans: this.getPlans(),
      revisionItems: this.getRevisionItems(),
      logs: this.getLogs(),
      tests: this.getTests()
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.profile) this.saveProfile(parsed.profile);
      if (parsed.plans) this.savePlans(parsed.plans);
      if (parsed.revisionItems) this.saveRevisionItems(parsed.revisionItems);
      if (parsed.logs) this.saveLogs(parsed.logs);
      return true;
    } catch {
      return false;
    }
  },

  resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.PLANS);
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.REVISION);
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.TESTS);
  }
};
