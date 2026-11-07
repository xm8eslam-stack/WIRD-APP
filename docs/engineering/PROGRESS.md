# WIRD — Engineering Progress Checkpoint

**Date:** 2026-11-07  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Main SHA at checkpoint:** `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`

## Completed and merged in this work segment

- PR #73 — durable remote projection crash recovery; merge SHA `cc887a6bfa07aec880f495221e64dd36edb14ca8`. Exact PR CI and post-merge main run `42350476806` succeeded.
- PR #77 — bidirectional profile sync integration between two isolated devices using Firestore Emulator, independent IndexedDB, and independent localStorage; merge SHA `716cf301bff9a8c7777ee3931dba6366a01afe3b`. Exact PR CI succeeded; emulator reported 26/26.
- PR #78 — offline same-document stale revision conflict test; merge SHA `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`. Exact PR CI succeeded; 450 automated assertions and 27/27 Firestore Rules Emulator tests passed.

## Current engineering state

- Crash recovery intent is durable and finalization is atomic with cursor/revision/inbox completion.
- Profile collection bidirectional device-to-device flow has an emulator-backed integration test.
- Same-document stale offline mutation is rejected by server revision; losing local mutation and remote inbox event are preserved; projector blocks and does not advance cursor.
- Tombstones are intentionally blocked from projection. Safe collection-specific deletion and tombstone retention/garbage collection are not implemented.
- Conflict detection/preservation is implemented; a dedicated conflict record and user-facing resolution/rebase flow are not.
- `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are explicit gates. Production values have not been inspected; do not assume sync is enabled.
- Production Firebase rules deployment is unverified.
- Vercel reports `build-rate-limit`; production deployment of current main and live URL smoke are unverified.

## Exact-head test evidence

| Candidate | Automated suite | Firestore Rules Emulator | TypeScript | Build | Startup smoke |
|---|---:|---:|---|---|---|
| PR #77 head `7d92b0e` | 450/450 | 26/26 | Pass | Pass | Pass |
| PR #78 head `9144a25` | 450/450 | 27/27 | Pass | Pass | Pass |

PR #78's post-merge main run was queued at checkpoint and must be rechecked.

## Open PRs / branches at checkpoint

- PR #73: merged.
- PR #77: merged.
- PR #78: merged.
- Documentation checkpoint branch: `docs/sync-engineering-state-20261107` (this change).
- Re-fetch live GitHub state before relying on this list.

## Next work, ordered by risk

1. Implement and test explicit conflict persistence and user-controlled resolution/rebase; do not silently drop pending local work.
2. Implement collection-specific tombstone projection with durable tombstone ledger, stale-event rejection, and safe retention rules.
3. Expand two-device integration to all collections and test same-document concurrent field changes / independent documents.
4. Test multi-tab locks, upload timeout-after-acceptance, retries/backoff, and long offline queues.
5. Audit account lifecycle, logout/switch/reinstall, schema migration, and session expiry.
6. Add Playwright E2E with independent browser contexts.
7. Verify production rules deployment and exact-SHA Vercel deployment only after release gates pass.

## Safety

No production data, rules, credentials, service accounts, environment variables, or Vercel settings were changed. No production sync activation was performed.


## Additional milestone — PR #81

- PR #81 merged as `059e902194811be71ab4dea9da8609a96967214e`.
- Added IndexedDB v8 UID-scoped `projectionConflicts` archive, bounded at 100 records per UID.
- Blocked projection archives the remote event and exact relevant local snapshot. Repeated observations preserve the original snapshot. Open records are never pruned; only resolved records may be pruned.
- Cloud sync diagnostics and Settings show open conflict count and latest conflict summary.
- Exact-head CI on `415cbe33389a6108d08f9d5785818e8e12458fee`: 459 automated assertions passed, 27 Firestore Rules tests passed, TypeScript/build/startup smoke/dependency audit passed.
- Post-merge main CI run `42351965332` passed on the merge SHA.
- The older PR #76 was closed as superseded by #81. PR #59 was closed as superseded by the revisioned sync work; its legacy serverTimestamp envelope was not merged.

## Updated current state

- Durable conflict evidence is now archived. Conflict resolution/rebase and user controls are still missing.
- Tombstone projection remains intentionally blocked.
- Two-device integration still covers profile upserts and a same-document offline conflict; it does not prove all collections or real-browser contexts.
- Production Vercel check remains `build-rate-limit`; live deployment unverified.


## Atomic conflict reconciliation milestone — PR #85

- PR #85 merged as `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- Conflict archival now verifies inbox/event identity and fingerprint, enforces a 500 KB snapshot cap, and refuses orphan records.
- `finalizeRemoteProjection` and `markRemoteProjected` resolve matching open conflict records atomically with cursor advancement and inbox deletion. Late archive attempts after cursor advancement cannot create orphan open conflicts.
- Projector archives blocked, mismatched-intent, prepare-failure, and finalization-failure paths. Settings shows localized reason and collection details.
- Exact PR head `b6af08b2d9461a1d3d7cc019404692d779500248`: 462 automated assertions passed; Firestore Rules 27/27; TypeScript/build/dependency audit/startup smoke passed.
- Post-merge main run `42352594819` passed on `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`.
- PR #82 and PR #86 closed as superseded by #85; PR #85 is the merged source of truth for atomic conflict reconciliation.

