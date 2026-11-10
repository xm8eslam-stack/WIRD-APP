export interface ReadingKhatmaPlanOptions {
  durationDays: number;
  sessionsPerDay: number;
}

export interface ReadingKhatmaPlan extends ReadingKhatmaPlanOptions {
  targetCompletionDate: string;
}

export interface ReadingKhatmaDailyLog {
  date: string;
  pages: number[];
}

export interface ReadingKhatmaCycle {
  id: string;
  startedAt: string;
  completedAt: string;
  durationDays?: number;
  pagesRead?: number;
}

export interface ReadingKhatma {
  id: string;
  startedAt: string;
  completedPages: number[];
  completedAt?: string;
  completedCycles: ReadingKhatmaCycle[];
  plan?: ReadingKhatmaPlan;
  dailyLogs?: ReadingKhatmaDailyLog[];
  isPaused?: boolean;
  pausedAt?: string;
  lastReadAt?: string;
}

export interface ReadingKhatmaProgress {
  completedPages: number;
  remainingPages: number;
  percent: number;
  nextPage: number;
  daysRemaining: number;
  pagesPerDay: number;
  sessionsPerDay: number;
  pagesPerSession: number;
  pagesReadToday: number;
  targetCompletionDate: string;
  isPaused: boolean;
}

const STORAGE_KEY = 'wird.reading.khatma.v1';
const DEFAULT_PLAN: ReadingKhatmaPlanOptions = { durationDays: 30, sessionsPerDay: 2 };

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function addDays(date: Date, days: number): string {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return localDateKey(result);
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isValidPlan(value: unknown): value is ReadingKhatmaPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as ReadingKhatmaPlan;
  const targetDate = typeof plan.targetCompletionDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(plan.targetCompletionDate)
      ? dateFromKey(plan.targetCompletionDate)
      : null;
  return Number.isInteger(plan.durationDays) && plan.durationDays >= 1 && plan.durationDays <= 365 &&
    Number.isInteger(plan.sessionsPerDay) && plan.sessionsPerDay >= 1 && plan.sessionsPerDay <= 6 &&
    Boolean(targetDate && Number.isFinite(targetDate.getTime()) && localDateKey(targetDate) === plan.targetCompletionDate);
}

function normalizePlan(options: ReadingKhatmaPlanOptions, now: Date): ReadingKhatmaPlan {
  if (!Number.isInteger(options.durationDays) || options.durationDays < 1 || options.durationDays > 365) {
    throw new RangeError('مدة الختمة يجب أن تكون بين يوم واحد و365 يوماً.');
  }
  if (!Number.isInteger(options.sessionsPerDay) || options.sessionsPerDay < 1 || options.sessionsPerDay > 6) {
    throw new RangeError('عدد جلسات القراءة اليومية يجب أن يكون بين جلسة واحدة و6 جلسات.');
  }
  return {
    durationDays: options.durationDays,
    sessionsPerDay: options.sessionsPerDay,
    targetCompletionDate: addDays(now, options.durationDays)
  };
}

function isValidDailyLog(value: unknown): value is ReadingKhatmaDailyLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as ReadingKhatmaDailyLog;
  const logDate = typeof log.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(log.date)
    ? dateFromKey(log.date)
    : null;
  return Boolean(logDate && Number.isFinite(logDate.getTime()) && localDateKey(logDate) === log.date) &&
    Array.isArray(log.pages) && log.pages.every(page => Number.isInteger(page) && page >= 1 && page <= 604);
}

const isValidKhatma = (value: unknown): value is ReadingKhatma => {
  if (!value || typeof value !== 'object') return false;
  const item = value as ReadingKhatma;
  const cycles = item.completedCycles;
  return typeof item.id === 'string' && item.id.length > 0 &&
    isValidDate(item.startedAt) &&
    Array.isArray(item.completedPages) && item.completedPages.every(page => Number.isInteger(page) && page >= 1 && page <= 604) &&
    (item.completedAt === undefined || isValidDate(item.completedAt)) &&
    (cycles === undefined || (Array.isArray(cycles) && cycles.length <= 1000 && cycles.every(cycle =>
      Boolean(cycle && typeof cycle.id === 'string' && isValidDate(cycle.startedAt) && isValidDate(cycle.completedAt))))) &&
    (item.plan === undefined || isValidPlan(item.plan)) &&
    (item.dailyLogs === undefined || (Array.isArray(item.dailyLogs) && item.dailyLogs.length <= 1000 && item.dailyLogs.every(isValidDailyLog))) &&
    (item.isPaused === undefined || typeof item.isPaused === 'boolean') &&
    (item.pausedAt === undefined || isValidDate(item.pausedAt)) &&
    (item.lastReadAt === undefined || isValidDate(item.lastReadAt));
};

export function readReadingKhatma(storage: Pick<Storage, 'getItem'> = localStorage): ReadingKhatma | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isValidKhatma(value)) return null;
    const startedAt = new Date(value.startedAt);
    const legacyPlan = normalizePlan(DEFAULT_PLAN, startedAt);
    return {
      ...value,
      completedPages: [...new Set(value.completedPages)].sort((a, b) => a - b),
      completedCycles: value.completedCycles || [],
      plan: value.plan || legacyPlan,
      dailyLogs: (value.dailyLogs || []).map(log => ({
        date: log.date,
        pages: [...new Set(log.pages)].sort((a, b) => a - b)
      })).sort((a, b) => a.date.localeCompare(b.date))
    };
  } catch { return null; }
}

