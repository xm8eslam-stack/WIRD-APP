> **Historical roadmap — updated 2026-11-11:** The active product roadmap is now [`docs/DEVELOPMENT_ROADMAP.md`](../../DEVELOPMENT_ROADMAP.md); current execution queue: [`docs/CONTINUE_HERE.md`](../../CONTINUE_HERE.md). This file remains as historical engineering planning (M0–M7); its dates, SHAs, and statuses are not authoritative today.

---

# WIRD — Master Engineering Roadmap

**Updated:** 2026-11-06 after PR #57 merge and PR #58 scope-isolation hardening  
**Source of truth:** `main`; Google AI Studio is connected to `main`.  
**Latest main SHA:** `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`.  
**Post-merge main Quality Gates:** PR #52 run `42277666291`, PR #53 run `42278457062`, PR #54 run `42280564932`, and PR #55 run `42282206155` passed. PR #55 exact-head runs `42281993489` and `42281999065` passed before merge.  
**Owner instruction:** Vercel build-rate-limit does not block merging tested changes; production deployment must still be verified separately.

Status vocabulary: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `REVIEWED`, `VERIFIED`, `COMMITTED`, `COMPLETED`. Use `COMPLETED` only when independent review, relevant tests, commit verification, and CI evidence all exist.

| Phase | Scope | Status | Evidence / remaining gate |
|---|---|---|---|
| 0 | Repository baseline, branch audit, architecture map | VERIFIED | Main inspected; branch divergence recorded; continue file-by-file audit |
| 1 | Local storage, backup, and portion merge integrity | COMPLETED | PR #4–#9 baseline plus PR #52 journal-ordered backup import/reset; exact-head CI passed |
| 2 | Memorization/revision correctness | IN PROGRESS | PR #50/#51 group session progress, activity, streak, and matching smart-plan task. PR #55 closed the development demo direct-write path and PR #57 moved legacy portions migration behind the journal; PR #58 hardens account-scope isolation before continuing the remaining legacy outbox failure/recovery audit |
| 3 | Local outbox foundation and identity | IMPLEMENTED / partial | PR #6 now fingerprints acknowledged mutations, validates pending/acknowledged uniqueness and disjointness, binds pending records to device identity, and prevents retry overflow. Still localStorage-backed (not cross-tab transactional), not wired to domain writes, and no cloud sync is active |
| 4 | Local event ledger + atomic mutation boundary | IN PROGRESS | PR #54 merged typed immutable domain-event metadata; deterministic aggregate derivation and remote event documents remain open |
| 5 | Firestore adapter and deterministic merge | NOT STARTED | No Firestore client, repository, sync coordinator, or merge engine |
| 6 | Firestore rules hardening and emulator integration | IN PROGRESS | UID/verified-user/allowlist/generic envelope exists; per-collection schemas, immutable event create-only rules, two-client tests remain |
| 7 | Controlled cloud rollout | BLOCKED pending approval | Requires backup, reviewed rules, explicit approval, two-device/two-account tests |
| 8 | Premium UX redesign | NOT STARTED on canonical main | Phase 5 branch is highly divergent; selectively inspect components only after core reliability |
| 9 | Complete Mushaf reader, tafsir, audio, repeat | PARTIAL / VERIFY | Quran chunks and tafsir integration exist; verify full Mushaf navigation, complete source integrity, audio controls, bookmarks, repeat |
| 10 | Unified reading/audio preferences | NOT STARTED / VERIFY | Central preference engine and cross-view synchronization require audit |
| 11 | Performance, PWA, accessibility, responsive QA | IN PROGRESS | Existing PWA and mobile work; complete browser/device/accessibility coverage |
| 12 | Release readiness | BLOCKED | Vercel production status affected by free deployment rate limit; Firebase rules/sync not deployed |

## M4 detailed sequence

1. Phase 1 is complete: PR #9 audited deterministic portion merge, distinct review-history preservation, conflict-audit union, status/strength consistency, and strict Quran range/scheduling boundaries. Do not repeat this work.
2. PR #10 and #11 mutation/queue/metrics slices are merged and CI-verified. Keep Phase 2 IN PROGRESS until multi-key rollback and remaining mutation paths pass failure-injection tests.
3. Outbox idempotency, acknowledged-ID semantics, state validation, device identity, retry bounds, and regression coverage are implemented in PR #6; do not repeat this milestone.
4. Compare Dexie, idb, and native IndexedDB for transaction semantics, licensing, compatibility, bundle cost, and migration impact; do not add a dependency until a representative prototype proves the benefit.
5. Define append-only event schemas for activity, revision attempts, weak-verse mistakes, and tests.
6. Implement transaction/journal semantics for domain event + outbox mutation.
7. Derive daily logs, streaks, and weak-verse counts from deduplicated events.
8. Preserve existing localStorage records; migration must be idempotent, non-destructive, and exportable.
9. Test crash/reload, quota, blocked IndexedDB, account switching, duplicate retries, and partial migration.
10. Run full CI and a separate code review before integration to main.

## M5–M7 cloud sequence

- Firestore adapter using per-user per-record documents.
- Memory cache initially; do not enable persistent web cache by default on shared browsers.
- Deterministic merge functions for portions, plans, and immutable events.
- Server timestamps and bounded incremental pull/push.
- Never acknowledge outbox records before remote confirmation.
- Collection-specific rules schemas, event create-only, tombstone-only deletes, payload limits, default deny.
- Two-client emulator tests and account isolation.
- Production rules deployment and sync activation only after explicit user approval.

## Product scope after data reliability

- Complete Qur’an reader with stable navigation, page/surah/juz/hizb/ayah index, bookmarks, reading position.
- Verified Qur’an text remains static bundled data; AI must never generate or rewrite it.
- Tafsir from identified trusted sources with attribution and no invented fallback.
- Audio playback with reciter selection, current-ayah tracking, repeat modes, playback-rate support only where the source/browser supports it.
- One central audio/reading preferences model.
- Integration with memorization, revision, daily wird, analytics, and AI assistant without counting listening as memorization.
- Premium RTL design, responsive behavior, accessibility, and offline reliability.

## Non-negotiable release rules

- No destructive migration without backup and explicit approval.
- No production Firestore rules deployment without explicit approval.
- No claiming cloud sync until M4–M7 acceptance tests pass.
- No Quran text mutation or AI-generated Quran text.
- No force-push to main; verify every commit SHA and CI result.
