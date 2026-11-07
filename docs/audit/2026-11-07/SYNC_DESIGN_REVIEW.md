# WIRD Remote Sync — Implementation Review

**Reviewed against:** `main` at `6228150c2f7137678ba1079f5d9b2e8aba527523`  
**Protocol:** `docs/sync/REMOTE_REPLICATION_PLAN.md`  
**Status:** Local journal exists; remote bidirectional replication is NOT IMPLEMENTED.

## Executive finding

The project has a meaningful local write-ahead journal and local projection replay. It does not yet have a complete remote event ingestion path. The current `main` coordinator can upload local outbox mutations, read a bounded page of remote events, discard the result, and then report `synced` when the local pending count is zero. That status is false because remote changes have not been durably imported or projected.

A separate working branch `fix/cloud-sync-honest-status-20261107` is correcting the status claim. It does not implement remote replication.

## Capability matrix

| Capability | Current main evidence | Assessment |
|---|---|---|
| Local durable journal | `IndexedDbSyncJournal` stores append-only events and outbox records in IndexedDB transactions | Implemented locally |
| Local outbox retry/ack | `LocalSyncOutbox` and coordinator push | Partial; acknowledgement is based on current document/event writes, not atomic remote CAS |
| Local projection replay | `journalProjectionReplayer.ts` with a per-UID projection cursor and Web Locks | Implemented locally; browser lock support is a requirement |
| Remote event write | Coordinator writes `users/{uid}/events/{eventId}` | Partial; event is a generic mutation envelope |
| Remote event read | Coordinator queries at most 20 recent events | Read-only probe only; result is discarded |
| Remote inbox | No distinct durable remote inbox store | Missing |
| Remote fetch cursor | No per-UID durable cursor for fetched remote pages | Missing |
| Remote projection | No validated remote event projector into local storage | Missing |
| Server revision/CAS | No monotonic server-owned revision or atomic compare-and-set transaction | Missing |
| Conflict resolution | No deterministic conflict record/rebase/resolution workflow | Missing |
| Multi-device integration | No two independent IndexedDB clients sharing an emulator and asserting final state | Not proven |
| Honest completion state | Main may mark synced after outbox drains despite remote no-op | Defect; separate branch adds partial state |

## Confirmed code-level gaps

1. `cloudSyncCoordinator.ts`: `pullRemoteReconciliation` queries remote events ordered by client timestamp, limited to 20, and does not persist or apply the result.
2. The same coordinator then calculates final status from local pending count alone and may set `synced`.
3. `indexedDbSyncJournal.ts` contains local events/outbox/acknowledgements/metadata and a local projection cursor, but no remote inbox or remote fetch cursor.
4. `journalProjectionReplayer.ts` replays local journal events; it is not a remote event ingestion pipeline.
5. `firestore.rules` validates a generic event envelope and generic map payload. It does not enforce the protocol's strict per-event allowlist/payload schema, monotonic revision, or CAS consistency.
6. Remote writes use separate document writes rather than one transaction that atomically commits immutable event + projection + revision.
7. A local device's timestamp is used for event ordering; it is not a trustworthy global concurrency order.

## Safe implementation sequence

### Gate 0 — honest status (small, independently releasable)
- Add `partial` sync state.
- A successful local upload with no remote importer must remain partial.
- Add explicit tests proving zero pending uploads alone cannot produce `synced`.
- Keep all changes on a main-based feature branch and draft PR.

### Gate 1 — schema and security contract
- Freeze event types and per-event payload validators shared by client and rules tests.
- Define server-owned revision metadata and immutable event identity.
- Add positive and negative Firestore Emulator tests.
- Prove create-only event semantics and reject same ID/different fingerprint.
- Do not weaken rules to make tests pass.

### Gate 2 — remote inbox and cursor
- Add a distinct IndexedDB remote inbox and durable per-UID fetch cursor.
- Persist an entire fetched page and cursor in one IndexedDB transaction.
- Deduplicate by event ID and fingerprint.
- Keep the local projection cursor independent.

### Gate 3 — transactional remote push
- Use Firestore transactions for revision compare-and-set, event creation and projection update.
- Do not acknowledge local outbox before confirmed transaction success.
- Make retries idempotent after server commit/local-ack interruption.
- Stale revision must trigger pull/reconcile, not blind overwrite.

### Gate 4 — remote event projection
- Validate UID, schema, event identity, revision and event-specific payload.
- Project via deterministic domain-specific handlers, never blind array union.
- Quarantine invalid/conflicting events and retain both source versions.
- Advance projection cursor only after projection commit.

### Gate 5 — multi-client proof
- Two or three isolated client instances with independent IndexedDB.
- Shared Firestore Emulator and same test UID, plus separate UID isolation.
- Test bidirectional changes, offline edits, concurrent edits, duplicate delivery, restart, interrupted acknowledgement, UID switch, cursor pagination, stale schema and quota failure.
- Assert final persisted data on every client and server.

### Gate 6 — deployment proof
- Exact-SHA CI, rules emulator, multi-client suite and production build.
- Deploy only with explicit authorization.
- Verify deployment corresponds to the exact tested SHA.
- Keep status partial until all required remote import/projection and two-device gates pass.

## Release decision

**NO-GO for claiming full cloud sync.**  
**GO only for local journal/outbox behavior and an explicitly labelled partial upload capability after the honest-status fix is reviewed and passes exact-head CI.**

No production Firestore rules or data should be changed during these design and test gates.
