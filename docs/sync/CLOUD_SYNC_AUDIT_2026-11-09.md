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
