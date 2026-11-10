# Immutable session-activity event projection

**Date:** 2026-11-11  
**Status:** Discovery/design only — no runtime code or production configuration changed.  
**Priority:** P1 for reliable multi-device activity history; implementation is blocked on a safe legacy/offline-device cutover contract.

## Problem

WIRD currently stores daily activity as one aggregate record per local date. That is efficient for display, but two devices can independently update the same daily record. A compare-and-set fingerprint prevents an older full snapshot from overwriting a newer divergent snapshot; it does not merge two valid sessions completed independently on different devices. The current safety policy correctly blocks whole-snapshot `keep-local` / `use-remote` decisions for `activityEvents`.

The target is to preserve every completed memorization/revision session exactly once across devices without summing duplicate delivery, losing offline sessions, or silently changing historical totals.

## Evidence from current main

Reviewed against `50bb25eeba2f1ed4ceae228b347c67b40f60c697`:

- `src/types/quran.ts`: `DailyLog` is keyed by `date` and stores `memorizedAyahsCount`, `reviewedPagesCount`, `minutesSpent`, and `completedTasks`. It has no immutable session identity.
- `src/services/storageService.ts`: `buildSessionCompletionSnapshot` reads the current log archive, updates the current local date, and returns `baseLogsFingerprint`; `recordSessionCompletionDetailed` updates the same aggregate and profile streak.
- `StorageService.applyJournalProjection('activityEvents')` currently expects a full `records` array and validates/replaces the daily-log snapshot. It is not an event reducer.
- `src/services/domainEvents.ts` already defines a validated `session.completed` domain event with mode, counts, minutes, task label, optional Quran coordinates, and UTC `occurredAt`. The payload does not explicitly preserve the user's local activity date or UTC offset.
- `src/services/remoteInboxProjector.ts` applies server-ordered events and blocks unresolved revisions/tombstones. The global projection cursor must not pass a blocked event.
- PR #325 adds a deterministic base-snapshot compare-and-set precondition for `weakVerses` and `activityEvents`. This prevents stale overwrite; it is not conflict convergence.

## Design principles

1. **Legacy history is a baseline, not disposable data.** Keep the existing daily-log archive byte-preserved as the historical baseline during migration.
2. **A session is immutable and idempotent.** Give each completion one stable event ID derived from the journal mutation ID. Re-delivery of the same event is a no-op; the same ID with different content is a hard conflict.
3. **Never aggregate by timestamp alone.** Deduplicate by event identity, not by matching date/counts/task text.
4. **Preserve local calendar meaning.** Capture `localDate` (`YYYY-MM-DD`) and the device UTC offset at completion. Do not derive the day from UTC during remote replay; that can move a session to the previous/next day.
5. **Do not silently merge legacy aggregates.** A daily aggregate cannot reveal which individual sessions it contains. If two devices have divergent pre-migration archives, preserve both and block automatic cutover until explicitly reconciled.
6. **No deletion for event history.** Corrections should be represented by a new compensating event with a unique identity; do not mutate or physically delete an accepted session event.
7. **Local-first and privacy-minimal.** Enqueue locally first; do not upload recordings, notes, or analytics. Store only bounded session metrics and necessary Quran coordinates.

## Proposed event contract (versioned; not yet implemented)

A new activity-session event should contain:

- `schemaVersion: 2`
- `eventId` / `mutationId`: stable, validated, unique identity
- `uid` and `deviceId`: scoped by the existing authenticated journal
- `occurredAtMs`: UTC instant for ordering/diagnostics
- `localDate`: date captured on the device at completion
- `timezoneOffsetMinutes`: offset captured at completion
- `mode`: `memorize` or `review`
- `memorizedAyahs`, `reviewedPages`, `minutes`: bounded non-negative integers
- Optional `surahNumber`, `startAyah`, `endAyah` as validated canonical coordinates
- Optional bounded task label only if required by existing UX

The event should not include audio, free-form notes, user email, or any unrelated profile data.

## Projection and storage shape

