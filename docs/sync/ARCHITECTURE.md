> **تنبيه حالة الوثيقة — 2026-11-11:** هذا الملف مرجع تخصصي/تاريخي لتصميم المجال وسجل أدلته، وليس قائمة المهام الحية. المصدر الوحيد للحالة والخطوة التالية هو [`docs/CONTINUE_HERE.md`](../CONTINUE_HERE.md) (اضبط مسار الرابط النسبي حسب مكان الملف)، والخطة الموحدة في [`docs/DEVELOPMENT_ROADMAP.md`](../DEVELOPMENT_ROADMAP.md). أعد التحقق من SHA وPR وCI وProduction قبل استخدام أي وصف قديم بأنه "حالي". لا تحذف التاريخ أو الأدلة السابقة.

# CURRENT ARCHITECTURE STATUS — 2026-11-07 (main at PR #158)

This section supersedes older status statements below; the detailed historical entries remain as implementation history.

## Merged conflict and convergence capabilities

- **PR #149 — use remote:** a confirmed, narrow executor reads the latest Firestore state, validates the revision/schema envelope, binds the decision to the exact archived local snapshot and mutation identities, re-reads the authoritative document immediately before commit, and atomically applies the chosen snapshot with conflict closure, Outbox supersession, revision metadata, inbox deletion, and cursor advancement. Crash recovery recognizes the exact already-applied snapshot. Tombstones remain unsupported.
- **PR #155 — keep local:** a confirmed, narrow executor revalidates the latest remote revision and exact local projection, preserves the old local mutation evidence, then atomically queues one consolidated full-snapshot replacement based on the latest remote revision. It is intentionally limited to supported single-collection upsert conflicts; grouped `syncMeta`, tombstones, and Ruqyah counters remain excluded.
- **PR #157 — Ruqyah V2 PN counters:** progress is represented by per-device monotonic increment components and reset watermarks. Component-wise merge is commutative, associative, and idempotent. Compatible V2 snapshots converge automatically; divergent V1 baselines are not guessed or summed and remain archived.
- **PR #158** records the current Ruqyah V2 release boundary.

## Exact-head CI evidence

- PR #149: `c675a2d164b88994c08a5368bf1695712f2625f3`, Quality Gate run `42368745026` — success.
- PR #155: `1d4ea9d5acb5be0179af6935f79c4a100fab1ecf`, Quality Gate run `42370175733` — success.
- PR #157: `b2752297842d6fd30d7b4ae86eb33d48585e9ce8`, Quality Gate run `42372550605` — success.
- PR #158: `c90af2e8838a52136e50f422981737966e104d29`, Quality Gate run `42372993374` — success.

These are repository CI/emulator/browser results, not proof of deployed Firestore rules, a live Vercel release, or real production-device convergence.

## Remaining blockers and invariants

1. Tombstones are accepted by the revisioned remote envelope but the projector still returns `blocked_tombstone`; storage projection rejects delete events. Define collection-specific semantics before changing this.
2. Keep-local cannot yet safely resolve grouped `syncMeta` events. Preserve the grouped transaction as one atomic unit; never partially re-publish its child projections.
3. Use-remote and keep-local are deliberately narrow and must not be generalized to unsupported collections or malformed snapshots.
4. Ruqyah V2 auto-merge requires valid V2 snapshots and compatible legacy baselines. Divergent V1 snapshots remain blocked.
5. Production sync activation remains gated by verified deployed Firestore rules, full account/cross-tab/offline/crash tests, and real two-device validation. The environment values are not observable here; do not assume either flag is enabled.
6. Production deployment is not established by CI. Confirm the exact deployed SHA and live smoke independently; do not bypass Vercel rate limits.

## Next implementation order

- Collection-specific tombstone design and tests, starting with an explicit allowlist and rejecting all ambiguous/unsupported cases.
- Atomic grouped `syncMeta` conflict resolution.
- Cross-tab/account lifecycle and long-offline/crash stress.
- Complete backup/restore/reset and authenticated browser journeys.
- Only then reassess the global production release gate.

---

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


