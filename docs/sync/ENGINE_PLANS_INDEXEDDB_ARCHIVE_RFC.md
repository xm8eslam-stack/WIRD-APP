# Engine Plans — Versioned IndexedDB Archive RFC

**Status:** Proposed design; not implemented  
**Date:** 2026-11-12  
**Baseline:** `main` `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`  
**Scope:** Local Engine Plans archive, startup hydration, journal/outbox integration, backup/restore/reset, remote materialization and compatibility.

## 1. Decision summary

Move Engine Plans from a single JSON localStorage value into a versioned, UID/scope-isolated IndexedDB archive. Keep localStorage as a verified, read-only rollback copy for a defined compatibility window. Hydrate the archive before mounting App. Store each plan as an independently validated record with a stable record ID and commit immutable archive revisions with manifests and stable fingerprints.

**Recommended atomicity boundary:** extend the existing `wird-sync-journal` IndexedDB database (currently schema v9) with archive stores. Do not create a second IndexedDB database for the canonical archive. A single IndexedDB transaction can then commit archive revision records/head + journal event + outbox entry for a local authenticated mutation. This directly satisfies the local atomic reference requirement and avoids pretending two databases share a transaction.

Remote chunk transfer is a separate network protocol: upload immutable chunks first, validate them, then publish the manifest/pointer. On receive, fetch and validate all required chunks before one local IndexedDB transaction materializes the archive and finalizes inbox/cursor state.

No Firestore Rules, Production flags, environment settings, secrets, or production data changes are included in this RFC.

## 2. Existing verified constraints

- `StorageService.getEnginePlans/saveEnginePlans` currently read/write one localStorage JSON array; save rejects more than 100 plans.
- `validateBackupPayload` and `sessionPersistence` also enforce the 100-plan limit.
- App reads plans during initial state construction and refresh/session flows. Dashboard independently reads the storage service during daily-session selection.
- Settings and Progress Analytics both call synchronous `exportFullBackup()`.
- UI import is journal-first through `importBackupFile → importBackupJournaled`; low-level `StorageService.importBackup` is a legacy direct writer.
- App reset is journal-first; low-level `StorageService.resetAllData` is a legacy direct deletion API.
- Journal replay, remote Inbox projection, conflict resolution, first-sync emptiness checks and local conflict snapshots all currently depend on synchronous localStorage projection APIs.
- AuthGate currently resolves scope, replays the journal for users, migrates legacy portions, then mounts App. It is the startup hydration barrier, but Engine Plans archive hydration does not exist.
- `setStorageScope` is synchronous and copies/verifies/removes localStorage keys. It cannot itself complete an IndexedDB archive migration.
- Current main's journal Engine Plans payload budget is 450,000 bytes; outbox aggregate budget is 1,500,000 bytes. PR #367's 800,000-byte value is an unmerged interim cap, not archive storage or chunking.

## 3. IndexedDB schema proposal

Bump the existing journal database schema from v9 to v10. Keep archive stores in the same database as events, outbox, acknowledgements, remote Inbox, conflicts, intents and metadata.

### 3.1 Stores

| Store | Key | Purpose |
|---|---|---|
| `enginePlanArchiveHeads` | `scopeKey` | Current committed revision pointer and migration state |
| `enginePlanArchiveManifests` | `[scopeKey, revision]` | Immutable revision metadata, count, schema, fingerprint and parent |
| `enginePlanArchiveRecords` | `[scopeKey, revision, recordId]` | Independently stored validated plan records and stable order index |
| Existing `events` | existing key | Append-only journal events; Engine Plans payloads carry archive references |
| Existing `outbox` | existing key | Delivery record with the same archive revision reference |
| Existing `remoteInbox`, `projectionConflicts`, `conflictResolutionIntents`, `metadata` | existing keys | Remote materialization and recovery coordination |

All archive rows include `scopeKey`, `revision`, and `schemaVersion`. `scopeKey` is exactly `guest` or `user:<uid>`; never infer ownership from a global singleton. Do not put user-identifying values in log messages.

### 3.2 Manifest contract

