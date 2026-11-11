# Latest live sync / release checkpoint — 2026-11-12

- Current main: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY and built from the exact current main SHA. This is not a live sync or browser smoke test.
- Main Quality Gate run `43079260528` and PR #363 exact-head run `43057118522` both ended before any job steps were recorded; job log downloads returned `BlobNotFound`. Neither is evidence of an actual test failure or a successful Quality Gate.
- PR #363 has been reconciled with current main in merge commit `bd383b2733af8dd95ce519d8867a256ef1cf8628`; GitHub reports mergeable=true. A follow-up relative-link correction changes the head; complete diff review and a successful exact-head gate are still required.
- Read-only Vercel environment inventory confirms Production values `true` for `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED`. No setting was changed. Owner decision is required before disabling/enabling either flag.
- PR #361/#362/#354 are merged and included in main. No new sync runtime code was merged in this checkpoint; event-ledger/cutover remains design-only.
- Google AI Studio sync, authenticated two-device sync, conflict/cutover production smoke, and live browser smoke are NOT VERIFIED.

> This live checkpoint supersedes all older main SHA and deployment references in the historical audit below.

---
## Current operational checkpoint — 2026-11-11 (daily engineering review)

This checkpoint supersedes the 2026-11-10 checkpoint and older statements below wherever they conflict. The older audit remains as historical evidence. Review performed against the current `main` pointer, current source blobs, PR metadata, GitHub checks, and the Vercel Production deployment/environment inventory. No application code, production data, secrets, environment settings, or Firestore Rules were changed.

### Repository, current main, and Production

