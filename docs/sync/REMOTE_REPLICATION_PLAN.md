# WIRD — Remote Replication Protocol (Design Gate)

**Status:** DESIGN ONLY — not implemented, not deployed, and not authorization to enable cloud sync.  
**Baseline reviewed:** main @ 6228150c2f7137678ba1079f5d9b2e8aba527523.  
**Related:** AGENTS.md, FIRESTORE_SYNC_DESIGN.md, firebase-blueprint.json, firestore.rules, cloudSyncCoordinator.ts, indexedDbSyncJournal.ts, journalProjectionReplayer.ts.

This document replaces the missing path referenced by AGENTS.md. It records the minimum safe protocol to implement before any remote projection or “fully synced” status is enabled.

## 1. Non-negotiable invariants

1. Local journal is durable source of truth for unacknowledged local mutations.
2. Local delivery outbox and remote import inbox are separate stores with separate cursors.
3. A remote event is immutable after creation; retries verify exact event identity and content.
4. Never acknowledge a local outbox mutation before remote transaction success is confirmed.
5. Never advance the remote fetch cursor before the fetched page is durably stored in the local inbox.
6. Never advance the local projection cursor before the event has been validated and its projection committed.
7. No client clock or blind last-write-wins decides progress conflicts.
8. No remote snapshot may replace a non-empty local projection while local events are pending.
9. UID is checked before every asynchronous boundary and again before committing.
10. Quran text and static Quran metadata are not user sync data.
11. A missing remote revision is not permission to overwrite an existing document.
12. Conflict means pending user-visible work, not “synced”.

## 2. Remote document model

Keep the current per-user path convention:

- users/{uid}/syncMeta/replication — per-user replication metadata.
- users/{uid}/events/{eventId} — append-only domain event ledger.
- users/{uid}/profile/{documentId}
- users/{uid}/plans/{documentId}
- users/{uid}/enginePlans/{documentId}
- users/{uid}/portions/{documentId}
- users/{uid}/weakVerses/{documentId}
- users/{uid}/tests/{documentId}
- users/{uid}/activityEvents/{documentId}

The current firestore.rules special-cases events before the generic allowlisted collection matcher. Keep this explicit.

### Replication metadata

Required logical fields:
- schemaVersion
- revision (per-user monotonic integer)
- committedAt (server timestamp)
- minimumReaderSchemaVersion
- optional bootstrap/snapshot metadata

Revision is a concurrency token, not a client timestamp. Prefer a transaction with a server-applied increment transform and security-rule validation that only permits exactly previous revision + 1. If this cannot be proven with Firestore Rules + client transactions, use a trusted server-side writer or keep cloud sync disabled. Do not silently weaken the server-owned revision requirement.

### Immutable event envelope

Required logical fields:
- schemaVersion
- eventId (stable UUID)
- mutationId (stable idempotency identity)
- uid
- deviceId
- localSequence
- originBaseRevision (revision observed when the local mutation was created)
- committedRevision (assigned by the remote transaction)
- committedAt (server timestamp)
- eventType (strict allowlist)
- payload (strict event-specific schema)
- payloadFingerprint (collision detection; not an authentication primitive)

Never put a full Quran text corpus in an event.

### Projection envelope

Each projection document contains:
- schemaVersion
- revision (the committed revision that produced this projection)
- lastEventId
- payload
- optional tombstone metadata only after delete/restore semantics are implemented

Do not trust a client-supplied updatedAtMs as a concurrency token.

## 3. Local mutation and outbox creation

When an authenticated user performs a domain mutation:

1. Validate the domain command against canonical Quran metadata and domain constraints.
2. Capture the current known remote revision and current local pending-event sequence.
3. Append a typed local domain event with stable eventId/mutationId and originBaseRevision.
4. Commit the event, local projection operation and outbox record in one IndexedDB transaction.
5. Apply the local projection through journalProjectionReplayer.
6. Keep the outbox record pending until the remote transaction confirms success.
7. If IndexedDB fails, fail visibly; do not fall back to unjournaled authenticated writes.

A local event must be replayable without network access. Event schema migrations must be versioned and deterministic.

## 4. Push protocol

Push is per UID and ordered by local sequence.

For each bounded batch:
1. Verify current auth UID and verified-email requirement.
2. Read pending outbox entries in sequence order.
3. Read current remote replication metadata and all affected projection docs inside a Firestore transaction.
4. Check whether each eventId/mutationId already exists:
   - same ID + same fingerprint: treat as already committed only after verifying the stored event and its committed revision;
   - same ID + different fingerprint: hard conflict; never overwrite.
5. Compare the expected remote revision with the transaction's current revision.
6. If the revision is stale, abort the write transaction and run pull/reconcile before retry. Do not apply a blind snapshot overwrite.
7. Validate eventType and payload against an allowlist and domain-specific schema.
8. Write the immutable event, update affected projection docs, and increment the per-user revision atomically in the same transaction.
9. Use a server timestamp for committedAt.
10. After transaction success is confirmed, mark the local outbox entry acknowledged in IndexedDB.
11. If the network drops after server commit but before local acknowledgement, retry; step 4 must detect the identical already-committed event and return the same committed revision.
12. If the transaction fails, retain the outbox entry and expose partial/error state.

The exact treatment of multiple offline local events must be specified before implementation. A safe approach is to submit an ordered batch with an expected revision chain; if another device has advanced the revision, pull first and rebase/resolve pending events without mutating immutable event payloads. Record original base revision and every rebase decision.

## 5. Pull protocol: remote inbox first

Never pull directly into StorageService.

