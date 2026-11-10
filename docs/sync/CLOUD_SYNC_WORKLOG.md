## Current operational checkpoint — 2026-11-10 (engineering review)

This checkpoint supersedes earlier operational statements below where they conflict with the evidence in this review. The reviewed application-code baseline was `2405067b60969ef431e3e9473ca446f9bd225a37`; this review changes documentation only. No application code, Firestore rules, production data, secrets, Vercel settings, or environment variables were changed.

### Repository, CI, and Production

- Reviewed `main` at application-code SHA `2405067b60969ef431e3e9473ca446f9bd225a37`.
- Exact-main WIRD Quality Gate [run 42865304625](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42865304625) completed successfully on that SHA: **662 automated assertions passed, 0 failed; 31 Firestore Rules Emulator tests passed; 8/8 approved Quran audio CDN probes passed; 140 desktop/mobile Playwright smoke tests passed with 2 skipped; TypeScript, dependency-audit step, production build, and server smoke passed**.
- Latest Vercel Production deployment is [`dpl_54yw4eh25j8fWqNU5iXeLqtq2VSR`](https://vercel.com/xm8eslam-9174s-projects/wird-app/54yw4eh25j8fWqNU5iXeLqtq2VSR), state `READY`, created 2026-11-10 15:39:32 UTC from SHA `f287670a28c8ed96b734044f96b3e3a4036c7f09`.
- Production is **13 commits behind** current `main`. The current-main Vercel status is failure with `build-rate-limit` / “Deployment rate limited — retry in 24 hours.” A compare of Production SHA `f287670...` to reviewed `main` found 13 later commits and 51 changed paths, but **no sync, Firestore, Firebase, auth, journal, outbox, writer, or projector paths changed**. Thus the inspected sync implementation remains source-identical between Production and reviewed `main`; the whole application deployment is not current.
- Vercel Production contains both sync feature-gate keys, `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED`; the prior checkpoint records them as enabled. Their values are not reproduced here and were not changed.
- Owner-reported authenticated two-device success remains valid historical evidence from the earlier checkpoint. This review did not repeat a physical-device round trip after the later sync changes; do not label it a fresh test.

### Firebase Auth and Firestore Rules

- The client pins Firebase project `wird-quran-app` and the default Firestore database `(default)`; it rejects a non-canonical project. Authenticated sync requires a verified email and the local storage scope to match the active UID.
- Production Rules deployment **is verified** by manual workflow [run 42691610063](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42691610063), completed successfully on 2026-11-09 20:31 UTC from main SHA `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674`. The workflow validated project `wird-quran-app`, the explicit deployment confirmation, credentials, emulator tests, and the active default-database ruleset. It recognized the exact deny-all bootstrap policy (deployed SHA-256 `ecf30f940747dcc3c5ba4993093e9a11ac9fc5df7e14b2a1512d2446923d84eb`), then successfully ran the Firestore-Rules-only deployment and logged “Deploy complete!”.
- Current `main` `firestore.rules` blob SHA is `6c9cbf1e7a1ebe4325240d751d40aec9efabc760`, identical to the file at deployment SHA `5de1c2cd...`; no later Rules-file change was found. This provides deployment/source-parity evidence. This review did not make another Firebase production call or deploy.
- Rules enforce verified-email UID ownership, the explicit collection allowlist, revision envelopes, matching event/state/server-sequence writes, immutable event documents, upsert-only revisioned events, denied physical deletes, and default-deny unknown paths.

### Current sync assessment

**Operational baseline: PASS with bounded evidence.** Production feature gates are present, reviewed sync source is unchanged since the latest Production deployment, the reviewed Rules source was successfully deployed, current-main CI passed, and the owner previously reported a successful two-device test. A fresh device round trip after the latest changes is still outstanding.

- IndexedDB journal schema version 9 contains append-only events, Outbox, acknowledgements, metadata, remote Inbox, projection-conflict archives, and conflict-resolution intents. Event and Outbox enqueue are atomic. Bounds include 1,000 pending mutations, 1,000 Inbox events, 100 archived projection conflicts, and a one-hour capped retry backoff.
- Legacy outbox migration rejects tombstones before committing the IndexedDB migration and preserves the original localStorage source. New local tombstone enqueue is rejected.
- Revisioned writer transactionally updates the state document, immutable event, and per-user server sequence with revision checks and retry idempotency. The writer still models a tombstone branch, but current Rules permit only upserts; this is not a supported delete path.
- Remote projector consumes server-ordered events through a durable Inbox and advances its cursor only after safe local application/finalization. Pending local mutations, base-revision conflicts, tombstones, and projection failures remain fail-closed. Compatible Ruqyah V2 snapshots have a dedicated merge/reset-watermark path; divergent legacy V1 baselines remain blocked.
- Grouped `syncMeta` use-remote and supported keep-local upsert decisions use local journal transaction boundaries. PR #209 adds a guard that blocks both choices for `weakVerses` and `activityEvents`, including grouped transactions containing either collection.
- New weak-verse records use coordinate IDs `weak-{surah}-{ayah}`, but `weakVerses` is still a full snapshot without a safe cross-device merge or resolution anti-resurrection model. `activityEvents` remains a full daily aggregate snapshot, not an immutable session ledger.
- Engine-plan payloads now have a dedicated 450 KB cap (ordinary mutations remain 128 KB); grouped `syncMeta` receives the larger cap only when it contains an engine-plan operation.

### Pull requests and environment inventory

- PR #208 (documentation continuity) merged as `c05476bc7e20f7f2f89881d93a6a0e49ff394beb`.
- PR #209 (weak-verse/activity conflict safety) merged as `f6fc58f017034f2c92e2a89067065fcb4dc29d8b`; exact-head Quality Gate [run 42788810615](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42788810615) succeeded. Its PR Vercel status was rate-limited, but the later Production deployment SHA `f287670...` is a descendant and includes it.
- PR #203 remains open but is stale/diverged: its head is 29 commits ahead and 35 behind current `main`, and GitHub reports `mergeable=false`. Its exact-head Quality Gate passed, but do not merge it without a fresh rebase/review.
- Vercel names observed for sync/Firebase configuration: `VITE_WIRD_REVISIONED_SYNC_ENABLED`, `VITE_WIRD_REMOTE_PROJECTION_ENABLED`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`. The manual Rules workflow uses GitHub variable `FIREBASE_PROJECT_ID` and secret `FIREBASE_SERVICE_ACCOUNT_JSON`. Values were not decrypted or included.

### Remaining risks and next action

1. Keep tombstones blocked until collection-specific delete, offline replay, stale-update rejection, recovery, and anti-resurrection semantics are designed and tested.
2. Build a weak-verse model that handles concurrent same-coordinate failures and resolution without stale resurrection; replace daily activity snapshots with an idempotent immutable session ledger and deterministic aggregation.
3. Keep divergent Ruqyah V1 baselines preserved and blocked; do not infer a merge.
4. Expand cross-tab, account-switch/logout/reinstall, crash, long-offline replay, queue-stress, and IndexedDB-quota/failure-injection coverage.
5. Obtain a fresh authenticated production A↔B device round trip after the latest deployed sync code, recording the exact records and operations exercised.
6. Retry/verify the application Production deployment after the Vercel rate-limit window; the current 13-commit app-wide lag is unrelated to sync source files but remains a release-status discrepancy.

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