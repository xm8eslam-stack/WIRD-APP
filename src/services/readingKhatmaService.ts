export interface ReadingKhatma {
  id: string;
  startedAt: string;
  completedPages: number[];
  completedAt?: string;
  completedCycles: Array<{ id: string; startedAt: string; completedAt: string }>;
}

const STORAGE_KEY = 'wird.reading.khatma.v1';
const isValidKhatma = (value: unknown): value is ReadingKhatma => {
  if (!value || typeof value !== 'object') return false;
  const item = value as ReadingKhatma;
  const cycles = item.completedCycles;
  return typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.startedAt === 'string' && Number.isFinite(Date.parse(item.startedAt)) &&
    Array.isArray(item.completedPages) && item.completedPages.every(page => Number.isInteger(page) && page >= 1 && page <= 604) &&
    (item.completedAt === undefined || (typeof item.completedAt === 'string' && Number.isFinite(Date.parse(item.completedAt)))) &&
    (cycles === undefined || (Array.isArray(cycles) && cycles.length <= 1000 && cycles.every(cycle => Boolean(cycle && typeof cycle.id === 'string' && Number.isFinite(Date.parse(cycle.startedAt)) && Number.isFinite(Date.parse(cycle.completedAt))))));
};

export function readReadingKhatma(storage: Pick<Storage, 'getItem'> = localStorage): ReadingKhatma | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isValidKhatma(value) ? { ...value, completedPages: [...new Set(value.completedPages)].sort((a, b) => a - b), completedCycles: value.completedCycles || [] } : null;
  } catch { return null; }
}

export function startReadingKhatma(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage, now = new Date()): ReadingKhatma {
  const current = readReadingKhatma(storage);
  if (current && !current.completedAt) return current;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw && !current) throw new Error('تعذر قراءة تقدم ختمة سابق؛ احتفظنا بالبيانات ولم نستبدلها.');
  const completedCycles = current?.completedAt ? [...current.completedCycles, { id: current.id, startedAt: current.startedAt, completedAt: current.completedAt }] : current?.completedCycles || [];
  const next: ReadingKhatma = { id: `${now.getTime()}-${Math.random().toString(36).slice(2)}`, startedAt: now.toISOString(), completedPages: [], completedCycles };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function markReadingPage(page: number, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): ReadingKhatma {
  if (!Number.isInteger(page) || page < 1 || page > 604) throw new RangeError('رقم الصفحة يجب أن يكون بين 1 و604.');
  const current = readReadingKhatma(storage);
  if (!current || current.completedAt) throw new Error('ابدأ ختمة قراءة نشطة أولاً.');
  const completedPages = [...new Set([...current.completedPages, page])].sort((a, b) => a - b);
  const next: ReadingKhatma = { ...current, completedPages, completedCycles: current.completedCycles, ...(completedPages.length === 604 ? { completedAt: new Date().toISOString() } : {}) };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearReadingKhatma(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
