export type RevelationType = 'مكية' | 'مدنية';

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  versesCount: number;
  revelationType: RevelationType;
  pageStart: number;
  pageEnd: number;
  juzStart: number;
  juzEnd: number;
}

export interface Ayah {
  number: number; // overall number or numberInSurah
  numberInSurah: number;
  surahNumber: number;
  text: string;
  words?: string[];
  juz: number;
  page: number;
  sajda?: boolean;
}

export type MemorizationStatus = 'not_started' | 'learning' | 'memorized' | 'needs_revision';

export interface AyahProgress {
  surahNumber: number;
  ayahNumber: number;
  status: MemorizationStatus;
  lastReviewed?: string;
  repetitionCount: number;
  retentionScore: number; // 1 to 5
}

export interface MemorizationPlan {
  id: string;
  title: string;
  description: string;
  type: 'whole_quran' | 'juz' | 'surahs' | 'custom';
  targetSurahs?: number[];
  targetJuz?: number[];
  startPage?: number;
  endPage?: number;
  totalUnits: number; // e.g. total ayahs or total pages
  completedUnits: number;
  unitType: 'ayah' | 'page';
  dailyTarget: number; // e.g. 5 ayahs or 1 page
  memorizationDaysPerWeek: number; // e.g. 5
  revisionDaysPerWeek: number; // e.g. 2
  startDate: string;
  targetEndDate: string;
  isActive: boolean;
  color?: string;
}

export interface RevisionItem {
  id: string;
  surahNumber: number;
  surahName: string;
  startAyah: number;
  endAyah: number;
  pageNumber?: number;
  juzNumber?: number;
  type: 'minor' | 'major'; // صغرى (recent) or كبرى (cumulative)
  lastReviewedDate?: string;
  nextDueDate: string;
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
  strength: 'strong' | 'medium' | 'weak'; // راسخ | متوسط | يتفلت
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  memorizedAyahsCount: number;
  reviewedPagesCount: number;
  minutesSpent: number;
  completedTasks: string[];
}

export interface TestResult {
  id: string;
  date: string;
  type: 'complete_verse' | 'order_words' | 'mutashabihat' | 'surah_beginnings';
  surahName: string;
  score: number;
  totalQuestions: number;
  weakVerses: string[];
}

export interface UserProfile {
  name: string;
  email: string;
  memorizationGoal: string;
  preferredReciter: ReciterId;
  quranFontSize: 'sm' | 'md' | 'lg' | 'xl';
  audioAutoPlay: boolean;
  repetitionTarget: number;
  theme: 'light' | 'dark';
  streakDays: number;
  lastActiveDate: string;
}

export type ReciterId = 'alafasy' | 'husary' | 'abdulbasit' | 'ghamdi' | 'minshawi';

export interface ReciterInfo {
  id: ReciterId;
  name: string;
  identifier: string; // EveryAyah identifier
  subfolder: string;
}

export interface MutashabihItem {
  id: string;
  title: string;
  surah1: {
    name: string;
    surahNumber: number;
    ayahNumber: number;
    text: string;
  };
  surah2: {
    name: string;
    surahNumber: number;
    ayahNumber: number;
    text: string;
  };
  distinctionRule: string; // ضبط المتشابه والضابط الحفظي
  difficulty: 'easy' | 'medium' | 'advanced';
}
