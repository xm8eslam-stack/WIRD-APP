# WIRD — Engineering Progress Checkpoint

**Date:** 2026-11-07  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Main SHA at checkpoint:** `6ea15e4cb13f34ec1744a8b358feab4f7e38f2e9`

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
