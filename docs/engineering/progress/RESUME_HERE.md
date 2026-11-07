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
