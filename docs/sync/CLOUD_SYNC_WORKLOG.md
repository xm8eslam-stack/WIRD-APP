# WIRD Cloud Sync — Persistent Engineering Worklog

> **Purpose:** This is the durable continuation record for all cloud-sync investigations, decisions, bugs, tests, and release work. Update this file whenever a sync task is started, completed, blocked, or its evidence changes.
> **Repository:** `xm8eslam-stack/WIRD-APP` · **Source branch:** `main`
> **Last reviewed:** 2026-11-09
> **Current audit report:** [CLOUD_SYNC_AUDIT_2026-11-09.md](./CLOUD_SYNC_AUDIT_2026-11-09.md)

## 1. Current checkpoint

- Latest application-code main SHA inspected during audit: `b79a9451f81fc72792d9417bef9f19ea44e83841`.
- Latest main SHA after adding this audit documentation: `bb3db8ec9c8ad3aa7bfece828b1afb9b2331c4a9` (documentation-only commits; no runtime code changed).
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
- Final worklog refresh follows this checkpoint.
