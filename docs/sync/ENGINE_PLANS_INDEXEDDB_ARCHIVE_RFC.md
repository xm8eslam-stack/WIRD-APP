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
| Conflict resolution | `syncConflictResolutionService.ts:112,230-243,283-328`; `indexedDbSyncJournal.ts:2178,2449,2508-2512,2687,2749-2764` | Generic conflict safety suite is registered; `syncConflictSafety.test.ts` has no Engine Plans-specific assertions. | Add Engine Plans use-remote/keep-local tests with revision+fingerprint references, UID switches, and cursor atomicity. Conflict intent preparation and commit APIs currently apply generic 128,000-byte payload checks at lines 2178, 2449 and 2687; payloads larger than that may be blocked even though normal Engine Plans mutations permit 450,000 bytes. Resolve this before large-plan conflict support. |
| Revisioned remote mutation / Firestore Rules | `revisionedRemoteMutation.ts:66`; `scripts/firestoreRules.test.ts:1250-1317` | Rules emulator exercises Engine Plans revision/merge shape at line 1317. | Rules tests do not prove chunk manifests, remote archive materialization, old-client capability negotiation, or real Production Rules deployment. |
| Journal replay | `journalProjectionReplayer.ts` applies via `StorageService.applyJournalEvent`; `storageService.ts:1725-1739` | `journalProjectionReplayer.test.ts` is registered but contains no Engine Plans-specific reference. | Add replay after archive-head commit/before cursor, missing archive revision, fingerprint mismatch, and no-empty-fallback tests. |

### 17.2 Confirmed gaps and design risks

1. **No canonical archive exists yet.** Engine Plans are still one scoped localStorage JSON array; journal/outbox/Inbox/conflict references still contain inline plan payloads or localStorage snapshots.
2. **The current getter is intentionally permissive, not a migration source.** `readJsonArrayArchive` at `storageService.ts:378-395` filters malformed records and returns `[]` on corrupt/non-array input while preserving the original bytes. This prevents destructive overwrite, but a UI consumer can see a partial/empty plan list. Archive hydration must read and strictly validate the exact scoped raw bytes, distinguish inaccessible storage from absent data, and fail closed rather than migrate the getter's filtered result.
2. **Startup barrier is insufficient for the future archive.** AuthGate's current order is scope → user journal replay → legacy portions migration → App mount. It has no archive initialize/copy-verify-mark/hydration step. App initializes synchronously at `App.tsx:111`; Dashboard independently reads storage at `DashboardView.tsx:73`.
3. **Scope migration can remove the legacy source.** `setStorageScope` copies/verifies then removes unscoped keys (including Engine Plans) when the user chooses import. Archive migration must be integrated before that removal, or the source must remain preserved as the RFC rollback copy.
4. **Synchronous export is a cutover blocker.** Both Settings and Progress Analytics call `exportFullBackup()` synchronously; both must use one async, consistent, verified archive snapshot.
5. **The 100-plan cap is duplicated.** Storage validation/save and session grouped persistence enforce it. Do not remove it until a validated archive API and all consumer contracts are ready; do not use a larger cap as a substitute for the archive.
6. **Payload ceilings are not uniform.** Normal Engine Plans journal mutations use 450,000 bytes via `maxMutationPayloadBytes`; legacy localStorage Outbox parsing remains 128,000 bytes per mutation; conflict intent preparation/use-remote/keep-local payload checks also remain 128,000 bytes (lines 2178, 2449 and 2687). A chunk-reference protocol must avoid embedding large plan arrays in those legacy/generic payload paths.
7. **Coverage gaps are material.** No AuthGate archive hydration test, archive repository/migration test, Engine Plans scope-switch test, demo-data-specific test, Engine Plans session-persistence test, remote Inbox chunk materialization test, or Engine Plans conflict-resolution test was found in the 183 code files.
8. **No code was changed and no test was run during this audit.** This is source evidence only; all runtime/CI results remain separate.

### 17.3 Exit gate

The code-source lexical sweep is complete for the 183 TS/TSX/JS files at the exact main SHA above. Before Stage B, still review non-code repository fixtures/config/data where relevant, verify the RFC's full transaction and crash-recovery design, and add the missing tests listed above. No migration, schema bump, cap increase, payload-budget change, Firestore Rules change, or Production flag change is authorized by this audit.



## 18. IndexedDB journal, remote cursor, and conflict transaction review — 2026-11-13

This review is against main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, not a runtime test. Source paths and ranges were fetched directly from that ref.

### 18.1 Two remote cursors have distinct meanings

- **Ingestion cursor — `remoteCursor`:** `importRemotePage` (`indexedDbSyncJournal.ts:3058-3185`) validates each event, requires strictly increasing contiguous server sequences, inserts every not-yet-stored event into `remoteInbox`, checks the 1,000-event inbox bound, and commits the inbox rows plus `remoteCursor` in the same IndexedDB read/write transaction. This is a durable *received* cursor, not proof of application.
- **Projection cursor — `remoteProjectionCursor`:** the projector reads only events after this cursor. `markRemoteProjected` (`indexedDbSyncJournal.ts:3221-3290`) advances it one sequence at a time only when the matching inbox event exists and there is no unresolved conflict, prepared resolution intent, or outstanding projection intent. It deletes that inbox row in the same transaction.
- The coordinator (`cloudSyncCoordinator.ts:440-506`) imports server pages first, then projects, and reports success only when the two cursors match. When projection is disabled, it intentionally leaves a received-but-not-projected backlog.
- **Conclusion:** The existing cursor separation is sound in principle. Do not collapse the two cursors. The ingestion cursor may advance after the complete page is durably staged; the projection cursor must never advance until the entire archive manifest/revision is locally materialized and verified.