1. Verify current UID.
2. Read the durable per-UID remote fetch cursor from IndexedDB.
3. Query events ordered by committedRevision, then eventId as deterministic tie-breaker, strictly after the cursor.
4. Validate document path UID, event UID, schema version, event ID, mutation ID, device ID, revision and event-specific payload.
5. Persist the entire fetched page to a distinct IndexedDB remote inbox, deduplicated by eventId and payload fingerprint.
6. Advance the remote fetch cursor only in the same IndexedDB transaction that persists the page.
7. Replay inbox events in deterministic committedRevision order.
8. Apply each event through a domain-specific projector; do not blindly union arrays.
9. If projection succeeds, mark the inbox item projected and advance the local remote-projection cursor atomically.
10. If an event is invalid or conflicts, preserve it in a conflict/quarantine store, stop or defer the affected sequence according to the protocol, and do not falsely advance the projection cursor.

The remote fetch cursor and local projection cursor must be independent. A page can be fetched but not yet projected.

## 6. Bootstrap and existing local data

A first sign-in on a device must not overwrite existing guest progress.

Bootstrap procedure:
1. Run the explicit guest/legacy ownership decision already used by AuthGate.
2. Preserve a verified backup before any migration.
3. Read remote replication metadata and the required projection snapshots consistently.
4. If local data is empty and no local pending events exist, install the remote baseline and set both remote cursors to its revision.
5. If local data is non-empty or pending local events exist, do not replace it. Import remote events into the inbox and run domain-specific reconciliation.
6. Keep local and remote versions until reconciliation is verified.
7. If data cannot be reconciled automatically, retain both versions and ask for an explicit user decision.

A bootstrap failure must leave the prior local data and journal intact.

## 7. Conflict policy by domain

No generic last-write-wins.

- Activity/session history: append-only immutable events; daily totals and streaks are derived from deduplicated events.
- Weak-verse mistakes: immutable failure/resolution events; do not merge by incrementing counters from stale snapshots.
- Tests: append-only result records with stable IDs.
- Memorization portions: canonical Quran ranges; overlapping ranges are normalized; weaker status/strength wins conservatively; distinct review attempts remain distinct; same-ID/different-content is a conflict.
- Revision history: append-only rating events with stable IDs; preserve all distinct attempts.
- Plans: stable plan/task IDs; completed tasks are never removed by a stale pending schedule; revision-only tasks are preserved; conflicting future schedules may be deferred for user choice.
- Profile: field-specific merge rules; never overwrite security/account identity fields from stale snapshots.
- Tombstones: do not enable until per-collection delete, restore, replay, retention and stale-device resurrection behavior is tested.

A conflict must include both source event IDs, source device IDs, base/current revisions, payload fingerprints and a clear resolution status.

## 8. Firestore Rules requirements

The current rules are a useful UID/verified-user foundation but are not sufficient for full replication.

Required before rollout:
- exact allowed eventType list;
- event-specific required/allowed keys and numeric/string bounds;
- maximum payload/document size;
- immutable event create-only behavior;
- reject changed event IDs or mutation IDs;
- enforce revision increments exactly once;
- enforce server timestamp semantics using request.time where supported;
- enforce projection/event/meta consistency using getAfter where supported;
- prevent a client from changing UID/device ownership or writing another user's path;
- reject unknown collection and unsupported schema versions;
- retain default deny and no physical deletes.

Run Firebase Rules Emulator positive and negative tests for every supported event type and collection. Do not deploy production rules during the design or test phase.

## 9. Multi-client test harness

Required automated harness:
- Client A, B and preferably C with independent IndexedDB databases.
- Same test UID for replication and separate UIDs for isolation.
- Shared Firestore Emulator.
- Independent online/offline controls, network delay/failure injection, restart/reload simulation and account switching.
- Assert final persisted data on every client and server, not only HTTP success.

Mandatory scenarios:
1. A writes, B imports/projects; then B writes, A imports/projects.
2. Concurrent edits to same record.
3. A offline while B commits, then A reconnects.
4. Server commit succeeds but local acknowledgement is interrupted.
5. Duplicate event and same ID/different content.
6. Restart during upload, pull, inbox persistence and projection.
7. UID switch during every async stage.
8. Cursor pagination, equal timestamps, events arriving during bootstrap.
9. Pending local mutation versus incoming remote event.
10. Tombstone/restore only after semantics exist.
11. Multiple local offline events in one ordered batch.
12. A stale client with an old schema version.
13. Firestore transaction retries and aborted transactions.
14. Quota/rate-limit errors without local data loss.

## 10. Honest UI status model

Until full remote import and projection pass:
- local-only: no authenticated cloud capability or guest mode.
- waiting-verification: signed-in but email not verified.
- offline: local journal works; remote delivery unavailable.
- queued: local changes are durable and waiting for remote push.
- uploading: remote write in progress.
- partial: remote push completed but remote reconciliation/pull is not complete.
- conflict: one or more events require resolution.
- error: remote attempt failed; local data remains safe.
- synced: only when outbox is empty, inbox is fully projected, cursors match the verified server revision, no unresolved conflict exists, and the exact sync cycle is complete.

Never show a green check merely because a remote read returned documents.

## 11. Free-tier constraint and architecture decision

The implementation must first be prototyped against Firebase Spark-compatible Firestore transactions and Rules. Do not assume Cloud Functions or another paid backend is available. If strict server-owned revision semantics cannot be guaranteed with the free-tier client transaction + Rules model, document the gap and keep remote writes disabled until the user explicitly approves an alternative.

## 12. Rollout gate

Cloud sync may be enabled for real users only after:
- full protocol implementation;
- local persistence and remote inbox tests;
- Firestore Rules Emulator coverage;
- multi-client integration scenarios;
- account/UID isolation;
- backup/restore rehearsal;
- exact-SHA CI pass;
- exact-SHA deployment pass;
- safe read-only production verification.

This document is a design gate, not evidence that any of these implementation or rollout steps have been completed.
