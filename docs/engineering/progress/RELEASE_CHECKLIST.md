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
- [ ] Independently review all Phase 2 mutation paths and confirm rollback/aggregate semantics before merging to main.
- [ ] Append-only local activity/revision/weak-verse/test event ledger.
- [ ] Event + outbox transaction/journal and deterministic replay.
- [ ] Crash/reload recovery and quota/blocked-storage tests.
- [ ] Cross-tab atomic event+outbox writes; current localStorage outbox is not cross-tab transactional and must remain disconnected from cloud sync.
- [ ] Idempotent, non-destructive migration with export/restore.

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