A committed manifest contains:
- `archiveSchemaVersion`
- `scopeKey`
- monotonically increasing local `revision`
- `parentRevision` (or null for first import)
- `recordCount`
- ordered stable `recordIds` or equivalent ordering metadata
- `fingerprintAlgorithm` and SHA-256 `fingerprint`
- creation metadata and commit state

Record identity is the validated plan's existing stable `id`. Reject missing IDs, duplicate IDs, malformed nested records and ambiguous order. Do not silently regenerate IDs during ordinary saves or migrations. Fingerprint the canonical serialized manifest plus records in deterministic order. Use Web Crypto SHA-256; do not use the current non-cryptographic snapshot fingerprint as archive integrity proof.

Records are immutable within a revision. Updating one or more plans creates a new revision. The previous committed revision remains available for rollback/recovery.

## 4. Local mutation protocol

For an authenticated user, one read-write IndexedDB transaction spans:
- archive manifest/records/head stores;
- `events`;
- `outbox`;
- any required mutation metadata.

The transaction validates expected base revision, writes a new immutable archive revision, updates the head, and inserts the corresponding journal event/outbox reference. All commit or none commit. The event/outbox payload references the archive revision, record count and fingerprint; it does not embed the full plan array.

For guest mode, use the same archive stores and revision semantics with `scopeKey=guest`, but do not create cloud journal/outbox mutations.

If the transaction aborts or quota is exceeded, preserve the previous archive head and report failure. Never update React state or report save success until the durable transaction commits. Retrying the same mutation ID and archive fingerprint is idempotent; reusing the same ID with different content is rejected.

### 4.1 Grouped operations

Session completion, demo-data load, backup import and reset may contain Engine Plans alongside other collections. Their grouped event must preserve existing all-or-nothing semantics. The archive update and grouped journal/outbox event must commit in the same IndexedDB transaction. Child operations must not be partially published.

## 5. Read API and hydration barrier

The archive repository exposes async operations such as:
- `initializeScope(scopeKey)`
- `readCommittedSnapshot(scopeKey)`
- `prepareAndCommitRevision(scopeKey, expectedRevision, records, mutationId)`
- `materializeRemoteRevision(scopeKey, manifest, verifiedChunks)`
- `verifyRevision(scopeKey, revision)`
- `exportSnapshot(scopeKey)`
- `rollbackToVerifiedRevision(scopeKey, revision)`

After hydration, StorageService may expose a synchronous read-only in-memory snapshot for existing React consumers. That cache is not durable and must be invalidated on every scope change. No UI may mount with a stale cache or a silent empty fallback.

Required AuthGate order:
1. Resolve authentication and explicit legacy-data ownership choice.
2. Set the exact storage scope and invalidate any prior in-memory Engine Plans snapshot.
3. Open/upgrade the journal database and initialize the archive stores for that scope.
4. If no archive exists, validate and migrate the scoped legacy localStorage array.
5. Verify record count, stable IDs, full read-back and SHA-256 fingerprint.
6. Commit the archive head/migration marker only after verification; keep the localStorage copy read-only.
7. Replay pending local journal events using archive-aware projection.
8. Materialize pending remote Inbox events; do not advance remote projection cursor until complete verification and durable archive commit.
9. Run the existing legacy portions migration.
10. Mount App only when `readyScope` still equals the active scope and the archive hydration barrier is satisfied.

IndexedDB unavailable, upgrade blocked, corruption, quota failure or fingerprint mismatch must produce an explicit recoverable gate/error. Do not claim the archive is hydrated and do not mount App with empty plans.

## 6. Lossless legacy migration and rollback

Migration is **copy → verify → mark**, never move-then-hope:
1. Read the current scope's legacy localStorage bytes without modifying them.
2. Strictly parse and validate every plan; reject duplicate IDs and invalid nested values.
3. Compute expected count, ordered IDs and SHA-256 fingerprint.
4. Write a staged archive revision in one IndexedDB transaction.
5. Read the staged revision back from IndexedDB and recompute all integrity values.
6. In a second transaction, mark the verified revision committed and record the migration marker.
7. Keep the original localStorage value unchanged and read-only throughout the rollback window.

