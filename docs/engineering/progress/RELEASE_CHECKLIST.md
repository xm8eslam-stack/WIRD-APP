# WIRD — Release Checklist

## Data integrity
- [x] Existing localStorage archives validated and corrupt bytes preserved for covered stores.
- [x] Backup import validation and rollback verification covered by regression tests.
- [x] Session completion and revision rating ordinary-failure rollback implemented.
- [x] Verify durable rollback status for activity/profile, portions, and weak-verse archives; recovery-required warning when any restore cannot be verified (PR #15).
- [x] Verify local outbox write rollback against durable storage and reject partially applied writes that cannot be restored (PR #16).
- [x] Verify durable rollback status for canonical portion writes in status updates, add-portion, memorization completion, and revision rating; recovery-required warning when previous bytes cannot be confirmed (PR #18).
- [x] Refuse backup export when durable storage cannot be read and stop import before the first write if a trustworthy rollback snapshot cannot be captured (PR #20).
- [x] Outbox acknowledged-ID content fingerprints, pending/acknowledged uniqueness and disjointness, device identity, and retry-bound regression tests.
- [x] Portion merge preserves distinct review events, same-ID conflicts, and pre-existing conflict-audit records; status/strength merge is conservative.
- [x] Quran coordinate, calendar date, SM-2 grade, plan-scope, and revision queue boundaries are validated; unbounded numeric ranges are rejected.
- [x] Strict per-record validation for plans, engine plans, revision items, tests, logs, weak verses, portions, profiles, and every backup-import collection covered by the current schema.
- [x] Reject malformed nested records before any partial import; preserve original archive bytes on failure.
- [x] Complete `unifiedPortionService.ts` migration/merge/history/conflict audit (PR #9).
- [ ] Complete audit of every remaining domain mutation call site, including review scheduling, duplicate operations, and statistics paths.
- [x] Verify Phase 2 tests for duplicate portion adds, weak-verse archive uniqueness, idempotent resolution, review-history classification, and rapid UI double submission in CI (PR #10, Actions #681).
- [x] Deterministic journal projection replay before authenticated app initialization, with UID scoping, ordered cursor advancement, and safe legacy-event handling (PR #36).
- [x] Journal-first authenticated profile settings/theme, preset plans, and engine-plan snapshots; serialize enqueue+replay under one per-UID lock and block stale snapshots after recovery (PR #37).
- [ ] Journal-first canonical portion/revision mutations and grouped atomic semantics for session completion, weak-verse recording, and activity/profile updates.
- [ ] Journal-first test results, backup import/reset, and every remaining production mutation call site.
- [ ] Independently review all Phase 2 mutation paths and confirm rollback/aggregate semantics before merging to main.
- [ ] Append-only immutable activity/revision/weak-verse/test event semantics with derived local aggregates.
- [x] Atomic append-only IndexedDB event + outbox transaction and deterministic UID-scoped local projection replay before authenticated app startup (PR #30 and PR #36).
- [ ] Complete crash/reload recovery and quota/blocked-storage tests for every domain mutation; PR #36/#37 cover replay and the first profile/plan snapshot paths only.
- [x] Cross-tab atomic event+outbox writes in IndexedDB; legacy localStorage outbox data is retained as a migration/recovery source, not as the cloud-write path.
- [x] Idempotent, non-destructive legacy outbox migration with source retention and conflict rejection (PR #31).

## Latest verified main checkpoint — PR #37
- Current main SHA: `60d475d1f4f06ea4a852751e1548297d9c7dc6de`.
- PR #36 exact-head runs `42242635765` (PR) and the corresponding push run passed; post-merge main run `42249998978` passed on SHA `9b76227b9498b23fa79fb39264d4b4be98fa16e4`.
- PR #37 exact-head runs `42251723375` and `42251711748` passed on SHA `d45dd9e7284101e332f15b2f408cd62001a961be`.
- Post-merge main run `42251976734` passed on exact SHA `60d475d1f4f06ea4a852751e1548297d9c7dc6de`. Vercel Production deployment is not confirmed.
- Phase 2 remains IN PROGRESS; PR #37 does not implement full cloud sync.

## Cloud sync
- [ ] Firestore client adapter.
- [ ] UID-scoped sync coordinator and bounded incremental pull/push.
- [ ] Deterministic conflict merge for portions, plans, and events.
- [ ] Acknowledge only after confirmed remote persistence.
- [ ] Collection-specific Firestore schemas and size limits.
- [ ] Create-only immutable event rules and tombstone validation.
- [ ] Two-client emulator tests and account-switch tests.
- [ ] Explicit user approval for production rules deployment and sync activation.
- [ ] Real two-device, two-account, offline replay verification.

## Quran reader and audio
- [x] Implement a page-based 604-page Mushaf reader with generated exact navigation for all 30 Juz and 240 Hizb quarters, page bookmarks, last-read position, tafsir entry, and continuous recitation (PR #14; automated CI checks passed).
- [x] Add shared playback-speed controls (0.75×–2×) across Quran Library, memorization sessions, and Mushaf reader, with visible EveryAyah link-back attribution (PR #14).
- [x] Document that recitation audio rights are separate from the Tanzil text license and no blanket EveryAyah license is assumed (PR #14).
- [x] Verify complete generated page index and Juz/Hizb navigation index in automated tests (PR #14).
- [ ] Independently verify the bundled full Quran text and source/version attribution.
- [x] Verify all 114 Surahs and 6,236 ayahs are present; automated integrity tests and generated page indexes cover all 604 pages and 30 Juz / 240 Hizb quarters (PR #14).
- [ ] Verify page/surah/juz/hizb/ayah navigation and bookmarks.
- [ ] Verify tafsir source attribution, response validation, and fallback behavior.
- [ ] Verify audio source rights, reciter selection, repeat modes, current-ayah tracking, and background behavior.
- [x] Add visible EveryAyah link-back attribution beside shared audio speed controls; document that audio rights are separate from the Tanzil text license and no blanket EveryAyah license is assumed.
- [ ] Confirm reciter-specific permissions before any commercial use, offline bundling, mirroring, or redistribution; see `docs/engineering/AUDIO_SOURCE_ATTRIBUTION.md`.
- [ ] Verify playback-rate behavior only where supported by source/browser.
- [ ] Verify reading and audio preferences are centralized and consistent across views.
- [ ] Verify listening never increments memorization/revision completion counters.

## Security and platform
- [ ] Review Firebase Auth account isolation and verified-user gating.
- [ ] Complete collection-specific Firestore rules tests.
- [ ] Verify secrets remain server-only.
- [ ] Review serverless endpoints and rate limiting.
- [ ] Verify PWA offline behavior and service-worker cache upgrades.
- [ ] Responsive QA on phone, tablet, and desktop.
- [ ] Accessibility and keyboard/screen-reader checks.
- [ ] Production build, TypeScript, full unit/integration suites, rules emulator, dependency audit, and server smoke test.

## Release and deployment
- [ ] Confirm current main SHA and CI success for that exact SHA.
- [ ] Confirm Vercel Production deployment is Ready for the same main SHA.
- [ ] Confirm Google AI Studio has synced main (user-visible confirmation required).
- [ ] Confirm Firebase production project/rules state; do not infer from frontend deployment.
- [ ] Confirm backup/export and rollback instructions.
- [ ] No known data-loss or critical security issues.
- [ ] No production data migration or rules deployment without explicit approval.

**Current release status:** NOT READY — Phase 1 data integrity is complete, but Phase 2 mutation/statistics audit, local event ledger, cloud sync, and Vercel production confirmation remain incomplete.

- [x] Verify Phase 2 queue/metrics regression tests in CI: legacy initial-memorization history, unique review event totals, average ease denominator, daily/weekly priority consistency, 20-item cap, impossible dates, future-record validation, and required weak-ayah text (PR #11, Actions #708).
- [x] Verify weak-verse quota failure, rollback failure/recovery warning, and profile quota failure after successful portion/weak-verse/activity writes in CI (PR #12, Actions #741).
- [x] Verify silent no-op write, mismatched write, silent removal, and weak-verse rollback behavior in CI (PR #13, Actions #759).
- [ ] Audit remaining multi-key mutation paths for rollback completeness and recovery-state reporting before marking Phase 2 complete.


## Storage reset rollback — verified in PR #24
- [x] Capture a complete durable snapshot before a full data reset; abort before deletion if snapshot reads fail.
- [x] Roll back earlier deletions when a later scoped-key removal fails; never report a partial reset as success.
- [x] Verify snapshot restoration from final memory and durable values.
- [x] Failure-injection tests for partial deletion rollback and unreadable-snapshot preflight (PR #24; exact-head Quality Gate run 42232090692 passed).
- [x] Post-merge main Quality Gate run 42232397539 (#885) passed on exact SHA `753dbf7d95f6f577f022952f122280de69d8e074`.
- [ ] Complete the remaining mutation-path and cross-tab/outbox audit.


## Legacy account-import rollback — verified in PR #26
- [x] Capture a directly readable snapshot of all legacy sources, scoped destinations, and the ownership marker before first-account import.
- [x] Abort before mutation when any required durable snapshot read is unavailable.
- [x] Reject conflicting scoped destination data before changing either storage scope.
- [x] Roll back copied destinations and previously removed legacy sources when a later source removal fails.
- [x] Keep the account scope inactive unless migration and ownership-marker persistence are verified.
- [x] Failure-injection tests and exact-head Quality Gate runs `42235874739` / `42235863281` passed on PR head `24682b573b31240d23950ed7e92ddea69947ce24` (334 automated assertions, 10 Firestore rules tests, TypeScript, production build, server smoke).
- [x] Post-merge main Quality Gate run `42236088244` passed on `e355acffc376b0af355e95926e6315dbf8083951`.
- [ ] Continue auditing remaining multi-key mutation paths, including canonical archive/schema-version/legacy projection writes.


## Canonical portion transaction — verified in PR #28
- [x] Capture directly readable snapshots of canonical portions, schema version, legacy portions, and legacy revision before mutation.
- [x] Verify canonical archive write/read-back before advancing schema version.
- [x] Verify schema-version and both legacy compatibility projection writes.
- [x] Roll back all four keys when schema-version commit fails.
- [x] Roll back all four keys when a legacy revision projection write applies and then throws.
- [x] Exact-head Quality Gate runs `42236675217` / `42236639584` passed on PR head `bb5a5224671fc3d1ef83b619b01556f8c6c39c01` (336 automated assertions, 10 Firestore rules tests, TypeScript, production build, server smoke).
- [x] Post-merge main Quality Gate run `42236977371` passed on exact SHA `f739b64aae61398c51769340f0e4182d51624fca`.
- [ ] Continue the remaining multi-key mutation and outbox cross-tab audit.


## IndexedDB event journal and outbox foundation — PR #30
- [x] Append-only event and outbox delivery records share one IndexedDB read/write transaction.
- [x] Cross-tab duplicate enqueue is idempotent; changed-content mutation ID collisions are rejected.
- [x] Transaction abort leaves no partial event/outbox pair.
- [x] Acknowledgement and retry metadata are separated from immutable event history.
- [x] Exact-head Quality Gate passed on PR SHA `9bc4945d92737df086396f436b2388a92972bf92` (344 automated assertions, 10 Firestore rules tests, TypeScript, production build, server smoke).
- [x] Post-merge main Quality Gate run `42238366343` passed.

## Legacy outbox migration — PR #31
- [x] Import pending records, retry metadata, device identity, acknowledgements, and known fingerprints atomically.
- [x] Detect conflicts and abort the complete migration without partial writes.
- [x] Retain localStorage source as a recovery copy; merge changed snapshots idempotently.
- [x] Exact-head Quality Gate passed on PR SHA `2f6e82213188110c9ae69cf057c376b1eb40051d` (349 automated assertions, 10 Firestore rules tests, TypeScript, production build, server smoke).
- [x] Post-merge main Quality Gate run `42239494829` passed.

## Async IndexedDB outbox adapter — PR #32
- [x] Replace synchronous localStorage outbox facade with async IndexedDB operations.
- [x] Import legacy data before each facade operation and retain source as a recovery copy.
- [x] Verify UID isolation, retry/acknowledgement, stale-tab merges, and invalid-input rejection.
- [x] Exact-head Quality Gate passed on PR SHA `d97d8cf10cd076a726dbf377c8a4078b8c2dec2c` (346 automated assertions, 10 Firestore rules tests, TypeScript, production build, server smoke).
- [x] Post-merge main Quality Gate run `42240305979` passed on exact SHA `f3a207844020494ebf6a350ae9cb27d6db62398e`.
- [ ] Connect domain mutation call sites and implement deterministic local projection replay.
- [ ] Implement Firestore sync worker and two-device/offline integration tests.


## Monotonic journal sequencing and projection cursor — PR #34
- [x] Upgrade IndexedDB schema v1→v2 and deterministically backfill existing events.
- [x] Allocate per-UID event sequences atomically with event/outbox writes.
- [x] Add bounded replay-page, projection-cursor read, and contiguous-only cursor advancement APIs.
- [x] Exact-head Quality Gate passed on PR SHA `148e7b27873219f552edee41b819f7b08949e7a5` (348 automated assertions, 10 Firestore rules tests, dependency audit, TypeScript, production build, server smoke).
- [x] Post-merge main Quality Gate run `42241532674` passed on exact SHA `bfff3969d510c49da6d0224a375b87ca2959c651`.
- [ ] Implement deterministic local projection replay before app state initialization.
- [ ] Connect domain mutation call sites and Firestore sync worker.
