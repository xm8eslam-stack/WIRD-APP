## Current operational checkpoint — 2026-11-10 (verified follow-up)

This checkpoint supersedes any older statement below that contradicts the current Production inventory or the owner's direct device test. It is a documentation update only; no runtime code, Firebase rules, production secrets, Vercel settings, or user data were changed.

### Production and user-observed operation

- Current `main` source SHA: `c8f86a4a32e554cf2275dd070d5bf864896e251c`.
- Latest Vercel Production deployment: `dpl_5YVP1Z9rgsgBdzEJsLpxdb8dp52Y`, state `READY`, deployed from the same `main` SHA. This establishes deployment/source parity, not every live feature path.
- Vercel environment inventory was inspected by variable name/target only; secret values were not decrypted or displayed:
  - `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` for Production.
  - `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` for Production.
- Owner-confirmed manual real-device test: authenticated sync was enabled and tested on two devices; the owner reports it is working. Treat the tested two-device path as **owner-reported PASS**. Do not describe the two-device test as absent or unverified. The scope and exact records/operations exercised were not independently captured in an automated trace, so do not generalize this observation to every failure/recovery scenario.
- GitHub Quality Gate run `42762626953` completed with conclusion `success`. The run covered the repository CI suite, TypeScript, Firestore Emulator tests, production build, server smoke, and desktop/mobile browser smoke. CI success is distinct from live production verification.

### Current sync status classification

**Operational baseline: PASS (bounded evidence).** Production flags are on, the current deployment is Ready on current main, and the owner reports successful two-device use. Preserve this working configuration.

**Implemented protections (source-level):** UID-scoped state; durable local-first outbox/journal; revision-checked Firestore writes; ordered immutable remote events; separate inbox/projection processing; auth-scope checks; retry triggers on startup/activity/reconnect; and local transaction boundaries for grouped projection. These are implementation findings, not a claim that every edge case has passed live testing.

**Known limitations / follow-up gates (not evidence that ordinary sync is broken):**
1. Collection-specific tombstone/delete semantics remain deliberately blocked. Do not convert deletes into empty upserts or bypass the guard. Safe deletion requires per-collection semantics, offline replay, stale-update rejection/anti-resurrection, recovery, and retention/compaction.
2. Grouped `syncMeta` **use-remote** is supported through one local journal transaction; grouped `keep-local`/merge is not fully supported and must remain blocked until an atomic grouped rebase/queue path is implemented and tested.
3. Ruqyah V2 compatible snapshots have deterministic component-wise merge/reset-watermark behavior. Divergent legacy V1 baselines remain ambiguous and must be archived/blocked rather than guessed.
4. Cross-tab concurrency, account-switch/logout/reinstall isolation, crash/long-offline replay, queue stress, and complete authenticated production journeys need broader targeted coverage. Existing CI/Emulator tests are not substitutes for these scenarios.
5. Historical audit/worklog statements that both flags were absent, sync was inactive, or the user's two-device test had not occurred are superseded by this checkpoint.

### Safety and change boundary

- Keep both Production sync flags enabled; do not toggle them during documentation or follow-up work.
- Do not change Production secrets, Firebase rules/schema, Vercel protection/settings, or user data without explicit approval.
- Do not claim that CI, Emulator, or a Ready deployment alone proves all live sync behavior.
- Separate owner-reported real-device evidence, automated CI, Emulator coverage, deployment evidence, and untested edge cases in every future report.

---

# WIRD Cloud Sync — Persistent Engineering Worklog

> **Purpose:** This is the durable continuation record for all cloud-sync investigations, decisions, bugs, tests, and release work. Update this file whenever a sync task is started, completed, blocked, or its evidence changes.
> **Repository:** `xm8eslam-stack/WIRD-APP` · **Source branch:** `main`
> **Last reviewed:** 2026-11-09
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



## 2026-11-10 — Guard weak-verse and daily-activity snapshot overwrites

- Identified a real cross-device gap: grouped `syncMeta/{mutationId}` events have independent parent IDs, so two different grouped transactions can each carry a full `weakVerses/snapshot` or `activityEvents/snapshot` without contending on the same child Firestore revision.
- Added a compare-and-set precondition to new weak-verse failure/resolution and daily-activity session/revision snapshots. The payload records a deterministic fingerprint of the exact base snapshot; the projector refuses to replace the local archive if it has changed since the event was prepared.
- Legacy snapshots without the new field can still bootstrap an empty device or replay an identical state, but cannot overwrite a non-empty divergent local archive.
- Explicit `use-remote` conflict resolution retains its intended authoritative behavior and bypasses the compare-and-set only after the conflict-resolution intent and verified remote snapshot have been committed.
- Tests cover weak-verse concurrent counter edits, weak-verse resolution vs concurrent notes, daily activity vs another device's aggregate, legacy bootstrap, and explicit remote selection.
- No schema/rules changes, no blind summation/union, and no tombstones. PR #203 is awaiting exact-head CI.

- Extended the same base precondition to backup import, ordered reset, and demo-fixture transactions. These flows now capture the current local archive before preparing their replacement snapshots, preserving intentional local actions while rejecting races with later changes.
