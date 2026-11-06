# WIRD Remote Replication — Safe Implementation Plan

Status: design checkpoint for PR #59. This document does not enable remote writes, change Firestore rules, or claim multi-device synchronization is complete.

## Current verified architecture

- Local mutations are appended atomically to the UID-scoped IndexedDB `events` and `outbox` stores.
- Local events receive a per-browser/per-UID sequence. That sequence is not a cross-device ordering key.
- The local projection replayer applies full collection snapshots and advances its durable projection cursor only after a successful projection.
- Cloud push writes an immutable `domain-mutation.v2` event envelope and then writes a mutable collection snapshot.
- The event envelope contains a server-assigned `serverCreatedAt`, but the mutable snapshot currently has no server revision or compare-and-set guard.
- The pull method currently performs a bounded read and deliberately returns `false`; remote events are not imported or projected.
- Tombstones are not supported by the projection layer. Legacy cloud events do not have the v2 journal envelope.

## Critical data-loss case to prevent

Device A can go offline while holding remote revision R. Device B can commit a newer snapshot R+1. If A later uploads its stale full-collection snapshot with an unconditional `setDoc`, A can overwrite B's newer data. Sorting by `clientUpdatedAtMs`, `occurredAtMs`, or device clocks does not prevent this. A server timestamp assigned when the stale write finally arrives also does not prove that its content was based on the latest state.

Therefore remote ingestion must not be enabled until cloud writes are guarded by optimistic concurrency.

## Required protocol before enabling pull

### 1. Server-owned document revision

Each mutable snapshot document needs a monotonic server revision and server update timestamp. A write must run in a Firestore transaction:

1. Read the existing snapshot and immutable event document.
2. If the event already exists, verify its immutable identity and treat an exact match as an idempotent retry.
3. Compare the mutation's recorded `baseRemoteRevision` with the current snapshot revision.
4. If they differ, abort without changing either snapshot or event and retain the local mutation as a conflict.
5. If they match, write the snapshot at the next revision and create the immutable event in the same transaction.

The initial revision must be established through a validated bootstrap/migration path. A missing local revision must never be interpreted as permission to overwrite an existing remote document.

### 2. Capture the base revision when the local mutation is created

The journal/outbox entry must persist the last-known remote revision for the target snapshot. Offline mutations use that last-known revision. The push transaction compares it with the current remote revision. A stale offline mutation must become a visible conflict, not a last-writer-wins overwrite.

### 3. Remote event ingestion must be separate from delivery

Add a UID-scoped IndexedDB import operation that:
- validates the v2 envelope, event identity, collection, document ID, operation, payload, and fingerprint;
- deduplicates by UID + event ID and rejects same-ID/different-content collisions;
- allocates a new local journal sequence transactionally;
- writes only to the local event store, never the outbox or acknowledgement store;
- persists a remote stream cursor independently of the local projection cursor;
- commits the imported event and cursor atomically only when the event is safe to advance past.

Remote imports must never be uploaded back as local mutations.

### 4. Pull ordering and legacy compatibility

- Use the server-assigned event timestamp plus a stable event-ID tie-breaker for v2 pagination; never order cross-device changes by client clocks.
- Store a durable per-UID remote cursor and resume from it after restart.
- Do not pretend legacy events have v2 metadata. Define a one-time validated snapshot bootstrap/migration boundary for pre-v2 records before advancing the v2 event cursor.
- Handle events arriving during bootstrap with a server-side high-water mark so no event can fall between the snapshot read and cursor initialization.

### 5. Conflict and projection rules

- Before projecting a remote full-snapshot event, check for pending local mutations targeting that collection/document.
- If a local mutation is pending, retain/defer the remote event and do not advance the remote cursor past it.
- A server revision conflict must remain visible and retryable only after an explicit deterministic resolution/merge path.
- Do not merge arrays by blind union; records need stable IDs and explicit update/delete semantics.
- Keep tombstones blocked until collection-specific deletion semantics, validation, replay, and restore behavior are implemented.
- Enforce the active UID before every import and projection; abort if the account scope changes during the operation.

## Required automated tests

1. Remote import is idempotent across retries and app restarts.
2. Same event ID with a different fingerprint is rejected without changing journal state.
3. Imported remote events never create outbox entries and are never pushed back.
4. Per-UID remote cursor and local projection cursor survive restart independently.
5. Pagination handles equal server timestamps using the event-ID tie-breaker without gaps or duplicates.
6. A pending local mutation blocks projection of a conflicting remote snapshot.
7. A stale offline write fails the Firestore transaction and leaves the remote snapshot/event unchanged.
8. Two devices writing from the same base revision produce one accepted commit and one explicit conflict.
9. UID changes during pull/import/replay stop the operation without cross-account writes.
10. Legacy event bootstrap cannot skip v2 events created during the bootstrap window.
11. Tombstones remain rejected until their dedicated tests and semantics are complete.

## Release gates

- Keep PR #59 Draft while this protocol is incomplete.
- Keep the UI status at `partial` until pull, durable import, projection, and cursor advancement are all complete.
- Do not deploy Firestore rules or change production data as part of implementation without explicit authorization.
- Do not merge or deploy based only on CI. Require successful CI on the exact PR head, a successful Vercel deployment for that same SHA, and real two-device verification with preserved data.
