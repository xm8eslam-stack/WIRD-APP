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