- Current `main`: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe` ([commit](https://github.com/xm8eslam-stack/WIRD-APP/commit/2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe)); GitHub compare against `main` is `identical`.
- Since the previous worklog checkpoint `50bb25eeba2f1ed4ceae228b347c67b40f60c697`, main advanced 14 commits. Sync-relevant additions include the pure activity reducer/tests in PR #330 and IndexedDB quota/recovery regression coverage in PR #351. PR #361 is the latest merge and changes offline audio storage policy, not cloud-sync behavior.
- Latest Production is [`dpl_GoKscgfr9hVhkjAc96QtmoBFqUmg`](https://vercel.com/xm8eslam-9174s-projects/wird-app/GoKscgfr9hVhkjAc96QtmoBFqUmg), `READY`, target `production`, created 2026-11-11 14:26:00 UTC. It is built from branch `main` at the exact same SHA `2c9aa972...`; alias `wird-app.vercel.app`.
- Current main combined status reports Vercel `success`. This replaces the older `build-rate-limit` Production status in the historical checkpoint. A separate main-triggered GitHub Quality Gate was not independently retrieved by the PR-only workflow-run endpoint.

### Material sync changes since the previous checkpoint

- PR #325 merged as `9669d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6`: deterministic base-snapshot fingerprint compare-and-set for full `weakVerses` and `activityEvents` projections. This is a stale-write guard, not a multi-device merge.
- PR #330 merged as `4669db79b535b13acc4b683d7052e7df5d4c9eca`: pure deterministic `projectDailyActivityFromEvents` helper plus 12 tests. It preserves the legacy baseline, deduplicates identical event IDs, rejects ID collisions and baseline mismatches, captures local-date/timezone semantics in the event contract, and rejects invalid/overflowing input without partial projection.
- PR #351 merged as `5c1ecbaa77bc5a3aa13aba35a45b4ee63d366129`: test-only IndexedDB `QuotaExceededError` open-boundary regression; verifies the legacy localStorage Outbox recovery bytes are preserved.
- PR #361 merged as current main/Production SHA `2c9aa972...`: EveryAyah remains stream-only pending documented offline-storage rights; no cloud-sync code change.
- PR #203 is closed without merge and superseded by #325. PR #363 remains an open Draft documentation PR touching this audit and the activity-event design; its server-visible per-device cutover proposal is not merged. PRs #358/#359 are open Draft offline-audio manifest proposals, not cloud-sync PRs.

### Firebase Auth, Firestore Rules, and sync architecture

- Firebase source still pins `wird-quran-app` / `(default)`; Auth/coordinator requires a current verified user and exact `user:<uid>` storage scope.
- Current Rules blob `6c9cbf1e7a1ebe4325240d751d40aec9efabc760` is byte-identical to the Rules blob at deployment commit `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`. Manual Firestore Rules deployment [run 42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063) completed successfully. Rules preserve verified UID ownership, allowlisted collections, revision/state/event/server-sequence coupling, immutable events, denied physical deletes, and default deny. No Rules deploy was run in this review.
- Coordinator, Outbox, revisioned writer, remote Inbox/projector, and conflict-resolution service blobs match the previously reviewed implementations. IndexedDB remains schema v9 with durable Outbox/Inbox, acknowledgements, conflict archives/intents, and separate remote/projection cursors.
- PR #325's CAS precondition now protects divergent `weakVerses` and `activityEvents` snapshots. Destructive whole-snapshot `keep-local` / `use-remote` choices remain blocked for both collections.
- The new activity reducer is **pure only**. It is not connected to session completion, journal, Outbox/Inbox, remote projector, or Firestore. `sessionPersistence.ts` still publishes `activityEvents/snapshot` with a base fingerprint, and its `session.completed` event does not yet carry the reducer's captured `localDate` and timezone offset. Thus concurrent independent device sessions still cannot be safely merged.
- Tombstone-shaped writes remain unsupported: Firestore Rules deny physical deletes and the remote projector blocks tombstones. No delete/restore/anti-resurrection guarantee is claimed.

### Production environment inventory

Relevant Production variable names include the two sync gates and the six `VITE_FIREBASE_*` keys: `VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`.

**Critical operational finding:** Vercel's non-decrypted Production inventory shows both `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` configured as `true`. They were last updated 2026-11-09 20:57:24 UTC, before the latest Production build on 2026-11-11 14:26:00 UTC. The coordinator evaluates them as build-time `import.meta.env` gates, so the current build should be treated as having both gates enabled unless a separate artifact check proves otherwise. This is a discovered pre-existing configuration, not a change made by this review. No secret values were decrypted or displayed.

The older audit section below that states the two gates were absent is historical and superseded by this checkpoint.

### Quality gates and evidence limits

- PR #325 exact-head Quality Gate [42917981860](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42917981860): success.
- PR #330 exact-head Quality Gate [42926607299](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42926607299): success.
- PR #351 exact-head Quality Gate [43024968443](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/43024968443): success.
- PR #361 exact-head Quality Gate [43030824673](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/43030824673): success.
- Rules deployment run [42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063): success.
- These checks prove the corresponding exact-head automated suites/build/browser/Emulator steps, not a fresh authenticated production A↔B round trip. No real-device test, production data write, live sync telemetry check, or destructive recovery test was performed in this review.

### Release assessment and next action

**Engineering implementation: advanced, with new deterministic reducer groundwork. Production synchronization safety: HOLD / elevated risk.** The main operational concern is that both Production build-time gates are already configured `true` while real-device verification and the server-visible per-device legacy cutover protocol remain outstanding.

1. Obtain an explicit owner decision on whether to authorize disabling the two Production sync gates. They were not changed here because this review forbids Production settings changes.
2. Review and reconcile the per-device cutover proposal in Draft PR #363; no event-ledger cloud wiring should occur until server-validated device/baseline acknowledgement and old-client schema gating are designed and tested.
3. Keep weak-verse/activity whole-snapshot resolution and tombstones blocked until safe merge/delete semantics exist.
4. After release gates are resolved, document an authenticated physical-device A→B→A round trip. Emulator and CI are not substitutes.

No application code, Production settings, secrets, Firestore Rules, or user data were changed in this review.

---

## Current operational checkpoint — 2026-11-10 (final engineering review)

This checkpoint supersedes older operational statements below where they conflict with the evidence here. Reviewed application-code baseline: `2405067b60969ef431e3e9473ca446f9bd225a37`. The later main commits in this review are documentation-only. No application code, Firestore Rules, production data, secrets, Vercel settings, or environment variables were changed.

### Repository, CI, and Production

- Current main immediately before this documentation refresh: `588ae4e94355e302e52941bf2b57d71ec69bb9b0`; its only difference from latest Production source SHA `dac125dd8770cc4881e2c6cea6fe94623ad52144` is the audit Markdown file. No runtime source changed between them.
- Latest Vercel Production deployment is [`dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5`](https://vercel.com/xm8eslam-9174s-projects/wird-app/DGbABxoSjMdnDgZn5UwxZvj7AcX5), state `READY`, built from SHA `dac125dd8770cc4881e2c6cea6fe94623ad52144` on 2026-11-10 18:32:01 UTC.
- Current main Vercel status is failure with `build-rate-limit` (“Deployment rate limited — retry in 24 hours”). Production is therefore one documentation-only commit behind current main; **application source and all reviewed sync paths are identical**.
- Exact application-code Quality Gate [run 42865304625](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42865304625) passed on SHA `2405067...`: **662 automated assertions, 0 failures; 31 Firestore Rules Emulator tests; 8/8 approved Quran audio probes; 140 Playwright smoke passes with 2 skipped; TypeScript, dependency-audit step, production build, and server smoke passed**.
- Main Quality Gate [run 42876158628](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42876158628) on SHA `588ae4e...` was still in progress at last poll, with no failed steps; dependency/Playwright setup was active. Do not label it complete. The intervening run on `9a508d...` was cancelled when a newer documentation commit superseded it.
- Vercel Production contains `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED`; the previous checkpoint records both as enabled. Their values are not reproduced and were not changed.
- Owner-reported authenticated two-device success remains historical evidence. This review did not repeat a physical-device round trip after the later sync changes.

### Firebase Auth and Firestore Rules

- Client configuration pins project `wird-quran-app` and default database `(default)`; non-canonical project configuration is rejected. Authenticated sync requires verified email and exact active-UID/local-storage-scope agreement.
- Production Rules deployment is verified by manual workflow [run 42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063), successful on 2026-11-09 from main SHA `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`. Its preflight queried the active default-database ruleset, recognized the exact deny-all bootstrap policy (SHA-256 `ecf30f940747dcc3c5ba4993093e9a11ac9fc5df7e14b2a1512d2446923d84eb`), and successfully deployed only `firestore.rules`.
- Current main Rules blob SHA `6c9cbf1e7a1ebe4325240d751d40aec9efabc760` is identical to the deployed commit's Rules blob; no later Rules-file change was found. This is deployment/source-parity evidence. No new Firebase production call or Rules deployment was made in this review.
- Rules enforce verified-email UID ownership, collection allowlisting, revision envelopes, matching state/event/server-sequence writes, immutable events, upsert-only routed mutations, denied physical deletes, and default-deny unknown paths.

### Current sync assessment

**Operational baseline: PASS with bounded evidence.** Production has the reviewed sync source and deployed Rules; the current Production/main difference is documentation-only. Current-main application-code tests passed, and the owner previously reported a successful two-device test. A fresh physical-device verification after the latest changes remains outstanding.

- IndexedDB journal schema v9 stores append-only events, Outbox, acknowledgements, metadata, remote Inbox, projection-conflict archives, and conflict-resolution intents. Event and Outbox enqueue are atomic. Bounds include 1,000 pending mutations, 1,000 Inbox events, 100 archived conflicts, and capped one-hour retry backoff.
- Legacy migration and new local enqueue reject tombstones; the legacy localStorage source is preserved on rejection.
- Revisioned writer transactionally writes state, immutable event, and per-user server sequence with revision checks and retry idempotency. A tombstone-shaped writer branch remains, but Rules accept only upserts; this is not a supported delete path.
- Remote projector processes server-ordered events through a durable Inbox and advances its cursor only after safe local application/finalization. Pending local writes, base-revision conflicts, tombstones, and projection failures remain fail-closed. Compatible Ruqyah V2 snapshots use a dedicated merge/reset-watermark path; divergent V1 baselines remain blocked.
- Grouped `syncMeta` use-remote and supported keep-local upsert decisions preserve local transaction boundaries. PR #209 blocks both decisions for `weakVerses` and `activityEvents`, including grouped transactions containing either.
- Weak-verse coordinate IDs `weak-{surah}-{ayah}` do not solve full-snapshot concurrency or resolution anti-resurrection. `activityEvents` remains a full daily aggregate snapshot, not an immutable session ledger.
- Engine-plan payloads use a dedicated 450 KB cap (ordinary mutations remain 128 KB); grouped `syncMeta` receives the larger cap only when it contains an engine-plan operation.

### Pull requests and environment inventory

- PR #208 merged as `c05476bc7e20f7f2f89881d93a6a0e49ff394beb`; PR #209 merged as `f6fc58f017034f2c92e2a89067065fcb4dc29d8`. PR #209 exact-head Quality Gate run `42788810615` passed and the latest Production code includes it.
- PR #203 remains open and stale/diverged: 29 commits ahead and 35 behind main, GitHub reports `mergeable=false`. Its exact-head Quality Gate passed, but it must not be merged without rebase and fresh review.
- Vercel keys: `VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. The manual Rules workflow uses GitHub variable `FIREBASE_PROJECT_ID` and secret `FIREBASE_SERVICE_ACCOUNT_JSON`. No secret values were decrypted or included.

