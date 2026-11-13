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


## 16. Pure archive chunk codec implementation — PR #371

PR #371 adds a pure codec only; it does not perform archive migration or remote writes.

- API: buildEnginePlanArchiveChunks(records, archiveRevisionId, schemaVersion, maxChunkBytes, entitlementRevision) and materializeEnginePlanArchiveChunks(manifest, chunkBytesById).
- Stable canonical JSON sorts object keys and rejects unsupported values, accessors, sparse arrays, non-finite numbers, circular references and unstable/missing record IDs.
- Large logical records are split into immutable fragments. Each descriptor binds archive revision, record ID, ordinal, fragment index/count, byte lengths, chunk SHA-256 and whole-record SHA-256.
- Manifest binds protocol/schema version, archive revision, optional server-authoritative entitlement revision, ordered record IDs, total bytes, transport chunk ceiling and whole-archive SHA-256.
- Materialization verifies every fragment, record, ordering, size, schema/revision/entitlement binding and full archive fingerprint before returning any records.
- Default raw chunk ceiling is 192,000 bytes; it is a transport bound, not a per-plan/account quota. A negotiated smaller limit may be passed by the caller.
- Tests are registered in runAllTests and cover large record round-trip, deterministic fingerprints, ordering, empty archive, missing/extra/duplicate/corrupt chunks, revision/schema/entitlement tampering and invalid JSON.
- This codec is not yet connected to IndexedDB archive revisions, Firestore chunk documents, manifest publication, capability negotiation or remote inbox materialization. Those remain separate stages after the full consumer/fixture audit and owner-approved entitlement source.
- Exact PR #371 head 597344a5f95a261df5301da4de992850d4a3f5b5; Quality Gate run 43278092246 / job 131391785241 failed before exposing steps/logs. No local tests/typecheck/build run.

### PR #371 latest head refresh
- Current exact head: 260df95c620cd534337e39d6707b044eb404139a.
- Additional validation rejects sparse orderedRecordIds, non-enumerable array properties, tampered totalBytes and changed entitlementRevision.
- Quality Gate run 43278752980 / job 131394096177 completed failure with steps=null/logs_url=null. No test/typecheck/build stage is inspectable.
- Codec remains pure and disconnected from archive migration, Firestore and remote Inbox.


## 16. Consumer inventory audit — 2026-11-13 (source review, not migration approval)

Baseline: main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. The repository tree contains 159 source TS/TSX files and 19 E2E/script TS/JS files (178 relevant files total). This pass reviewed the principal storage, startup, UI, backup, journal, outbox, inbox, conflict, and test-registry paths below. It is a targeted source audit; it does **not** certify that every indirect caller, fixture, or test has been exhaustively inspected. Migration remains HOLD.

### Confirmed direct/UI and lifecycle consumers
- `src/App.tsx`: initializes React `enginePlans` synchronously from `StorageService.getEnginePlans()`; repeats that read in refresh, daily-session selection, session completion, reset, and view refresh. `handleUpdateEnginePlans` calls `persistEnginePlansSnapshot` then updates React state after success. App state is currently initialized before any async archive hydration exists.
- `src/components/dashboard/DashboardView.tsx`: independently calls `StorageService.getEnginePlans()` in daily-session selection instead of consuming the hydrated App snapshot. This is a stale/empty-read risk at cutover and must be replaced by a prop/shared ready store.
- `src/components/plans/PlanningEngineWizard.tsx`: consumes `enginePlans` and writes create/update/delete/activation changes through `onUpdateEnginePlans`; it does not own durable storage directly.
- `src/components/auth/AuthGate.tsx`: resolves storage scope, runs `setStorageScope`, awaits journal replay for a user, then legacy portions migration, and finally mounts App. Required future order is scope resolution → archive hydration/legacy copy-verify-marker → journal replay/materialization → portions migration → mount.
- `src/services/storageService.ts`: `getEnginePlans/saveEnginePlans` use one localStorage JSON-array key; save rejects >100; backup payload validation separately rejects >100. `getLocalProjectionSnapshot`, `isLocalProjectionEmpty`, `matchesJournalProjection`, and `applyJournalProjection/applyJournalEvent` expose Engine Plans through localStorage projection contracts.
- `src/services/sessionPersistence.ts`: validates optional plan snapshot at <=100 and adds it to the same grouped session transaction as progress/activity/profile.
- `src/services/demoDataPersistence.ts`: grouped demo-data transaction includes an Engine Plans snapshot.
- `src/services/backupPersistence.ts`: backup import builds journal projection operations for Engine Plans; journal-first reset includes an empty Engine Plans snapshot. Import/reset must become archive-revision aware and preserve grouped atomicity.
- Backup export entrypoints confirmed in `src/components/settings/SettingsView.tsx` and `src/components/progress/ProgressAnalyticsView.tsx`; both call synchronous `StorageService.exportFullBackup()`. Both must move to one async verified archive snapshot API. Both UI import entrypoints use `importBackupFile` (journal-first). The legacy low-level `StorageService.importBackup` is used by the backup validation tests reviewed; full production caller scan remains open.

