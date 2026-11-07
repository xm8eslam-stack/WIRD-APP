# WIRD Security & Data Integrity Audit

**Audit date:** 2026-11-06  
**Audited branch:** `main`  
**Latest reviewed main HEAD:** `8ac5d87d84077f209eaf49881dd1354ce10d3565`  
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

## 2026-11-07 — Live security/deployment checkpoint

- PR #91 added Ruqyah progress to the owner-scoped revisioned mutation model and Firestore rules. Exact-head emulator coverage passed in run 42355023151.
- PR #93 passed 29 Firestore Security Rules Emulator tests on exact head 7d2b44f7a4fe49686abe433fe8f535b97d2b1866. This is emulator evidence only; production rules deployment was not performed or verified.
- Current main SHA f6ebdbd93bb5b8ec0f3d5888ec7b54040ce997d3 passed Main Quality Gate run 42355600523. No production secrets, Vercel environment variables, Firebase project configuration, or remote-sync flags were changed.
- Revisioned sync flags must remain disabled until manual conflict resolution, tombstone semantics, Ruqyah concurrent increment resolution, cross-tab concurrency, account lifecycle isolation, and production rules/deployment gates pass.
- Vercel build-rate-limit is a provider quota issue; it is not evidence of a deployed artifact. Confirm deployed SHA and live smoke separately.

## 2026-11-07 — API proxy and deployment safety checkpoint

- PR #97 merged with a server-side IslamicAPI proxy. The provider key is read only from server environment, upstream content blocks are allowlisted, streamed response bodies are bounded to 2 MiB, and topic endpoints are disabled unless the server-side RUQYAH_TOPICS_ENABLED flag is explicitly true.
- Rate limiting uses Vercel-provided x-real-ip when available and is bounded per serverless instance. It is best-effort, not a globally coordinated quota; provider fair-use limits remain authoritative.
- PR #98 merged a manual-only Firestore rules deployment workflow requiring main, exact project-ID match, typed confirmation, and a service-account secret. It has not been dispatched.
- PR #100 is open to add the Firestore Emulator preflight before credential creation/deployment. Do not dispatch until merged and explicitly approved.
- Main SHA 8089579d020a6a4831cdc9ba4f25f8672f30cc3d passed run 42356505550. Its Vercel status is build-rate-limit failure; no live production SHA or rules deployment is verified.
- No production secrets, Vercel settings, Firebase rules, or sync flags were changed by this session.

## 2026-11-07 — Current main security checkpoint

- Main SHA `d71908b3e411bcd7d1db2b09318eb3c95564198e` passed Main Quality Gate run `42357565644`: 509 unit assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, and server startup smoke.
- PR #105 keeps IslamicAPI server-side and Quran-locator-only; canonical Quran text is rendered from WIRD's verified corpus. Third-party Sunnah text and unverified audio catalogues/recordings are blocked; educational topic content remains disabled pending qualified review.
- PR #104 exposes archived conflict evidence only within the exact authenticated UID storage scope. The view is read-only and does not resolve or discard records.
- PR #106 adds reverse multi-collection projection tests; six array payloads are empty, so field-level domain-record coverage is incomplete.
- Vercel status is still `build-rate-limit`; no current production SHA/live smoke is verified. Production Firestore rules workflow exists but has not been dispatched.
- Do not enable remote-sync flags or change production secrets/rules. Conflict resolution, tombstones, additive counter merge, cross-tab concurrency, account lifecycle race tests, and live deployment verification remain release blockers.

### Subsequent update — PR #108 merged

- PR #108 merged at `4ae28edf7d30e41f11727a7b85b67d9056d78408`. It replaces the global source Set with an exact content-ID → source mapping, rejects duplicate/missing/unregistered items, clarifies Abu Dawud 5082 grading for all three protective surahs, and cites the named Ibn Baz fatwa on combining ruqyah and medical treatment. Exact-head runs `42358001268` and `42358006528` passed: 510 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, build, and server startup smoke.
- Current main is now `4ae28edf7d30e41f11727a7b85b67d9056d78408`; post-merge Main Quality Gate run `42358126271` was still in progress when this update was written. Verify its final result before any release claim.
- The previous `d71908b3e411bcd7d1db2b09318eb3c95564198e` checkpoint is now historical. Vercel's production deployment status remains a separate `build-rate-limit` failure and no live deployed SHA is verified.

### Subsequent update — PR #110 merged

- PR #110 merged at `31ab27764b5c5db19d0003403adf43905c2bbc8e`. It closes a critical in-flight account-switch race: the coordinator now binds outbox reads, revision lookups, rebases, acknowledgements, retries, and remote event imports to the UID captured at sync start, and rechecks the authenticated UID plus exact `user:<uid>` scope after async boundaries. A stale cycle aborts without mutating the new account's outbox.
- Regression test uses identical mutation IDs in accounts A and B and proves stale A operations cannot read, rebase, mark failed, or acknowledge B's pending mutation; both accounts' pending data remains recoverable.
- Exact PR head `e4865e17707e7f8dbea7bdbad8997bafcda4a414` passed run `42358255018`: 511 unit assertions, 31 Firestore Rules Emulator tests, TypeScript, production build, and production/development startup smoke.
- Current main is now `31ab27764b5c5db19d0003403adf43905c2bbc8e`; verify its post-merge Quality Gate before claiming main green. Vercel production remains blocked by `build-rate-limit` and no live deployed SHA is verified.


## 2026-11-07 — PR #111 and populated eight-collection sync verification

- PR #111 merged as `48cf9b236072cd3db2603a57cda5f67b30a778cd`. It restricts IslamicAPI to validated Quran locator coordinates; displayed Quran text and metadata resolve from WIRD's canonical corpus. Duplicate PR #112 was closed after all code/test files were confirmed identical to main and its only remaining difference was stale checklist wording.
- PR #114 merged as `8ac5d87d84077f209eaf49881dd1354ce10d3565`; exact PR head `9ff200bc731ac99db0d662f76dad97b370d00c9b` passed both push and pull-request Quality Gate runs `42359408488` and `42359412200`.
- Exact-head evidence: 513 automated assertions passed, 31 Firestore Rules Emulator tests passed, dependency audit passed, TypeScript passed, production build passed, and production/development server startup smoke passed.
- PR #114 replaces empty fixtures for plans, enginePlans, portions, weakVerses, tests, and activityEvents with valid non-empty domain records. All eight collections now have populated fixtures. The Emulator test performs sequential A → B → A projection with distinct B-side edits and compares complete local projection records and remote payload fields, plus revision 1/2.
- This does not prove simultaneous concurrent merge for every collection, long-offline replay, real-browser cross-tab behavior, or Playwright/device E2E. It closes the empty-record serialization/round-trip gap documented under PR #101/#106.
- Current main SHA: `8ac5d87d84077f209eaf49881dd1354ce10d3565`. Post-merge Main Quality Gate run `42359547235` was in progress when this checkpoint was prepared; recheck its final conclusion before claiming main's post-merge gate passed.
- Vercel status remains `build-rate-limit`; this is a provider deployment quota failure, not a successful deployment. No production Firebase rules deployment, live deployed SHA, live two-device verification, environment-variable change, secret change, or production sync activation is claimed.
- PR #2 remains a draft and is 115 commits ahead / 262 behind current main; do not merge it wholesale. Review and selectively reapply any still-useful changes only.
- Next priority: design and implement an idempotent user-directed conflict-resolution state machine with durable preservation and latest-revision revalidation; then tombstone semantics, additive Ruqyah counters, cross-tab/Playwright, and account lifecycle stress tests. Keep production sync gates disabled.
