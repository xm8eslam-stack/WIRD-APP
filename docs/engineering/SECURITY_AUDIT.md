# WIRD Security & Data Integrity Audit

**Audit date:** 2026-11-06  
**Audited branch:** `main`  
**Audited HEAD:** `f342b4bc7e02a48f88b90646098eea178901c8ea`  
**CI:** GitHub Actions run [42169105813](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42169105813) completed successfully.  
**Deployment:** The user reports `https://wird-app.vercel.app/#/dashboard` is working; the Vercel check for this commit is green. This does not verify Firebase production rules or cloud sync.

## Executive summary

WIRD has a sound local-first foundation and Firebase Authentication. UID-scoped local storage and a legacy-data ownership decision are implemented. Several correctness and persistence bugs affecting memorization/revision were fixed and regression-tested in this session, including review/memorization separation, repeat-loop prevention for in-progress passages, single-write page updates, and truthful backup-import feedback.

**Cloud sync is not implemented yet.** Firestore rules and emulator tests exist, but there is no Firestore client adapter, local outbox, merge engine, or live rules deployment confirmation. Do not tell users their progress is cloud-synced until the M4–M7 gates in `IMPLEMENTATION_ROADMAP.md` pass.

## Confirmed protections and fixes

| Area | Current state |
|---|---|
| Auth gating | Verified-user gating exists in AuthGate; unauthenticated/guest/verified account states are separated |
| Local account isolation | Authenticated local data is scoped by exact Firebase UID; guest data remains separate |
| Legacy local data | First authenticated account receives an explicit import-or-keep-as-guest decision |
| Weak-verse persistence | Uses centralized StorageService; malformed/corrupt archives are preserved and block writes rather than becoming an empty list; coordinates are checked against canonical Surah metadata |
| Durable local writes | Failed localStorage writes no longer leak through memory fallback as successful writes; corrupt profile/log/plan/revision/test/portion archives are preserved and normal writes are blocked |
| Activity/streak write | Session log/profile write reports failure and attempts rollback rather than silently claiming success |
| Session completion boundary | `persistSessionCompletion` validates exact Quran coordinates and rolls back the newly saved portion if activity/streak persistence fails |
| Revision rating transaction | Portion rating and weak-verse writes roll back together if weak-verse or activity/streak persistence fails; restoration is verified |
| Event identity | Revision history and sync outbox use collision-resistant Web Crypto UUIDv4 identifiers instead of millisecond timestamps |
| Review vs memorization | Review sessions no longer add memorized ayahs or create memorization portions |
| Retention score | Overlapping ranges count each ayah once; weakest overlapping status wins |
| Review page count | Uses canonical Mushaf page mapping rather than an ayah-count estimate |
| In-progress memorization | Resumes exact stored range; no clipped child range that leaves a repeating parent |
| Page status updates | Prepares all Surah segments and persists the whole page update in one canonical write |
| Backup import UI | Checks `result.success`; failed imports and file-read errors no longer display false success |
| Backup rollback | Snapshot restoration verifies memory and durable localStorage readback; failed recovery is surfaced rather than silently reported as attempted success |
| Corrupt archive handling | Daily logs, profile, plans, engine plans, revision items, tests, and canonical portions are not silently normalized and overwritten; validated legacy recovery remains available |
| Daily plan selection | Does not start future engine tasks or silently escape a plan's explicit scope |
| Firestore rules | UID ownership, verified-user check, allowlist, generic envelope, tombstone-only delete model, default deny |
| Rules tests | Firebase Emulator rules tests run in CI |

## Important unresolved risks

### Critical — cloud sync is absent

- `src/lib/firebase.ts` initializes Firebase App/Auth only.
- No application Firestore client, `onSnapshot` listener, cloud repository, or sync engine is present.
- `LocalSyncOutbox` exists but is not yet called by session, review, weak-verse, test, or plan mutation flows.
- Firestore rules are not confirmed deployed to the live Firebase project.
- Cross-device progress must be considered unavailable until sync is implemented and verified.

### High — current Firestore rules are only a foundation

- Rules currently validate a generic envelope, not the full schema for each collection.
- Collection-specific payload key/type/range validation and size limits remain required.
- Event collections should become create-only.
- No live Firebase rules deployment was performed.

### High — current activity and weak-verse data are aggregate projections

- Daily logs are currently updated as per-day aggregates. A cross-device read-modify-write would lose concurrent increments; migrate to immutable activity events before sync.
- Weak-verse mistake counts are aggregated; migrate to immutable mistake events before sync. Local weak-verse archive validation now rejects malformed data without overwriting the original bytes.
- Review history and portion state need unique event IDs and deterministic merge semantics.
- Session completion now rolls back ordinary write failures across portion/activity. Other multi-key operations can still partially succeed; crash-atomicity requires the event journal and recovery replay.