### 18.2 Normal remote projection transaction

1. `projectRemoteInboxBatch` reads the next event, cached revision, pending local mutations, initialization state, and any existing projection intent (`remoteInboxProjector.ts:161-435`).
2. A conflicting event is retained in Inbox and archived with a local projection snapshot and relevant local mutation evidence. No projection cursor is advanced while the conflict remains unresolved.
3. For a projectable event, it creates a durable `remoteProjectionIntent` first.
4. `finalizeRemoteProjection` (`indexedDbSyncJournal.ts:1693-1885`) verifies the exact intent and inbox identity, requires `cursor + 1 === sequence`, rejects pending local mutations, and in one IndexedDB transaction commits remote revision metadata, initialized-collection baselines, projection cursor, Inbox deletion, and conflict closure.
5. The `applyProjection` callback is synchronous and writes the localStorage projection while that IndexedDB transaction is active. This is **not a cross-database atomic transaction**: localStorage and IndexedDB cannot commit atomically together. The prewritten durable projection intent plus idempotent replay is a recovery protocol, not true atomicity. Archive migration should make IndexedDB the canonical data store and localStorage a rebuildable projection; the archive revision and journal metadata should share one IndexedDB transaction.

### 18.3 Conflict resolution transaction semantics

- `saveProjectionConflict` archives the remote event, local snapshot, and relevant local Outbox mutations in one IndexedDB transaction; grouped `syncMeta` events gather child-collection mutations as well (`indexedDbSyncJournal.ts:~1950-2140`).
- `prepareConflictResolutionIntent` stores an immutable user choice bound to event fingerprint, server sequence, collection/document, local snapshot fingerprint, and local mutation fingerprint set (`indexedDbSyncJournal.ts:2160-2350`). It does not move either cursor or mutate projection/Outbox.
- **Payload mismatch is confirmed:** the remote Inbox accepts Engine Plans payloads under the 450,000-byte per-collection budget (`indexedDbSyncJournal.ts:3077-3079`), but conflict-intent preparation enforces the generic 128,000-byte ceiling (`2175-2180`). `commitUseRemoteConflictResolution` enforces the same 128,000-byte ceiling (`2434-2449`); `commitKeepLocalConflictResolution` does likewise (`2672+`, payload check near method entry). Therefore a valid large Engine Plans event can be ingested and archived but cannot be explicitly resolved through either use-remote or keep-local. This is a real compatibility gap, not merely a theoretical limit. Do not simply raise all conflict payload limits: use verified immutable archive revision references for large Engine Plans, and keep small bounded decision metadata in the intent.
- Use-remote re-fetches authoritative Firestore state, validates it, prepares/reuses a bound intent, re-fetches immediately before commit, and checks revision/payload equality (`syncConflictResolutionService.ts`). The IndexedDB commit then validates the intent and archived evidence, applies the projection, supersedes matching pending Outbox mutations, updates revision metadata, advances projection cursor, deletes Inbox event, closes conflict, and deletes intent (`indexedDbSyncJournal.ts:2434-2670`).
- Keep-local rebuilds a consolidated local payload from verified archived mutations and current projection, re-fetches the remote base revision, then atomically replaces old pending mutations with one new event/Outbox mutation, updates remote revision metadata and projection cursor, deletes Inbox event, closes conflict, and removes the prepared intent (`indexedDbSyncJournal.ts:2672-3015`).
- Both conflict commit paths still apply the selected projection synchronously to localStorage inside the IndexedDB transaction. As above, the archive cutover must replace this with an IndexedDB canonical revision commit and a recoverable projection update.

### 18.4 Required archive-aware transaction contracts

**Local mutation (including grouped session completion):** prepare/validate immutable archive revision and fingerprint outside the transaction; in one IndexedDB transaction verify expected archive head/scope, write all immutable records and manifest, append journal event, enqueue Outbox reference, and advance the archive head. If any write/quota/constraint fails, none of those IndexedDB records or metadata may commit. Update localStorage only as a derived projection after commit; if projection fails, retain the durable event for replay and do not report a failed data commit as data loss.

**Remote ingestion:** validate event envelope and manifest/chunk references; persist inbox envelope and received cursor together. If archive chunks are fetched separately, persist verified chunks incrementally under a staging revision but do not expose the revision as canonical or advance projection cursor. Incomplete staging is resumable and quota-safe.

**Remote projection:** verify every chunk count, stable ID, ordering, schema, and SHA-256 manifest fingerprint before commit. In one IndexedDB transaction publish the immutable remote archive revision as the collection head, commit remote revision metadata, advance projection cursor, delete the Inbox event, and close any reconciled conflict. If any check fails, preserve previous head, Inbox event, conflict evidence, and cursor. Never advance cursor on a partial manifest.

**Conflict use-remote:** store only a bounded immutable revision reference (revision ID + manifest hash + event fingerprint + decision ID) in the prepared intent. Re-fetch remote head and verify it still matches immediately before commit. In one IndexedDB transaction atomically switch archive head, supersede exact pending local references, update remote revision, advance projection cursor, delete Inbox row, close conflict, and remove intent. Retain old immutable revisions for rollback.