## 2026-11-07 — populated multi-record sync, Playwright, and conflict-evidence checkpoint

- Current main at checkpoint: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`.
- PR #122 merged as `beec50a623febdfa79f286f7c2b87d8234b2b150`; exact head `945c0f73e965d0111d46c53179465ee4c98fb83a` passed six Playwright app-shell checks (three desktop, three mobile Chromium/iPhone 13 viewport emulation). Post-merge main run `42360161749` passed.
- PR #125 merged as `ceebd11995bece572d40230ab084858be5a40cf2`; exact head `b24e0eb8221c23498878ee0a58727990ad9f2dfd` passed 521 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright checks. Post-merge main run `42360526021` passed.
- PR #126 merged as `802811d45a6d7e977d3b4082fd08ebf5e95151fa`; exact head `9886ca8a090cf07f04b51943fbc254a4b98ce221` passed 521 automated assertions and 31 Firestore Rules Emulator tests plus the remaining Quality Gate steps, including Playwright. Post-merge main run `42360725981` passed.
- PR #129 merged as `ab1a2cd04a1456a6430985ce6f6e72a1b137907d`; exact head `334a73a05bddc4d574cdf8c25a0299f329b22c49` passed 525 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright app-shell checks. Its post-merge main run was cancelled when the subsequent documentation-only PR #130 updated main; current main Quality Gate run `42361224358` is the relevant post-merge validation and was in progress at this checkpoint.
- PR #129 makes normal remote projection and the final IndexedDB cursor/revision transaction document-scoped. Same-document pending writes still block; unrelated test-result documents can progress independently. Grouped `syncMeta` transactions retain collection-wide guards.
- PR #126 adds durable pending local mutation evidence to Conflict Archive, including mutation IDs, fingerprints, base revisions, sequence numbers, and payloads. Repeated observations append by mutation ID; a fingerprint mismatch or combined snapshot size above 500 KB aborts without deleting inbox/outbox entries or advancing the cursor. Settings displays at most ten archived mutation payloads while retaining the full archive.
- This is not yet a user-directed conflict-resolution state machine: keep-local, use-remote, safe merge, and revision revalidation actions remain unimplemented. Tombstones, additive multi-device Ruqyah counters, full auth/sync browser journeys, real two-device verification, and production deployment remain release blockers.
- PR #127 added 16 Ruqyah locator-library browser checks; PR #130 refreshed the Ruqyah checkpoint and release checklist after CORS hardening and locator-library E2E. These browser checks do not replace live Firebase/device tests.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit` on reviewed main updates. No live deployed SHA, live two-device verification, Firebase production-rules deployment, secret/environment-variable change, or production sync activation is claimed.
- PR #2 remains a draft, 115 commits ahead / 276 behind current main. Do not merge it wholesale.
- Next: implement the conflict decision state machine with atomic archival/revalidation and crash recovery; then tombstones, additive Ruqyah counters, broader Playwright workflows, backup/restore stress, and account lifecycle tests.


## 2026-11-07 — projection isolation and conflict evidence

Normal remote events now use the `uid + collection + documentId` outbox index both before projection and inside the atomic IndexedDB cursor/revision commit. This prevents a pending write to one test-result/activity document from blocking an unrelated document in the same collection. Grouped `syncMeta` operations intentionally retain collection-wide checks to preserve transaction atomicity. Same-document conflicts remain blocking.

Conflict records now preserve the raw local snapshot plus the exact pending local outbox entries for the conflicting document. Evidence is deduplicated by mutation ID and fingerprint and shares a 500 KB cap. This is an evidence-preservation layer only; it does not yet authorize or execute a conflict decision.



## 2026-11-10 — Current revisioned-sync release and collection review

This addendum supersedes older release-state statements above where they conflict with the current checkpoint.

