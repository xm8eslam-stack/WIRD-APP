# WIRD — Master Engineering Roadmap

**Updated:** 2026-11-06  
**Source of truth:** `main`; Google AI Studio is connected to `main`.

Status vocabulary: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `REVIEWED`, `VERIFIED`, `COMMITTED`, `COMPLETED`. Use `COMPLETED` only when independent review, relevant tests, commit verification, and CI evidence all exist.

| Phase | Scope | Status | Evidence / remaining gate |
|---|---|---|---|
| 0 | Repository baseline, branch audit, architecture map | VERIFIED | Main inspected; branch divergence recorded; continue file-by-file audit |
| 1 | Local storage and backup integrity | VERIFIED with ongoing audit | Archive validation, corruption preservation, backup rollback tests; audit all remaining call sites |
| 2 | Memorization/revision correctness | VERIFIED for known fixes | Session/review isolation, coordinate validation, rollback; continue edge-case audit |
| 3 | Local outbox foundation and identity | IMPLEMENTED / partial | UID-scoped outbox and UUIDs exist; not wired to domain writes |
| 4 | Local event ledger + atomic mutation boundary | IN PROGRESS | Next priority: immutable activity/weak-verse/review events and durable outbox in one recoverable transaction |
| 5 | Firestore adapter and deterministic merge | NOT STARTED | No Firestore client, repository, sync coordinator, or merge engine |
| 6 | Firestore rules hardening and emulator integration | IN PROGRESS | UID/verified-user/allowlist/generic envelope exists; per-collection schemas, immutable event create-only rules, two-client tests remain |
| 7 | Controlled cloud rollout | BLOCKED pending approval | Requires backup, reviewed rules, explicit approval, two-device/two-account tests |
| 8 | Premium UX redesign | NOT STARTED on canonical main | Phase 5 branch is highly divergent; selectively inspect components only after core reliability |
| 9 | Complete Mushaf reader, tafsir, audio, repeat | PARTIAL / VERIFY | Quran chunks and tafsir integration exist; verify full Mushaf navigation, complete source integrity, audio controls, bookmarks, repeat |
| 10 | Unified reading/audio preferences | NOT STARTED / VERIFY | Central preference engine and cross-view synchronization require audit |
| 11 | Performance, PWA, accessibility, responsive QA | IN PROGRESS | Existing PWA and mobile work; complete browser/device/accessibility coverage |
| 12 | Release readiness | BLOCKED | Vercel production status affected by free deployment rate limit; Firebase rules/sync not deployed |

## M4 detailed sequence

1. Complete file-by-file audit of mutation boundaries and all call sites.
2. Harden outbox idempotency, acknowledged-ID semantics, and validation.
3. Select transactional IndexedDB wrapper only after comparing real package APIs, licensing, compatibility, bundle cost, and migration impact.
4. Define append-only event schemas for activity, revision attempts, weak-verse mistakes, and tests.
5. Implement transaction/journal semantics for domain event + outbox mutation.
6. Derive daily logs, streaks, and weak-verse counts from deduplicated events.
7. Preserve existing localStorage records; migration must be idempotent, non-destructive, and exportable.
8. Test crash/reload, quota, blocked IndexedDB, account switching, duplicate retries, and partial migration.
9. Run full CI and a separate code review before integration to main.

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