**Conflict keep-local:** validate the local archive head and all mutation references/fingerprints, create a new immutable revision based on that head, enqueue one bounded manifest-reference mutation against the latest verified remote revision, and commit archive head + journal + Outbox + conflict closure/cursor state in one transaction. Preserve archived old mutation evidence until the replacement is acknowledged and retention policy permits compaction.

### 18.5 Test matrix required before Stage B

1. Remote ingestion page: contiguous page, duplicate identical event, duplicate mismatched fingerprint, gap, out-of-order sequence, 100-event page, 1,000-event inbox full, quota failure; prove inbox rows and received cursor commit/abort together.
2. Projection: complete archive manifest; missing chunk; wrong chunk hash; duplicate stable ID; schema mismatch; interrupted download; quota failure; scope switch during fetch; stale intent; already-applied idempotent retry; prove projection cursor does not move on any incomplete case.
3. Conflict archive: ordinary and grouped `syncMeta` conflict, Engine Plans archive reference, local pending mutation set changes after display, fingerprint mismatch, missing local revision, oversized inline payload rejection, old-client event without archive capability.
4. Use-remote: remote revision changes after intent; archive chunk missing; local head changes; UID switch; IndexedDB abort; projection materialization failure; retry after crash; cursor/inbox/conflict/Outbox/archive head invariants.
5. Keep-local: multiple direct and grouped mutations, later direct mutation supersedes grouped one, stale local fingerprint, unexpected collection/document, large plan manifest, Outbox capacity, transaction abort, retry after crash.
6. Upgrade: v9 → v10 preserves every existing store and all guest/UID data; failed upgrade leaves v9 readable; no second canonical database.
7. Cross-tab: two tabs enqueue local mutation while remote event is staged/projected; lock unavailable; scope switches while waiting; prove no cross-account writes and no cursor skip.

### 18.6 Exit decision

- Cursor split and Inbox staging are structurally appropriate and already have useful atomicity within IndexedDB.
- Existing remote finalization/conflict commits are **not fully atomic across IndexedDB and localStorage**; they rely on durable intent and replay. This is acceptable as a legacy projection strategy only if explicitly preserved and tested; it is not the final archive ownership model.
- The 128 KB conflict payload ceiling is a confirmed blocker for valid 450 KB Engine Plans events.
- No archive repository, immutable chunk records, SHA-256 manifest, or archive-aware conflict API exists on main. PR #371 codec remains separate and is not integrated.
- **Stage B remains HOLD.** Do not change schema v9, payload caps, Firestore Rules, Production flags, or local/remote data until the archive-reference API and tests above are implemented on an isolated branch and pass exact-head Quality Gate.
- Source review only. No tests were executed and no runtime code was changed in this review.

 
## 19. PR #371 archive codec review and integration constraints — 2026-11-13

Reviewed PR #371 source at exact HEAD 260df95c620cd534337e39d6707b044eb404139a:
- src/services/enginePlanArchiveChunkCodec.ts
- src/services/enginePlanArchiveChunkCodec.test.ts
- src/tests/runAllTests.ts

PR #371 remains OPEN/DRAFT and is not in main. Its codec is a useful pure building block, not an archive repository or a complete remote protocol.

### 19.1 What the codec already provides

- Protocol version 1, stable record IDs and order, canonical JSON serialization, duplicate-ID rejection, SHA-256 per fragment, per-record SHA-256, and whole-archive SHA-256.
- Per-fragment ceiling 192,000 bytes, with reconstruction checks for missing/extra/corrupt chunks, fragment order/count, canonical record bytes, record ID, total bytes, and archive fingerprint.
- Rejects unsupported values (undefined, Date/non-plain objects, cycles, sparse arrays, non-finite numbers, hidden properties) rather than silently dropping data.
- Tests cover split/rebuild, stable ordering/IDs, missing/extra/corrupt/duplicate chunks, schema/revision/entitlement binding, malformed values, unsafe chunk size, and empty archives.

### 19.2 Integration blockers and design corrections