If migration fails at any point, the old bytes remain intact and the archive head remains the previous committed revision. Retry is idempotent. Never overwrite a non-empty archive with a legacy snapshot unless an explicit, validated recovery decision authorizes it. A marker without a verifiable committed manifest is invalid.

The current synchronous `setStorageScope` must not be treated as archive migration. Its existing copy/verify/delete logic must be reviewed so the Engine Plans key remains recoverable and cannot be deleted before the archive migration has a verified destination.

## 7. Journal replay, Inbox and conflict handling

### Local replay
- A journal event containing Engine Plans references a committed archive revision.
- Replay verifies the referenced revision and fingerprint before treating the event as materialized.
- If the archive transaction committed but the projection cursor did not, replay detects the exact revision/fingerprint and safely completes cursor finalization.
- A missing or mismatched archive revision blocks replay and leaves the event durable; never substitute an empty list.

### Remote Inbox
- Remote manifest/chunks are fetched and validated before local finalization.
- Materialize all records and update the archive head in a local transaction that also finalizes the Inbox event, remote revision metadata and projection cursor where possible.
- Any missing chunk, hash mismatch, schema mismatch or scope change leaves the Inbox event and cursor untouched.
- Grouped `syncMeta` transactions containing Engine Plans must materialize every child before the grouped cursor can advance.

### Conflict resolution
- Conflict snapshots store archive revision + fingerprint + record IDs, not only raw localStorage bytes.
- `use-remote` validates the latest server revision and fully materializes its manifest before atomically committing the local archive head and conflict/cursor state.
- `keep-local` creates a new immutable archive revision based on the latest remote revision and records the exact local mutation identities. Do not union complete arrays or use last-write-wins.
- Existing safety blocks for unsupported collections remain unchanged. No tombstones are introduced by this work.

## 8. Remote manifest/chunk protocol

This is a separate rollout stage after local archive, journal references and local tests pass.

- Chunk payloads are immutable and idempotent, each with `archiveRevisionId`, `chunkId`, index/count, byte length and SHA-256.
- The manifest lists every chunk and its expected size/hash, total records/bytes, schema version, ordered record IDs and whole-archive fingerprint.
- Upload chunks first. Read back/verify all chunk documents. Publish the manifest/pointer last using revision compare-and-set. A partial upload never becomes the active revision.
- Receiver downloads all chunks, validates per-chunk and whole-archive integrity, then materializes locally before cursor advancement.
- Retain the last known-good remote revision. Garbage-collect old chunks only after trustworthy device acknowledgements prove no supported client still needs them.
- Keep each Firestore document below the conservative per-document payload ceiling with envelope headroom. Do not increase the 800 KB interim cap. The 800 KB cap is not a total archive quota.
- The exact Firestore document paths, Rules allowlist/schema changes, indexes, writer transaction and cleanup protocol require a separate Rules/security review and explicit owner approval before implementation or deployment.

## 9. Capability negotiation and older clients

A client must advertise supported archive schema, manifest/chunk protocol and maximum readable/writable version. Do not publish a manifest reference to a user scope if any active supported device cannot read it.

- Unknown capability means legacy-only compatibility, not permission to send new payloads.
- New clients can read legacy inline snapshots during transition.
- The cutover is per user/device and server-validated; local client claims alone are insufficient.
- Keep legacy inline writes available until all active devices acknowledge the new protocol or a documented deprecation policy safely excludes them.
- No destructive garbage collection until device acknowledgements and retention policy are reliable.

## 10. Backup, import and reset

### Export
Both Settings and Progress Analytics switch to one async verified export API. It reads a consistent committed archive revision and the other backup collections, validates the final payload, then downloads it. Export failure must show an error; never export stale localStorage compatibility bytes.

### Import
Validate the entire backup, including stable IDs, duplicates, sizes and schema, before any write. Stage the archive revision and grouped journal/outbox transaction atomically. Keep the previous revision active until commit. Failure leaves all prior collections and archive head intact. Legacy low-level `StorageService.importBackup` must be deprecated only after all callers and compatibility tests are proven.

### Reset
Use the existing journal-first reset flow, but make the Engine Plans empty archive revision part of the same grouped transaction. Do not use low-level `StorageService.resetAllData` as the canonical reset. Preserve previous archive revisions until reset is committed and recovery policy allows pruning.