- PR #197 is merged: grouped `syncMeta` keep-local operations use an atomic local transaction; unsupported tombstones and unsupported grouped operations fail closed.
- PR #198 is merged and deployed. Tested head: `0709b25663b0b52d151bff8de7508823dad89eee`; merge commit: `c6befabbacbb5f7ad6351e9dca6c604408713285`; Vercel deployment `dpl_DcQBhZU4QVrtZm1qoV8CwUryez9J` reached `READY` on `wird-app.vercel.app`.
- PR #198 fixed test-result projection: legacy `tests/snapshot` is authoritative; immutable per-result documents merge by result ID and reject conflicting reuse. Exact-head Quality Gate passed tests, Rules Emulator, TypeScript, build, server smoke, and desktop/mobile browser smoke.
- The user has since manually verified account synchronization across two devices and confirmed it works. This is user-reported live verification, separate from CI.
- Current collection review confirms `weakVerses` and `activityEvents` still use full snapshots. Weak-verse first-failure IDs are mutation-scoped; resolution removes a record from a replacement snapshot. Daily activity remains per-date aggregates even though session completion also emits a stable-ID `session.completed` domain event. Neither collection may be reconciled with blind union or numeric addition.
- Tombstones remain unsupported end-to-end. Remote projector blocks them without advancing its cursor. Do not bypass this guard or infer deletion semantics from snapshot writers.
- PR #200 is open for a narrow grouped-projection correctness fix: forward child `documentId` into both projection and recovery matching, preserving authoritative test snapshots versus immutable per-result merge. Its exact-head regression test and Quality Gate are pending; no merge or deployment is claimed.
- PR #199 contains the durable continuity checkpoint and documentation refresh. It remains separate from runtime changes.
- Vercel PR checks currently report the Free-plan `build-rate-limit`; this is not a successful preview deployment. Do not conflate it with GitHub Actions CI or the existing production deployment.



## 2026-11-10 — Post-PR #200 grouped identity fix and profile-key follow-up

- PR #200 merged to `main` as `5a866f22c254fd35b9c487f7d69546e6b691a9d3`. Exact PR head `7ed3af44291cf439b89625e30722750a9366e3e8` passed the complete GitHub Quality Gate, including automated tests, Firestore Rules Emulator, TypeScript, production build, server smoke, and desktop/mobile browser smoke.
- The fix forwards each grouped child operation's `documentId` into local apply and grouped recovery matching. Test-result recovery now distinguishes the authoritative `tests/snapshot` replacement from immutable per-result merges.
- Vercel reported `build-rate-limit` for the PR. A deployment lookup for merge SHA `5a866f22c254fd35b9c487f7d69546e6b691a9d3` returned no deployment record; do not claim this fix is live on Production yet.
- A further review found `RetentionService.buildRevisionPerformanceSnapshot` writes the profile projection under `profile/profile`, while session completion and `persistProfileSnapshot` use `profile/main`. Since revisioned conflict control keys by document ID, these create separate revision streams for the same logical profile. PR #201 is open to unify the revision path to `profile/main` and add a regression assertion; exact-head CI is pending.



## 2026-11-10 — PR #201 merged and combined production release verified

- PR #201 merged to `main` as `12468243db7707c19a1bf75823ca1dc6e09f9ad8`. Its exact PR head `fa6ef0ab821ea3ca9cea8ae59fd3197f75400fcf` passed the complete GitHub Quality Gate.
- Revision-rating profile projection now uses `profile/main`, matching session completion and profile snapshot writers. This removes the separate `profile/profile` revision stream for the same logical profile.
- Vercel Production deployment `dpl_d4u8eFLiZoxAwnd6UW5tQk8GPTKt` is `READY` on alias `wird-app.vercel.app`, with exact Git SHA `12468243db7707c19a1bf75823ca1dc6e09f9ad8`. This deployed tree includes PR #200 and PR #201.
- The earlier Vercel PR checks were rate-limited, but the subsequent main production deployment succeeded. Use the deployment record above as the current deployment evidence.
- Remaining unresolved collection-level work is weak-verse deletion/anti-resurrection and daily activity event-derived aggregation. Keep tombstones fail-closed.



## 2026-11-10 — Stable weak-verse identity merged; reconciliation remains gated