1. **The codec returns a fully materialized manifest containing every chunk descriptor and every ordered record ID.** There is no manifest byte-size/page limit or manifest paging. A sufficiently large archive can exceed Firestore's 1 MiB document ceiling even though each data chunk is only 192 KB. Do not store the entire manifest as one Firestore document. Add a hierarchical manifest: bounded descriptor pages (e.g. target ≤256 KB serialized each), each with a SHA-256 page digest and ordered page index; a small root manifest references pages and binds their hashes, total counts/bytes, revision, schema and archive fingerprint. The exact page size is a protocol constant with safety headroom, not an account quota.
2. **No repository adapter exists.** Codec functions build and materialize byte arrays only. There is no IndexedDB object-store schema, staging/publish API, local revision-head CAS, scope key, garbage collection, quota recovery, or crash recovery.
3. **No Firestore transport exists.** There is no chunk upload/download pagination, server-side manifest publication, immutable document path contract, retry/resume, old-client capability negotiation, or retention/rollback policy.
4. **No Journal/Outbox/Inbox integration exists.** Journal and Outbox still carry full Engine Plans payloads. Remote Inbox still stores the full event payload inline. No event references a manifest/revision/chunk page.
5. **No conflict integration exists.** Conflict intent payload checks remain 128 KB. The codec does not let conflict intents point to an immutable archive revision or verify a selected remote manifest at commit.
6. **Memory behavior needs a streaming review.** Build currently retains all output chunks in memory and computes a whole-archive fingerprint over a canonicalized payload containing all records. Materialize retains all record bytes and the full record list. This may be acceptable for small local fixtures but must not be the only path for large adaptive archives. Production sync should stream bounded pages/chunks and incrementally verify per-record/page/archive digests without loading all cloud bytes into one JS object graph.
7. **Descriptor validation needs a root/page boundary.** The codec validates descriptors against a complete in-memory manifest; a paged protocol must bind page index, first/last record ordinal, descriptor count, and each page digest to the root, then validate global no-gap/no-overlap ordering across pages before publishing the head.
8. **Record schema validation is currently generic.** Canonical JSON shape and id are validated, but domain-specific EngineGeneratedPlan schema/semantic validation must run before the archive head is advanced. Codec validity is not equivalent to a valid WIRD plan.
9. **The entitlementRevision field is only a binding field.** It is not authorization and must not be interpreted as proof of a plan tier or capacity. Actual entitlement enforcement requires a trusted server-authoritative contract, separately designed; no client-supplied entitlement value grants storage/sync rights.

### 19.3 Recommended integration shape

- Keep the codec pure and deterministic. Add manifest-page encode/decode helpers or a separate paged-manifest codec; do not mix Firestore or IndexedDB side effects into the pure codec.
- IndexedDB v10 should extend wird-sync-journal, adding archive revisions, record/chunk fragments, manifest pages, and staging metadata stores (or equivalent stores) with compound UID/revision keys. Do not create a second canonical database.
- Use immutable revision IDs and a per-scope archive-head record. Guest and user:<uid> must never share keys.
- Stage locally: validate strict legacy raw bytes → build and persist immutable local archive revision → read it back and verify all fragments/pages/manifest → atomically publish archive head + migration marker + Journal event + Outbox reference → only then allow App mount and later legacy-key cleanup. Preserve the exact legacy raw bytes read-only until explicit rollback retention expiry.
- Stage remotely: upload immutable chunks in bounded batches; upload manifest pages; verify remote reads/digests; publish a small root/head pointer last using a revision/CAS check. Readers must ignore uncommitted staging revisions.
- Receive remotely: import event + received cursor into Inbox; stage referenced pages/chunks; validate every page and record plus WIRD plan schema; then atomically publish the remote archive head + remote revision + projection cursor + Inbox deletion/conflict resolution. The received cursor can be ahead; the projection cursor cannot.
- Conflict resolution stores only archive revision ID, root manifest digest, event fingerprint, and decision metadata. Use-remote revalidates remote head immediately before atomic head switch. Keep-local creates a new immutable local revision and queues a small reference mutation.
- Retain previous heads/revisions until the new revision is fully acknowledged and rollback retention is satisfied. Garbage collection must be reachability-based and must never delete a chunk referenced by current head, pending Outbox, Inbox, open conflict, prepared intent, or rollback copy.
- Quota failure must leave previous head, journal, Outbox, Inbox, cursor and source localStorage unchanged; staging fragments may be marked abandoned and collected only after proving they are unreachable.

### 19.4 Decision

PR #371 codec may be reused after its own exact-head tests are inspectable and pass, but it is not sufficient to begin archive migration. Manifest paging, streaming/memory bounds, domain validation, repository persistence, remote transport, Journal/Outbox/Inbox references, conflict resolution, CAS publication, crash recovery and retention remain unimplemented. Keep #371 Draft until its CI is inspectable; keep archive Stage B HOLD.


## 20. Executable archive repository contract — design checkpoint 2026-11-13

This section converts the previous transaction findings into a concrete repository/API boundary. It is a design proposal only. It does not authorize an IndexedDB version bump, migration, Firestore writes, Rules changes, cap changes, or rollout.

### 20.1 IndexedDB ownership and key model

Extend the existing `wird-sync-journal` database (currently schema v9 on main); do not create a second canonical database. The proposed next schema is v10, subject to an explicit upgrade review and preservation tests.

Every archive row is scoped by an immutable owner key:
- Guest: `guest`
- Signed-in user: `user:<uid>`

Never derive the owner key from a display name, email, or mutable auth state. Every read/write transaction must receive a captured scope token and re-check that it still matches the active scope before publishing a head. A scope switch aborts outstanding staging/publish work; it must never retarget a transaction to the next user.

Proposed stores (exact names are implementation choices, but responsibilities are mandatory):
- `enginePlanArchiveHeads`: one current head per scope; key `[scopeKey]`; stores revision ID, root manifest digest, generation, schema version, and migration state.
- `enginePlanArchiveRevisions`: immutable revision/root records; key `[scopeKey, revisionId]`; stores parent revision, root digest, record count, total bytes, archive schema, creation metadata, and publication state.
- `enginePlanArchiveRecords`: immutable canonical record fragments; key `[scopeKey, revisionId, recordId, fragmentIndex]`; stores fragment bytes and verified descriptor fields. A record may span fragments; ordering is explicit, never inferred from object-store iteration.
- `enginePlanArchiveManifestPages`: immutable bounded descriptor pages; key `[scopeKey, revisionId, pageIndex]`; stores first/last record ordinal, descriptor count, serialized byte length, page digest, and descriptors.
- `enginePlanArchiveStaging`: resumable, non-canonical staging state; key `[scopeKey, revisionId]`; records expected root digest, received page/chunk bitmap or cursors, last activity, and failure state.
- `enginePlanArchiveMigration`: durable per-scope migration marker and source fingerprint; key `[scopeKey]`; states are absent → copying → verified → published → legacy-cleanup-eligible. The exact original legacy raw bytes/fingerprint remain available for rollback until the retention gate is explicitly satisfied.