### Medium — plan and progress UX

- Daily quick-start and review/memorization modes were corrected, but the remaining components and all mutation call sites still need a complete file-by-file audit.
- Page/Juz plans are deliberately blocked from automatic quick-start until exact ayah-range resolution is available; they must not be widened to whole Surahs.

### Medium — serverless AI endpoint

- `api/advisor.ts` uses an in-memory per-IP rate limiter. Serverless instances can scale independently, so this is not a globally authoritative quota.
- The endpoint should remain optional and must not be required for memorization, revision, or data integrity.
- Keep `GEMINI_API_KEY` server-only; never expose it as a `VITE_` variable.

## Firestore rules model currently present

- Path: `users/{uid}/{collection}/{documentId}`
- Verified Firebase auth required.
- `request.auth.uid == uid`.
- Collection allowlist currently includes profile, plans, enginePlans, portions, weakVerses, tests, activityEvents, and syncMeta.
- Generic envelope includes schema version, payload, client update time, device ID, mutation ID, and optional tombstone.
- Physical deletes denied; unknown paths default denied.

This model must be tightened per collection before production sync.

## Verification evidence

Latest Actions run: [42178884028](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42178884028) — success.
- Automated test suites: 250 passed, 0 failed.
- Firestore Emulator security-rule tests: passed.
- TypeScript validation: passed.
- Production build, including Quran chunk validation: passed.
- Production server startup smoke test: passed.

The Vercel status check for the audited commit is successful. No Firebase production rules deployment or real two-device sync test has been performed.

## Next security actions

1. Finish the remaining file-by-file audit and document every data mutation path.
2. Implement a UID-scoped local event ledger and durable outbox.
3. Implement deterministic merge functions and tests before Firestore integration.
4. Harden rules with collection-specific schemas, immutable events, and size limits.
5. Run two-client emulator tests for account isolation, concurrency, retries, and offline replay.
6. Request explicit approval before deploying rules or enabling cloud sync for real users.


## 2026-11-07 cloud-sync audit update

- PR #73: projection crash recovery intent and atomic finalization merged; post-merge CI run `42350476806` passed.
- PR #77: emulator-backed bidirectional profile sync across independent IndexedDB/localStorage devices merged; exact-head CI passed with 450 automated assertions and 26 Firestore Rules tests.
- PR #78: stale offline same-document mutation rejected by server revision; losing local mutation and remote inbox event preserved; projection blocked without cursor advance. Exact-head CI passed with 450 automated assertions and 27 rules tests.
- Firestore transactions use server revisions and a monotonic per-user sequence; client timestamps are not used to resolve conflicts.
- Tombstones remain blocked from local projection. Do not interpret remote tombstone write support as end-to-end delete propagation.
- Conflict preservation/detection is tested, but durable conflict records and user-facing resolution are absent.
- Emulator success does not prove production Firestore rules are deployed. No production rules deployment or data mutation was performed.
- Cloud writes/projection remain behind explicit Vite build flags; production values were not inspected. Vercel currently reports `build-rate-limit`; production deployment is unverified.
- Full release must remain blocked pending collection-specific rules, all-collection multi-device tests, tombstone implementation, conflict resolution, account lifecycle, browser E2E, and live deployment verification.


## 2026-11-07 — conflict archive verification

PR #81 adds a bounded UID-scoped IndexedDB archive for blocked remote projection conflicts. It preserves the remote event and local snapshot, surfaces diagnostics in Settings, and never prunes open records. Exact-head CI passed (459 automated assertions, 27 Firestore Rules tests, TypeScript, build, dependency audit, startup smoke); post-merge main run `42351965332` passed on `059e902194811be71ab4dea9da8609a96967214e`. This does not implement conflict resolution or tombstone propagation. Vercel still reports `build-rate-limit`; live production deployment/rules remain unverified.


## PR #85 — conflict archive integrity

Conflict archival validates the stored inbox event and fingerprint, checks existing conflict identity, caps local snapshots, and prevents orphan records. Conflict status is resolved only in the same transaction as a successful projection cursor commit/inbox deletion. Exact PR head passed 462 automated assertions and 27 Firestore Rules tests; post-merge main run `42352594819` passed on `db4ec36f14490cd50eb61ccd2b9e73972dbe8b17`. Manual conflict resolution/rebase and tombstone projection remain unimplemented; Vercel production deployment remains unverified.
