# WIRD — Resume Here

**Authoritative checkpoint: 2026-11-06. Re-fetch GitHub before any new edit.**

## Canonical repository
- Repository: `xm8eslam-stack/WIRD-APP`
- Canonical branch: `main` (Google AI Studio source)
- Latest main SHA: `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`
- PRs #49–#57 are merged. PR #54 added typed domain-event envelopes; PR #55 journaled demo fixture writes; PR #57 removed read-side mutations and journaled legacy portion migration.
- PR #57 exact-head runs `42283803166` and `42283813448` passed; post-merge main run `42284039747` passed.
- Latest PR #55 main merge includes the preceding direct Quran Library tabs/Juz-index commit `033b8abda6bbf4f5c58d9b20d835f3268230abb6`.

## Completed reliability work
- Journal-first profile/plans/page progress/manual portions/test snapshots/weak-verse failure and resolution/revision ratings.
- Session completion groups memorization progress, activity, streak/profile, and matching smart-plan task into one recoverable event.
- Backup import/reset replay older pending events first and commit grouped snapshots through the journal.
- Domain-event envelopes for session completion, revision ratings, test completion, and weak-verse failure/resolution are validated and stored in append-only IndexedDB journal entries.
- Development demo data now uses one journaled transaction for authenticated users and one rollback-safe local transaction for guests; old direct demo writer methods are removed.
- Quota rollback and simulated IndexedDB restart/replay recovery tests are included.
- Quran reader has direct Surah-to-Mushaf navigation; Tafsir route is registered in Express.

## Current next task — PR #58 account-scope guard
- Branch: `fix/journal-scope-guard-20261106`; verify exact-head CI and merge after review.
- It aborts a legacy migration if the active account scope changes while the journal lock is pending.

## Remaining local mutation audit
1. Review legacy outbox migration/reset and IndexedDB-loss/blocked scenarios.
2. Review remaining multi-key mutation callers; device-local reader/Tafsir/audio preferences are intentionally local and catch storage exceptions.
3. Add any missing failure-injection coverage for quota/read/write/rollback behavior.
4. Keep the local-first experience intact; guests must not open a cloud outbox.

## Subsequent phases
- Derive daily aggregates and streaks deterministically from the typed domain-event ledger.
- Define record-level Firestore mapping and conflict semantics.
- Implement Firestore adapter/sync coordinator behind a disabled feature gate.
- Test offline replay, duplicate delivery, account isolation, tombstones, and two-device conflicts.
- Do not deploy production rules, activate cloud writes, or perform destructive migration without explicit approval.

## Deployment interpretation
- Owner says Vercel status is not a blocker for merging tested changes.
- Production deployment and live browser verification against the current main SHA remain unconfirmed.

## Working rules
- Work from freshly fetched `main` on a separate branch.
- Run exact-head GitHub Quality Gate, inspect every job, review the diff, merge, and verify main SHA.
- Vercel failure is not a merge blocker by owner's instruction; it remains an unverified deployment state.
- Do not merge stale/diverged PRs #2 or #8 wholesale; reapply only reviewed useful changes.


## New verified checkpoint — 2026-11-07
- PR #73 merged: `cc887a6bfa07aec880f495221e64dd36edb14ca8` (projection crash recovery).
- PR #77 merged: `716cf301bff9a8c7777ee3931dba6366a01afe3b` (profile round trip between two independent emulator devices; 26 rules tests).
- PR #78 merged: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9` (offline stale revision conflict preservation; 27 rules tests).
- Exact PR gates: 450 automated assertions, rules emulator, TypeScript, build, startup smoke, and dependency audit passed.
- Current main at checkpoint: `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`; post-merge main CI must be rechecked.
- Tombstones are still blocked; no collection-specific delete projection or tombstone GC. Conflict detection preserves pending local work but no conflict record/UI/rebase workflow exists.
- Runtime upload/projection are controlled by explicit Vite flags; production flag values have not been checked. Production Firebase rules and Vercel deploy remain unverified (`build-rate-limit`).
- Read `docs/engineering/PROGRESS.md` and `docs/sync/RELEASE-GATES.md` before continuing.


