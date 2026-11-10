import type { DailyLog } from '../types/quran';
import { QuranMath } from './quranMath';

export interface ActivityBaselineV1 {
  schemaVersion: 1;
  baselineId: string;
  logs: readonly DailyLog[];
}

export interface SessionActivityEventV2 {
  schemaVersion: 2;
  eventId: string;
  baselineId: string;
  occurredAtMs: number;
  localDate: string;
  timezoneOffsetMinutes: number;
  mode: 'memorize' | 'review';
  memorizedAyahs: number;
  reviewedPages: number;
  minutes: number;
  taskName: string;
  surahNumber?: number;
  startAyah?: number;
  endAyah?: number;
}

export type ActivityProjectionErrorCode =
  | 'invalid_baseline'
  | 'invalid_events'
  | 'invalid_event'
  | 'baseline_mismatch'
  | 'event_id_collision'
  | 'aggregate_overflow';

export type ActivityProjectionResult =
  | {
      success: true;
      logs: DailyLog[];
      appliedEventCount: number;
      duplicateEventCount: number;
    }
  | {
      success: false;
      errorCode: ActivityProjectionErrorCode;
      error: string;
    };

const MAX_DAILY_LOGS = 10_000;
const MAX_ACTIVITY_EVENTS = 10_000;
const MAX_DAILY_COUNT = 100_000;
const MAX_DAILY_MINUTES = 1_440;
const MAX_COMPLETED_TASKS = 100;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isDailyLog(value: unknown): value is DailyLog {
  if (!isRecord(value) || !isDateOnly(value.date)) return false;
  return Number.isSafeInteger(value.memorizedAyahsCount) &&
    Number(value.memorizedAyahsCount) >= 0 &&
    Number(value.memorizedAyahsCount) <= MAX_DAILY_COUNT &&
    Number.isSafeInteger(value.reviewedPagesCount) &&
    Number(value.reviewedPagesCount) >= 0 &&
    Number(value.reviewedPagesCount) <= MAX_DAILY_COUNT &&
    Number.isSafeInteger(value.minutesSpent) &&
    Number(value.minutesSpent) >= 0 &&
    Number(value.minutesSpent) <= MAX_DAILY_MINUTES &&
    Array.isArray(value.completedTasks) &&
    value.completedTasks.length <= MAX_COMPLETED_TASKS &&
    value.completedTasks.every(task =>
      typeof task === 'string' && task.trim().length > 0 && task.length <= 200
    );
}

function isValidBaseline(value: unknown): value is ActivityBaselineV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      typeof value.baselineId !== 'string' || !SAFE_ID.test(value.baselineId) ||
      !Array.isArray(value.logs) || value.logs.length > MAX_DAILY_LOGS ||
      !value.logs.every(isDailyLog)) {
    return false;
  }
  return new Set(value.logs.map(log => log.date)).size === value.logs.length;
}

const EVENT_KEYS = new Set([
  'schemaVersion', 'eventId', 'baselineId', 'occurredAtMs', 'localDate',
  'timezoneOffsetMinutes', 'mode', 'memorizedAyahs', 'reviewedPages',
  'minutes', 'taskName', 'surahNumber', 'startAyah', 'endAyah'
]);