- PR #207 merged to `main` as `d45e30e521c3f20c7c6e48aa81b7bc37798952b4`. Exact PR head `fc1c5d58a59e806f75d14649d3610858663852d4` passed the full 30-step WIRD Quality Gate (run `42786910676`).
- New weak-verse records now use a coordinate-derived ID `weak-{surahNumber}-{ayahNumber}` in both journal-first and legacy local writers. The journal mutation ID remains device/action-specific for retry idempotency.
- Existing historical weak-verse IDs are deliberately preserved. Resolution events reference those IDs, so rewriting existing IDs would break their references.
- This is identity normalization only. It does not merge concurrent `weakVerses/snapshot` full-snapshot writes, does not make `mistakeCount` additive across devices, and does not prevent a stale active snapshot from resurrecting a resolved verse.
- Weak-verse remote projection and conflict resolution must therefore remain fail-closed until a durable event/tombstone model exists. Do not union arrays blindly or sum counters.
- Activity remains a per-day `DailyLog` aggregate snapshot. Session completion already has a stable mutation ID and `session.completed` domain event, but the local activity projection still adds into one date bucket. A safe multi-device design needs immutable per-session event identity, deduplicated materialization, legacy baseline migration, and rollback/recovery coverage before changing the projection.


---

## Engine plan archive scaling and chunked Firestore publication — design review 2026-11-12

**Status:** architecture decision proposal only. No chunked runtime implementation or Firestore schema/rule deployment is included in this documentation update.

### 1. Verified current constraints

- `StorageService.saveEnginePlans` rejects arrays longer than 100 and stores the full JSON archive through the synchronous `localStorage` adapter. Removing the count check alone would expose the browser's localStorage quota and would not make storage adaptive.
- `persistEnginePlansSnapshot` journals the complete `{ records: plans }` payload. The current main journal has a 450,000-byte engine-plan mutation budget; PR #367 proposes a shared 800,000-byte per-mutation budget across journal/outbox/writer. That PR does not implement chunking.
- `localSyncOutbox` stores its complete serialized state through StorageService and currently has a 1,500,000-byte aggregate cap. A larger individual payload can still exhaust the aggregate outbox budget when other pending mutations exist.
- `revisionedRemoteMutation` writes one state document and one immutable event containing the payload. The event ledger and state document therefore both carry the current full snapshot.
- Firestore documents have a hard size ceiling; raising client-side byte limits cannot bypass it. The existing Firestore rules only allow the current top-level user collection/document shape and do not yet authorize a versioned chunk subcollection.
- `remoteInboxProjector` expects the existing collection payload shape and has no manifest materialization step. An old client cannot safely project a new manifest-shaped enginePlans payload.

### 2. Required end-to-end target

#### Local archive

1. Add a versioned `enginePlanSnapshots` object store to the durable IndexedDB journal database (or prove a separate database can preserve the required atomicity; same-database transaction is preferred).
2. Store large plan snapshots as immutable local versions with:
   - `snapshotId` / `versionId`
   - schema version and plan identity
   - UTF-8 serialized byte length
   - chunk count and per-chunk byte length
   - per-chunk SHA-256 and full-snapshot digest
   - creation time and storage-scope UID
3. Keep small plans on the existing path when safe; large plans use local chunks. Do not retain the full large snapshot a second time in the Outbox.
4. Extend the journal API so the snapshot version and its small outbox manifest/reference are committed atomically. A failed transaction must leave the previous active snapshot and outbox untouched.
5. Migrate the existing localStorage archive losslessly: copy to IndexedDB, read back and verify the full digest, then switch the active pointer. Keep the old value until verification passes.
6. Because `StorageService.getEnginePlans()` is synchronous today, do not simply change its backing store and leave callers unaware. Either hydrate a verified in-memory read cache before the app exposes plan-dependent screens, or migrate consumers to an explicitly asynchronous repository. The first render must not mistake “IndexedDB not loaded yet” for “the user has no plans”.

#### Remote Firestore chunks