All compound keys include scope and revision. No store may use a global record ID as a key without the scope/revision prefix.

### 20.2 Bounded manifest protocol

Keep data fragments below the codec's 192,000-byte ceiling. Do not put all chunk descriptors or all ordered record IDs in one root document.

Use a two-level manifest:
1. Descriptor pages target at most 256 KiB serialized, with a hard encoded-byte check before persistence. Each page binds page index, first/last record ordinal, descriptor count, total bytes, and SHA-256 digest.
2. A small root manifest binds protocol/schema version, immutable revision ID, parent revision, scope binding, record count, total bytes, page count, ordered page digests, and whole-archive fingerprint.
3. The root must be small enough for the transport's document ceiling with explicit headroom. If the page-digest list itself becomes too large, introduce a bounded multi-level page index; never silently exceed the document limit.
4. Validation proves contiguous page indexes, contiguous record ordinals, no duplicate/missing record IDs, exact fragment counts/order, per-fragment and per-record hashes, page hashes, aggregate byte totals, and final archive digest before publication.

The 256 KiB page target is a transport/protocol bound, not a per-user storage entitlement.

### 20.3 Repository API boundary

The repository is the only canonical Engine Plans persistence API after cutover. Proposed asynchronous operations:

- `getHead(scopeToken)` → verified head metadata or empty.
- `readRevision(scopeToken, revisionId)` → stream/iterator of records only after manifest/page/fragment verification; expose no partially verified revision as current.
- `prepareRevision(scopeToken, records, expectedHead)` → validate domain schema, stable IDs, canonical bytes and hashes; return an immutable prepared revision without publishing it.
- `stageRevision(scopeToken, preparedRevision, batchBudget)` → persist bounded fragments/pages as non-canonical staging; resumable and idempotent.
- `verifyStagedRevision(scopeToken, revisionId)` → read back from IndexedDB and independently verify every page/fragment/record and aggregate digest.
- `publishLocalRevision(scopeToken, revisionId, expectedHead, journalEvent, outboxReference)` → one IndexedDB read/write transaction that checks scope + compare-and-swap head, changes revision to published, advances head, appends Journal event, enqueues Outbox reference, and records migration marker when applicable.
- `publishRemoteRevision(scopeToken, revisionId, expectedHead, remoteRevision, inboxEventId, projectionSequence)` → one IndexedDB transaction that advances archive head and remote revision metadata, advances only the projection cursor, deletes the fully materialized Inbox event, and closes the matching conflict/intent.
- `exportVerifiedBackup(scopeToken)` → one consistent async snapshot including the verified Engine Plans archive revision.
- `importBackup(scopeToken, input)` / `resetScope(scopeToken)` → recoverable journaled operations that preserve or atomically replace archive head and rollback references.
- `collectGarbage(scopeToken, retentionPolicy)` → reachability-based collection only; never delete a referenced revision or fragment.

No caller may mutate the archive stores directly. No UI may reconstruct an archive by reading arbitrary chunks itself. Existing synchronous export and direct localStorage APIs must remain until every caller is migrated; then they become compatibility adapters or are removed in a separately reviewed change.

### 20.4 Transaction and failure rules

- Preparation, network I/O, canonicalization and expensive hashing occur before opening a short IndexedDB write transaction.
- The publish transaction re-checks scope, expected head/generation, all referenced staging rows, and expected Journal/Outbox identity. It performs no network calls and no unbounded async work.
- Local publication commits immutable revision + head CAS + Journal event + Outbox reference + migration marker in one transaction. Quota/constraint/abort means none of these become visible.
- Remote ingestion commits Inbox event(s) + received cursor together, as today. Chunk fetch/staging may continue afterward. The received cursor may be ahead of the projection cursor.
- Remote projection commits archive head + remote revision + projection cursor + Inbox deletion + conflict closure in one transaction, only after full local read-back verification.
- A failed localStorage projection is recoverable derived-view work; it must not roll back or misreport a successfully committed canonical IndexedDB revision. Replay is idempotent and scoped.
- Use-remote intent stores a small immutable reference (revision ID + root digest + event fingerprint + decision ID), not the full plan body.
- Keep-local creates a new immutable revision from the verified local head and queues one small reference event. Previous revisions remain reachable until the replacement is acknowledged and rollback retention expires.
- Any failed verification leaves the prior head and both cursors unchanged; preserve Inbox/conflict evidence for retry or user resolution.

### 20.5 Migration state machine

