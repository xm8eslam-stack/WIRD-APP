import type { RevisionRating, TestResult } from '../types/quran';
import { QuranMath } from './quranMath';

export type DomainEventType =
  | 'session.completed'
  | 'revision.rated'
  | 'test.completed'
  | 'weak_verse.failed'
  | 'weak_verse.resolved';

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: 1;
  id: string;
  type: DomainEventType;
  occurredAt: string;
  payload: TPayload;
}

export type SessionCompletedEvent = DomainEvent<{
  mode: 'memorize' | 'review';
  memorizedAyahs: number;
  reviewedPages: number;
  minutes: number;
  taskName: string;
  surahNumber?: number;
  startAyah?: number;
  endAyah?: number;
  includesSmartPlanProjection: boolean;
}>;

export type RevisionRatedEvent = DomainEvent<{
  portionId: string;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  rating: RevisionRating;
  notes?: string;
  weakAyahNumber?: number;
}>;

export type TestCompletedEvent = DomainEvent<{
  testResultId: string;
  testType: TestResult['type'];
  score: number;
  totalQuestions: number;
  surahName: string;
}>;

export type WeakVerseFailedEvent = DomainEvent<{
  surahNumber: number;
  ayahNumber: number;
  notes?: string;
}>;

export type WeakVerseResolvedEvent = DomainEvent<{
  weakVerseId: string;
  surahNumber: number;
  ayahNumber: number;
}>;

export type WirdDomainEvent =
  | SessionCompletedEvent
  | RevisionRatedEvent
  | TestCompletedEvent
  | WeakVerseFailedEvent
  | WeakVerseResolvedEvent;

/** Validate event identity, timestamp, and discriminated payload before durable enqueue. */
export function isValidDomainEvent(value: unknown, expectedId?: string): value is WirdDomainEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (event.schemaVersion !== 1 ||
      typeof event.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(event.id) ||
      (expectedId !== undefined && event.id !== expectedId) ||
      typeof event.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(event.occurredAt)) ||
      !['session.completed', 'revision.rated', 'test.completed', 'weak_verse.failed', 'weak_verse.resolved'].includes(String(event.type)) ||
      !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    return false;
  }

  const payload = event.payload as Record<string, unknown>;
  const isCount = (value: unknown, max = 1000000) =>
    Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;
  const isCoordinate = (surah: unknown, ayah: unknown) =>
    typeof surah === 'number' && typeof ayah === 'number' &&
    QuranMath.isValidCoordinate(surah, ayah);
  const isOptionalNote = (value: unknown) =>
    value === undefined || (typeof value === 'string' && value.length <= 2000);

  switch (event.type) {
    case 'session.completed':
      return (payload.mode === 'memorize' || payload.mode === 'review') &&
        isCount(payload.memorizedAyahs) && isCount(payload.reviewedPages) &&
        isCount(payload.minutes, 1440) &&
        typeof payload.taskName === 'string' && payload.taskName.trim().length > 0 &&
        payload.taskName.length <= 200 &&
        typeof payload.includesSmartPlanProjection === 'boolean' &&
        (payload.surahNumber === undefined
          ? payload.startAyah === undefined && payload.endAyah === undefined
          : isCoordinate(payload.surahNumber, payload.startAyah) &&
            isCoordinate(payload.surahNumber, payload.endAyah) &&
            Number(payload.endAyah) >= Number(payload.startAyah));
    case 'revision.rated':
      return typeof payload.portionId === 'string' && payload.portionId.length > 0 && payload.portionId.length <= 128 &&
        isCoordinate(payload.surahNumber, payload.startAyah) &&
        isCoordinate(payload.surahNumber, payload.endAyah) &&
        Number(payload.endAyah) >= Number(payload.startAyah) &&
        (payload.rating === 'successful' || payload.rating === 'difficult' || payload.rating === 'failed') &&
        isOptionalNote(payload.notes) &&
        (payload.weakAyahNumber === undefined ||
          (isCoordinate(payload.surahNumber, payload.weakAyahNumber) &&
            Number(payload.weakAyahNumber) >= Number(payload.startAyah) &&
            Number(payload.weakAyahNumber) <= Number(payload.endAyah)));
    case 'test.completed':
      return typeof payload.testResultId === 'string' && payload.testResultId.length > 0 &&
        ['complete_verse', 'order_words', 'mutashabihat', 'surah_beginnings', 'random_recall', 'bidirectional_recall'].includes(String(payload.testType)) &&
        isCount(payload.score) && isCount(payload.totalQuestions) &&
        Number(payload.totalQuestions) > 0 && Number(payload.score) <= Number(payload.totalQuestions) &&
        typeof payload.surahName === 'string' && payload.surahName.length > 0 && payload.surahName.length <= 100;
    case 'weak_verse.failed':
      return isCoordinate(payload.surahNumber, payload.ayahNumber) && isOptionalNote(payload.notes);
    case 'weak_verse.resolved':
      return typeof payload.weakVerseId === 'string' && payload.weakVerseId.length > 0 &&
        isCoordinate(payload.surahNumber, payload.ayahNumber);
    default:
      return false;
  }
}
