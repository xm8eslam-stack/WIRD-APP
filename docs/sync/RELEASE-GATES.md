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

## 2026-11-07 — Deployment workflow checkpoint

- Current main SHA 8089579d020a6a4831cdc9ba4f25f8672f30cc3d passed Main Quality Gate run 42356505550.
- PR #98 added a manual-only, main-only, typed-confirmation workflow that deploys only Firestore rules. It has not been dispatched; no production rules deployment is claimed.
- PR #100 is open to add a Firestore Emulator preflight to the manual deploy workflow. Do not dispatch until this preflight is merged and explicit deployment approval is given.
- Current main Vercel status is build-rate-limit failure; production alias and deployed SHA are unverified.
- Do not set VITE_WIRD_REVISIONED_SYNC_ENABLED or VITE_WIRD_REMOTE_PROJECTION_ENABLED until manual conflict resolution, additive Ruqyah counter merge, tombstones, cross-tab concurrency, account isolation, and live two-device verification pass.

## 2026-11-07 — Updated after PR #104/#106/#105

- PR #104 adds a UID-guarded read-only conflict inspector. Manual keep-local/use-remote/merge/rebase remains a blocker.
- PR #106 adds bidirectional A ↔ B revisioned projection across eight collection routes and exact-head Emulator/CI coverage. Six collection arrays remain empty in the fixture; populated domain-record serialization is still a blocker.
- PR #105 restricts external Ruqyah API use to Quran reference indexing, keeps educational topics disabled, and blocks unverified recitation audio. The source policy is documented; PR #108 adds an exact source registry and must be reviewed for ID-to-reference binding and `g-4` health guidance attribution.
- Current main SHA: `d71908b3e411bcd7d1db2b09318eb3c95564198e`; Main Quality Gate `42357565644` passed (509 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, build, startup smoke).
- Vercel remains failed with `build-rate-limit`; production deployment/live SHA is not verified.
- Remaining blockers: manual conflict resolution, deterministic additive Ruqyah counter merge, tombstone projection/retention, real multi-tab/browser concurrency, in-flight account lifecycle isolation, populated multi-collection records, Playwright E2E, production rules deployment, and exact-SHA live deployment/post-deploy smoke.
- Keep both remote sync flags disabled and do not dispatch the manual rules workflow until explicit approval and all gates pass.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.

### Subsequent update — PR #111 merged

- PR #111 merged at `48cf9b236072cd3db2603a57cda5f67b30a778cd`. IslamicAPI now exposes only validated Quran locators (`instant` + `from-quran`); provider-authored text/translation/reference fields are stripped, and the UI resolves Arabic text and metadata from WIRD's canonical Quran corpus. Topic/category endpoints are hard-disabled, ambiguous/multi-reference titles and invalid IDs/ranges fail closed, and audio remains disabled pending source/rights verification.
- Exact PR head `805c6c3d7b0c00ab348be4891f1f027d50529974` passed run `42358956417`: 513 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and startup smoke.
- Current main SHA is `48cf9b236072cd3db2603a57cda5f67b30a778cd`. Main Quality Gate job `128363308512` passed, but run `42359049396` was still marked in progress at this checkpoint. Vercel remains `build-rate-limit`; production deployment/live SHA is unverified.