function isValidSessionActivityEvent(value: unknown): value is SessionActivityEventV2 {
  if (!isRecord(value) || Object.keys(value).some(key => !EVENT_KEYS.has(key)) ||
      value.schemaVersion !== 2 ||
      typeof value.eventId !== 'string' || !SAFE_ID.test(value.eventId) ||
      typeof value.baselineId !== 'string' || !SAFE_ID.test(value.baselineId) ||
      !Number.isSafeInteger(value.occurredAtMs) || Number(value.occurredAtMs) < 0 ||
      !isDateOnly(value.localDate) ||
      !Number.isSafeInteger(value.timezoneOffsetMinutes) ||
      Number(value.timezoneOffsetMinutes) < -840 || Number(value.timezoneOffsetMinutes) > 840 ||
      (value.mode !== 'memorize' && value.mode !== 'review') ||
      !Number.isSafeInteger(value.memorizedAyahs) ||
      Number(value.memorizedAyahs) < 0 || Number(value.memorizedAyahs) > 6_236 ||
      !Number.isSafeInteger(value.reviewedPages) ||
      Number(value.reviewedPages) < 0 || Number(value.reviewedPages) > 604 ||
      !Number.isSafeInteger(value.minutes) ||
      Number(value.minutes) < 0 || Number(value.minutes) > MAX_DAILY_MINUTES ||
      typeof value.taskName !== 'string' || !value.taskName.trim() || value.taskName.length > 200 ||
      (Number(value.memorizedAyahs) === 0 &&
        Number(value.reviewedPages) === 0 && Number(value.minutes) === 0)) {
    return false;
  }

  const hasSurah = value.surahNumber !== undefined;
  const hasStart = value.startAyah !== undefined;
  const hasEnd = value.endAyah !== undefined;
  if (hasSurah || hasStart || hasEnd) {
    if (!hasSurah || !hasStart || !hasEnd ||
        typeof value.surahNumber !== 'number' ||
        typeof value.startAyah !== 'number' ||
        typeof value.endAyah !== 'number' ||
        !QuranMath.isValidCoordinate(value.surahNumber, value.startAyah) ||
        !QuranMath.isValidCoordinate(value.surahNumber, value.endAyah) ||
        value.endAyah < value.startAyah) {
      return false;
    }
  }
  return true;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableSerialize(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

function failure(
  errorCode: ActivityProjectionErrorCode,
  error: string
): ActivityProjectionResult {
  return { success: false, errorCode, error };
}

/**
 * Deterministically derives daily activity from an immutable legacy baseline
 * plus post-cutover session events. This function is intentionally pure:
 * it performs no storage, sync, network, or migration writes.
 *
 * Every event must name the exact baseline it was created against. Events
 * from an older baseline are rejected instead of being silently counted or
 * discarded; the caller must preserve and reconcile those events separately.
 */
export function projectDailyActivityFromEvents(
  baselineInput: unknown,
  eventInputs: readonly unknown[]
): ActivityProjectionResult {
  if (!isValidBaseline(baselineInput)) {
    return failure('invalid_baseline', 'النسخة الأساسية لسجل النشاط غير صالحة؛ لم يتم إنشاء إسقاط.');
  }
  if (!Array.isArray(eventInputs) || eventInputs.length > MAX_ACTIVITY_EVENTS) {
    return failure('invalid_events', 'قائمة أحداث النشاط تتجاوز الحد المسموح أو ليست مصفوفة صالحة.');
  }

  const baseline = baselineInput;
  const seenEvents = new Map<string, string>();
  const uniqueEvents: SessionActivityEventV2[] = [];
  let duplicateEventCount = 0;

  for (const candidate of eventInputs) {
    if (!isValidSessionActivityEvent(candidate)) {
      return failure('invalid_event', 'يوجد حدث جلسة غير صالح؛ لم يتم تطبيق أي حدث.');
    }
    if (candidate.baselineId !== baseline.baselineId) {
      return failure('baseline_mismatch', 'حدث الجلسة مرتبط بنسخة أساسية مختلفة؛ تم إيقاف الإسقاط لحماية سجل الحفظ القديم.');
    }

    const fingerprint = stableSerialize(candidate);
    const previous = seenEvents.get(candidate.eventId);
    if (previous !== undefined) {
      if (previous !== fingerprint) {
        return failure('event_id_collision', 'معرّف حدث الجلسة مستخدم بمحتوى مختلف؛ لم يتم احتساب أي حدث.');
      }
      duplicateEventCount++;
      continue;
    }
    seenEvents.set(candidate.eventId, fingerprint);
    uniqueEvents.push(candidate);
  }

  const logsByDate = new Map<string, DailyLog>();
  const baselineTaskNames = new Map<string, Set<string>>();
  const addedTaskNames = new Map<string, Set<string>>();
  const newDates = new Set<string>();

  for (const log of baseline.logs) {
    const copy: DailyLog = { ...log, completedTasks: [...log.completedTasks] };
    logsByDate.set(copy.date, copy);
    baselineTaskNames.set(copy.date, new Set(copy.completedTasks));
    addedTaskNames.set(copy.date, new Set());
  }

  for (const event of uniqueEvents) {
    let log = logsByDate.get(event.localDate);
    if (!log) {
      log = {
        date: event.localDate,
        memorizedAyahsCount: 0,
        reviewedPagesCount: 0,
        minutesSpent: 0,
        completedTasks: []
      };
      logsByDate.set(event.localDate, log);
      baselineTaskNames.set(event.localDate, new Set());
      addedTaskNames.set(event.localDate, new Set());
      newDates.add(event.localDate);
    }

    const memorized = log.memorizedAyahsCount + event.memorizedAyahs;
    const reviewed = log.reviewedPagesCount + event.reviewedPages;
    const minutes = log.minutesSpent + event.minutes;
    const baseTasks = baselineTaskNames.get(event.localDate)!;
    const addedTasks = addedTaskNames.get(event.localDate)!;
    if (!Number.isSafeInteger(memorized) || memorized > MAX_DAILY_COUNT ||
        !Number.isSafeInteger(reviewed) || reviewed > MAX_DAILY_COUNT ||
        !Number.isSafeInteger(minutes) || minutes > MAX_DAILY_MINUTES ||
        (!baseTasks.has(event.taskName) && !addedTasks.has(event.taskName) &&
          baseTasks.size + addedTasks.size >= MAX_COMPLETED_TASKS)) {
      return failure('aggregate_overflow', 'تجميع أحداث النشاط يتجاوز الحدود اليومية؛ لم يتم اعتماد إسقاط جزئي.');
    }

    log.memorizedAyahsCount = memorized;
    log.reviewedPagesCount = reviewed;
    log.minutesSpent = minutes;
    if (!baseTasks.has(event.taskName)) addedTasks.add(event.taskName);
  }

  for (const [date, log] of logsByDate) {
    const additions = [...(addedTaskNames.get(date) ?? new Set<string>())].sort();
    log.completedTasks = [...log.completedTasks, ...additions];
    if (!isDailyLog(log)) {
      return failure('aggregate_overflow', 'نتيجة سجل النشاط اليومي غير صالحة؛ لم يتم إرجاع أي إسقاط جزئي.');
    }
  }

  const existingDates = baseline.logs.map(log => logsByDate.get(log.date)!);
  const appendedDates = [...newDates].sort().map(date => logsByDate.get(date)!);
  return {
    success: true,
    logs: [...existingDates, ...appendedDates],
    appliedEventCount: uniqueEvents.length,
    duplicateEventCount
  };
}
