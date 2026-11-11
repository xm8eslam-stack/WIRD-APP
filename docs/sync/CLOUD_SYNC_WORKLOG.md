## 2026-11-12 — Live main / Production sync guard review

- Current main SHA: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Vercel Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY on the same SHA; no live A↔B sync smoke was performed.
- Read-only Vercel inventory confirms `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` for Production. No settings or values were changed; owner decision is required before any toggle.
- Main Quality Gate run `43079260528` failed before steps/logs were recorded (`BlobNotFound`); this is not a diagnosed test failure.
- PR #363 was reconciled with current main in merge commit `bd383b2733af8dd95ce519d8867a256ef1cf8628`; GitHub reports mergeable=true. Last checked head `d79805b44b26f4ea73e77ffac21503255983b9c1` run `43117295374` failed before steps/logs (`BlobNotFound`); two relative links were fixed and the follow-up scan found zero broken links. The next docs checkpoint changes the head, so re-fetch the final exact-head gate. No PR merge or sync cutover was performed.
- PR #364 adds only Advisor request/history validation and prompt boundaries; no sync code or configuration changed.
- Existing safe boundary remains: local-first behavior, fail-closed conflict handling, no activation of new remote projection behavior without complete evidence and owner approval.

---
## Daily engineering review — 2026-11-11 (current main / Production)

This entry supersedes earlier operational statements in this worklog where they conflict. Review was performed against GitHub main and the Vercel Production deployment. No application code, Firestore Rules, production data, environment variables, secrets, or Vercel settings were changed by this review.

### Repository and deployment state