### Confirmed sync/projection consumers
- `src/services/journaledSnapshotService.ts`: emits `enginePlans/snapshot` event payload and projects it via `StorageService.saveEnginePlans`.
- `src/services/indexedDbSyncJournal.ts`: current IndexedDB database `wird-sync-journal` schema v9 stores events/outbox/Inbox/conflicts, but Engine Plans payloads remain inline and are projected back through localStorage. Current main per-mutation ceiling is 450,000 bytes; grouped syncMeta containing Engine Plans inherits that ceiling. The PR #371 codec is not connected to these paths.
- `src/services/localSyncOutbox.ts` and `src/services/cloudSyncCoordinator.ts`: include `enginePlans` in allowed collections and legacy remote-state collection lists.
- `src/services/remoteInboxProjector.ts`: grouped transaction allowlist includes Engine Plans; remote projection delegates to StorageService local projection APIs and conflict snapshots.
- `src/services/syncConflictResolutionService.ts`: grouped conflict resolution allows Engine Plans and compares the local projection snapshot against durable localStorage before replay.
- This confirms the archive migration is not a UI-only storage replacement. Journal replay, outbox, remote Inbox, grouped transactions, first-sync guards, conflicts and revision/cursor finalization all need archive references and verified materialization. LocalStorage writes performed inside IndexedDB journal operations are not one cross-store atomic transaction; the proposed shared-database archive stores are intended to close that gap.

### Test/fixture map confirmed in the source registry and targeted files
- Main aggregator: `src/tests/runAllTests.ts` includes planning engine, backup validation, backup persistence, clean initialization, session persistence, local sync outbox, IndexedDB journal, journal replay, journaled snapshot service, cloud sync coordinator, sync conflict safety, daily session selection and plan range selection suites.
- Relevant direct test modules include `src/services/planningEngine.test.ts`, `src/tests/backupValidation.test.ts`, `src/services/backupPersistence.test.ts`, `src/services/sessionPersistence.test.ts`, `src/services/journaledSnapshotService.test.ts`, `src/services/indexedDbSyncJournal.test.ts`, `src/services/localSyncOutbox.test.ts`, `src/services/journalProjectionReplayer.test.ts`, `src/services/cloudSyncCoordinator.test.ts`, `src/services/syncConflictSafety.test.ts`, `src/services/storageScope.test.ts`, and `src/tests/cleanInitialization.test.ts`.
- Relevant browser suites include `e2e/plans-ux.spec.ts` and `e2e/dashboard-ux.spec.ts`; test registry and fixtures need a complete second-pass audit before implementation.

### Remaining audit gates before Stage B
1. Complete repository-wide caller search for every direct `ENGINE_PLANS` key, `getEnginePlans/saveEnginePlans`, generic `getRawItem/setRawItem/removeRawItem`, backup export/import/reset and projection method. Include generated fixtures, scripts, E2E helpers and migration/restore paths.
2. Trace the complete grouped transaction/cursor path for normal mutations, session completion, demo data, import/reset, remote Inbox, use-remote/keep-local and replay after crash. Specify archive revision references at each boundary.
3. Inspect every test fixture that seeds legacy localStorage, fake IndexedDB, outbox/Inbox/conflict state, plus account switching and reload tests.
4. Produce a call-site-to-test matrix with exact file/line and missing test per call site. Only then freeze the migration PR scope.
5. Do not remove the 100 cap, change payload ceilings, alter schema/rules/flags or start migration before these gates and the RFC transaction design are reviewed.


## 17. Second-pass code-source and test matrix — 2026-11-13

Baseline: main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. A second-pass lexical sweep fetched and inspected all **183 TypeScript/TSX/JavaScript files** in the repository tree: 159 under `src/`, 18 under `e2e/`, 1 under `scripts/`, and 5 under `api/`. The repository tree contains 310 blobs total; this statement is specifically a complete code-source sweep, not a claim that every Markdown/config/lock/data blob was semantically reviewed. Search terms included the literal key, `ENGINE_PLANS`, `getEnginePlans`, `saveEnginePlans`, backup APIs, and `enginePlans` references. The literal `wird_engine_plans` is declared at `src/services/storageService.ts:36`; direct consumers route through `STORAGE_KEYS.ENGINE_PLANS`.