## Latest checkpoint — PR #81
- Main SHA: `059e902194811be71ab4dea9da8609a96967214e`.
- PR #81 merged: bounded UID-scoped durable conflict archive + Settings diagnostics.
- Exact PR gate: 459 assertions, 27/27 Firestore Rules, TypeScript, build, dependency audit, startup smoke passed. Post-merge main run `42351965332` passed.
- PR #76 and #59 are closed as superseded.
- Conflict evidence is persisted, but resolution/rebase UI is not implemented. Tombstone projection remains blocked.
- Continue with conflict-resolution protocol, then tombstone semantics, broader collection/device coverage, and browser E2E. Do not enable production projection.


## Latest checkpoint — PR #85
- Main SHA: `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- PR #85 merged: validates conflict event/inbox identity, caps snapshots, resolves conflict records atomically with projection cursor commits, and prevents late orphan archives.
- Exact PR gate: 462 assertions, 27/27 Firestore Rules, TypeScript, build, dependency audit, startup smoke passed. Post-merge main run `42352594819` passed.
- PR #82 and #86 closed as superseded.
- Next: manual conflict resolution/rebase workflow, then safe tombstone semantics, all-collection/device coverage, multi-tab and browser E2E. Do not enable production sync.

## Live resume checkpoint — 2026-11-07 after PR #89

- Current main SHA: e894140c91ec8086d111989dcdb601d3cdbf9ce4. Re-fetch before editing.
- PR #62 merged: 8535802d3609c854b1c91742135c84894e5e074f; exact PR CI and post-merge Main run 42354256341 passed.
- PR #89 merged: e894140c91ec8086d111989dcdb601d3cdbf9ce4; exact PR CI runs 42354410219 and 42354399498 passed. PR #63 is closed as superseded.
- Main run 42354517460 was in progress at checkpoint time; verify its final conclusion on the exact SHA.
- PR #88 Ruqyah integration is on main. Its progress counters are UID-scoped local-only data, not cloud sync.
- Review the active branch feat/ruqyah-cloud-sync-20261107 before continuing. At observed head ec15084e9a1f20013476af5df83144f45456a595, run 42354431882 failed 3 progress persistence tests because StorageService.saveRuqyahProgressSnapshot was missing. The branch is incomplete; do not merge. Re-fetch latest branch and logs before changing it.
- Ruqyah counters need a concurrency-safe merge model (per-device counters or immutable increment events) before adding them to sync. Do not use blind last-write-wins snapshots.
- Highest sync priorities remain: manual conflict-resolution state machine with preserved outbox/local/remote snapshots; collection-specific tombstone semantics; expand two-device tests beyond profile; multi-tab/browser concurrency; account lifecycle isolation; negative Firestore rules tests; Playwright E2E.
- Keep VITE_WIRD_REVISIONED_SYNC_ENABLED and VITE_WIRD_REMOTE_PROJECTION_ENABLED disabled for real users until every release gate passes. Do not deploy production rules or change production settings without explicit approval.

## Live resume checkpoint — 2026-11-07 after PR #93

- Current main SHA: f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Main Quality Gate run 42355600523 passed on this exact SHA.
- PR #91 merged at a618036b995ff45749748e90e2a4d3ec1037c838; Ruqyah journal-first revisioned sync and version-5 backup integration are present. Exact-head run 42355023151 passed.
- PR #92 merged at bd6fc3a79267ee7136746fed17c58a6ceac8b58c; canonical storage migration integrity fixes and regression tests are present. Exact-head run 42355486226 passed.
- PR #93 merged at f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3; exact-head run 42355488786 passed 500 unit tests, 29 Firestore rules tests, dependency audit, TypeScript, production build and startup smoke.
- Continue with PR #94: verify exact head/checks, review the Ruqyah legacy-state collection scan, and confirm the concurrent-offline test preserves local Outbox, remote Inbox, conflict evidence and cursor. Merge only after the exact-head gate passes.
- Important: the Ruqyah counters remain full snapshots. A stale concurrent increment is blocked and archived; it is not automatically combined with the remote increment. Do not describe this as additive convergence.
- Manual conflict-resolution UI/state machine, tombstone projection, cross-tab coordination, all-collection tests, account lifecycle isolation, production rules deployment, and production deploy/live smoke remain blockers.
- Keep revisioned sync and remote projection flags disabled for real users until all release gates pass. Do not set Vercel variables or deploy Firebase rules from this session.

### Subsequent checkpoint update — PR #95 merged

- PR #95 merged at 52e62d6b21057cf0d796cc3b137f4087cbe2e983. Its exact-head Quality Gate passed on c2e9478f6053ddc95aaa5058d7a5ab074255d58b; the merge adds post-success Ruqyah progress notifications for direct backup import and full reset, with rollback-safe notification timing.
- Main Quality Gate run 42355938085 was in progress on 52e62d6b21057cf0d796cc3b137f4087cbe2e983 when this note was added; verify its final conclusion before the next release decision.
- PR #94 was created against the previous main SHA f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Its changes are disjoint from PR #95, but re-check mergeability and exact-head CI after main advanced.
- PR #96 documents the global stop condition: do not set remote-sync flags until manual conflict resolution, additive counter merge, tombstones, cross-tab coordination, account isolation, and live verification all pass.

## Live resume checkpoint — 2026-11-07 after PR #98

- Re-fetch main before work; checkpoint SHA is 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. Main Quality Gate 42356505550 passed on this SHA.
- PR #97 merged: 217f7136244d4d7afd02a9c52be86f520c1baefa. API proxy hardening and bounded upstream stream reads are present; topic endpoints remain disabled by default.
- PR #98 merged: 8089579d020a6a4831cdc9ba4f25f8672f30cc3d. Manual-only Firestore rules deploy workflow is present but not dispatched. PR #100 adds the missing pre-deploy Emulator gate; review exact head and checks before merging. Do not dispatch until explicit approval.
- Current main Vercel status is build-rate-limit failure. Previous Vercel success on f2c3f32f is not evidence that current main is deployed. Production alias/live SHA remain unknown.
- PR #94 added Ruqyah first-sync detection and concurrent-offline conflict retention. It does not additively merge counts.
- Continue with manual conflict resolution (including base/delta-aware Ruqyah merge), tombstone semantics, cross-tab concurrency, account lifecycle isolation, all-collection tests, Playwright E2E, production rules verification, and live deploy smoke.
- Keep both VITE_WIRD sync flags disabled until every global release gate passes. Keep RUQYAH_TOPICS_ENABLED unset/false pending content review.

## Resume here — live main checkpoint 2026-11-07

- Re-fetch main before editing. Last verified main SHA: `d71908b3e411bcd7d1db2b09318eb3c95564198e`.
- Main Quality Gate `42357565644` passed on this SHA: 509 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, build, and startup smoke.
- PR #104 merged: Settings conflict inspector is read-only and UID-scope guarded. Do not describe it as conflict resolution.
- PR #106 merged: bidirectional A ↔ B revisioned event projection through all eight collection routes, exact-head CI passed. Six collection arrays are empty in the test fixture; populated record schemas remain to be tested.
- PR #105 merged: Ruqyah source allowlist/audio safety hardening; topic content remains disabled and unverified audio remains blocked.
- PR #108 open: review exact head/checks and address the source registry ID→reference mapping plus generic `g-4` health source before merge.
- Current Vercel status is `build-rate-limit`; no current production deployment SHA/live smoke verified.
- Next sync work: full manual conflict resolution/rebase state machine; safe tombstones; account-switch in-flight isolation; real multi-tab concurrency; populated per-collection fixtures and offline/retry/crash tests.
- Do not enable `VITE_WIRD_REVISIONED_SYNC_ENABLED` or `VITE_WIRD_REMOTE_PROJECTION_ENABLED`; do not dispatch Firestore deployment workflow without explicit approval and completed release gates.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.