## 11. Storage quota and retention

- No arbitrary 100-record limit. Capacity is governed by actual browser quota, application safety reserve and verified write success.
- Estimate quota for UX only; `navigator.storage.estimate()` is not a reservation or guarantee.
- Catch `QuotaExceededError` at transaction commit. Leave the old head and journal/outbox unchanged.
- Do not delete user plans, journal events, Outbox, Inbox, conflicts or progress under storage pressure.
- Optional audio/media cache may be evicted independently; Engine Plans and sync evidence may not.
- Retain at least the last verified archive revision plus any revision referenced by unacknowledged journal/outbox/inbox/conflict records.
- Garbage collection is disabled until reference accounting and device acknowledgements are proven.

## 12. Required tests before migration release

### Archive and schema
- v9 → v10 upgrade with empty, populated and malformed databases.
- Existing journal/outbox/Inbox/conflict records survive upgrade byte-for-byte.
- Guest and multiple UID scopes never read or overwrite each other.
- Stable ID uniqueness, order preservation, deterministic SHA-256 and schema validation.
- More than 100 plans; large plans; empty archive; duplicate/missing IDs; invalid nested records.

### Migration and crash recovery
- Crash before write, during record writes, after staged commit, during verification, before marker, after marker and before App mount.
- Quota failure at every transaction boundary.
- Retry idempotency and changed-content mutation-ID collision.
- Legacy source remains byte-identical after all failed attempts and after successful migration during rollback window.
- Account switch while migration is waiting or committing; stale scope writes are rejected.

### Application consumers
- AuthGate never mounts App before archive hydration.
- App initial state/refresh/session completion use the hydrated archive.
- Dashboard receives plans from the same hydrated source; no direct localStorage read.
- Planning wizard create/update/delete persist a new revision and update the cache only after commit.
- Demo-data grouped transaction includes its plan revision atomically.
- Settings and Progress Analytics export the same verified revision asynchronously.
- Import, reset and rollback preserve all collections and archive revision consistently.

### Journal, cloud and conflicts
- Local archive revision + event + Outbox commit atomically.
- Replay after crash before/after archive head commit; cursor never advances on missing/mismatched archive.
- Grouped `syncMeta` with Engine Plans plus other projections is all-or-nothing.
- Remote Inbox with missing/duplicate/corrupt/out-of-order chunks; cursor remains unchanged.
- A/B/A two-client import, concurrent edits, offline edits, retry after server success before acknowledgement, duplicate IDs, account switching and restart.
- Use-remote and keep-local preserve exact revisions/fingerprints and never lose local/remote bytes.
- Old client capability, unknown capability and mixed-version devices fail closed.

### Backup and quota
- Export after restart equals the verified archive revision.
- Import from old v3/v4/v5 backup shapes and new archive-capable backups.
- Failure at every import stage restores the previous archive and projections.
- Reset interrupted at each stage recovers without partial empty state.
- Browser quota exhaustion never deletes the previous archive or sync evidence.

## 13. Rollout stages

| Stage | Scope | Exit gate |
|---|---|---|
| A | RFC and API/schema review | Approved transaction boundary and test matrix |
| B | v10 stores + archive repository + unit tests | Schema migration, UID isolation, integrity, quota and crash tests |
| C | AuthGate hydration + App/UI consumers | No stale/empty reads; restart/scope-switch tests |
| D | Journal/outbox grouped mutation references | Atomic local archive/event/outbox tests |
| E | Backup/import/reset/conflict integration | Full rollback/replay/conflict tests |
| F | Remote manifest/chunks + capability negotiation | Rules review, emulator A/B/C and mixed-version tests |
| G | Release verification | Exact-head CI, Preview smoke, then separately authorized production/device gates |

Do not combine all stages into one oversized PR. Keep independent stages on separate feature branches with clear file ownership. No merge or deployment without exact-head gates and required owner approvals.

## 14. Explicit non-goals

- No increase to 100 or any payload budget as a substitute for archive storage.
- No invented subscription tiers or plan quotas.
- No cloud backup of local audio files.
- No Firestore Rules or Production changes in the local archive PR.
- No deletion/tombstone semantics for unrelated collections.
- No claim of unlimited storage; browser quota is finite and implementation must fail safely.


