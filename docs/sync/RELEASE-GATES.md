# WIRD Sync Release Gates

A release gate is passed only with evidence on the exact candidate SHA.

## Required before enabling production sync

- [ ] All active user mutation paths are journaled and audited.
- [ ] Firestore rules are deployed to the intended production Firebase project and verified to match the transaction contract.
- [ ] Two-device tests cover every supported collection and both directions.
- [ ] Offline retry, idempotent replay, timeout-after-acceptance, and restart tests pass.
- [ ] Same-document stale revision conflicts preserve both versions and have a tested resolution path. (Detection/preservation and durable archive exist; user-facing resolution remains open.)
- [ ] Tombstone projection, offline deletion, stale update rejection, and safe retention/compaction are implemented and tested.
- [ ] Cross-tab sync serialization is tested in independent real browser contexts.
- [ ] Account switch/logout/reinstall/schema migration tests pass.
- [ ] Playwright desktop/mobile/tablet E2E passes.
- [ ] Load/stress tests cover expected queue sizes and bounded retry behavior.
- [ ] Remote projection and upload feature flags are reviewed and explicitly configured.
- [ ] Production deployment is tied to the exact candidate SHA and a live URL smoke test passes.

## Current release decision

**Not approved for full production cloud-sync activation.** The existing feature gates must remain disabled unless a separately approved release process proves the above requirements. The current verified work establishes local durability, revision-checked Firestore transactions, emulator rules, a profile-only two-device round trip, and preservation of one offline conflict case. It does not establish complete cross-collection sync, tombstone behavior, conflict resolution, or live deployment.


## New evidence since the initial checkpoint

PR #81 added a bounded UID-scoped durable archive for blocked remote projection conflicts and Settings diagnostics. Exact-head PR CI passed with 459 automated assertions, Firestore Rules Emulator 27/27, TypeScript, production build, dependency audit, and production startup smoke. Post-merge main run `42351965332` passed on `059e902194811be71ab4dea9da8609a96967214e`.

This closes the conflict-evidence preservation gap, but not the resolution gate. Production sync remains not approved.


## PR #85 update

Atomic conflict reconciliation is now implemented: an open archive record is marked reconciled in the same IndexedDB transaction as cursor advancement and inbox deletion, with event fingerprint/inbox validation and bounded snapshot size. PR #85 exact-head CI passed (462 assertions, 27/27 Firestore Rules, TypeScript, build, dependency audit, startup smoke); post-merge main run `42352594819` passed on `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.

Still not approved for production sync: user-directed conflict choices/merge/rebase remain absent, tombstone projection remains blocked, two-device tests cover a limited collection set, and live Vercel/production rules verification remains outstanding.

## 2026-11-07 checkpoint update

The following remain release blockers and must not be waived:

- User-facing conflict resolution with keep-local/use-remote/merge semantics, durable history, server-revision revalidation, and idempotent recovery.
- Collection-specific tombstone projection, stale-event rejection, offline deletion and safe retention/compaction.
- Multi-collection two-device coverage. Current two-device evidence is profile-only plus one offline stale-revision conflict.
- Cross-tab concurrency in independent real browser contexts and account-switch/logout/reinstall isolation.
- Collection-specific Firestore payload validation and negative authorization tests, plus confirmation that production rules match the candidate.
- Exact-SHA production deployment and post-deploy browser smoke. Vercel build-rate-limit failures are not deployment evidence.
- Ruqyah progress sync is not implemented. Before enabling it, design a concurrency-safe counter model and test increments from two independent devices.
- Main checkpoint SHA at this update: e894140c91ec8086d111989dcdb601d3cdbf9ce4. Post-merge CI run 42354517460 was still in progress; recheck before release.

## 2026-11-07 — Updated after Ruqyah sync integration

- Ruqyah progress is now in the revisioned collection model and version-5 backup. PR #94 must close the legacy first-sync scan gap and pass concurrent-offline conflict-preservation tests.
- Concurrent Ruqyah counter increments are not yet additively merged. Stale writes must remain blocked and both snapshots retained; production activation remains prohibited until the data model can preserve and resolve independent increments deterministically.
- Manual conflict-resolution UI/state machine remains a release blocker: keep-local, use-remote, and safe merge/rebase must revalidate server revision and preserve Outbox/archives until commit.
- Tombstone projection remains blocked. Do not remove the guard until delete semantics, stale-event rejection, offline delete, resurrection prevention, and retention/compaction are tested per collection.
- Cross-tab browser concurrency, full collection coverage, account lifecycle isolation, production Firestore rules deployment, and exact-SHA live deployment/post-deploy smoke remain blockers.
- Main checkpoint SHA: f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3. Main Quality Gate run 42355600523 passed; this does not verify production deployment.