### Remaining risks and next action

1. Keep tombstones blocked until collection-specific delete, offline replay, stale-update rejection, recovery, and anti-resurrection semantics are designed and tested.
2. Design safe weak-verse concurrency/resolution and an immutable session-event ledger for deterministic activity aggregation.
3. Preserve and block divergent Ruqyah V1 baselines; do not infer a merge.
4. Expand cross-tab, account-switch/logout/reinstall, crash, long-offline replay, queue-stress, and IndexedDB quota/failure-injection coverage.
5. Obtain a fresh authenticated production A↔B device round trip after the latest sync changes, recording exact records and operations.
6. Recheck the Vercel rate-limited deployment status after its retry window; the current Production/main difference is documentation-only.

No production flags, secrets, Firebase Rules, schemas, or user data were changed in this review.

---

# WIRD — Comprehensive Cloud Synchronization Audit

**Audit date:** 2026-11-09  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Branch inspected:** `main`  
**Observed source HEAD before audit documentation commits:** `b79a9451f81fc72792d9417bef9f19ea44e83841`  
**Vercel project:** `wird-app` (Hobby)  
**Canonical Firebase project in source:** `wird-quran-app`  
**Firestore database:** `(default)`

> This report distinguishes source-code inspection and historical CI/emulator evidence from deployed and real-device verification. No production secrets were decrypted, no feature flags were changed, no Firestore rules were deployed, and no production data was modified.

## Executive summary

The WIRD repository contains a substantial local-first, revisioned synchronization architecture. It is not a basic "upload local JSON to Firestore" implementation. It uses a UID-scoped IndexedDB journal, durable Outbox/Inbox, immutable remote events, optimistic per-document revisions, a per-user server sequence, a projection cursor, conflict archives, recovery intents, and a separate coordinator for upload and remote projection.

**However, WIRD cloud synchronization must not currently be described as ready for public production use.** The most important operational finding is that the inspected Vercel environment-variable inventory did not contain either of the two runtime gates used by the sync coordinator:

- `VITE_WIRD_REVISIONED_SYNC_ENABLED`
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED`

Both functions return true only when the corresponding build-time value is exactly the string `"true"`. In the absence of these values, the revisioned upload loop is disabled and remote projection is disabled. The coordinator may still import remote events into its durable local Inbox, but it will not complete full reconciliation. This preserves data but does not provide the requested complete cross-device experience.

The source rules and architecture are strong in several areas, but important conflict classes remain intentionally blocked: tombstones, grouped `syncMeta` decisions, and divergent legacy Ruqyah V1 baselines. Broad cross-tab/account-lifecycle and long-offline stress, deployed rules verification, and a real authenticated production two-device test remain outstanding.

**Overall assessment: implementation is advanced; production activation and end-to-end operational readiness are not demonstrated.**

## 1. Scope and evidence inspected

### Repository and source

Inspected:
- Repository metadata and default branch.
- Recent commit history and sync-related commits.
- `src/lib/firebase.ts`
- `src/services/cloudSyncCoordinator.ts`
- `src/services/revisionedRemoteMutation.ts`
- `src/services/remoteInboxProjector.ts`
- `src/services/indexedDbSyncJournal.ts`
- `src/services/localSyncOutbox.ts`
- `src/services/journalProjectionReplayer.ts` (source/test portions returned during inspection)
- `src/services/journaledSnapshotService.ts`
- `firestore.rules`
- `firebase.json`
- `scripts/firestoreRules.test.ts`
- `package.json`
- `docs/engineering/FIRESTORE_SYNC_DESIGN.md`
- `docs/sync/ARCHITECTURE.md`
- `docs/sync/STATE-MACHINE.md`
- `docs/sync/TEST-MATRIX.md`
- `docs/DEVELOPMENT_CHECKPOINT.md`
- `docs/agent-handoffs/LATEST-GOOGLE-STUDIO.md`

### External configuration metadata

Inspected:
- Vercel Git-linked project context.
- Vercel project environment-variable **names and target environments only**; values were not decrypted.
- Recent Vercel deployment records and the latest observed Production deployment metadata.
- GitHub combined status for the inspected source HEAD.

### Not performed in this audit

- No local checkout or package install was available in this inspection, so a fresh full test suite/build was not run in this session.
- No authenticated login was performed in a real browser.
- No real second device was connected to the same account.
- No live production Firestore read/write was attempted.
- No Firestore rules deployment status could be proven from source alone.
- No secrets or environment-variable values were read.
- No changes were made to runtime behavior or production configuration.

## 2. Current source and deployment state

| Item | Observed state |
|---|---|
| Repository | `xm8eslam-stack/WIRD-APP` |
| Default branch | `main` |
| Source HEAD observed | `b79a9451f81fc72792d9417bef9f19ea44e83841` |
| Vercel project | `wird-app` |
| Vercel plan | Hobby |
| Canonical Firebase project | `wird-quran-app` |
| Firestore database | `(default)` |
| Rules source | `firestore.rules` |
| Latest Production deployment observed | `dpl_Di9gFtjLFgWVDHxgk4qFh2mfbVFn` |
| Production deployment SHA | `a5b88a4c01d3c15cbf6fa2085e17cae01c8d897d` |
| Production deployment state | `READY` |
| Production alias | `https://wird-app.vercel.app` |
| Current-main combined status | Vercel failure: `build-rate-limit` |

The latest observed Production deployment is on an older SHA than the source HEAD inspected. Therefore a Ready deployment exists, but it does **not** prove the currently inspected main code is deployed. A Ready deployment also does not prove that cloud sync is activated or that an authenticated two-device workflow succeeds.

The current main combined status returned a Vercel build-rate-limit failure. This is a deployment-provider limitation, not proof that the sync code itself failed its tests.

