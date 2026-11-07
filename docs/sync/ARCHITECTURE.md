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

## 2026-11-07 — Ruqyah data boundary and current main checkpoint

- Main at this checkpoint: e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- PR #88 added Ruqyah progress under STORAGE_KEYS.RUQYAH_PROGRESS with UID-scoped local storage and corruption preservation. It is intentionally outside the current SyncCollection allowlist and outside StorageService.getLocalProjectionSnapshot / applyJournalProjection.
- Do not treat the presence of an authenticated UID-scoped local key as cloud sync. Ruqyah progress remains local-only.
- A separate experiment branch attempted to add ruqyahProgress to sync allowlists. Its observed exact-head CI failed because it called a nonexistent StorageService method, and its implementation did not yet provide the complete mutation enqueue/projection/revision/rules path.
- More importantly, Ruqyah counts are mutable per-item aggregates. Before syncing them, define a merge model that cannot lose independent increments (e.g. per-device monotonic counters with deterministic totals or immutable increment events). Do not use a full-snapshot last-write-wins mutation.
- All current sync safety invariants remain unchanged: conflict evidence is preserved; tombstones are blocked; no manual conflict resolution exists; projection/upload gates must remain disabled in production until release gates pass.

## 2026-11-07 — Ruqyah revisioned sync integration and safety boundary

- PR #91 added Ruqyah progress as a revisioned journal collection and version-5 backup field. It is UID-scoped locally and uses the same owner-scoped Firestore revision/event envelope as other synced data.
- PR #94 adds the Ruqyah collection to the coordinator's legacy remote-state scan. Its concurrent-offline test must pass before this integration is considered complete.
- The current Ruqyah payload is an aggregate counter snapshot. Sequential edits converge, but two independent offline increments from the same base revision cannot be automatically summed from the current snapshot alone. The safe current behavior is stale-revision rejection, preservation of the local Outbox mutation and remote Inbox event, conflict archival, and no cursor advancement.
- Do not claim additive convergence. Do not enable production remote sync until a deterministic per-device/event-based counter model or a user-facing merge workflow with sufficient base/delta evidence exists.
- User-facing conflict resolution remains unimplemented for all collections. Conflict archive state is evidence, not a user decision.

## 2026-11-07 — Conflict visibility and bidirectional collection test coverage

- PR #104 adds a read-only Settings inspector for open conflict archives. It shows the archived remote event payload and local projection snapshot with event identity/revision/time, and requires the active storage scope to exactly match the authenticated UID. It intentionally exposes no keep-local/use-remote/merge actions and changes no journal state.
- PR #106 adds an Emulator-backed reverse B → A event pass after A → B, across profile, plans, enginePlans, portions, weakVerses, tests, activityEvents, and ruqyahProgress. Revision 2 and ordered cursor completion are asserted.
- Test-fixture limitation: six collection payloads still use empty `records` arrays. This verifies collection routing and projection plumbing, not populated-record serialization or every domain invariant.
- User-facing conflict resolution, rebase against latest server revision, tombstone semantics, and real cross-tab/browser concurrency remain unimplemented.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.