## Updated limitations

- The archive's `reconciled` state means the corresponding event was safely projected/cursor-committed; it does not represent a user choosing local vs remote data.
- Manual conflict resolution/merge/rebase UI remains absent. Tombstone projection remains blocked. Profile-only two-device integration and one same-document offline conflict test do not certify all collections or physical devices.
- Vercel still reports `build-rate-limit`; current main is not verified as deployed.

## 2026-11-07 — Live continuation checkpoint after PR #89

- Re-fetched repository state; the checkpoint SHA from the earlier section is historical. Current main at this checkpoint: e894140c91ec8086d111989dcdb601d3cdbf9ce4.
- PR #62 merged as 8535802d3609c854b1c91742135c84894e5e074f. Exact-head Quality Gate 42342109962 passed; post-merge Main Quality Gate 42354256341 passed on that exact merge SHA.
- PR #89 merged as e894140c91ec8086d111989dcdb601d3cdbf9ce4, reapplying the audio repeat fix from stale PR #63 onto current main. Exact-head runs 42354410219 and 42354399498 passed. PR #63 was closed as superseded; its divergent branch was not merged.
- Post-merge Main run 42354517460 was still in progress when this checkpoint was written. Recheck it against the exact main SHA before claiming post-merge CI success.
- PR #88 Ruqyah integration is merged at 6af7ce1d27543429911ca686550bc26f446ec2e0; Main run 42354021822 passed. Ruqyah progress currently persists in UID-scoped local storage only; it is not yet part of the cloud sync collection/projection model.
- A separate branch feat/ruqyah-cloud-sync-20261107 is under active development. Its observed exact-head run 42354431882 failed: 491 passed / 3 failed because StorageService.saveRuqyahProgressSnapshot was called but is not implemented. Do not merge that branch based on allowlist changes alone. Re-fetch its latest head and checks before any action; later commits may have changed it.
- Important design gap: Ruqyah counters are mutable per-item totals. A cross-device merge policy (per-device counters or immutable increment events) is not defined. Do not sync a whole counter snapshot with last-write-wins semantics because concurrent increments can be lost.
- Existing cloud-sync release blockers remain: no user-facing keep-local/use-remote/merge/rebase workflow; tombstone projection blocked; two-device coverage is profile-only plus one offline conflict; all-collection, cross-tab browser, account-lifecycle and production rules/deployment verification remain outstanding.
- Vercel still reports a daily build-rate-limit status. No current-main production deployment or live URL smoke is claimed.
- No production data, Firebase rules deployment, secrets, Vercel settings, or remote-sync flags were changed.