## 3. Firebase configuration and authentication

### Canonical project guard

`src/lib/firebase.ts` declares:
- `WIRD_FIREBASE_PROJECT_ID = "wird-quran-app"`
- `WIRD_FIRESTORE_DATABASE_ID = "(default)"`

The resolver uses the Vite environment values first, then the applet config fallback. Initialization is blocked if the resolved project is not the canonical project. It also checks an already-initialized Firebase app and throws if it points to another project.

This prevents silently using the old project `elliptical-rampart-bxq1s` or an unintended named database.

### Environment inventory

The inspected Vercel inventory included the six Firebase web config keys:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

They were listed for Production and Preview. Their values were not decrypted, so presence is not proof that each value is correct or that the deployed app resolves to the canonical Firebase project.

### Auth gate

The coordinator requires:
- A current Firebase user.
- `emailVerified === true`.
- Local storage scope exactly equal to `user:<uid>`.
- Firebase configuration and Firestore client availability.

The Firestore rules independently require `request.auth != null`, verified email, and `request.auth.uid == uid` for user data.

**Assessment:** strong source-level account ownership and verified-email boundaries. A live sign-up/verification/sign-in journey remains unverified.

## 4. Local-first journal and offline durability

The local journal is implemented in `src/services/indexedDbSyncJournal.ts`:
- Database name: `wird-sync-journal`.
- Current schema version: 9.
- Separate stores for events, Outbox, acknowledgements, metadata, remote Inbox, projection conflicts, and conflict-resolution intents.
- Per-user UID namespace.
- Per-device identity and monotonically allocated local sequence.
- Durable remote revision metadata and projection cursors.
- Retry metadata and bounded payload/queue limits.

The source defines explicit bounds, including:
- Up to 1,000 pending mutations.
- Up to 5,000 acknowledged IDs.
- Up to 10,000 remote revision records.
- Up to 1,000 remote Inbox events.
- Up to 100 projection conflict records.
- Up to 500 conflict-resolution intents.
- Up to 500 KB combined conflict snapshot bytes.
- Up to 128 KB mutation payload bytes.
- Bounded retry backoff.

The local design deliberately uses WIRD's own UID-scoped IndexedDB journal rather than relying on Firestore persistent browser cache as the durable offline queue. This gives WIRD explicit control over account separation, retry, and conflict handling.

### Strengths

- Mutations are journaled before local projection.
- Event and Outbox persistence is designed to be atomic.
- Replay logic handles interrupted local projection and guards stale writes after recovery.
- Queue limits are explicit rather than allowing unbounded growth.
- Conflict evidence is retained rather than silently discarded.
- The journal is designed to preserve pending work when network operations fail.

### Remaining verification

- Large queue/load tests and browser IndexedDB quota exhaustion.
- Long offline intervals and reconnect replay with many ordered events.
- Browser crash at each point in enqueue, local projection, remote commit, acknowledgement, and projection finalization.
- Multiple tabs mutating the same UID concurrently under real browser scheduling.
- Recovery after browser profile/storage cleanup or device replacement.

## 5. Upload pipeline and server transaction

### Coordinator

`src/services/cloudSyncCoordinator.ts`:
1. Checks network.
2. Checks Firebase initialization and auth.
3. Requires verified email.
4. Confirms the active local storage scope matches the exact UID.
5. Checks the revisioned-upload feature gate.
6. Reads bounded ready Outbox batches (25 entries).
7. Revalidates scope around asynchronous boundaries.
8. Reconciles cached remote revision metadata.
9. Rebases only when the local sequence/revision relationship is safe.
10. Writes the remote mutation.
11. Acknowledges the local Outbox item only after confirmed remote success.
12. Pulls remote events and attempts safe projection.
13. Computes a final status using pending writes and remote reconciliation.

### Remote transaction

`src/services/revisionedRemoteMutation.ts` uses one Firestore transaction to:
- Read the target state document.
- Read the immutable event document.
- Read the per-user sequence allocator.
- Reject stale base revisions.
- Detect exact already-applied retries.
- Reject mutation/event ID collisions.
- Increment the server sequence.
- Write the state document.
- Write the immutable event.
- Update the sequence document.

The transaction is retried only for a specific permission-denied/sequence-contention condition when a subsequent read proves that another writer advanced the sequence. A static rules denial is not blindly retried.

This is a strong foundation for idempotency and stale-write prevention.

### Important operational limitation

The upload loop runs only when:
`import.meta.env.VITE_WIRD_REVISIONED_SYNC_ENABLED === "true"`.

The Vercel inventory inspected in this audit did not list this variable. Therefore the production upload path should be treated as disabled unless another uninspected deployment/build configuration supplies it.

## 6. Remote import and projection

The coordinator imports remote events ordered by `serverSequence` into a durable local Inbox, in pages of up to 100 events and up to five pages per cycle.

Projection is separately gated by:
`import.meta.env.VITE_WIRD_REMOTE_PROJECTION_ENABLED === "true"`.

If projection is disabled, the coordinator records `projection_disabled` and returns incomplete reconciliation. This is safer than pretending that imported-but-unapplied events are synchronized.

The projector:
- Processes events in server sequence order.
- Checks the cached revision.
- Checks pending local mutations at document/collection scope.
- Checks whether the remote collection has been initialized.
- Requires a known base revision before applying an upsert.
- Uses durable projection intents for interrupted operations.
- Advances the cursor only after successful projection/finalization.
- Archives conflicts and leaves the event/cursor available for recovery when projection is blocked.
- Has a dedicated Ruqyah V2 counter merge path.

### Status semantics

The code distinguishes `synced`, `partial`, `offline`, `unverified`, `guest`, and `error`. The completion helper requires zero pending Outbox entries and a fully reconciled remote state; upload acknowledgement alone does not qualify as fully synced.

This is the correct distinction. It must remain covered by UI tests so the user is never shown a false "synced" state.

## 7. Multi-device and conflict behavior

### Supported paths

- Normal remote upsert projection is revision ordered.
- Same-document pending local mutations block projection to avoid overwriting local unsynced work.
- Unrelated documents can progress independently in document-scoped projection.
- Confirmed **use-remote** resolution exists for supported upsert conflicts. It revalidates the authoritative remote revision and exact archived local evidence before atomic local finalization.
- Confirmed **keep-local** re-publication exists for supported single-collection upsert conflicts. It queues a consolidated replacement against the latest verified remote revision and preserves prior mutation evidence.
- Ruqyah V2 uses per-device monotonic PN-counter components and reset watermarks. Compatible V2 snapshots merge component-wise, idempotently, and independent of delivery order.