For each scope, migration is copy → verify → publish → cleanup-eligible; never destructive move:
1. Capture the exact legacy Engine Plans raw string and its byte length/fingerprint. Do not parse-and-reserialize it as the rollback source.
2. Strictly parse and validate every plan against the current WIRD domain schema. Preserve unknown-but-valid fields only if the domain contract explicitly allows them; otherwise stop and report the exact record, without dropping it.
3. Build immutable revision and paged manifest; stage to IndexedDB in bounded transactions.
4. Read back from IndexedDB and verify all records, pages, and root digest independently.
5. In one transaction compare-and-swap the expected empty/current head, publish revision, append migration journal event, enqueue reference if cloud sync is enabled for that scope, and mark migration published.
6. AuthGate must await verified archive hydration for the selected scope before App mounts or any Engine Plans consumer reads data.
7. Keep the original legacy bytes read-only. Cleanup is a later explicit release step only after backup/rollback evidence and all consumers have switched to the repository. Cleanup must never run on first successful copy.
8. On quota, interruption, tab closure, or scope switch, retain legacy bytes and previous head; leave resumable staging or mark it abandoned without exposing it.

### 20.6 Locking, multi-tab and scope changes

Use a per-scope lease/lock record with owner token, monotonically increasing fencing generation, expiry and operation ID. Every writer re-checks the fencing generation inside its publish transaction. A stale tab cannot publish after another tab acquired a newer generation. Do not rely on an in-memory mutex alone. If the browser lacks a reliable lock primitive, the IndexedDB transaction plus generation CAS is the authority. On auth scope switch, cancel fetches, stop staging, invalidate old tokens and wait for the new scope's hydration barrier before exposing data.

### 20.7 Garbage collection and rollback reachability

A revision/chunk is live if reachable from any of:
- current archive head;
- previous head inside rollback retention;
- pending Outbox event/reference;
- received Inbox event/reference;
- open projection conflict;
- prepared conflict-resolution intent;
- active staging session;
- migration rollback copy or backup snapshot not yet expired.

GC first marks unreachable candidates with a generation and grace period; a later pass re-checks every root and only then deletes. GC never runs as part of publish, migration, conflict resolution, or quota-failure recovery. Quota pressure may evict only already-proven unreachable staging/orphan records; it must never evict the last known-good revision.

### 20.8 Required test families and Stage B entry criteria

Before implementation is allowed to enter migration:
- v9 → v10 upgrade preservation for every existing store and guest/user data, including injected upgrade abort.
- Guest/user scope isolation, scope-switch cancellation, two-tab fencing and stale-writer rejection.
- Exact-byte legacy copy, malformed record rejection, unknown schema, empty archive, large multi-page manifest, page boundary/no-gap/no-overlap, fragment and root hash corruption.
- Atomic local revision + Journal + Outbox + head rollback on quota/constraint/abort.
- AuthGate hydration barrier and no pre-hydration consumer access.
- Async export/import/reset, session completion, grouped syncMeta, demo-data paths, backup rollback.
- Inbox received cursor may advance while projection cursor remains fixed; no projection on partial pages/chunks.
- Use-remote and keep-local conflict paths with stale revisions, missing chunks, scope switch, pending mutation changes and crash/retry.
- GC reachability across every root listed above; prove no current/pending/conflicted/rollback chunk can be deleted.
- Browser E2E across desktop/mobile plus actual multi-tab tests where supported.
- Exact-head inspectable CI: unit/integration tests, TypeScript, lint, production build, Firestore Rules Emulator and Playwright. No invisible/empty CI run counts as a pass.

**Stage B remains HOLD.** The repository API and schema are now specified at design level, but the full Engine Plans caller inventory and test-to-call-site matrix are still incomplete. No schema v10, code migration, Firestore protocol, Rules, cap change, production flag, merge or deployment is authorized by this design checkpoint.


## 21. Main-branch implementation audit — 2026-11-13 (verified scope and remaining evidence)