## 15. Account-plan adaptive capacity (new owner requirement)

This section defines the contract boundary; it does not create or assume subscription tiers. Main was inspected on 2026-11-12 and no billing/subscription/entitlement service or account tier model was found.

### 15.1 Separate three limits

1. **Per-plan content capacity:** maximum serialized bytes for one Engine Plan, supplied by a verified account entitlement.
2. **Account archive capacity:** maximum total Engine Plans bytes and/or active plan count for the account, supplied by the same entitlement.
3. **Local browser capacity:** actual IndexedDB write availability on this device. Browser quota estimates are advisory; the transaction commit is authoritative.

Chunk size is a fourth, transport-only parameter. It is not a user entitlement and must not change when the account changes plan.

### 15.2 Versioned server-authoritative entitlement snapshot

Proposed read-only snapshot shape (field names are contract proposals, not current app fields):

- uid
- entitlementVersion
- planId (opaque identifier; no tier names hardcoded in client)
- issuedAt, expiresAt
- enginePlans.maxSinglePlanBytes
- enginePlans.maxArchiveBytes
- enginePlans.maxActivePlans
- enginePlans.chunkProtocolVersion
- enginePlans.maxReadableArchiveSchema
- enginePlans.maxWritableArchiveSchema

The snapshot must come from a server-verified source (e.g. Firebase custom claims or an authenticated server endpoint backed by trusted billing/owner configuration). Never accept a client-writable Firestore profile field or a request-body planId as authority. Unknown/missing/expired entitlement fails closed for new cloud writes using a documented compatibility policy; it must not make already stored local plans unreadable or deletable.

### 15.3 Effective local write policy

- Validate a single plan against maxSinglePlanBytes and the full account archive against maxArchiveBytes / maxActivePlans.
- Also check local IndexedDB availability and handle QuotaExceededError atomically.
- navigator.storage.estimate() may show a useful estimate, but it cannot reserve space or override a failed transaction.
- Effective capacity is bounded by both the account entitlement and actual device capacity; it is never the larger of the two.
- If device quota is low, preserve all existing plans and sync evidence. Explain the limitation and allow export/recovery; do not silently delete old plans.
- If the user downgrades below current usage, preserve all existing records and permit read/export/restore. Block only new additions/expansions that exceed the new limit, unless the actual published product policy explicitly defines a reviewed alternative. Never truncate plans to fit.
- Upgrade takes effect only after a fresh verified entitlement snapshot; no local plan cache can grant itself a higher quota.

### 15.4 Chunk transport independent of account plan

- Keep a conservative global per-document/chunk payload ceiling with Firestore envelope headroom.
- Split the immutable archive by stable record IDs and bounded serialized bytes. The manifest carries per-chunk byte lengths and SHA-256, total archive fingerprint, archive revision, schema/protocol version, and entitlement revision used for validation.
- A plan with a large narrative or schedule may span multiple chunks, but it remains one logical record in the archive. The receiver reconstructs and validates the full record before making it visible.
- Upload/read-back/verify all chunks before publishing the manifest pointer. Download/verify/materialize all chunks before Inbox cursor advancement.
- Interrupted uploads remain unreferenced staging objects; retries are idempotent. Never treat a partial chunk set as a valid plan or publish a manifest that exceeds the entitlement.
- Old clients that cannot read the archive schema/chunk protocol must be capability-gated before the server publishes the new manifest.

### 15.5 Owner decision and release gates

Before enabling plan-based limits, the owner must approve the actual plan catalog and the meaning/value of each entitlement field. No plan names, prices, quotas, or tier defaults may be invented by engineering. The archive repository, local quota handling, chunk protocol, and tests can be implemented independently while that business decision is pending.

Required tests: server-verified vs client-forged entitlement, expired/missing/unknown claims, upgrade/downgrade with over-limit existing records, plan-size vs archive-size limits, chunk-size independence, offline cached claims, quota failure, and account switching. Firestore Rules or Production entitlement wiring requires separate security review and explicit owner approval.