### Unsupported / blocked paths

**Tombstones**
- The remote mutation contract and rules can represent a tombstone.
- The projector explicitly returns `blocked_tombstone`.
- Safe local deletion, resurrection prevention, per-collection deletion semantics, recovery, and retention are not complete.
- Do not reinterpret a tombstone as an empty upsert.

**Grouped `syncMeta`**
- `syncMeta` may represent one grouped transaction spanning multiple collections.
- The projector inspects all participating collections and archives the combined local projection snapshot.
- The current keep-local/use-remote conflict executors do not safely resolve grouped `syncMeta` conflicts.
- Never split a grouped transaction into separate child writes; partial application would violate atomicity.

**Legacy Ruqyah V1**
- V1 snapshots do not contain enough per-device history to safely infer whether two different totals overlap.
- Divergent V1 baselines remain archived and blocked.
- Do not automatically sum or take max of ambiguous legacy counts.

These are deliberate fail-closed safety boundaries, not ordinary UI defects.

## 8. Firestore Rules review

The reviewed `firestore.rules` file:
- Requires verified authentication.
- Requires the authenticated UID to match the document path UID.
- Uses a strict allowlist of nine data collections.
- Validates the sync envelope schema, payload type, IDs, device ID, mutation ID, timestamps, and revision arithmetic.
- Requires revision increments to match the existing document revision.
- Uses `existsAfter` / `getAfter` checks to bind the event, state document, and remote sequence writes together.
- Requires event records to be immutable after creation.
- Denies physical deletes.
- Denies all unmatched paths by default.
- Applies a specific V2 payload shape check to Ruqyah progress.

This is stronger than a permissive owner-only rule set.

### Critical deployment distinction

The file in GitHub is source configuration. This audit did not verify that the exact current rules have been deployed to the canonical production Firebase project. Production activation must remain blocked until the deployed rules are verified against the exact client transaction contract.

The Firebase emulator configuration points at the Firestore rules file and port 8080. Emulator success is not production deployment evidence.

## 9. Test evidence and confidence

The repository's sync documentation records the following historical evidence:
- PR #149: confirmed use-remote conflict resolution; exact-head Quality Gate passed.
- PR #155: confirmed keep-local for supported single-collection upserts; exact-head Quality Gate passed.
- PR #157: Ruqyah V2 counter convergence, resets, migration guards, and a two-device offline emulator scenario; exact-head Quality Gate passed.
- PR #158: checkpoint/release documentation; exact-head Quality Gate passed.
- Earlier populated collection matrix: all eight data routes were tested with populated records in sequential A → B → A emulator-backed round trips. This does not equal simultaneous multi-device conflict convergence for every collection.
- Nov 9 handoff records a later Quality Gate with 596 automated assertions, 31 Firestore Rules tests, 50 desktop/mobile Playwright tests, 8/8 audio CDN probes, dependency audit, TypeScript, build, and smoke checks for the exact tested PR #176 head.

### What the evidence proves

- Many local journal, outbox, projection, rules, conflict, and migration behaviors have substantial automated coverage.
- Emulator-backed two-device scenarios exist for selected flows, including profile exchange and Ruqyah V2 concurrent offline counter convergence.
- Exact tested commits passed their documented Quality Gates.

### What it does not prove

- That the current source HEAD passed a fresh complete Quality Gate in this audit.
- That current production rules match the checked-in rules.
- That current main is deployed to Production.
- That production sync flags are enabled.
- That a real authenticated user can sign in on two physical devices and complete A → B → A synchronization.
- That all collections support every conflict class or deletion semantics.

## 10. Vercel environment and deployment findings

### Environment names

The inspected environment inventory listed the Firebase config keys for Production and Preview, and several unrelated API keys. Secret values were not decrypted.

