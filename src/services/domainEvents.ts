import type { RevisionRating, TestResult } from '../types/quran';

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

/** Validate event identity and envelope before it enters the durable journal. */
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
  return true;
}