export function startReadingKhatma(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date(),
  options: ReadingKhatmaPlanOptions = DEFAULT_PLAN
): ReadingKhatma {
  const current = readReadingKhatma(storage);
  if (current && !current.completedAt) return current;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw && !current) throw new Error('تعذر قراءة تقدم ختمة سابق؛ احتفظنا بالبيانات ولم نستبدلها.');
  const completedCycles = current?.completedAt
    ? [...current.completedCycles, {
      id: current.id,
      startedAt: current.startedAt,
      completedAt: current.completedAt,
      durationDays: current.plan?.durationDays,
      pagesRead: current.completedPages.length
    }]
    : current?.completedCycles || [];
  const next: ReadingKhatma = {
    id: now.getTime() + '-' + Math.random().toString(36).slice(2),
    startedAt: now.toISOString(),
    completedPages: [],
    completedCycles,
    plan: normalizePlan(options, now),
    dailyLogs: [],
    isPaused: false
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function updateReadingKhatmaPlan(
  options: ReadingKhatmaPlanOptions,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date()
): ReadingKhatma {
  const current = readReadingKhatma(storage);
  if (!current || current.completedAt) throw new Error('لا توجد ختمة قراءة نشطة لتعديل خطتها.');
  const next = { ...current, plan: normalizePlan(options, now) };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function pauseReadingKhatma(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date()
): ReadingKhatma {
  const current = readReadingKhatma(storage);
  if (!current || current.completedAt) throw new Error('لا توجد ختمة نشطة لإيقافها مؤقتاً.');
  if (current.isPaused) return current;
  const next = { ...current, isPaused: true, pausedAt: now.toISOString() };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resumeReadingKhatma(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): ReadingKhatma {
  const current = readReadingKhatma(storage);
  if (!current || current.completedAt) throw new Error('لا توجد ختمة نشطة لاستئنافها.');
  if (!current.isPaused) return current;
  const next = { ...current, isPaused: false };
  delete next.pausedAt;
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function markReadingPage(
  page: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date()
): ReadingKhatma {
  if (!Number.isInteger(page) || page < 1 || page > 604) throw new RangeError('رقم الصفحة يجب أن يكون بين 1 و604.');
  const current = readReadingKhatma(storage);
  if (!current || current.completedAt) throw new Error('ابدأ ختمة قراءة نشطة أولاً.');
  if (current.isPaused) throw new Error('الختمة متوقفة مؤقتاً؛ استأنفها قبل تسجيل القراءة.');
  const completedPages = [...new Set([...current.completedPages, page])].sort((a, b) => a - b);
  const today = localDateKey(now);
  const dailyLogs = [...(current.dailyLogs || [])];
  const todayIndex = dailyLogs.findIndex(log => log.date === today);
  if (todayIndex >= 0) {
    dailyLogs[todayIndex] = { date: today, pages: [...new Set([...dailyLogs[todayIndex].pages, page])].sort((a, b) => a - b) };
  } else {
    dailyLogs.push({ date: today, pages: [page] });
  }
  const next: ReadingKhatma = {
    ...current,
    completedPages,
    dailyLogs: dailyLogs.sort((a, b) => a.date.localeCompare(b.date)),
    lastReadAt: now.toISOString(),
    ...(completedPages.length === 604 ? { completedAt: now.toISOString(), isPaused: false } : {})
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getReadingKhatmaProgress(khatma: ReadingKhatma, now = new Date()): ReadingKhatmaProgress {
  const completedPages = new Set(khatma.completedPages).size;
  const remainingPages = Math.max(0, 604 - completedPages);
  const plan = khatma.plan || normalizePlan(DEFAULT_PLAN, new Date(khatma.startedAt));
  const daysRemaining = khatma.completedAt
    ? 0
    : Math.max(1, Math.ceil((dateFromKey(plan.targetCompletionDate).getTime() - dateFromKey(localDateKey(now)).getTime()) / 86_400_000));
  const pagesPerDay = remainingPages === 0 ? 0 : Math.ceil(remainingPages / daysRemaining);
  const sessionsPerDay = plan.sessionsPerDay;
  const todayLog = khatma.dailyLogs?.find(log => log.date === localDateKey(now));
  return {
    completedPages,
    remainingPages,
    percent: Math.floor(completedPages / 604 * 100),
    nextPage: Array.from({ length: 604 }, (_, index) => index + 1).find(page => !khatma.completedPages.includes(page)) || 604,
    daysRemaining,
    pagesPerDay,
    sessionsPerDay,
    pagesPerSession: pagesPerDay === 0 ? 0 : Math.ceil(pagesPerDay / sessionsPerDay),
    pagesReadToday: todayLog?.pages.length || 0,
    targetCompletionDate: plan.targetCompletionDate,
    isPaused: Boolean(khatma.isPaused)
  };
}

export function clearReadingKhatma(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