1. Use a dedicated per-user immutable version path, e.g. `users/{uid}/enginePlanVersions/{versionId}/chunks/{chunkId}`. Final collection/path names must be confirmed against the current rules and migration policy before coding.
2. Keep each chunk comfortably below the Firestore per-document ceiling; an initial target around 256 KiB of serialized UTF-8 content is proposed, not a final measured guarantee.
3. Split only at UTF-8 code-point boundaries. Never slice JavaScript strings by UTF-16 index and assume the byte budget is preserved.
4. Use stable version/chunk identities so retrying the same mutation is idempotent. A new content version must never overwrite chunks belonging to the previous version.
5. Each chunk record must bind UID, plan identity, version, index/count, byte length, schema version, and SHA-256. Reject a duplicate chunk ID if any immutable field or digest differs.
6. Upload all chunks first. Read them back and verify count, ordering, UTF-8 byte lengths, each digest, and the full reconstructed snapshot digest.
7. Only after complete verification, publish a small manifest pointer through the existing revisioned `enginePlans` event/state transaction. The manifest pointer is the atomic visibility boundary.
8. Never delete the prior valid version as part of publication. Garbage collection is deferred until a separately verified device-acknowledgement/retention policy exists; do not infer that all devices have received a version merely because one device uploaded it.

#### Remote import and projection

1. A receiving client reads the manifest event and downloads the exact referenced immutable chunks.
2. Verify the entire set before writing a materialized event into the durable local inbox.
3. If any chunk is missing, malformed, out of order, too large, or fails its digest, preserve the event and both cursors; do not partially update the local plan archive.
4. Materialize the verified snapshot into the local IndexedDB archive, then atomically advance the local active-version pointer and projection cursor.
5. Keep pending local mutations and conflict archives intact. A remote manifest must never overwrite unsynced local work.
6. An old client that does not advertise manifest support must not receive or project a manifest payload. Add explicit capability/version negotiation before rollout; do not rely on “everyone updates quickly”.

### 3. Quota and entitlement model

- “Unlimited” cannot mean unlimited physical bytes. Browser IndexedDB quota, device eviction, Firestore document/write/storage limits, account usage, and billing remain real constraints.
- Remove arbitrary hard-coded plan-count limits only after the IndexedDB archive and migration path are ready.
- Keep three limits separate: per-chunk Firestore document budget, per-mutation/outbox metadata budget, and aggregate per-user storage entitlement.
- No verified subscription/entitlement source or plan tiers are established in this repository review. Do not invent quotas or label any user as unlimited. Define a server-trusted `getStorageEntitlement(uid)` policy only after the product's actual plans and billing rules are specified.
- Show the user an honest usage estimate and a clear “storage unavailable/quota reached” state. Never delete the last valid snapshot to make room.

### 4. Firestore rules and rollout boundary

- A nested chunk path requires explicit owner-only read/create rules and immutable-update/delete denial or a separately reviewed retention rule. The existing broad top-level user match does not automatically authorize this nested path.
- Add emulator tests for cross-UID reads/writes, unverified users, invalid chunk fields, duplicate IDs, updates, deletes, manifest publication before all chunks, and old-client compatibility.
- Production Firestore Rules deployment, schema changes, and sync feature-flag changes remain owner-approved actions. This design does not authorize them.
- The manifest protocol must remain feature-gated until all clients that can receive the event understand it and the production rollout/rollback plan is approved.

### 5. Required test matrix

- Small inline snapshot remains backward compatible.
- Multi-chunk snapshots at boundary sizes (one byte below/at/above chunk target and multiple chunks).
- Arabic text, emoji, combining marks, and mixed scripts split/reassemble byte-for-byte.
- Duplicate upload, interrupted upload, missing chunk, reordered chunk, altered byte length, altered digest, and full digest mismatch.
- Manifest pointer never publishes before all chunks verify.
- Failed local migration leaves the original localStorage value intact.
- Crash between local chunk writes and outbox commit; crash after chunk upload but before manifest publication; crash after publication but before local acknowledgement.
- Two devices with concurrent edits, stale revision, pending local mutation, account switch, and old client without manifest capability.
- IndexedDB quota exhaustion, Firestore permission/quota errors, outbox near aggregate cap, and retry after connectivity returns.
- No chunk garbage collection while any supported device may still need the previous version.

### 6. Implementation sequence