- Exact current `main` SHA: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe` ([commit](https://github.com/xm8eslam-stack/WIRD-APP/commit/2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe)). GitHub compare `main...2c9aa972` returned `identical`, confirming the branch pointer.
- The previous worklog checkpoint named `50bb25eeba2f1ed4ceae228b347c67b40f60c697`; current main is 14 commits ahead of that checkpoint.
- Latest Production deployment: [`dpl_GoKscgfr9hVhkjAc96QtmoBFqUmg`](https://vercel.com/xm8eslam-9174s-projects/wird-app/GoKscgfr9hVhkjAc96QtmoBFqUmg), state `READY`, target `production`, created 2026-11-11 14:26:00 UTC and ready 14:26:15 UTC. Its Git source is branch `main`, exact SHA `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`; the production alias is `wird-app.vercel.app`.
- Therefore current main and latest READY Production are on the same exact SHA. The combined GitHub status for this SHA reports Vercel `success`.
- The project metadata's `latestDeployment` pointed to a non-Production preview; the deployment above was selected from the explicit `target=production` deployment list and independently fetched by deployment ID.

### Changes since the previous worklog checkpoint

- PR [#330](https://github.com/xm8eslam-stack/WIRD-APP/pull/330) merged as `4669db79b535b13acc4b683d7052e7df5d4c9eca`. It adds a pure, deterministic session-activity reducer and 12 focused tests. Exact-head Quality Gate [run 42926607299](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42926607299) completed successfully.
- PR [#351](https://github.com/xm8eslam-stack/WIRD-APP/pull/351) merged as `5c1ecbaa77bc5a3aa13aba35a45b4ee63d366129`. It adds an IndexedDB open-boundary `QuotaExceededError` regression test and verifies that legacy localStorage Outbox recovery bytes remain unchanged after the failure. Exact-head Quality Gate [run 43024968443](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/43024968443) completed successfully. This is not a browser-level full-storage quota exhaustion test.
- PR [#361](https://github.com/xm8eslam-stack/WIRD-APP/pull/361) merged as current main/Production SHA `2c9aa972...`. It keeps EveryAyah audio stream-only until offline-storage rights are documented; this is an offline-audio policy change, not a cloud-sync change. Exact-head Quality Gate [run 43030824673](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/43030824673) completed successfully.
- PR [#325](https://github.com/xm8eslam-stack/WIRD-APP/pull/325) remains merged (merge SHA `9669d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6`; exact-head Quality Gate [run 42917981860](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42917981860) succeeded). Its compare-and-set snapshot guard is now part of main.
- PR [#203](https://github.com/xm8eslam-stack/WIRD-APP/pull/203) is **closed without merge**, superseded by #325; it is no longer an open merge candidate.
- PR [#363](https://github.com/xm8eslam-stack/WIRD-APP/pull/363) is an open Draft documentation-consolidation PR. It touches this audit and the activity-event design document, but is not merged and its documentation must be reconciled against this current review before any later merge. Open Draft PRs #358 and #359 concern overlapping device-local offline-audio manifests, not cloud sync.

### Current source review

The canonical Firebase project remains `wird-quran-app` and database `(default)` (`src/lib/firebase.ts` blob `f9a41ebe1c949030f3f6438a3dd142e830788e1a`). Auth/coordinator checks still require a current user, verified email, and exact `user:<uid>` storage scope; the two sync gates are evaluated as exact build-time `import.meta.env...` values.

Current reviewed source blob SHAs:
- `firestore.rules`: `6c9cbf1e7a1ebe4325240d751d40aec9efabc760`
- `src/services/cloudSyncCoordinator.ts`: `6452db6e80f154c79e555db295b0898a95b99992`
- `src/services/indexedDbSyncJournal.ts`: `e7a2108a89cb91032ed0257198ccf5e96af0b61e`
- `src/services/localSyncOutbox.ts`: `500135c9029eb9e25fb39ea8deddcc37831366d3`
- `src/services/revisionedRemoteMutation.ts`: `98f82e7e3f705f8e8d4caafae9154187ca5eaf86`
- `src/services/remoteInboxProjector.ts`: `532a9a86a059d2c196f687e2f0d9b6829a5f08eb`
- `src/services/syncConflictResolutionService.ts`: `79754df18f292f99c0e554d53f31a983750c10f9`
- `src/services/syncConflictSafety.ts`: `09245a613c35cad063e6d6da01c7117e7a33a122`
- `src/services/activityEventProjection.ts`: `93f05a83bbf08538bb3bafad7ce4489c5de31ead`
- `src/services/activityEventProjection.test.ts`: `a21edd93da621e02f1deede4af13d795ff1e42ae`
- `src/services/storageService.ts`: `6db81d223871a1f15cf75a88cff665cdccce5a22`
- `src/services/sessionPersistence.ts`: `893953d3062051a750dc18b9c7ae43da46cdfd1a`
- `src/services/weakVerseRecording.ts`: `22d5ae234b8411967d5b18b06dc0f49cfd96083a`

Findings:
- **Auth / coordinator:** canonical project pinning, verified-email requirement, UID-scope assertion, bounded Outbox drain, durable Inbox, and separate remote/projection cursors remain in place.
- **Firestore Rules:** current Rules blob `6c9cbf...` is byte-identical to the Rules blob fetched at the successful deployment commit `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`. Manual Rules deployment [run 42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063) completed successfully. Rules enforce verified UID ownership, collection allowlisting, revision envelopes, matching event/state/server-sequence writes, immutable event documents, and default-deny unknown paths. Physical deletes remain denied. No Rules deployment was performed in this review.
- **IndexedDB journal / Outbox / Inbox:** journal schema remains v9. The durable journal retains append-only events, Outbox, acknowledgements, remote Inbox, projection conflicts, resolution intents, and cursor metadata. Event plus Outbox enqueue remains atomic; legacy Outbox bytes are preserved during migration/recovery. Current Outbox and Inbox/projector paths remain unchanged from the previously reviewed implementations.
- **Revisioned writer / remote projector:** the writer still transactionally writes the state envelope, immutable event, and per-user server sequence with base-revision checks. The projector imports ordered events through durable Inbox and advances the projection cursor only after safe application/finalization. Pending local mutations, revision mismatch, tombstones, and failed projection remain fail-closed.
- **Snapshot conflict protection:** PR #325 adds a deterministic base-snapshot fingerprint compare-and-set precondition for `weakVerses` and `activityEvents`. It prevents a stale divergent full snapshot from replacing current local data, but it is not a multi-device merge. Whole-snapshot `keep-local` / `use-remote` choices remain blocked for these collections by `syncConflictSafety`.
- **Activity reducer:** PR #330 adds `projectDailyActivityFromEvents`, a pure helper that preserves a legacy baseline, groups unique events by captured local date, deduplicates identical event IDs, rejects ID collisions and baseline mismatches, validates timezone offsets/Quran coordinates, and fails without partial output on aggregate overflow. Its 12 tests cover duplicate replay, collisions, old-baseline conflicts, order independence, local-date/DST/travel cases, and baseline preservation.
- **Important integration boundary:** the reducer is **not wired** into session completion, IndexedDB, Outbox/Inbox, the remote projector, or Firestore. `sessionPersistence.ts` still writes a full `activityEvents/snapshot` daily aggregate with the PR #325 fingerprint; `session.completed` still records UTC `occurredAt` without the reducer's captured `localDate` and timezone offset. The current activity sync therefore remains snapshot/CAS-based, not an immutable cross-device session ledger.
- **Deletion:** `revisionedRemoteMutation.ts` still contains a tombstone-shaped writer branch, but Firestore Rules deny deletes and `remoteInboxProjector.ts` blocks tombstones. Delete propagation, retention, restore, and anti-resurrection are not supported.

### Vercel environment inventory — names and non-secret gate status only

Relevant Vercel Production keys observed:
- `VITE_WIRD_REVISIONED_SYNC_ENABLED`
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Critical finding:** the two sync-gate entries are already configured as `true` for Production in Vercel. Their configuration was last updated 2026-11-09 20:57:24 UTC; the latest Production deployment was created later, on 2026-11-11 14:26:00 UTC. Since the coordinator reads these as build-time environment values, treat both gates as enabled in the current Production build unless a separate build-artifact check proves otherwise. This review did not enable them and did not change either setting. No secret values were decrypted or included.

### CI, deployment, and evidence boundaries

- Exact-head Quality Gate runs succeeded for PR #325 (`42917981860`), PR #330 (`42926607299`), PR #351 (`43024968443`), and PR #361 (`43030824673`). Their test, Emulator, TypeScript, build, server-smoke, and desktop/mobile browser steps completed successfully; PR #325's optional 604-map check was skipped by its workflow condition.
- Current main's combined status reports Vercel `success`; the connector's commit-workflow-runs endpoint returned no main-triggered run because that endpoint only exposes PR-triggered runs. Do not infer that a separate post-merge main Quality Gate was independently observed from this result.
- The successful Rules deployment run is separate from application CI and proves Rules deployment/source parity, not real-device behavior.

### Proven vs. not proven

**Proven:** current main pointer and latest Production SHA match; latest Production is READY; relevant exact-head PR Quality Gates passed; current Rules source matches the Rules blob at the successful deployment commit; source-level Auth/journal/Outbox/Inbox/writer/projector/conflict guards are present; the pure activity reducer and its 12 tests are merged.

**Not proven:** a fresh authenticated production A↔B round trip after these changes; simultaneous independent session aggregation; server-visible per-device legacy cutover acknowledgement; long-offline replay; cross-tab/account-switch/logout/reinstall stress; full browser quota exhaustion; tombstone deletion/restore/anti-resurrection; live Production sync telemetry or a real authenticated write/read. CI and Emulator results are not substitutes for two physical devices.

### Open risks and next safe action

1. Production sync gates are configured `true` despite the outstanding real-device and cutover evidence. This is the highest-priority operational risk. Do not silently change Production settings in this review; obtain an explicit owner decision on whether to authorize disabling them.
2. Review the server-visible per-device cutover protocol proposed in Draft PR #363. Local device IDs/outbox watermarks alone do not prove all offline legacy devices drained their mutations. Do not wire the reducer into cloud sync until a server-validated UID/device/baseline acknowledgement and old-client schema gate are designed and Emulator-tested.
3. Keep `weakVerses` and `activityEvents` whole-snapshot conflict choices blocked until a true deterministic merge/ledger exists.
4. Keep tombstones blocked until collection-specific delete, restore, retention, stale-update, and anti-resurrection semantics are tested.
5. After the above gates are resolved, perform a documented authenticated real-device A→B→A round trip and record exact records/operations. Do not label Emulator/CI as device evidence.

No application code, production environment setting, secret, Firestore Rules, or user data was changed in this review.

## Current follow-up — 2026-11-11 after PR #328

- Current `main`: `50bb25eeba2f1ed4ceae228b347c67b40f60c697`; PR #328 merged successfully with direct ayah selection in the sticky memorization/revision navigation.
- Exact PR Quality Gate run `42921569974` passed: 152 Playwright checks passed, 2 skipped; dependency audit 0 vulnerabilities; Firestore Rules Emulator, TypeScript, production build, and server smoke succeeded.
- Source review: `DailyLog` remains a date-keyed aggregate (ayah count, reviewed pages, minutes, completed task labels). `StorageService.buildSessionCompletionSnapshot` updates that aggregate and returns a base snapshot fingerprint; the `activityEvents` projector still expects a complete `records` array. Existing `session.completed` domain events carry metrics and UTC `occurredAt`, but no explicit local activity date/time-zone offset.
- PR #325's compare-and-set guard prevents stale full-snapshot overwrites; it does not provide a merge for independent devices. Keep whole-snapshot keep-local/use-remote blocked for `weakVerses` and `activityEvents`.
- A staged, non-destructive ledger design is in `docs/sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. It preserves the legacy DailyLog baseline, deduplicates immutable per-session events by stable identity, captures the local activity date, and blocks unresolved legacy/offline-device conflicts rather than silently merging or discarding them.
- No sync runtime code, Firestore Rules/schema, production data, secrets, environment variables, or remote-sync flags changed.
- Last documented READY Production remains `dac125dd8770cc4881e2c6cea6fe94623ad52144`; the post-merge GitHub Vercel status for `50bb25e` now reports `success`, but the Vercel deployment detail endpoint returned team-scope 403. Exact Production SHA/state and live smoke remain unverified.
- Real-device A↔B round trip, long-offline replay, cross-tab/account lifecycle stress, tombstone/delete semantics, and activity-event migration remain unverified. Production sync release remains HOLD.

Next safe sync step: implement a pure event reducer with deterministic local-date aggregation and idempotent deduplication, then test baseline preservation, out-of-order delivery, duplicate replay, collision rejection, timezone/DST boundaries, and crash recovery before wiring it into IndexedDB or Firestore.

---

## Current operational checkpoint — 2026-11-10 (scheduled engineering review)

This checkpoint supersedes earlier operational status statements where they conflict with the evidence below. Review performed against the live `main` branch and current GitHub/Vercel metadata. No application code, Firestore Rules, production data, secrets, Vercel settings, feature-flag values, or Firebase configuration were changed. Only this worklog is being updated.

### Repository, source delta, CI, and Production