- Keep a versioned legacy baseline document containing the validated existing `DailyLog[]` snapshot and a stable baseline identity.
- Store each new session event as its own immutable document under the UID-scoped activity event collection, routed through the existing revisioned event stream. A new event document starts at base revision 0; a duplicate identity with different content is blocked.
- Keep the baseline and event ledger separate. The displayed daily log is a deterministic projection: `legacy baseline + unique post-cutover events grouped by captured localDate`.
- Persist the local event archive and its Outbox enqueue atomically in IndexedDB. Remote Inbox projection must append/deduplicate the event and advance the cursor in the same recoverable finalization boundary.
- Preserve the current daily-log UI contract by deriving `DailyLog[]` for display; do not let UI components write the derived aggregate directly.
- Include the baseline and event ledger in backup/export/import with versioned validation and idempotent restore. Do not remove the legacy `logs` field until old backups and older supported clients are handled.

## Migration and offline-device cutover — blocking design requirement

A timestamp-only cutover is unsafe: a device may complete a session offline before the cutover, while its aggregate is not yet included in the canonical baseline. Excluding events before a global timestamp would lose that session; including them could double-count sessions already represented in a legacy aggregate.

Therefore:

1. Keep current snapshot writes and all destructive conflict choices fail-closed during discovery.
2. Define a per-device migration acknowledgement that proves the device has drained pre-cutover legacy activity mutations and loaded the canonical baseline. Record the exact journal/outbox watermark used for that acknowledgement.
3. A device with a divergent legacy archive or unacknowledged offline mutations must retain its bytes and enter an explicit recovery/conflict path. Do not silently union daily counters or choose the newest timestamp.
4. Only after the migration protocol proves that every accepted pre-cutover mutation is either represented in the baseline or preserved as a separately identified event may the server accept version-2 session events.
5. Add a minimum supported sync schema/version gate before old clients can continue writing legacy snapshots. This requires a separately reviewed Firestore Rules/client-compatibility change and explicit production approval; it is not part of this design-only change.

If a safe per-device watermark cannot be proven with the existing journal metadata, stop and redesign the cutover rather than approximating it.

## Implementation phases

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 — Design (current) | Specify event identity, local date, baseline, cutover, backup, and conflict rules | Reviewed contract; no unresolved double-count/loss case |
| 1 — Pure reducer | Add a dependency-free deterministic reducer and unit tests; no production wiring | Duplicate/out-of-order replay, collision, timezone/DST, baseline preservation, and overflow tests pass |
| 2 — Local journal | Append immutable session events atomically with the local Outbox; derive daily display from baseline + events behind a default-off gate | Crash/quota/restart/account-scope tests pass; legacy bytes remain intact |
| 3 — Cloud projection | Add per-event remote documents and atomic Inbox finalization; update Rules in Emulator only | Concurrent devices, duplicate delivery, out-of-order replay, and conflict archive tests pass |
| 4 — Migration | Add per-device cutover acknowledgement and backup/restore compatibility | Offline legacy-device and divergent-baseline scenarios preserve all bytes and never double-count |
| 5 — Release | Production Rules/configuration and two-device real-world verification | Explicit owner approval, exact-SHA CI, deployed Rules parity, exact Production SHA, authenticated A↔B round trip, and rollback proof |

## Required tests

- Same event delivered repeatedly: counts increase once.
- Same event ID with different payload: hard conflict; no cursor advance.
- Two devices complete sessions on the same local date concurrently: both events remain distinct and both count once.
- Out-of-order event delivery and retry after timeout/crash: deterministic final projection.
- Local midnight, UTC midnight, DST transition, timezone change, and travel between zones: the captured `localDate` remains stable.
- Baseline plus event replay: no historical double counting.
- Offline device with pre-cutover legacy data: preserved and blocked until explicit migration reconciliation.
- Backup/export/import and restore repeated twice: no event duplication or baseline replacement.
- Logout/account switch, cross-tab contention, IndexedDB quota failure, and partial transaction rollback: no cross-account leakage or lost event.
- Large queue and bounded retry stress: projection cursor never passes a blocked event.

## Rollback and release boundaries

- Keep the new event store separate from the legacy `DailyLog[]` key. Disabling the feature must not delete either archive.
- Do not run a destructive migration or rewrite existing daily logs.
- Do not enable production sync flags, alter Firestore Rules/schema, or deploy configuration as part of this work.
- A passing unit test or Emulator test is not proof of a real-device two-way sync release.

## Decision

Proceed first with the pure reducer and deterministic tests after the cutover contract is reviewed. Do not yet wire event projection into production sync: the existing aggregate format cannot distinguish historical sessions from independently completed offline sessions without a proven per-device migration watermark.