Baseline reviewed: `main` at `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. This is a source review of the named files and test paths below; it is not a claim that every source file or caller was exhaustively scanned, and no test command was executed in this review.

### 21.1 Confirmed runtime boundaries

- `storageService.ts` still stores `wird_engine_plans` as a localStorage JSON value; `getEnginePlans()` / `saveEnginePlans()` are synchronous and the legacy local cap is 100 plans.
- The current IndexedDB journal is `wird-sync-journal`, schema version 9, with stores for events, outbox, acknowledgements, metadata, remoteInbox, projectionConflicts and conflictResolutionIntents. No Engine Plans archive revision/chunk/page stores are present in the reviewed v9 schema.
- `AuthGate` establishes the guest/user storage scope and replays journal work before mounting App. This is the required place to await verified archive hydration before any Engine Plans consumer is mounted.
- App and Planning Engine flows persist plan changes through journaled snapshot paths, while Dashboard still reads Engine Plans synchronously. Settings and Progress Analytics both use the synchronous full-backup export path that reads the legacy localStorage value. These are explicit async-hydration/export migration call sites.
- Backup import and UI reset use journal-first paths. The low-level synchronous `StorageService.importBackup()` and `resetAllData()` remain legacy APIs; the complete caller inventory is not yet independently closed by a reproducible repository-wide scan.
- Session persistence groups Engine Plans with session work, but reviewed tests use empty plan arrays in the relevant grouped snapshot cases. No verified test currently proves a non-empty plan revision and session completion publish atomically.

### 21.2 Confirmed payload-budget mismatch on main

The reviewed main code has distinct ceilings that must not be conflated:

| Path | Observed ceiling |
| --- | ---: |
| IndexedDB Journal Engine Plans payload | 450,000 bytes |
| Ordinary mutation / legacy Outbox per mutation | 128,000 bytes |
| Legacy Outbox aggregate | 1,500,000 bytes |
| Revisioned Firestore writer | 128,000 bytes |
| Conflict snapshot | 500,000 bytes |
| Some conflict-resolution paths | 128,000 bytes |

This creates a local-acceptance / later-sync-or-conflict-rejection risk for payloads that fit the journal but exceed downstream budgets. PR #367 proposes a consistent interim 800,000-byte Engine Plans budget, but it is not merged into main and is not a chunked archive protocol. Do not change main's limits as a substitute for archive integration.

### 21.3 Tests reviewed versus gaps

Reviewed test families include storage scope, backup persistence, session persistence, planning engine, journaled snapshot service, IndexedDB sync journal, cloud sync coordinator, clean initialization, storage reliability, backup validation, journal projection replay, and plans/dashboard/settings/progress E2E.

Existing coverage demonstrates local plan persistence, selected journal/replay behavior, some quota/rollback handling, sync retry behavior, and malformed local data protection. It does not yet establish the archive release gates below:

- v9→v10 upgrade preservation and injected upgrade-abort recovery;
- real non-empty plan export → import → reload roundtrip;
- session completion atomicity with a non-empty plan revision;
- paged manifest integrity, streaming memory bounds, and chunk/page/root corruption recovery;
- migration interruption/resume with exact legacy-byte retention;
- two-tab fencing and stale-writer rejection for archive heads;
- archive-aware conflict use-remote/keep-local and Inbox projection atomicity;
- reset/account-deletion tombstones preventing archive resurrection;
- reachability GC across head, rollback, outbox, inbox, conflicts, intents, staging and backup roots.

No unit, integration, typecheck, lint, build, emulator or Playwright tests were run as part of this source review. Existing CI failures with unavailable step/log data remain unclassified; they are neither a code-level failure diagnosis nor a pass.

### 21.4 Safe next sequence

1. Finish a reproducible complete Engine Plans caller inventory and map each caller to an async repository consumer.
2. Add pure paged-manifest and bounded streaming codec tests independently of IndexedDB.
3. Implement the archive repository behind a feature-isolated adapter on a new branch, with no v10 migration or caller cutover in the first increment.
4. Prove repository behavior against an isolated test database, including CAS, staging, read-back verification, quota rollback, scope isolation and fencing.
5. Only then prepare the v9→v10 upgrade and AuthGate hydration integration as a separately reviewable increment.
6. Keep remote Firestore transport, conflict references, backup/reset conversion and rollout behind their own exact-head gates.

**Status remains DESIGN / HOLD.** This audit addendum changes documentation only. It does not approve or implement Stage B, change IndexedDB schema, alter runtime code or payload limits, touch Firestore Rules/data, enable production sync, merge a PR, or deploy.


## 22. Exact-head PR review and CI retry checkpoint — 2026-11-13

### 22.1 PR #367 — interim 800 KB payload alignment

Reviewed exact head `fd417faaa96a11920ef3a8e4f1038f567c36a731` and the changed payload-limit helper/tests.

- The shared helper gives `enginePlans` and grouped `syncMeta` transactions containing an Engine Plans operation an 800,000-byte limit; ordinary mutations remain at 128,000 bytes.
- The helper is applied at the IndexedDB journal, legacy Outbox facade, revisioned Firestore writer, remote Inbox validation, and the reviewed conflict prepare/commit paths.
- New tests exercise a 700 KB journal/outbox payload, grouped session envelope, rejection above 800 KB, and a large keep-local conflict resolution.
- Conflict snapshots are raised to 1,700,000 bytes and retained conflict count reduced to 29. This bounds the theoretical conflict-snapshot subtotal around 49.3 MB, but does not establish actual browser quota availability or make 800 KB a chunked archive protocol.
- The 800 KB scalar limit is still an interim compatibility ceiling, not adaptive storage, not a server-authoritative entitlement, and not a substitute for immutable archive revisions. Keep Draft/HOLD until CI is inspectable and the archive protocol replaces this interim path.

### 22.2 PR #371 — codec review remains incomplete for production use

Reviewed exact head `260df95c620cd534337e39d6707b044eb404139a`, codec and its tests.

- The pure codec canonicalizes JSON records, rejects unsupported/circular/sparse values, splits records into fragments no larger than 192,000 bytes, and validates fragment, record and archive SHA-256 fingerprints on reconstruction.
- The returned manifest still materializes every ordered record ID and every chunk descriptor in one object. There is no encoded manifest byte ceiling or descriptor paging.
- Build and materialize retain complete chunk/record collections in memory; archive fingerprinting canonicalizes the complete record set. This is not a bounded streaming implementation for large archives.
- The codec has no IndexedDB persistence, staging/publish/CAS, scope fencing, quota recovery, Firestore transport, Journal/Outbox/Inbox references, or conflict-resolution integration.
- It is suitable only as a pure codec prototype until paged manifests and bounded streaming are implemented and tested. Do not connect it to live data or migration.

### 22.3 PR #372 — CI dependency graph proposal

Reviewed exact head `950640ea78d29e87d426a89d8887c15e4de2abac`, package manifest, lockfile and workflow.

- The workflow switches the full verification sequence to Bun 1.4.4 and frozen lockfile installation; the lockfile includes Playwright and Firestore Rules test dependencies, plus explicit trusted dependencies and a gRPC override.
- Main still uses the mixed Bun/npm workflow and does not yet declare the Playwright test package directly. The proposed single Bun graph is directionally coherent, but exact-head CI must prove frozen install, audit, test runner, Firestore emulator, TypeScript, build, server smoke and Playwright under the selected Node/Bun versions.
- The workflow currently has a 30-minute job timeout. No change to main is justified by the currently uninspectable run result.

### 22.4 CI retry evidence

The latest observed exact-head runs before retry were:
- #363 docs head after audit update `0487a6dcf8ca8615c8c86e38dc5e2d8983a915f2`: run `43475819437`, job `132059257172`.
- #367: run `43209066503`, job `131151602011`.
- #371: run `43278752980`, job `131394096177`.
- #372: run `43391729769`, job `131773203535`.

All four jobs reported `conclusion=failure`, but `steps=null` and `logs_url=null`; no individual command outcome is observable. A retry was successfully requested for each failed job. Retry completion and exact-head test results remain pending and must be fetched before any pass/failure classification.

**Decision unchanged: all four PRs remain OPEN/DRAFT; #367/#371/#372 remain HOLD, and #363 remains documentation-only Draft/HOLD. No merge, deploy, production sync activation, schema change, Rules/data change, or secrets/settings change is performed.**


## 23. CI runner allocation and deployment boundary — 2026-11-13

The GitHub REST workflow/job records were checked directly after the retries:

- PR #363 run `43475819437`, attempt 2, job `132059729366`: completed failure in approximately 3 seconds; `steps=[]`, `runner_id=0`, empty runner name.
- PR #367 run `43209066503`, attempt 2, job `132059755899`: same empty-step / runner_id=0 result.
- PR #371 run `43278752980`, attempt 2, job `132059776012`: same empty-step / runner_id=0 result.
- PR #372 run `43391729769`, attempt 3, job `132059785133`: same empty-step / runner_id=0 result.
- The new exact-head PR #363 run for `81b187e3ab2e25cf74e47be41d1fcfa728941bd7` is run `43476057043`, attempt 1, job `132060047769`; it also failed in approximately 2 seconds with `steps=[]`, `runner_id=0`.

These records show that GitHub did not assign a runner or start a workflow step. This is stronger evidence of a runner allocation/dispatch failure than the earlier connector-only `steps=null` result, but the API exposes no diagnostic message identifying the root cause. Therefore no repository command ran, and none of these attempts is a code/test failure or a passing quality gate. Further immediate retries are not useful until the runner service/repository Actions configuration is investigated.

Vercel boundary recheck:
- Production alias `wird-app.vercel.app` is attached to READY deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, sourced from `main` SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Latest documentation preview `dpl_7czKY3nPsoGHe3UKpmcCgKjPeNMF` is READY for docs branch SHA `81b187e3ab2e25cf74e47be41d1fcfa728941bd7`, with a preview-only alias. It is not Production and contains no runtime changes from this audit.

No manual deploy, alias reassignment, Production promotion, or sync setting change was performed. A READY preview is not a live application smoke test. Keep all PRs Draft/HOLD until runner allocation is restored and a full inspectable Quality Gate passes on each final code head.


## 24. Active PR changed-path collision map — 2026-11-13

A fresh exact changed-path comparison was run across OPEN PRs #363–#372. This is a path-overlap map, not a mergeability or semantic-equivalence claim.

| PR pair | Shared paths | Required handling |
| --- | --- | --- |
| #365 with #367, #368, #369, #371 | `src/tests/runAllTests.ts` | Serialize test-runner edits; rebase/reapply each registration and inspect the final aggregator. |
| #367 with #368, #371 | `src/tests/runAllTests.ts` | Do not merge in parallel; reapply registrations and rerun the full gate after each final head. |
| #367 with #369 | `src/components/plans/PlanningEngineWizard.tsx`, `src/tests/runAllTests.ts` | Resolve the same component carefully: retain both the 800 KB warning/guard and the multi-Surah/Juz/range UX. Re-run plan wizard and range E2E after integration. |
| #368 with #369 | `src/tests/runAllTests.ts` | Only aggregator collision observed; still serialize registration edits. |
| #368 with #371 | `src/tests/runAllTests.ts` | Only aggregator collision observed; serialize registration edits. |
| #369 with #371 | `src/tests/runAllTests.ts` | Only aggregator collision observed; serialize registration edits. |

No changed-path overlap was observed in this scan between #366 and #368, or between #370 and the other listed code PRs. That does not rule out runtime interaction: #366 changes Service Worker/offline storage behavior while #368 introduces a separate offline audio Cache Storage/library/downloader stack, so their storage ownership, cache names, eviction and UI integration still need a semantic integration review before either is treated as a complete offline-audio release.

### Required integration order

1. Keep all current PRs Draft/HOLD until CI runner allocation is restored.
2. Integrate #367 and #369 on one plan-component branch in a controlled sequence, preserving both changes and all test registrations.
3. Integrate #365, #368 and #371 one at a time, resolving only the test aggregator collision at each step.
4. Keep #370 isolated; verify it against the final session component after other merges.
5. Re-run the complete exact-head suite after the last rebase/merge. A previous PR's pass cannot certify a combined head.

This scan does not authorize merging any PR or changing main.