- Current `main` SHA: `1e1d62502ee291e1993b24b93b13bcdec0972e76` ([commit](https://github.com/xm8eslam-stack/WIRD-APP/commit/1e1d62502ee291e1993b24b93b13bcdec0972e76)).
- Reviewed application-code baseline remains `2405067b60969ef431e3e9473ca446f9bd225a37`. GitHub compare from that code baseline to current main reports 5 commits but only two changed files: `docs/sync/CLOUD_SYNC_AUDIT_2026-11-09.md` and `docs/sync/CLOUD_SYNC_WORKLOG.md`. No runtime sync source or Rules file changed after the reviewed application-code baseline.
- Latest current-main Quality Gate [run 42876570523](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42876570523) completed **success** on exact SHA `1e1d625...`. Its job passed: **662 automated assertions, 0 failures; 31 Firestore Rules Emulator tests; 8/8 approved Quran audio probes; 140 Playwright desktop/mobile smoke tests passed with 2 skipped; dependency audit, TypeScript validation, production build, and production/development server smoke passed**. Playwright diagnostics upload reported that `test-results/playwright` was absent, so no diagnostics artifact was uploaded; the Playwright run itself passed.
- Latest Vercel Production deployment remains [`dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5`](https://vercel.com/xm8eslam-9174s-projects/wird-app/DGbABxoSjMdnDgZn5UwxZvj7AcX5), state `READY`, created 2026-11-10 18:32:01 UTC, built from SHA `dac125dd8770cc4881e2c6cea6fe94623ad52144`.
- Current main is **two documentation-only commits ahead** of that Production SHA: `588ae4e...` and `1e1d625...`. GitHub compare confirms only the two sync Markdown documents changed. The current main combined status is still Vercel failure `build-rate-limit` (“Deployment rate limited — retry in 24 hours”). Therefore Production is behind current main documentation, but the reviewed application-code source is unchanged. Do not describe the current main documentation commit as deployed.
- The previous in-progress main run `42876158628` was superseded/cancelled; it is not the final result. Use the successful exact-current-main run `42876570523` above.

### Firebase Auth and Firestore Rules

- Current source pins Firebase project `wird-quran-app` and Firestore database `(default)`; Firebase initialization rejects a non-canonical project. Coordinator and Auth tests enforce current-user presence, verified email, and exact `user:<uid>` local-storage scope.
- Production Firestore Rules deployment is verified by manual workflow [run 42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063), completed successfully on 2026-11-09 from main SHA `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`. The workflow passed 31 Emulator tests, validated the exact project/confirmation and credentials, recognized the exact deny-all bootstrap baseline, and successfully deployed **Firestore Rules only**.
- Current main `firestore.rules` blob SHA `6c9cbf1e7a1ebe4325240d751d40aec9efabc760` is byte-identical to the Rules blob at the successful deployment commit. No later Rules source change was found. No Firebase production call or Rules deployment was made in this review.
- Rules enforce verified-email UID ownership, collection allowlisting, revision envelopes, matching state/event/server-sequence writes, immutable events, upsert-only routed mutations, denied physical deletes, and default-deny unknown paths.

### Environment inventory — names only

The Vercel `wird-app` inventory contains these relevant Production keys:
- `VITE_WIRD_REVISIONED_SYNC_ENABLED`
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The six Firebase configuration keys are listed for Production and Preview. This review intentionally did not inspect or reproduce any values. Both sync-gate names are present in the Production inventory; their values were not re-read in this run and no flag was changed. No GitHub secret or Vercel secret was decrypted.

### Sync architecture re-check on current main

Reviewed current source and test files (blob SHAs):
- `src/lib/firebase.ts` — `f9a41ebe1c949030f3f6438a3dd142e830788e1a`
- `firestore.rules` — `6c9cbf1e7a1ebe4325240d751d40aec9efabc760`
- `src/services/cloudSyncCoordinator.ts` — `6452db6e80f154c79e555db295b0898a95b99992`
- `src/services/indexedDbSyncJournal.ts` — `59bb542226717f32fac5eb559636611cb384dd9e`
- `src/services/localSyncOutbox.ts` — `500135c9029eb9e25fb39ea8deddcc37831366d3`
- `src/services/revisionedRemoteMutation.ts` — `98f82e7e3f705f8e8d4caafae9154187ca5eaf86`
- `src/services/remoteInboxProjector.ts` — `532a9a86a059d2c196f687e2f0d9b6829a5f08eb`
- `src/services/syncConflictResolutionService.ts` — `79754df18f292f99c0e554d53f31a983750c10f9`
- `src/services/syncConflictSafety.ts` — `09245a613c35cad063e6d6da01c7117e7a33a122`
- Related tests: `cloudSyncCoordinator.test.ts`, `indexedDbSyncJournal.test.ts`, `localSyncOutbox.test.ts`, `syncConflictSafety.test.ts`, and `firebaseAuth.test.ts`.

Findings:
- **Coordinator/Auth:** cloud upload and remote projection remain independent build-time gates. The coordinator checks current authenticated UID, verified email, and matching local storage scope; account-scope changes fail closed. It drains bounded Outbox batches and exposes pending counts, remote Inbox counts, and separate remote/projection cursors.
- **IndexedDB journal:** database `wird-sync-journal`, schema v9, with append-only events, Outbox, acknowledgements, metadata, remote Inbox, projection-conflict archive, and conflict-resolution intents. Event plus Outbox enqueue is atomic. Bounds include 1,000 pending mutations, 1,000 Inbox events, 100 projection conflicts, 500 conflict intents, a 128 KB ordinary payload limit, and a dedicated 450 KB engine-plan allowance. Retry backoff is capped at one hour.
- **Outbox/migration:** UID-scoped operations are backed by IndexedDB; duplicate enqueue is idempotent and acknowledgement preserves append-only event history. Legacy localStorage Outbox migration preserves its source as a recovery copy. New local tombstones and unsupported legacy tombstones are rejected before an unreplayable event is created.
- **Revisioned writer:** Firestore transaction writes state, immutable event, and per-user sequence together; it checks base revision and retries only the bounded server-sequence contention case. A tombstone-shaped writer branch remains in source, but Rules accept only upserts, so this is not an enabled/supported delete path.
- **Remote projector:** server-ordered events enter durable Inbox; projection cursor advances only after safe local application/finalization. Pending local writes, base-revision mismatches, tombstones, and failed projection remain blocked. Compatible Ruqyah V2 snapshots use a dedicated additive merge/reset-watermark path; divergent V1 baselines remain blocked.
- **Conflict handling:** supported single-document upsert and grouped `syncMeta` decisions retain transaction boundaries. Safety checks block destructive whole-snapshot choices for `weakVerses` and `activityEvents`, including grouped `syncMeta` operations containing either collection. `weakVerses` coordinate IDs do not solve concurrent full-snapshot merge or anti-resurrection. `activityEvents` remains a daily aggregate snapshot rather than an immutable session ledger.

### PR status and changes since the previous checkpoint

- PR [#208](https://github.com/xm8eslam-stack/WIRD-APP/pull/208) merged; commit `c05476bc7e20f7f2f89881d93a6a0e49ff394beb`.
- PR [#209](https://github.com/xm8eslam-stack/WIRD-APP/pull/209) merged; commit `f6fc58f017034f2c92e2a89067065fcb4dc29d8`. Its exact-head Quality Gate [run 42788810615](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42788810615) succeeded (633 assertions, 31 Rules Emulator tests, 8/8 audio probes, build and browser smoke).
- PR [#203](https://github.com/xm8eslam-stack/WIRD-APP/pull/203) remains open and is now **29 commits ahead / 40 behind** current main; GitHub compare reports `diverged`, and GitHub reports `mergeable=false`. Its head is `89f5fb9075b99730db7e3be8375b5203de77228e`. It must not be merged as-is; rebase/supersede it from current main and rerun the exact-head Quality Gate before any future merge decision.
- Other open work such as offline asset caching and continuous audio is not a cloud-sync PR. No new sync PR was created in this review.

### What is proven vs. not proven

**Proven from current evidence**
- Current main exact-SHA CI is green with the counts above.
- Firestore Rules Emulator tests pass.
- Production Rules workflow succeeded, and the current Rules source blob matches the source deployed by that workflow.
- Latest Vercel Production deployment is Ready on `dac125dd...`; current main's difference from it is documentation-only.
- Source-level Auth, journal, Outbox, revisioned writer, projector, and fail-closed conflict protections are present and covered by automated tests.

**Not proven in this run**
- No authenticated production read/write or real-device sync was attempted.
- CI and Emulator do not substitute for an authenticated two-device round trip. The earlier owner-reported success is historical evidence only; a fresh A→B→A test after the reviewed sync changes is still required.
- No fresh production sign-up/email-verification journey, account-switch stress, cross-tab race, long-offline replay, crash recovery, queue saturation, or IndexedDB quota/failure-injection campaign was run outside the automated coverage.
- The values of the two Vercel sync gates and all secrets were intentionally not inspected in this run.

### Open risks and next exact action

1. Keep tombstones and physical deletes blocked until collection-specific deletion semantics, stale-update rejection, offline replay, recovery, retention, and anti-resurrection are designed and tested.
2. Design per-record weak-verse concurrency/merge and deterministic activity session events; keep destructive conflict choices blocked meanwhile.
3. Preserve and block divergent Ruqyah V1 baselines; never infer a merge. Continue using only the tested compatible V2 merge path.
4. Expand cross-tab, account-switch/logout/reinstall, crash, long-offline replay, queue-stress, and IndexedDB quota/failure-injection coverage.
5. Perform a fresh authenticated production A→B→A round trip on two real devices and record exact operations/results; do not use CI or Emulator as a substitute.
6. Rebase or supersede stale PR #203 from current main and rerun all exact-head gates before considering its changes.
7. Recheck Vercel after the current `build-rate-limit` retry window; no app-source deployment is needed solely for the two documentation-only commits.

No audit-report refresh was necessary: the source compare found no material runtime or Rules change since the prior code audit. This worklog entry records the changed operational evidence and supersedes the earlier in-progress CI/deployment checkpoint.

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

# WIRD Cloud Sync — Persistent Engineering Worklog

> **Purpose:** This is the durable continuation record for all cloud-sync investigations, decisions, bugs, tests, and release work. Update this file whenever a sync task is started, completed, blocked, or its evidence changes.
> **Repository:** `xm8eslam-stack/WIRD-APP` · **Source branch:** `main`
> **Last reviewed:** 2026-11-10
> **Current audit report:** [CLOUD_SYNC_AUDIT_2026-11-09.md](./CLOUD_SYNC_AUDIT_2026-11-09.md)

## 1. Current checkpoint

- Latest application-code main SHA inspected during audit: `b79a9451f81fc72792d9417bef9f19ea44e83841`.
- Audit report and persistent worklog were committed to `main` after the source review. These commits are documentation-only and do not change runtime code; inspect the current `main` ref for its latest documentation checkpoint.
- Latest verified Production deployment observed: `dpl_Di9gFtjLFgWVDHxgk4qFh2mfbVFn`, Ready, alias `https://wird-app.vercel.app`, deployed from main SHA `a5b88a4c01d3c15cbf6fa2085e17cae01c8d897d`.
- Production is behind the currently observed main SHA. The combined status on current main reports Vercel failure with `build-rate-limit`; do not claim the latest main is deployed.
- Canonical Firebase project in code: `wird-quran-app`; Firestore database: `(default)`. The code explicitly rejects the legacy project `elliptical-rampart-bxq1s`.
- Vercel project: `wird-app`, Hobby plan.
- Vercel environment inventory contains the six `VITE_FIREBASE_*` config keys for Production and Preview. Values were not decrypted or inspected.
- **Neither** `VITE_WIRD_REVISIONED_SYNC_ENABLED` nor `VITE_WIRD_REMOTE_PROJECTION_ENABLED` appeared in the inspected Vercel environment inventory. Both code gates therefore resolve false unless supplied through another deployment configuration not visible in this inventory. Treat production cloud upload and remote projection as **not activated / not proven**.
- Firestore Rules source exists at `firestore.rules`; actual deployment of those rules to the canonical production Firebase project has not been verified.
- No production secrets, environment values, Firebase rules, feature flags, or project settings were changed during this audit.

## 2. Architecture confirmed in source

- UID-scoped IndexedDB journal: `wird-sync-journal`, schema version 9.
- Durable stores include local events, Outbox, acknowledgements, metadata, remote Inbox, projection conflicts, and conflict-resolution intents.
- Local mutations are journaled before local projection; event and Outbox writes are atomic. The app is local-first.
- Cloud upload and remote projection are separate gates.
- Upload uses `writeRevisionedRemoteMutation`: one Firestore transaction writes the state document, immutable event, and per-user server sequence.
- Remote projection imports server-ordered events into a durable Inbox and advances the projection cursor only after safe local application/finalization.
- Authenticated cloud sync requires a current Firebase user, verified email, and exact match between auth UID and local storage scope.
- The coordinator re-checks account scope around asynchronous operations to stop work after account changes.
- A network-online event triggers sync; visible tabs run periodic sync (default 60 seconds); newly journaled mutations trigger sync.
- Firebase web persistence is not used as the source of offline durability; WIRD's own UID-scoped IndexedDB journal is the controlled offline queue.

## 3. Data collections and known semantics

Allowlist in the coordinator, journal, and rules:
`profile`, `plans`, `enginePlans`, `portions`, `weakVerses`, `tests`, `activityEvents`, `ruqyahProgress`, `syncMeta`.

- State documents use schema/revision envelopes with `mutationId`, `deviceId`, `baseRevision`, and `revision`.
- Immutable remote events use unique mutation/event IDs and server sequence numbers.
- Per-document revision checks prevent stale writes from silently replacing newer remote state.
- Client timestamps are descriptive metadata, not the authoritative cross-device order.
- Ruqyah progress has a V2 per-device PN-counter model with reset watermarks. Compatible V2 snapshots merge additively and idempotently; divergent migrated V1 baselines remain blocked and preserved.
- `syncMeta` represents grouped transactions and must remain atomic across participating collections.

## 4. Verified strengths

- Firestore rules require verified auth, UID ownership, strict collection allowlist, valid revision envelope, matching event/state/sequence writes, immutable events, and default-deny unknown paths.
- Physical Firestore deletes are denied; tombstones are used as the intended deletion representation.
- Local journal has bounded queues, payload limits, retry/backoff metadata, durable conflict evidence, and crash-recovery intents.
- Conflict handling includes confirmed use-remote for supported upsert conflicts and confirmed keep-local re-publication for supported single-collection upsert conflicts.
- Account scope is checked before and after network/storage awaits in the coordinator.
- Historical exact-head Quality Gates documented for PRs #149, #155, #157, and #158 passed. The Nov 9 handoff records 596 automated assertions, 31 Firestore Rules tests, 50 desktop/mobile Playwright tests, 8/8 audio CDN probes, dependency audit, TypeScript, production build, and smoke checks for the then-tested PR #176 head. These are CI/emulator results, not proof of production sync.

## 5. Open blockers — do not mark sync production-ready

1. **Production feature flags:** not present in the inspected Vercel variable inventory. Keep both gates off until every release gate is met.
2. **Production rules:** source is reviewed, but deployed rules matching this exact transaction contract are not verified.
3. **Tombstones:** remote writer/rules can represent tombstones, but the local projector intentionally returns `blocked_tombstone`. Delete propagation, resurrection prevention, collection-specific semantics, recovery, and retention are not complete.
4. **Grouped syncMeta conflicts:** grouped transaction evidence is archived, but safe keep-local/merge resolution is not implemented. Never split the grouped operation into partial writes.
5. **Legacy Ruqyah V1:** divergent legacy baselines are intentionally blocked; preserve evidence and require a safe reconciliation plan.
6. **Cross-tab/account lifecycle:** broad stress for simultaneous tabs, reload/sign-out/account switch while writes are pending, and auth lifecycle races is incomplete.
7. **Offline/crash/load:** long-offline replay, out-of-order events, large queues, IndexedDB quota failures, and broad failure injection need more coverage.
8. **Real production devices:** no authenticated real-device A↔B production test has been completed/recorded.
9. **Deployment lag:** current main SHA differs from the latest observed Production deployment SHA; current-main Vercel status reports a build-rate-limit failure.
10. **User-visible status:** verify the UI never presents upload acknowledgement alone as fully synced; `synced` must require zero pending writes and fully reconciled remote cursor.

## 6. Required next work (priority order)

- [ ] Confirm the exact current main SHA and current Vercel Production SHA before every release-related change.
- [ ] Build a safe release checklist for deploying the reviewed Firestore Rules to `wird-quran-app` (default database), with explicit approval and emulator evidence.
- [ ] Design collection-specific tombstone behavior and resurrection prevention; retain fail-closed behavior until tests pass.
- [ ] Design atomic grouped `syncMeta` conflict handling (or explicit safe user-facing alternative).
- [ ] Expand cross-tab, account-switch, reload, sign-out, offline replay, out-of-order delivery, crash-recovery, and queue-capacity tests.
- [ ] Add full populated record and multi-collection conflict coverage, preserving atomic transaction boundaries.
- [ ] Add complete authenticated browser/device flows for signup, email verification, first sync, second device, offline edits, reconnect, conflict, sign-out, and account switching.
- [ ] Verify Vercel Production environment flags and exact deployed SHA after deployment is possible. Do not read or print secret values.
- [ ] Only after all above: enable revisioned upload and remote projection under a staged rollout, then perform real two-device smoke and rollback rehearsal.

## 7. Update protocol for future sessions

Every continuation must:
1. Read this file and the current audit report first.
2. Fetch current `main`, current PRs, and latest Production deployment; never rely on an old SHA.
3. Record exact file paths, commit/PR SHAs, test command/results, rules deployment status, Vercel deployment status, and real-device evidence.
4. Separate **implemented**, **CI-tested**, **emulator-tested**, **deployed**, and **real-device-verified** claims.
5. Never turn on production sync flags, deploy rules, change secrets, or change production settings without explicit user approval.
6. Update this worklog after each meaningful milestone, including blockers and the next exact action.

## 8. Change log

### 2026-11-09 — Initial comprehensive audit checkpoint
- Inspected repository metadata, latest commit history, sync coordinator, revisioned writer, remote projector, IndexedDB journal, local outbox, Firestore rules, Firebase initialization, sync design/state-machine/test-matrix docs, Vercel project, environment-variable inventory (names/targets only), and recent deployment history.
- Found both production sync flags absent from the inspected Vercel inventory.
- Found latest Production deployment on SHA `a5b88a4...`, behind observed main `b79a945...`; current main combined status reports Vercel `build-rate-limit`.
- Confirmed unresolved tombstone and grouped syncMeta conflict boundaries; no production activation performed.
- Detailed findings: [CLOUD_SYNC_AUDIT_2026-11-09.md](./CLOUD_SYNC_AUDIT_2026-11-09.md).
- Worklog creation commit: `693252f74918c5767caa8d51ef696281890ad32b`.
- Audit report commit: `bb3db8ec9c8ad3aa7bfece828b1afb9b2331c4a9`.
- The current version of this file is the latest continuation checkpoint on `main`.


## 2026-11-09 — Same-day activation readiness follow-up

- Re-read the audit and worklog, then re-verified latest main: `b240f4018e0b77d5487bd58ffd0a9f8c75592e69`.
- Exact-SHA Quality Gate run `42668329017` succeeded. Its steps include automated tests, Firestore Rules Emulator, TypeScript, production build, server smoke, and desktop/mobile browser smoke.
- Latest Vercel Production deployment `dpl_37KEV3k9vHmpcw3JgX8EhE91uvE4` is `READY` on the same SHA. Deployment lag is no longer the immediate blocker.
- Re-inspected Vercel environment variable inventory without decrypting values. The two sync gates remain absent: `VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`. Do not add/enable them yet.
- No Firebase admin connector was available; sandbox provisioning was rejected; local container could not clone GitHub. No runtime code, secrets, production flags, rules, or data were changed in this session.
- Current blocker ordering: (1) prove production rules parity; (2) close/contain tombstone behavior and resurrection; (3) design atomic grouped `syncMeta` conflict handling; (4) preserve and safely handle divergent Ruqyah V1; (5) expand lifecycle/offline/crash tests; (6) complete authenticated production two-device verification.
- Next session must begin by checking this exact checkpoint and continue with a test-capable checkout. No claims of sync activation until a real two-device round trip is observed.
- Audit addendum commit: `4243dc7be4ec8b578d9854874249501d5f804144`.


## 2026-11-09 — Independent sandbox verification after approval

- User approved the bounded work scope: isolated GitHub branch, code/rules/tests review, Firebase production verification when administrative access is available, Vercel flag configuration only after release gates, and no destructive production data operations.
- Created branch `fix/cloud-sync-production-readiness` from main SHA `4479dea4a177073e43c334dea5a34aa21251b23a`.
- Created a Vercel Sandbox, cloned the branch, and confirmed the checkout HEAD exactly matched `4479dea4a177073e43c334dea5a34aa21251b23a`.
- Fresh local verification on that exact checkout: **601 automated assertions passed, 0 failed** (`bun run test`). The sync-specific suite included 40 passing assertions, including blocked tombstones, durable conflict archives, grouped transaction initialization, and Ruqyah V2 merge/recovery cases.
- Fresh Firestore Rules Emulator verification: **31 passed, 0 failed** (`bun run test:firestore-rules`). This ran against the checked-in `firestore.rules` only, using demo project `demo-wird`; it is not production rules deployment evidence.
- Fresh TypeScript check passed (`bun run lint`). Fresh Vite production build passed (`bun run build`); the existing large-chunk warning remains non-fatal.
- API import smoke passed (`bun run smoke:api-imports`). Production and development server smoke both passed (`bun run smoke:server`).
- Dependency setup note: `bun install --frozen-lockfile` correctly refused because the existing `bun.lock` does not reflect the current `package.json` overrides. A non-frozen install resolved the manifest; the lockfile was restored afterward. No dependency or generated Quran data changes are intended for this branch.
- Confirmed source-level safety behavior: local journal enqueue rejects tombstones before creating an event; projector blocks remote tombstones without advancing the cursor; grouped `syncMeta` projection uses one logical local transaction with snapshot/rollback verification, but grouped conflict decision executors remain unsupported. Divergent legacy Ruqyah V1 baselines remain blocked.
- Vercel project inventory rechecked without decrypting values: both `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` remain absent. Latest Production deployment is `READY` on `4479dea4a177073e43c334dea5a34aa21251b23a`; this is deploy evidence only, not sync activation evidence.
- GitHub combined status for the same SHA reports Vercel success. The connector's commit-workflow-runs helper returned no PR-triggered runs for this main commit; the fresh sandbox commands above are the direct test evidence for this checkpoint.
- No runtime code, Firestore production rules, Vercel environment variables, secrets, or production data were changed. The branch is intentionally left as a verified checkpoint pending the remaining production gates below.
- Remaining hard gates: obtain Firebase administrative project access to verify deployed rules parity; design/test safe collection-specific tombstones and anti-resurrection; implement atomic grouped `syncMeta` conflict decisions (never split into child writes); preserve/resolve divergent Ruqyah V1 only with evidence; then perform authenticated production A↔B real-device verification. Do not activate either production flag before these gates.


## 2026-11-09 — Exact CI command parity follow-up

On the same runtime source checkout SHA `4479dea4a177073e43c334dea5a34aa21251b23a`, repeated the repository's GitHub Actions commands using npm (not only Bun):
- `npm test`: **601 passed, 0 failed**.
- `npm audit --audit-level=high`: **0 vulnerabilities** in the npm-resolved dependency tree used for this check.
- `npm run smoke:api-imports`: passed.
- `node scripts/check-ruqyah-audio-source.mjs`: **8/8** approved CDN samples returned HTTP 206 audio/mpeg with byte-range support.
- `npm run test:firestore-rules`: **31 passed, 0 failed** in demo project `demo-wird` emulator.
- `npm run lint`: passed.
- `npm run build`: passed; existing non-fatal large-chunk warning remains.
- `npm run smoke:server`: production and development server smoke passed.

The GitHub Actions run `42671987530` for PR #181 completed with failure but exposed zero jobs and zero check runs via the public GitHub Actions API, so it provides no actionable failing step/log. The exact CI commands above were run independently in the sandbox instead. The browser smoke suite (`npx playwright test`) remains unverified in this follow-up because the sandbox stopped after the command window and a replacement sandbox could not be provisioned. No code, lockfile, production settings, or user data changes were pushed as part of these command checks.


## 2026-11-09 — GitHub Actions full Quality Gate completed

- GitHub Actions run **42675737240** (WIRD Quality Gate, run 3274) completed with conclusion **success** on PR #181 head SHA `0e4352e450a1492c7af0d4817e291744ba8e3ae8`.
- All job steps completed successfully: dependency install, Playwright runner install, npm audit, automated suite, native API imports, approved Quran audio CDN byte-range checks, Firestore Rules Emulator, TypeScript, production build, server startup smoke, Chromium install, desktop/mobile Playwright smoke tests, diagnostics upload, and job cleanup.
- The Playwright desktop/mobile browser suite is now CI-verified; this supersedes the earlier note that it had not yet been run in the independent sandbox pass.
- PR #181 remains documentation-only (2 files). Runtime source baseline is still `4479dea4a177073e43c334dea5a34aa21251b23a`; no runtime code, production Firebase rules, Vercel sync flags, secrets, or user data were changed.
- Vercel preview deployment for the latest PR head is `READY`; Vercel status check is success.
- Release blockers remain unchanged: manually prove deployed Firebase rules parity; finish and test collection-safe tombstones/anti-resurrection, grouped `syncMeta` keep-local conflict semantics, and divergent Ruqyah V1 recovery; then complete a real authenticated production A↔B device test. Do not enable sync flags before those gates.


## 2026-11-09 — Tombstone write-path containment and conflict-path clarification

- Hardened checked-in Firestore Rules: revisioned state documents no longer accept a `deletedAt` field, and routed revisioned events now accept `operation == 'upsert'` only. Physical Firestore deletes remain denied. This prevents new unsupported tombstone events from being committed by a compliant client.
- Updated the Rules Emulator test: a revisioned tombstone write and a physical delete are both expected to fail. Fresh local emulator result on the code branch plus this patch: **31 passed, 0 failed**. The same checkout also passed **601 application assertions**, TypeScript, production build, API import smoke, and server smoke.
- Existing client protections remain: local journal enqueue rejects tombstones; remote inbox projector still blocks any already-existing/externally-created tombstone without advancing the cursor. The manual Firebase step must still verify deployed-rule parity and that no pre-existing tombstone event is pending before activation.
- Clarified grouped `syncMeta` conflict semantics after inspecting implementation/tests: the **use-remote** decision path already applies the grouped transaction through one local journal transaction and archives/supersedes pending mutations for every affected collection; a targeted journal test covers it. The **keep-local** decision path remains deliberately blocked for grouped `syncMeta` and Ruqyah V2 until an atomic grouped rebase/queue implementation is designed and tested.
- The tested engine-plan deletion path is an atomic full-snapshot upsert, not a per-document Firestore tombstone. Do not generalize this to all collections without reviewing their domain delete semantics.
- No Firebase production rules were deployed and no Vercel flags or user data were changed. The Firestore rules patch is only in the PR branch pending CI and the later manual production deployment workflow.


## 2026-11-09 — Legacy tombstone outbox migration containment

- Found an additional compatibility edge: legacy localStorage outbox validation still accepted `operation: 'tombstone'`, and the importer would migrate it into IndexedDB even though current Firestore Rules now reject tombstone writes. That could leave an old account's upload queue permanently retrying a denied operation.
- Updated `IndexedDbSyncJournal.importLegacyState` to reject any legacy tombstone before opening/committing the IndexedDB migration transaction. The error is explicit and the wrapper does not remove or rewrite the original localStorage source, so the full legacy outbox remains available for recovery; no partial upsert migration is committed.
- Added an integration regression test through `LocalSyncOutbox.migrateLegacyToIndexedDb`: it verifies rejection, exact original localStorage bytes preserved, and zero new IndexedDB pending entries/events.
- Fresh sandbox verification on branch `fix/sync-legacy-tombstone-migration` from main SHA `1d97b918c4c1b0564ceb52405ab3e47abb528f80`: **602 application assertions passed, 0 failed**; TypeScript passed; production build passed (existing non-fatal large-chunk warning). Firestore Rules Emulator separately remains **31 passed, 0 failed** on the same main rules.
- This intentionally fails closed for an account whose legacy outbox contains a tombstone: its local source is preserved and cloud migration pauses until a collection-specific recovery is performed. Do not delete that source or manually change its operation to upsert.
- No production data, Firebase rules, Vercel flags, or secrets were changed by this patch. It is pending PR review/CI.


## 2026-11-09 — Post-merge deployment and Firestore deployment preflight

- PR #182 merged to `main` as commit `34aef1f06b8d476815d0823b752ea14347b826b1`. Its exact PR-head Quality Gate completed successfully: 602 application assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, server smoke, and desktop/mobile browser smoke.
- Vercel Production deployment `dpl_HR7FyyiH3TRV7RVtpa7DiynExKQG` is `READY` on the exact merge commit `34aef1f06b8d476815d0823b752ea14347b826b1`.
- Rechecked Vercel environment-variable names without decrypting values. Neither `VITE_WIRD_REVISIONED_SYNC_ENABLED` nor `VITE_WIRD_REMOTE_PROJECTION_ENABLED` is present. Cloud sync remains inactive; do not add or enable either flag yet.
- Found that the existing manual Firebase Rules workflow deployed the checked-in file without first reading the active production release. Firebase documents that CLI deployment replaces rules currently published in the Firebase Console. This could overwrite a console-only production change.
- Opened PR #183 (`safety/firestore-rules-deploy-preflight`) to authenticate with the Firebase Rules service account, read the active default-database release and ruleset through the Firebase Rules REST API, and compare the deployed `firestore.rules` byte-for-byte with the reviewed repository source before deployment. Missing release, missing file, inaccessible ruleset, or any mismatch fails closed and prints hashes only. The workflow remains manual and still requires exact project confirmation.
- PR #183 CI is pending at this checkpoint; do not merge until its exact-head Quality Gate succeeds.
- Attempted to provision a Vercel sandbox for a fresh post-merge checkout, but the Vercel Sandbox API returned 403 Forbidden. No CLI fallback is available in the current execution environment. No sandbox was created and no production state was changed.
- Firebase production rules have still not been inspected or deployed. The manual setup of `FIREBASE_PROJECT_ID=wird-quran-app` and `FIREBASE_SERVICE_ACCOUNT_JSON` remains deferred until the workflow preflight is merged and reviewed.



## 2026-11-10 — Latest sync continuity and grouped projection follow-up

- PR #197 merged: grouped `syncMeta` keep-local is atomic; unsupported tombstones/operations fail closed.
- PR #198 merged and deployed to Production. Tested head `0709b25663b0b52d151bff8de7508823dad89eee`; merge commit `c6befabbacbb5f7ad6351e9dca6c604408713285`; Vercel deployment `dpl_DcQBhZU4QVrtZm1qoV8CwUryez9J` is `READY` on `wird-app.vercel.app`.
- PR #198 test-result behavior: `tests/snapshot` remains authoritative; per-result documents merge by immutable result ID and fail closed on same-ID/different-content collisions. Exact-head Quality Gate passed.
- The user manually confirmed successful account sync across two devices. Record this as user-reported live verification; do not relabel it as an automated test.
- New code review found weak-verse first-failure IDs are `weak-{surah}-{ayah}-{mutationId}`; subsequent local failures update by coordinate and increment the counter. Resolution persists a replacement snapshot after filtering by ID. Cross-device first failures can create separate IDs for one coordinate, and stale snapshots can reintroduce a resolved verse. No safe generic merge exists while tombstones are unsupported.
- Activity events are currently daily `DailyLog` aggregates. Session completion emits a stable mutation ID and a typed `session.completed` event, but its local activity projection still replaces the aggregate array. Two distinct device sessions can compete as full snapshots; summing snapshots can double-count.
- The remote inbox projector blocks pending local mutations, base-revision conflicts, and tombstones without advancing past unresolved events. It has a dedicated constrained V2 Ruqyah counter merge, but no weak-verse/activity merge.
- PR #200 is open for a narrow bug fix: grouped transaction application was dropping each child's `documentId`, and grouped recovery matching also ignored it. The patch forwards the ID and makes `tests` recovery distinguish authoritative snapshot from per-result merge. Regression coverage is added; exact-head CI is pending.
- PR #199 is the documentation continuity checkpoint, including this worklog update and the collection-level findings.
- PR PR checks may show Vercel `build-rate-limit` due to the Free plan. This does not establish a code failure, but also does not count as a successful preview deployment. Keep CI, Vercel deployment, and live verification separate.
- No production Firestore rules/schema, secrets, environment settings, or sync flags were changed in this review.



## 2026-11-10 — PR #200 merged; canonical profile key mismatch found

- PR #200 merged as `5a866f22c254fd35b9c487f7d69546e6b691a9d3`; exact PR head `7ed3af44291cf439b89625e30722750a9366e3e8` passed the full Quality Gate.
- Grouped child `documentId` is now forwarded during local projection and grouped recovery. Test-result recovery uses authoritative replacement for `snapshot` and immutable-ID merge for per-result documents.
- Vercel Free-plan `build-rate-limit` prevented a preview deployment; no Vercel deployment record exists for the merge SHA. Production live verification of this patch is therefore not claimed.
- Found a second revisioned identity inconsistency: `RetentionService.buildRevisionPerformanceSnapshot` emits `profile/profile`, while session completion and profile snapshot writers use `profile/main`. This splits revision/conflict tracking for one logical profile. PR #201 changes the revision writer to the canonical `main` document and adds a regression assertion; CI pending.
- Weak-verse and daily-activity collection merge limitations remain unchanged and fail closed where conflicts are detected.



## 2026-11-10 — Canonical profile key fix merged and deployed

- PR #201 merged as `12468243db7707c19a1bf75823ca1dc6e09f9ad8`; exact-head Quality Gate run `42777475075` succeeded.
- Revision rating now targets the canonical `profile/main` document, aligned with session completion and profile snapshot persistence.
- Production deployment `dpl_d4u8eFLiZoxAwnd6UW5tQk8GPTKt` reached `READY` on `wird-app.vercel.app` and is built from exact SHA `12468243db7707c19a1bf75823ca1dc6e09f9ad8`. The deployed source includes PR #200's grouped document-ID fix and PR #201's profile-key fix.
- Previous Vercel PR check failures were caused by the build-rate limit; the later main deployment completed successfully. No Firebase rules/schema or production sync flags were changed.



## 2026-11-10 — PR #207: weak-verse coordinate identity

- Merged PR #207 at `d45e30e521c3f20c7c6e48aa81b7bc37798952b4`; exact head `fc1c5d58a59e806f75d14649d3610858663852d4` passed WIRD Quality Gate run `42786910676` (30 successful steps).
- Both journal-first and legacy weak-verse writers now assign new records the stable coordinate ID `weak-{surah}-{ayah}`. Action mutation IDs remain unique and continue to protect retry semantics.
- Historical IDs remain unchanged because `weak_verse.resolved` events reference them.
- Remaining risks are unchanged: concurrent writes still target a full `weakVerses/snapshot`; no safe cross-device union exists yet; mistake counters lack a deduplicated per-failure materialization; resolution has no tombstone/anti-resurrection projection. Keep these paths fail-closed.
- `activityEvents` is still a full `DailyLog[]` snapshot, not an immutable per-session ledger. The existing `session.completed` domain event and stable session mutation ID are useful building blocks, but a new ledger plus deterministic daily aggregation and legacy migration is required.


## 2026-11-10 — Scheduled engineering review at main SHA 2405067

- Re-read this worklog and `CLOUD_SYNC_AUDIT_2026-11-09.md`, then reviewed current main SHA `2405067b60969ef431e3e9473ca446f9bd225a37`, the sync source files, Firestore Rules, relevant PRs, Actions, and Vercel Production/environment inventory.
- **Production Rules deployment was found and verified:** manual workflow run [42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063) succeeded on main SHA `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`. Preflight verified the active default-database rules were the exact deny-all bootstrap policy, then deployed only `firestore.rules` to `wird-quran-app`. Current main Rules blob `6c9cbf1e7a1ebe4325240d751d40aec9efabc760` is identical to the deployed commit's Rules blob. This supersedes the earlier “production Rules unverified” entries.
- PR #208 merged as `c05476bc7e20f7f2f89881d93a6a0e49ff394beb`. PR #209 merged as `f6fc58f017034f2c92e2a89067065fcb4dc29d8`; its exact-head Quality Gate run `42788810615` passed. The new `syncConflictSafety` guard blocks use-remote and keep-local for full-snapshot `weakVerses` and `activityEvents`, including grouped `syncMeta` transactions containing either.
- The journal payload budget changed: ordinary mutations remain capped at 128 KB; `enginePlans` and grouped `syncMeta` operations containing engine plans use a bounded 450 KB cap.
- Current-main Quality Gate [42865304625](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42865304625) succeeded on exact SHA `2405067...`: 662 assertions, 31 Rules Emulator tests, 8/8 Quran audio probes, 140 Playwright smoke passes / 2 skips, TypeScript, audit step, build, and server smoke all passed.
- Latest Production deployment is `dpl_54yw4eh25j8fWqNU5iXeLqtq2VSR`, READY on SHA `f287670...`. Current main is 13 commits ahead; Vercel reports `build-rate-limit` (“retry in 24 hours”). Compare showed no sync/Firebase/Rules/auth/journal/outbox/writer/projector files changed in the 13 later commits, so the reviewed sync implementation remains source-identical to Production although the app-wide deployment is behind.
- Both sync feature-gate keys remain present in Production; prior checkpoint records them as enabled. No environment values or secrets were printed or changed.
- Owner-reported two-device success remains historical evidence; no new physical-device round trip was performed in this review.
- PR #203 remains open and stale/diverged (29 commits ahead, 35 behind main; `mergeable=false`) despite its exact-head Quality Gate success. Do not merge without rebase and a fresh review.
- Remaining gates: weak-verse merge/anti-resurrection, immutable activity ledger, tombstone lifecycle, divergent Ruqyah V1 recovery, lifecycle/offline/crash/quota stress, and fresh A↔B verification after the latest sync changes.
- Review was documentation-only. No application code, production Rules, Vercel configuration, secrets, or user data were changed.

## 2026-11-10 — Post-review Vercel deployment follow-up

- After the worklog and audit documentation commits, Vercel Production automatically deployed exact main checkpoint `9a508d05a3f44f2f24ab4f85d38f329ad7b57a31` as `dpl_HHoXRwWTftWHeBXbST3bq9qVMvuS`; state `READY`, created 2026-11-10 18:27:24 UTC. GitHub Vercel status for this SHA is success.
- This supersedes the earlier observation that Production was 13 commits behind. The intervening 13 commits from `f287670...` to application-code SHA `2405067...` did not modify any reviewed sync/Firebase/Rules/auth/journal/Outbox/writer/projector file.
- Exact-main Quality Gate run `42875369360` on `9a508d05...` was still in progress at the last poll; all completed steps were successful and desktop/mobile browser smoke was active. The unchanged application-code SHA `2405067...` has its own completed successful Quality Gate run `42865304625`.
- No runtime code or production configuration was changed by this follow-up; it records an automatic deployment resulting from documentation-only commits.

## 2026-11-10 — Final deployment and CI reconciliation

- Latest Production deployment is `dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5`, READY on SHA `dac125dd8770cc4881e2c6cea6fe94623ad52144`.
- Current main before this documentation refresh was `588ae4e94355e302e52941bf2b57d71ec69bb9b0`; compare confirms it is one commit ahead of Production and the only changed path is `docs/sync/CLOUD_SYNC_AUDIT_2026-11-09.md`. No runtime source or sync file differs.
- Current-main Vercel status is rate-limited. Do not confuse this with the READY Production deployment or a code failure.
- Exact application-code SHA `2405067...` has completed Quality Gate run `42865304625` successfully. Newer docs-only main run `42876158628` was still in progress at last poll; no failed step had appeared.
- This supersedes the prior interim note that Production was exactly on `9a508d...`; the latest READY deployment is now `dac125...`.

## 2026-11-11 — Post-merge checkpoint: PR #325 and PR #326

- Current main: `3667a8c003b79984546d48a9defc20c6f2bcd367`.
- PR #325 merged at `966d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6`. Its exact-head Quality Gate run `42917981860` passed 667 assertions, 31 Firestore Rules Emulator tests, 8/8 approved Quran audio probes, 140 Playwright tests, TypeScript, production build, and server smoke.
- PR #326 merged at `3667a8c003b79984546d48a9defc20c6f2bcd367`. Its exact-head Quality Gate run `42919276966` passed 674 assertions, 604 Mushaf coordinate-map checks, 31 Firestore Rules Emulator tests, 8/8 approved Quran audio probes, 150 Playwright tests, TypeScript, production build, and server smoke.
- PR #325 protects `weakVerses` and `activityEvents` full-snapshot writes with a deterministic non-cryptographic base fingerprint. New mutation builders carry the base identity; stale snapshots are rejected; grouped transactions roll back. Legacy events may bootstrap empty archives or replay identical data only. The fingerprint is a compare-and-set identity, not authentication.
- Existing higher-level `syncConflictSafety` still blocks whole-snapshot `keep-local/use-remote` decisions for `weakVerses` and `activityEvents`. No automatic counter summation, timestamp winner, array-union, tombstone, or delete semantics were introduced. PR #325 is a data-loss guard, not complete conflict resolution or proof of full bidirectional sync.
- PR #326 adds continuous ayah audio playback across a selected range and across Mushaf pages, pause/resume, speed/repeat controls, Mushaf text/spacing/width controls, and a 10-second timeout for opportunistic audio pre-cache. The current flexible text flow remains distinct from a verified printed-line facsimile.
- No Firestore Rules/schema, production data, secrets, environment variables, or remote-sync flags changed.
- Latest Production remains `dac125dd8770cc4881e2c6cea6fe94623ad52144` (`READY`), which predates PR #325/#326. Vercel status for current main is `build-rate-limit`; the new main SHA is not claimed as deployed and no live smoke test for it has been completed.
- Follow-up: when Vercel quota recovers, deploy through the normal GitHub→Vercel path, verify exact SHA `3667a8c`, and run live smoke. Then run a controlled two-device sync test and design tombstone/delete semantics separately before any broader conflict-resolution changes.


## 2026-11-11 — Follow-up verification after PR #325/#326

- Current main SHA is 3667a8c003b79984546d48a9defc20c6f2bcd367; main Quality Gate run [42920401307](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42920401307) completed successfully on the exact SHA.
- PR #325 merged as 966d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6; exact-head run 42917981860 passed 667 assertions, 31 Rules Emulator tests, 8/8 audio probes, 140 Playwright tests, TypeScript, production build, and server smoke. It adds base-snapshot compare-and-set protection for weakVerses and activityEvents, not conflict convergence.
- PR #326 merged as 3667a8c003b79984546d48a9defc20c6f2bcd367; exact-head run 42919276966 passed 674 assertions, 604 coordinate-map checks, 31 Rules Emulator tests, 8/8 audio probes, 150 Playwright tests, TypeScript, production build, and server smoke.
- Current safety policy remains: syncConflictSafety blocks whole-snapshot keep-local/use-remote for weakVerses and activityEvents; generic tombstones are rejected and the remote projection cursor must not pass a blocked tombstone. PR #325 does not change those constraints.
- Still unverified: post-PR #325 real-device A↔B round trip, account lifecycle/cross-tab stress, long-offline replay, crash/quota failure injection, collection-specific delete/anti-resurrection, and event-derived daily activity projection.
- Latest Production remains dpl_DGbABxoSjMdnDgZn5UwxZvj7AcX5 on dac125dd8770cc4881e2c6cea6fe94623ad52144 (READY). Current main is newer and Vercel reports build-rate-limit; no live production verification for 3667a8c is claimed.
- No Firestore Rules/schema, production data, secrets, environment values, or sync feature flags were changed.

Next safe sync work: design an immutable, idempotent session-activity event projection that preserves legacy DailyLog baselines, and separately specify collection-specific tombstone/replay/restore semantics. Do not wire a migration or unblock conflict choices until populated-record, replay, concurrency, crash, and rollback tests pass.