### 17.1 Call-site-to-test matrix

| Consumer / path | Exact source locations | Existing evidence | Missing coverage / migration requirement |
|---|---|---|---|
| Canonical key + localStorage getter/writer | `storageService.ts:36,1161-1179` | `planningEngine.test.ts:204-206,662-687`; `backupValidation.test.ts:506-508`; `storageReliability.test.ts:73` | No archive repository, immutable revision, >100 record, quota/crash, or SHA-256 migration tests. |
| Scope ownership / legacy import | `storageService.ts:167-176,218-294`; `AuthGate.tsx:14-46,57-74` | `storageScope.test.ts` covers generic UID-scoped storage; no Engine Plans-specific scope assertion found. | Test guest→UID import, keep-guest, two UIDs, account switch during async archive copy, and byte-identical legacy rollback. `setStorageScope` currently copies/verifies then removes legacy source keys; archive migration must interpose before source deletion. |
| App startup, refresh, session selection, mutation, reset | `App.tsx:111,225,308-345,364-373,399-412,518-527,673` | `journaledSnapshotService.test.ts:88-142,366-372,429-436`; `cloudSyncCoordinator.test.ts:534-621` | No AuthGate hydration barrier test; no assertion that App's initial state is unavailable until archive hydration succeeds; session snapshot-specific test is absent. |
| Dashboard / daily quick-start | `DashboardView.tsx:73`; `dailySessionSelection.ts:83-87` | `dailySessionSelection.test.ts:87-107` covers due, future-only, paused, inactive and completed tasks. | Dashboard must consume the same hydrated App snapshot; add startup/reload/scope-change UI tests and no-stale-read assertion. |
| Planning UI create/update/delete/activate | `PlanningEngineWizard.tsx:28-29,194-243`; `MemorizationPlansView.tsx:21-31,151-152` | Pure planning/storage tests exist; `e2e/plans-ux.spec.ts:7` seeds `wird_plans` (preset plans), not Engine Plans. | No E2E coverage for smart-plan archive create/edit/delete/reload, save failure, or state update only after archive commit. |
| Daily session grouped mutation | `sessionPersistence.ts:14,80-108` | Session persistence suite is registered in `runAllTests.ts`, but `sessionPersistence.test.ts` contains no Engine Plans-specific reference/assertion. | Add grouped archive revision + activity/profile/portion atomicity, >100 plans, quota failure, crash/replay and rollback tests. Keep the current 100 cap unchanged until archive capacity is proven. |
| Demo-data grouped mutation | `demoDataPersistence.ts:18-46`, especially line 34 | No dedicated `demoDataPersistence.test.ts` exists in the scanned tree; grouped transaction infrastructure is tested elsewhere. | Add demo load/retry/failure tests proving Engine Plans and every sibling projection commit or roll back together. |
| Backup validation and synchronous export | `storageService.ts:900,946,1977-2000,2089`; `SettingsView.tsx:166`; `ProgressAnalyticsView.tsx:167` | `backupValidation.test.ts:90,152,200-216,335-340,451-480,506-508` | Both UI exports are synchronous and read localStorage. Replace with one async consistent-revision export; test restart consistency and export failure without stale fallback. |
| Backup import | `backupPersistence.ts:145-146,194-233`; legacy direct writer `storageService.ts:2106-2133` | UI calls `importBackupFile`; `backupPersistence.test.ts:39-87,136-167`; legacy direct import is exercised in `backupValidation.test.ts:340,358,371,395,459`. | Full production caller search found no UI use of the low-level direct writer in the scanned code; retain compatibility tests until deprecation is explicitly safe. Add archive staging + grouped journal/outbox rollback coverage. |
| Reset | `App.tsx:518-527`; `backupPersistence.ts:249-266`; legacy `storageService.ts:2167-2188` | `backupPersistence.test.ts:99,115-122`; `storageReliability.test.ts:247,279` | Add interrupted archive reset/recovery and previous-revision retention tests; do not make low-level direct reset canonical. |
| Journaled snapshots / local projection | `journaledSnapshotService.ts:178-184,317`; `storageService.ts:1499-1510,1524-1564,1575-1588,1631-1674,1737-1801` | `journaledSnapshotService.test.ts:88-142,429-436` | Existing projections still synchronously read/write localStorage. Replace with verified archive revision references and test projection replay idempotency against archive revision/fingerprint. |
| IndexedDB journal schema / payload | `indexedDbSyncJournal.ts:7-40,273,392,586,798,1986,3078` | `indexedDbSyncJournal.test.ts:65-121` tests 450,000-byte Engine Plans mutation ceiling and grouped syncMeta ceiling. | DB is v9; add v10 upgrade preservation tests for every existing store. Main's inline payload budget is not archive storage. |
| Legacy Outbox format | `localSyncOutbox.ts:67-74,115,218-237,289` | `localSyncOutbox.test.ts` covers generic migration/recovery, but has no Engine Plans-specific cases. | Legacy localStorage Outbox validation still caps each mutation at 128,000 bytes; preserve its recovery semantics and explicitly test migration/rejection. New archive refs must not carry full plan arrays through this legacy format. |
| Remote Inbox / first-sync / grouped transactions | `remoteInboxProjector.ts:59-93,110-139,178-188`; `storageService.ts:1499-1564`; `cloudSyncCoordinator.ts:22` | `cloudSyncCoordinator.test.ts:534-621` covers outbound Engine Plans snapshot/delete/recovery; generic coordinator tests cover other flows. | No dedicated remote Inbox Engine Plans manifest/chunk materialization test. Cursor must remain unchanged until complete archive verification and local commit. |
| Conflict resolution | `syncConflictResolutionService.ts:112,230-243,283-328`; `indexedDbSyncJournal.ts:2449,2508-2512,2687,2749-2764` | Generic conflict safety suite is registered; `syncConflictSafety.test.ts` has no Engine Plans-specific assertions. | Add Engine Plans use-remote/keep-local tests with revision+fingerprint references, UID switches, and cursor atomicity. Conflict intent/commit APIs currently apply a generic 128,000-byte expected-payload check at lines 2449 and 2687; payloads larger than that may be blocked even though normal Engine Plans mutations permit 450,000 bytes. Resolve this before large-plan conflict support. |
| Revisioned remote mutation / Firestore Rules | `revisionedRemoteMutation.ts:66`; `scripts/firestoreRules.test.ts:1250-1317` | Rules emulator exercises Engine Plans revision/merge shape at line 1317. | Rules tests do not prove chunk manifests, remote archive materialization, old-client capability negotiation, or real Production Rules deployment. |
| Journal replay | `journalProjectionReplayer.ts` applies via `StorageService.applyJournalEvent`; `storageService.ts:1725-1739` | `journalProjectionReplayer.test.ts` is registered but contains no Engine Plans-specific reference. | Add replay after archive-head commit/before cursor, missing archive revision, fingerprint mismatch, and no-empty-fallback tests. |