1. Complete PR #367's interim limit alignment only after exact-head CI becomes inspectable and passes.
2. Build and test the local IndexedDB archive/migration layer independently of Firestore.
3. Integrate atomic snapshot-reference journaling and local projection.
4. Add the immutable Firestore chunk writer and Emulator rules in a separate reviewed change.
5. Add manifest materialization to the remote inbox/projector with old-client capability gating.
6. Run multi-device and offline recovery gates before any production rollout.

**Do not start by deleting the 100-plan guard or increasing byte constants again.** The safe next coding slice is the local archive repository plus a lossless migration/hydration strategy, after the existing read/write call sites and test fixtures are mapped.


## Engine Plans archive migration — call-site audit addendum (2026-11-12)

The current main-branch inventory confirms that the migration boundary is wider than `StorageService.getEnginePlans/saveEnginePlans`:

- UI state initialization and refresh are in `src/App.tsx`; the planning wizard receives the array through props and emits `onUpdateEnginePlans` rather than owning persistence.
- Normal writes go through `persistEnginePlansSnapshot` in `journaledSnapshotService`; session completion can include an optional enginePlans snapshot through `sessionPersistence`.
- Backup validation caps enginePlans at 100; journal-first import creates one `enginePlans/snapshot` operation. Legacy `StorageService.exportBackup/importBackup` still directly serializes/writes the localStorage key and must remain covered until all callers and compatibility paths are accounted for.
- Reset emits an empty enginePlans snapshot. Projection writes through `saveEnginePlans`, while `matchesJournalProjection` reads the legacy key directly. Clear/reset/recovery key lists also include ENGINE_PLANS.
- `cloudSyncCoordinator`, `revisionedRemoteMutation`, `remoteInboxProjector`, `indexedDbSyncJournal`, and `localSyncOutbox` all recognize the enginePlans collection. Receiver materialization and cursor ordering therefore form part of the archive migration, not an optional later integration.
- Existing test coverage spans `storageReliability`, `backupValidation`, `journaledSnapshotService`, `backupPersistence`, `sessionPersistence`, `indexedDbSyncJournal`, and `localSyncOutbox` suites. Inventory is still incomplete for every indirect UI/legacy backup caller and all test fixtures.

### Required migration API and invariants

1. IndexedDB is the canonical durable archive; use a versioned envelope with schema version, monotonically increasing revision/generation, record count, stable content digest, and validated records. Avoid one unbounded localStorage JSON string as the canonical copy.
2. Because IndexedDB is asynchronous, startup must expose a hydration barrier before App state, backup export, planning, or sync projection can read the archive. No consumer may silently fall back to an empty array while hydration is pending or failed.
3. Migration is copy-verify-mark, not move: validate legacy records, write the new archive transactionally, read it back, verify IDs/count/digest, then persist a migration marker. Preserve the old localStorage value read-only through at least one successful close/reopen cycle and a tested rollback window.
4. Journal writes must reference the exact archive revision and expected base revision. If the archive transaction or journal/outbox commit fails, surface failure and do not advance remote cursors or claim success. Idempotent retries must not duplicate records.
5. Backup export serializes a verified archive snapshot. Import validates the complete payload first, stages the new archive, commits atomically, and can restore the previous revision after quota/transaction failure. Reset must use the same transaction boundary.
6. Remote snapshots larger than the safe inline mutation budget require immutable chunks plus a manifest. Upload and verify all chunks before publishing the manifest pointer. Receiver materializes and verifies the full archive before projection/cursor advancement.
7. Capability negotiation is mandatory before sending manifest/chunk events to older clients. Firestore Rules, schema rollout, and feature flags remain separately owner-approved.
8. Keep three independent budgets: chunk/document bytes, mutation/outbox metadata bytes, and real aggregate storage entitlement. No subscription tier or unlimited quota may be invented.

### Gate before implementation
Complete the remaining repository-wide scan for legacy backup/import/export callers and test fixtures; add a call-site inventory test or static guard where practical; then implement the local archive/hydration layer in isolation. Do not remove the 100-record guard or change remote byte budgets as a substitute for migration.
