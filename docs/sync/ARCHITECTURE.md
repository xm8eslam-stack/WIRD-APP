# WIRD Sync Architecture — verified implementation boundary

**Reviewed:** 2026-11-07  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Current main at review:** `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`

## Components

- `IndexedDbSyncJournal`: UID-scoped durable local event journal, outbox, acknowledgements, inbox, revision metadata, and projection cursor.
- `LocalSyncOutbox`: application facade for enqueue, upload-ready batches, acknowledgements, remote import, revision metadata, and retry scheduling.
- `revisionedRemoteMutation.ts`: Firestore transaction that checks per-document base revision, writes the state envelope and immutable event, and advances the per-user server sequence atomically.
- `remoteInboxProjector.ts`: validates the next remote event against local revision/pending mutations and projects only safe upserts.
- `cloudSyncCoordinator.ts`: network/auth-aware orchestration. Upload and remote projection are separately feature-gated.
- `firestore.rules`: verified-user/UID ownership, collection allowlist, schema checks, immutable events, and server-sequence consistency.

## Local/remote boundaries

A local mutation is journaled before projection. Upload acknowledgement is not equivalent to remote projection. The device tracks an imported remote cursor separately from the locally projected cursor. A remote event is retained until its local projection and cursor finalization complete.

## Two-device evidence

PR #77 added an Emulator integration using separate authenticated Firestore clients, independent fake IndexedDB factories, and independent localStorage adapters. It proves a profile upsert from A is projected by B and a subsequent B upsert is projected by A, with both devices converging at revision 2 / cursor 2 and no pending outbox items.

PR #78 adds an offline same-document conflict regression: the first device's base-revision write wins; the stale write is rejected; the losing device retains its pending mutation and remote inbox event; projection is blocked and its cursor remains unchanged. This proves preservation and conflict detection, **not** a user-facing conflict-resolution workflow.

## Explicitly not certified

- The two-device tests currently exercise the profile collection and do not prove all collection mappings or browser/device E2E.
- Tombstone delivery is intentionally blocked by the projector and local storage adapter. No safe collection-specific delete projection or tombstone garbage collection is implemented.
- A bounded UID-scoped IndexedDB conflict archive is now implemented (PR #81). It preserves the remote event and the exact relevant local storage snapshot when projection blocks; open conflicts are never pruned, and only resolved historical records may be pruned at capacity. Settings shows the open count and latest event summary. This is diagnostic/recovery storage, not a resolution UI.
- Production Firebase rules deployment and Vercel deployment of current main have not been verified.
- Runtime activation depends on explicit build flags: `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED`. Their production values have not been inspected and must not be assumed enabled.

## Safety invariant

Never enable upload or projection against production until the deployed Firestore rules match the transaction contract, every active mutation path is journaled, tombstones/conflicts have safe semantics, and release gates pass.


## Conflict archive implementation — PR #81

- IndexedDB schema version 8 adds `projectionConflicts`, keyed and indexed by UID.
- Maximum 100 conflict records per UID; when full, only resolved records may be pruned. If all records are open, archive insertion fails safely and the inbox event remains.
- Repeated observations update reason/time but preserve the first captured local snapshot. Archival validates the event fingerprint and immutable identity against the inbox record before writing.
- The projector archives blocked decisions and failed finalization while leaving the inbox event and cursor unchanged.
- Settings exposes count and latest summary. It does not expose a destructive or automatic resolution action.
- Durable conflict resolution, user choice, and safe cursor advancement after resolution remain unimplemented.


## Atomic conflict reconciliation — PR #85

- `saveProjectionConflict` checks the current UID metadata, inbox event at the same server sequence, immutable event identity/fingerprint, and the existing archive record before saving. It rejects orphan or mismatched evidence.
- Local snapshot bytes are capped at 500 KB. If the cap or 100-open-record limit is exceeded, the inbox event and cursor remain unchanged.
- `finalizeRemoteProjection` and `markRemoteProjected` include the conflict store in the same IndexedDB transaction as cursor advancement and inbox deletion. A matching open conflict is marked `resolved/reconciled` atomically with that cursor transition.
- Late archival after another tab has already advanced the cursor cannot create an orphan open conflict.
- The only supported resolution status is `reconciled` (derived from successful projection/cursor commit). There is no manual keep-local/use-remote API or user merge UI.