### 17.2 Confirmed gaps and design risks

1. **No canonical archive exists yet.** Engine Plans are still one scoped localStorage JSON array; journal/outbox/Inbox/conflict references still contain inline plan payloads or localStorage snapshots.
2. **Startup barrier is insufficient for the future archive.** AuthGate's current order is scope → user journal replay → legacy portions migration → App mount. It has no archive initialize/copy-verify-mark/hydration step. App initializes synchronously at `App.tsx:111`; Dashboard independently reads storage at `DashboardView.tsx:73`.
3. **Scope migration can remove the legacy source.** `setStorageScope` copies/verifies then removes unscoped keys (including Engine Plans) when the user chooses import. Archive migration must be integrated before that removal, or the source must remain preserved as the RFC rollback copy.
4. **Synchronous export is a cutover blocker.** Both Settings and Progress Analytics call `exportFullBackup()` synchronously; both must use one async, consistent, verified archive snapshot.
5. **The 100-plan cap is duplicated.** Storage validation/save and session grouped persistence enforce it. Do not remove it until a validated archive API and all consumer contracts are ready; do not use a larger cap as a substitute for the archive.
6. **Payload ceilings are not uniform.** Normal Engine Plans journal mutations use 450,000 bytes via `maxMutationPayloadBytes`; legacy localStorage Outbox parsing remains 128,000 bytes per mutation; conflict intent/use-remote/keep-local payload checks also remain 128,000 bytes. A chunk-reference protocol must avoid embedding large plan arrays in those legacy/generic payload paths.
7. **Coverage gaps are material.** No AuthGate archive hydration test, archive repository/migration test, Engine Plans scope-switch test, demo-data-specific test, Engine Plans session-persistence test, remote Inbox chunk materialization test, or Engine Plans conflict-resolution test was found in the 183 code files.
8. **No code was changed and no test was run during this audit.** This is source evidence only; all runtime/CI results remain separate.

### 17.3 Exit gate

The code-source lexical sweep is complete for the 183 TS/TSX/JS files at the exact main SHA above. Before Stage B, still review non-code repository fixtures/config/data where relevant, verify the RFC's full transaction and crash-recovery design, and add the missing tests listed above. No migration, schema bump, cap increase, payload-budget change, Firestore Rules change, or Production flag change is authorized by this audit.