The two sync gates were not present in the returned inventory:
- `VITE_WIRD_REVISIONED_SYNC_ENABLED`
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED`

This is the clearest current blocker. A build-time Vite variable must exist in the environment used to build the deployment; setting it in a different environment after build does not retroactively change the deployed bundle.

### Deployment

The latest Production deployment returned by the Vercel project inventory was Ready on SHA `a5b88a4...`. The currently inspected main SHA was `b79a945...`. The combined status on the latter showed Vercel `build-rate-limit`.

Therefore:
- A Production deployment exists.
- The current inspected main is not proven deployed.
- The current Production bundle is not proven to include later source changes.
- No evidence proves the sync flags are enabled in Production.
- No live sync smoke was completed.

## 11. Findings by severity

| Severity | Finding | Consequence | Required action |
|---|---|---|---|
| Critical | Both sync feature flags absent from inspected Vercel inventory | Upload and remote projection resolve disabled by default | Verify intended values and deployment targets; enable only after release gates |
| Critical | Deployed production Firestore rules not verified | Client writes may be rejected or contract may differ | Verify exact deployed rules before activation |
| High | Latest Production SHA behind inspected main | Runtime differs from source under review | Deploy current main when Vercel permits; verify exact SHA |
| High | Tombstones are blocked in projection | Deletes cannot safely converge; stale data may persist | Implement collection-specific semantics and anti-resurrection tests |
| High | Grouped syncMeta conflict decisions unsupported | Atomic grouped updates can remain blocked | Design one atomic grouped resolution path |
| High | Real production two-device flow not verified | User's core cross-device requirement remains unproven | Authenticated device A/B/A smoke with non-destructive test data |
| High | Broad cross-tab/account lifecycle stress incomplete | Race conditions may remain under account changes or multiple tabs | Add browser-level lifecycle and race tests |
| Medium | Long-offline, queue saturation, quota and crash stress incomplete | Recovery at scale is not yet certified | Add bounded load/failure-injection matrix |
| Medium | Divergent Ruqyah V1 baselines remain blocked | Some legacy users may need guided recovery | Preserve data; design manual verified migration |
| Medium | Current main Vercel status is build-rate-limit | Deployment cannot currently be claimed | Respect provider quota; retry only when available |

## 12. Recommended release plan

### Phase A — Establish real production configuration
- Verify canonical Firebase web config without exposing secrets.
- Verify Vercel Production and Preview targets.
- Verify both feature-flag values and the exact commit used to build.
- Confirm Firestore rules deployment to `wird-quran-app/(default)`.
- Do not activate flags yet.

### Phase B — Close safety gaps
- Define tombstone semantics by collection.
- Implement safe anti-resurrection and recovery/retention.
- Implement atomic grouped syncMeta conflict resolution.
- Keep divergent Ruqyah V1 baselines blocked until a safe reconciliation tool exists.
- Complete account lifecycle, cross-tab, long-offline, out-of-order, and crash tests.

### Phase C — Browser/device validation
Use two clean browser profiles/devices and a dedicated test account:
1. Sign up or sign in and verify email.
2. Make one profile/settings change on device A.
3. Confirm it appears on device B.
4. Make a different change on B and confirm it returns to A.
5. Add a plan and a populated memorization portion on A; verify exact records on B.
6. Record an activity event/test result on B; verify on A.
7. Make offline changes on both devices to the same supported domain and verify conflict handling preserves both sides.
8. Test Ruqyah V2 concurrent increments and reset.
9. Test sign-out from A and sign-in as a different account; verify no prior account data is visible.
10. Verify pending counts, remote cursor, projection cursor, and final `synced` status.

Do not use real user data as test fixtures. Keep an export/backup before any migration or destructive test.

### Phase D — Controlled rollout
- Enable revisioned upload only after rules and mutation-path coverage are verified.
- Enable remote projection only after projection and conflict gates are verified.
- Start with a controlled test account/cohort if the architecture supports it.
- Monitor Outbox pending count, Inbox/projection cursor gap, conflicts, permission denials, retries, and failed transactions.
- Have a rollback plan that disables new remote writes without deleting local journal data.
- Verify the deployed SHA and repeat the two-device smoke after rollout.

## 13. Final verdict

**Do not announce WIRD cloud synchronization as production-ready yet.**

The repository has a serious and thoughtful foundation, including durable local journaling, idempotent revisioned writes, event ordering, conflict evidence, and selected multi-device merge behavior. The immediate blocker is operational: the inspected Vercel configuration does not show either required sync flag, and the latest Production deployment is behind the source HEAD. In addition, tombstone and grouped transaction conflict behavior remain intentionally incomplete, and production rules/device behavior have not been proven.

The safe next step is not to turn on the flags immediately. It is to close the release gaps, verify deployed rules and exact environment configuration, then run an authenticated two-device test with controlled data.

---

## Evidence links

- Repository: https://github.com/xm8eslam-stack/WIRD-APP
- Firestore rules: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/firestore.rules
- Firebase initialization: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/src/lib/firebase.ts
- Cloud coordinator: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/src/services/cloudSyncCoordinator.ts
- Revisioned remote writer: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/src/services/revisionedRemoteMutation.ts
- Remote projector: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/src/services/remoteInboxProjector.ts
- IndexedDB journal: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/src/services/indexedDbSyncJournal.ts
- Sync architecture: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/docs/sync/ARCHITECTURE.md
- Sync state machine: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/docs/sync/STATE-MACHINE.md
- Sync test matrix: https://github.com/xm8eslam-stack/WIRD-APP/blob/main/docs/sync/TEST-MATRIX.md
- Persistent worklog: [CLOUD_SYNC_WORKLOG.md](./CLOUD_SYNC_WORKLOG.md)


## Follow-up verification — 2026-11-09 (latest main checkpoint)

This addendum supersedes only the time-sensitive source/deployment observations above; the architectural risks and historical test limitations remain applicable.

- Current `main` HEAD re-verified from the branch endpoint: `b240f4018e0b77d5487bd58ffd0a9f8c75592e69` (documentation checkpoint).
- GitHub Quality Gate run `42668329017` on this exact SHA completed with conclusion `success`. The job's listed steps all completed successfully: automated tests, native API import smoke, approved Quran audio CDN checks, Firestore Rules Emulator, TypeScript, production build, server startup smoke, and desktop/mobile browser smoke. This is CI/emulator evidence, not production Firestore rule deployment or two-real-device evidence.
- Latest Vercel Production deployment: `dpl_37KEV3k9vHmpcw3JgX8EhE91uvE4`, state `READY`, built from the same `b240f401...` SHA. This resolves the previously recorded deployment-lag observation for this checkpoint.
- Latest inspected Vercel project environment inventory (names/targets only; `decrypt=false`) still does not include `VITE_WIRD_REVISIONED_SYNC_ENABLED` or `VITE_WIRD_REMOTE_PROJECTION_ENABLED`. Firebase web config keys are present for Production and Preview; values were not read. Therefore the production sync gates remain off by default.
- The Vercel deployment is current, but neither feature gate is enabled and no production sync transaction has been proven. Do not infer cloud sync availability from deployment READY.
- No Firebase/Firestore administration connector was available in the connected tools, and the attempted isolated Vercel sandbox provisioning was rejected by the API. The local execution container could not resolve GitHub for a checkout. Consequently, this session did not modify runtime code or independently rerun tests; it relied on the exact-SHA GitHub Quality Gate evidence above.
- Production Firestore Rules deployment status remains unverified. Do not deploy rules or enable either gate until exact rules parity and safe data migration/conflict behavior are proven.
- Open release blockers remain: tombstone semantics/resurrection prevention; atomic grouped `syncMeta` conflict decisions; divergent Ruqyah V1 preservation/reconciliation; broader cross-tab/account lifecycle/offline/crash/IndexedDB quota stress; and authenticated production A↔B verification.


## 2026-11-09 — Post-approval independent verification addendum

The audit's source-level conclusions were rechecked in a fresh Vercel Sandbox cloned from branch `fix/cloud-sync-production-readiness`, starting at exact SHA `4479dea4a177073e43c334dea5a34aa21251b23a`.

Fresh results on that exact checkout:
- Automated application suite: **601 passed, 0 failed**.
- Firestore Rules Emulator: **31 passed, 0 failed** against the checked-in rules and demo project only.
- TypeScript: passed.
- Production build: passed (existing non-fatal large-chunk warning).
- Native API import smoke: passed.
- Production and development server smoke: passed.

This raises confidence in the checked-in code and rules contract, but does not establish that the canonical Firebase project's deployed rules equal the checked-in file. No Firebase production read/write or rules deployment was performed because Firebase administrative actions were not exposed in the connected tool session. Vercel Production is Ready on the same SHA, but the two build-time sync flags remain absent; no upload/projection activation or physical-device round trip is claimed.

The tombstone and grouped `syncMeta` limitations are intentional fail-closed behavior, not defects to bypass: tombstone enqueue is rejected locally and remote tombstone projection is blocked without cursor movement; grouped transaction application has local snapshot/rollback safeguards, while grouped conflict resolution is still unsupported. Divergent legacy Ruqyah V1 baselines remain preserved and blocked. These require explicit data-contract and recovery design plus targeted tests before activation.

No runtime code, production rules, production flags, secrets, or user data were modified during this verification. See the worklog for the exact test commands and remaining release gates.


## 2026-11-09 — npm/CI command parity addendum

A second independent verification pass executed the workflow's npm commands on the same runtime source SHA `4479dea4a177073e43c334dea5a34aa21251b23a`:

- `npm test`: 601 passed, 0 failed.
- `npm audit --audit-level=high`: zero vulnerabilities in the npm-resolved dependency tree for this check.
- `npm run smoke:api-imports`: passed.
- Approved Quran audio CDN check: 8/8 byte-range samples passed (HTTP 206, audio/mpeg).
- `npm run test:firestore-rules`: 31 passed, 0 failed in the demo Firestore emulator.
- `npm run lint`: passed.
- `npm run build`: passed, with the known non-fatal large-chunk warning.
- `npm run smoke:server`: production and development server smoke passed.

PR #181's Actions run `42671987530` ended in failure while the GitHub API returned zero jobs and zero check runs, so no failing workflow step was available to diagnose. The same CI commands were independently run in the sandbox. Playwright desktop/mobile browser smoke remains unverified in this pass because the sandbox session expired before browser installation and replacement sandbox provisioning was rejected. These results are not evidence of Firebase production rules parity or a live authenticated two-device sync test.


## 2026-11-09 — Final GitHub Actions Quality Gate evidence

GitHub Actions run **42675737240** (WIRD Quality Gate, run 3274) completed with **success** on PR #181 head SHA `0e4352e450a1492c7af0d4817e291744ba8e3ae8`. Every step passed, including npm dependency audit, all 601 automated assertions, native API import smoke, 8/8 Quran audio CDN byte-range samples, 31 Firestore Rules Emulator tests, TypeScript, production build, production/development server smoke, Chromium installation, and desktop/mobile Playwright browser smoke tests. This supersedes the earlier failed zero-job Actions attempt and the interim note that Playwright remained unverified.

The PR remains documentation-only; the runtime code tested by the earlier independent sandbox pass is unchanged at base SHA `4479dea4a177073e43c334dea5a34aa21251b23a`. Vercel preview is READY and its status is success. This CI result does not prove deployed Firebase rules parity, production sync activation, or an authenticated physical two-device round trip. No production rules, flags, secrets, or user data were changed. Remaining blockers are collection-safe tombstone/anti-resurrection behavior, grouped `syncMeta` keep-local conflict handling, divergent legacy Ruqyah V1 recovery, and the manual Firebase release gate followed by a real-device A↔B test.


## 2026-11-09 — Tombstone hardening and grouped conflict-path clarification

A narrow fail-closed mitigation was added to the PR branch: Firestore Rules now accept only revisioned `upsert` events and state envelopes without `deletedAt`; physical deletes remain denied. This closes the remote write path for tombstones until collection-specific local projection and anti-resurrection semantics exist. The Rules Emulator test now asserts both tombstone transactions and physical deletes are denied. Local journal enqueue already rejects tombstones, while the projector remains fail-closed for any pre-existing or externally-created tombstone without moving its cursor. Production rules parity and absence of pre-existing tombstone events must still be manually verified before activation.

The grouped `syncMeta` paths were also distinguished precisely: the use-remote conflict decision is implemented and covered by a journal test that atomically applies all child projections and handles affected pending mutations; the keep-local grouped conflict decision remains unsupported and must not be simulated by splitting the group. The engine-plan delete test exercises an atomic full-snapshot upsert, not generic tombstone semantics.

Fresh local verification after the Rules patch: 31 Firestore Rules Emulator tests passed; 601 application assertions passed; TypeScript, production build, API import smoke, and production/development server smoke passed. This does not prove deployed production rules parity or a real authenticated two-device round trip. No production rules, flags, secrets, or user data were changed.


## 2026-11-09 — Legacy tombstone migration safety addendum

The previous Rules hardening exposed a local compatibility path: `importLegacyState` still accepted tombstone entries from the v1 localStorage outbox and could import them into IndexedDB, where the new upsert-only Firestore Rules would reject their uploads indefinitely. The importer now rejects legacy tombstones before opening the IndexedDB write transaction. The calling migration wrapper retains the exact original localStorage bytes on rejection, preventing partial migration or data loss. A new integration test verifies the source remains unchanged and no partial IndexedDB event/outbox entries are committed.

Fresh sandbox verification from main SHA `1d97b918c4c1b0564ceb52405ab3e47abb528f80` plus this patch: **602 application assertions passed, 0 failed**, TypeScript passed, and production build passed. Firestore Rules Emulator remains **31 passed, 0 failed**. This is a fail-closed recovery boundary: an account with a legacy tombstone will need manual, collection-specific recovery before cloud sync can proceed; do not rewrite or discard the preserved source. No production configuration or user data was changed.


## 2026-11-10 — Engineering follow-up: deployed Rules, conflict guards, and current release state

This addendum supersedes earlier statements in this audit that production Rules had not been deployed, that the sync gates were absent, or that grouped keep-local conflict resolution was entirely unsupported.

### Verified production Rules deployment

- Manual GitHub Actions workflow [42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063) completed successfully at 2026-11-09 20:31 UTC on main SHA `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`.
- The workflow required the exact canonical project `wird-quran-app`, explicit `DEPLOY_FIRESTORE_RULES` confirmation, service-account authentication, generated Quran data, and 31 passing Firestore Rules Emulator tests.
- Its preflight queried the active `cloud.firestore` default-database release/ruleset and recognized the exact deny-all bootstrap policy (SHA-256 `ecf30f940747dcc3c5ba4993093e9a11ac9fc5df7e14b2a1512d2446923d84eb`). It then deployed only `firestore.rules`; logs show the rules compiled, were released to `cloud.firestore`, and the deployment completed.
- Current main `firestore.rules` blob SHA `6c9cbf1e7a1ebe4325240d751d40aec9efabc760` matches the file at the deployment commit exactly. No later Rules-file modification was found. This establishes deployed-source parity from the successful workflow evidence; no new Firebase production call or deployment was made in this review.

### Code and conflict-path changes since the PR #207 checkpoint

- PR #208 merged documentation continuity at `c05476bc7e20f7f2f89881d93a6a0e49ff394beb`.
- PR #209 merged at `f6fc58f017034f2c92e2a89067065fcb4dc29d8`; exact PR head `25371892e045a201e2ffc61edf5c94a3ad3d2d04` passed Quality Gate run `42788810615`. Its Vercel PR check was rate-limited, but Production SHA `f287670a28c8ed96b734044f96b3e3a4036c7f09` is a descendant and includes this fix.
- New `src/services/syncConflictSafety.ts` and tests prevent both use-remote and keep-local from choosing a whole snapshot for `weakVerses` or `activityEvents`; the same guard rejects grouped `syncMeta` conflict decisions when any child operation contains either unsafe collection. This prevents an operator choice from silently discarding independent device changes.
- Weak-verse coordinate IDs `weak-{surah}-{ayah}` remain useful identity stabilization, not a merge algorithm. The collection still uses a full snapshot and has no safe concurrent union or resolution anti-resurrection behavior.
- `activityEvents` remains a full daily aggregate snapshot. The `session.completed` domain event is not yet the authoritative immutable ledger from which daily aggregates can be deterministically rebuilt.
- Grouped `syncMeta` use-remote is atomic; keep-local is implemented for supported bounded upsert-only grouped transactions. It must remain blocked for weak-verse/activity snapshots and unsupported operations. Tombstones and Ruqyah additive counters are not generic grouped keep-local operations.
- `indexedDbSyncJournal.ts` now uses a 450 KB cap for `enginePlans` and grouped `syncMeta` transactions containing an engine-plan child; ordinary mutations retain the 128 KB cap. Current CI covers the bounded larger-payload case.

### Current main, CI, Production, and environment inventory

- Reviewed application-code main SHA: `2405067b60969ef431e3e9473ca446f9bd225a37`.
- Exact-main Quality Gate [42865304625](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42865304625) succeeded: 662 automated assertions, 31 Rules Emulator tests, 8/8 approved Quran audio probes, 140 Playwright smoke passes with 2 skipped, plus successful TypeScript, dependency-audit step, production build, and server smoke.
- Latest Vercel Production deployment [`dpl_54yw4eh25j8fWqNU5iXeLqtq2VSR`](https://vercel.com/xm8eslam-9174s-projects/wird-app/54yw4eh25j8fWqNU5iXeLqtq2VSR) is READY on SHA `f287670a28c8ed96b734044f96b3e3a4036c7f09`. Main is 13 commits ahead. GitHub's current-main Vercel status reports `build-rate-limit` (“Deployment rate limited — retry in 24 hours”). The 13 later commits changed 51 paths but no sync/Firebase/Rules/auth/journal/outbox/writer/projector paths; sync-source parity with the deployed build is therefore preserved, while app-wide main remains undeployed.
- Vercel Production environment inventory contains `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED`; the previous checkpoint recorded both as enabled. Firebase web configuration keys present include `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`. The manual Rules workflow uses GitHub variable `FIREBASE_PROJECT_ID` and secret `FIREBASE_SERVICE_ACCOUNT_JSON`. No secret values were decrypted or included.
- The earlier owner-reported authenticated two-device success remains useful bounded evidence. No fresh A↔B physical-device test was run after the latest sync changes in this review.

### PR status and remaining risks

- PR #203 remains open, with its branch 29 commits ahead and 35 behind current main and GitHub reporting `mergeable=false`. Its exact-head Quality Gate passed, but it is stale/diverged and must not be merged without rebase and fresh review.
- Tombstones remain unsupported: local enqueue/import reject them, Rules accept upserts only and deny physical deletes, and the remote projector blocks any existing tombstone without advancing its cursor. The writer still has a tombstone-shaped branch; it is not a supported deletion contract.
- Divergent legacy Ruqyah V1 baselines remain blocked; compatible V2 per-device counters have a dedicated merge/reset-watermark path.
- Cross-tab/account lifecycle, logout/reinstall isolation, long-offline replay, crash recovery, queue stress, and IndexedDB quota/failure injection need broader targeted coverage.
- Next action: obtain a fresh authenticated two-device round trip after the latest deployed sync code, continue collection-specific weak-verse/activity/tombstone design, and verify a new app-wide Production deployment after the Vercel rate-limit window. Do not toggle existing feature gates or change production settings as part of this audit.

## 2026-11-10 — Post-review Production deployment status

- Vercel automatically deployed the documentation checkpoint SHA `9a508d05a3f44f2f24ab4f85d38f329ad7b57a31` to Production as `dpl_HHoXRwWTftWHeBXbST3bq9qVMvuS`; state `READY`, created 2026-11-10 18:27:24 UTC. The GitHub Vercel status for this SHA is success.
- This supersedes the preceding note that the latest Production deployment was 13 commits behind main. The intervening 13 commits did not change any sync/Firebase/Rules/auth/journal/Outbox/writer/projector path; current Production now matches the reviewed main checkpoint.
- Exact-main Quality Gate run `42875369360` for `9a508d05...` was still running at the last poll, with all completed steps successful and desktop/mobile browser smoke in progress. The unchanged application-code SHA `2405067...` has completed Quality Gate run `42865304625` with success.
- No runtime code, Rules, environment variables, secrets, or user data changed during this follow-up.

## 2026-11-10 — Final deployment and CI reconciliation

- Latest Vercel Production deployment is `dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5`, READY on SHA `dac125dd8770cc4881e2c6cea6fe94623ad52144`.
- Current main before this documentation refresh was `588ae4e94355e302e52941bf2b57d71ec69bb9b0`; it is one commit ahead of Production and the only differing path is this audit Markdown file. Sync/application source is identical.
- Current-main Vercel status is rate-limited; the existing READY Production deployment remains valid. The application-code Quality Gate on `2405067...` passed run `42865304625`; docs-only run `42876158628` was still in progress at last poll with no failed steps.
- This supersedes the interim `9a508d...` Production checkpoint above. No runtime code or production settings were changed.