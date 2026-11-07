# WIRD — Remediation Roadmap and Execution Plan

**Planning baseline:** main @ 6228150c2f7137678ba1079f5d9b2e8aba527523  
**Audit branch:** chore/full-repository-audit-20261107  
**Status:** Provisional sequencing based on the reviewed findings. Final audit closure requires visual inspection of the three PNG icons and updating the review counter.

## Guiding rules

1. Protect Quran text and user progress above feature velocity.
2. Never claim cloud sync until remote push, pull, cursor, CAS, conflict and two-device gates pass.
3. Keep main unchanged during fixes; use a fresh branch per independent milestone.
4. Do not merge PR #59/#60 or any stale branch wholesale. Port only reviewed patches.
5. No production Firestore rules deployment, Vercel project-setting changes, destructive migration, or production data write without explicit user approval.
6. Every mutation fix needs a regression test, full Quality Gate, exact SHA and checkpoint update.
7. Keep user-facing status truthful: local-only, queued/uploading, partially synced, fully synced only when proven.

## Phase 0 — Close the audit (before source remediation)

**Scope**
- Visually inspect public/apple-touch-icon.png, public/icon-192.png and public/icon-512.png.
- Reconcile current-main architecture report with exact source and CI.
- Append a 2026-11-07 entry to WORK_LOG; do not rewrite historical entries.
- Mark stale AI Studio/engineering checkpoints as historical and point them to the new canonical audit/resume document.
- Verify branch matrix row count is 70 and file register row count is 147.
- Record audit branch head SHA and CI status.

**Acceptance**
- All 147 files have a per-file note and explicit status.
- All 70 branches have a comparison and disposition.
- Architecture report, blocker report and roadmap agree on exact baseline and CI.
- No application source or production setting changed during audit.

## Phase 1 — Fix local data-integrity defects

Create branch: chore or fix branch based on current main; one issue group per PR.

### 1A. Journal every backup import path
- Replace ProgressAnalyticsView's direct StorageService.importBackup with importBackupJournaled.
- Ensure guest mode remains rollback-safe local-only.
- Search every backup/import/reset entrypoint and route authenticated writes through the journal boundary.
- Add UI-path tests for Settings and Progress Analytics.
- Verify pending journal replay before import, restart, backup round-trip and failed-import rollback.

### 1B. Preserve all plan task history
- Refactor PlanLifecycle.resumePlan and recalculatePlan to retain every completed memorization/revision task and partial day by stable identity.
- Reschedule only future incomplete work.
- Add tests for memorization, minor revision, major revision, revision-only days, partial days, repeated pause/resume and recalculation.
- Do not silently delete old schedule records.

### 1C. Fix QuranLibrary repeat loop
- Replace stale React state closure with a ref or equivalent stable counter.
- Ensure target count is exact and stop/unmount/navigation clears playback callbacks.
- Add fake Audio regression tests for targets 1, 2, 5, 10 and target changes.

### 1D. Harden Quran coordinates
- Add safe integer and Surah-specific validation to QuranMath public functions.
- Ensure invalid ranges reject rather than silently clamp, except explicit UI clamping functions.
- Validate domain event payloads against canonical Surah verse counts.
- Add property/boundary tests for Surah 1/114, ayah 1/last, invalid Surah and fractional/NaN/infinite input.

**Acceptance for Phase 1**
- Full npm test, npm run lint, npm run build, Firestore Rules Emulator and server smoke all pass.
- No progress/history is lost in backup, plan lifecycle or session flows.
- No duplicate or infinite audio playback.

## Phase 2 — Fix Tafsir end-to-end

Create fresh branch from latest main; port PR #60's useful changes only.

- Add response Content-Type and body-shape validation before JSON parsing.
- Detect HTML SPA/error responses and return an actionable Arabic error.
- Preserve abort/timeout handling and source/book validation.
- Verify Vercel function routing and Express dev route precedence.
- Add tests for HTML, malformed JSON, empty response, wrong content type, 404, 429, 5xx, timeout, abort and valid Tafsir.
- Do not change Quran text or substitute invented Tafsir.

**Acceptance**
- All targeted Tafsir tests pass.
- Full Quality Gate passes.
- A real hosted endpoint check confirms JSON response once deployment is available.
- Do not claim deployed fix before exact production deployment is verified.

## Phase 3 — Secure and correct the AI Advisor

- Decide the explicit guest/auth policy.
- Verify Firebase ID token for authenticated requests; reject invalid/expired tokens.
- If guests are allowed, apply separate distributed abuse/quota controls.
- Replace per-instance-only rate limiting with a globally reliable mechanism compatible with the free-tier constraint; if no safe free mechanism exists, disable public Gemini POST and keep deterministic fallback.
- Validate numeric inputs and bound every prompt/context field.
- Derive unique memorized ayah count without overlap double-counting.
- Separate retention score from weekly completion rate.
- Calculate best day from real logs or remove it.
- Implement bounded conversation history or clearly label the Advisor as stateless.
- Add request timeouts, error handling and monitoring.
- Review religious advice/method claims with sources and a qualified reviewer.

**Acceptance**
- Security tests prove auth/quota policy.
- No client key leakage.
- Metric tests prove correct unique counts.
- AI fallback works offline and without a key.
- No fabricated statistics or unsupported religious claims.

## Phase 4 — Make cloud status truthful, then implement real synchronization

### 4A. Immediate truthfulness gate
- Port PR #59 retry/idempotency improvements selectively.
- Ensure state is partial/upload-only until remote import is implemented.
- Remove any UI text that implies cross-device sync is complete.
- Confirm guest/unverified users remain local-only.
- No remote projection.

### 4B. Remote sync design
- Define server-owned per-user monotonic revision and transaction/CAS protocol.
- Separate local outbox from remote inbox.
- Validate event type and payload schema per domain event.
- Immutable remote event documents; idempotent retry with content verification.
- Bounded push and incremental pull with durable remote cursor.
- Remote events enter local journal only after validation; projection cursor advances only after durable apply.
- Conflict rules are domain-specific and conservative; preserve conflicts for user resolution rather than overwriting a weaker memorization status.
- Tombstones prevent stale-device resurrection.
- Quran text is never synced as user data.

### 4C. Two-device integration
- Firestore Emulator two-client tests.
- Two browser profiles/devices with same UID.
- Two accounts on one browser/device.
- Offline mutation, reload, reconnect, duplicate retry, stale snapshots, conflicting review ratings, deletion and restore.
- Measure bounded read/write usage and stay within Firebase Spark limits.

**Acceptance**
- No lost mutation across any order of reconnect.
- Outbox acknowledges only after verified remote write.
- Remote cursor cannot skip failed events.
- Same mutation retry is idempotent; changed-content ID collision is rejected.
- Account data never crosses UID boundary.
- Only after all gates pass may UI display fully synced.

## Phase 5 — PWA, mobile, accessibility and performance

- Wait for controllerchange before reload after SKIP_WAITING.
- Add root ErrorBoundary with safe recovery/export path.
- Clean timers/listeners and clipboard failures in AuthScreen.
- Validate route coordinates and prevent empty/invalid sessions.
- Test tablet landscape, small mobile, iOS Safari, Android Chrome, keyboard, screen reader, RTL, contrast and reduced motion.
- Profile Vite chunks and lazy loading; split heavy routes/data only with measured benefit.
- Verify offline shell, cache upgrade, stale chunk recovery, quota and audio cache behavior.
- Keep audio rights/attribution clear.

## Phase 6 — Scholarly content and release readiness

- Review Mutashabihat entries and explanations with a qualified Quran teacher.
- Add source/provenance for religious method claims and quotations.
- Verify EveryAyah reciter rights; no bundling/mirroring without permission.
- Verify Tanzil attribution and exact canonical dataset checksum.
- Update one authoritative status/resume doc and archive stale checkpoints.
- Confirm Vercel production deployment for exact main SHA.
- Confirm Firebase rules target/project and production deployment only after approval.
- Perform backup/restore rehearsal and data-loss rollback test.
- Prepare user-facing release notes with only verified capabilities.

## Branch and PR strategy

- Audit branch remains documentation-only.
- Fix branch names should be short and scoped: fix/progress-import-journal, fix/plan-lifecycle-history, fix/quran-audio-repeat, fix/tafsir-html-response, fix/advisor-auth-quota, feat/firestore-remote-inbox.
- One PR per cohesive fix, exact base SHA recorded.
- Do not delete the four archive candidates until the repository owner chooses a branch cleanup window; connected GitHub operations currently do not expose safe branch deletion.
- Keep all 65 diverged branches until their unique commits have been reviewed and ported or explicitly abandoned.
- Close stale PRs only after preserving unique patches and recording the reason.

## Suggested execution order

1. Phase 0 audit closure.
2. Phase 1A backup import journal.
3. Phase 1B plan lifecycle history.
4. Phase 1C audio repeat.
5. Phase 1D coordinate/domain validation.
6. Phase 2 Tafsir.
7. Phase 3 Advisor security/data correctness.
8. Phase 4A truthful sync status.
9. Phase 4B/4C real sync.
10. Phase 5 PWA/mobile/performance.
11. Phase 6 content and release.

This order fixes local data loss before touching cloud replication, then closes security and user-facing errors before public rollout.

## Execution status update — 2026-11-07

Phase 0 — **COMPLETE**. All 147 baseline files have per-file notes; all 70 baseline branches were compared; three PWA icons were visually inspected; the remote replication design gate was added at docs/sync/REMOTE_REPLICATION_PLAN.md because AGENTS.md referenced a missing file.

Phase 1:
- 1A Backup import journal boundary — implemented on PR #61 (Draft, not merged). Exact-head Quality Gate run 42340818280 PASS: 404 passed / 0 failed; Firestore Rules 13/13; TypeScript/build/smoke pass. Vercel Preview Ready.
- 1B Plan lifecycle/history — implemented on PR #62 (Draft, not merged). Latest exact-head Quality Gate run 42342109962 PASS: 407 passed / 0 failed; Firestore Rules 13/13; TypeScript/build/smoke pass. Vercel Preview failed due Vercel daily build-rate limit.
- 1C QuranLibrary repeat controller — implemented on PR #63 (Draft, not merged). Exact-head Quality Gate run 42341365536 PASS: 404 passed / 0 failed; Firestore Rules 13/13; TypeScript/build/smoke pass. Vercel Preview failed due Vercel daily build-rate limit.
- 1D QuranMath/domain event validation — implemented on PR #65 (Draft, not merged). Exact-head run 42342171626 PASS: 417 passed / 0 failed; Firestore Rules 13/13; TypeScript/build and production/development server smoke pass.

Phase 2 Tafsir:
- HTML/non-JSON handling and regression tests implemented on PR #64 (Draft, not merged). Exact-head Quality Gate run 42341419175 PASS: 405 passed / 0 failed; Vercel Preview is blocked by the daily build-rate limit.

Main remains unchanged at 6228150c2f7137678ba1079f5d9b2e8aba527523. None of these PRs has been merged. Vercel daily build-rate limit is an external deployment gate; it does not invalidate the green GitHub Quality Gate, but production/preview behavior is not confirmed for PRs #62–#64.

## Execution checkpoint — 2026-11-07 (after PR #65)

Current live branch count: **76**. Original baseline: 70 branches / 147 files. Main remains at 6228150c2f7137678ba1079f5d9b2e8aba527523.

| PR | Scope | Exact-head Quality Gate | Vercel Preview |
|---|---|---|---|
| #61 | Journal-first backup import | PASS — 404 passed / 0 failed | Ready |
| #62 | Plan task/revision history and gap preservation; invalid legacy schedule guard | PASS — 407 passed / 0 failed | Daily build-rate limit |
| #63 | Quran ayah repeat controller and correct pause/resume | PASS — 404 passed / 0 failed | Daily build-rate limit |
| #64 | Tafsir HTML/malformed JSON handling | PASS — 405 passed / 0 failed | Daily build-rate limit |
| #65 | Quran coordinate/domain-event validation and plan input guards | PASS — 417 passed / 0 failed | Ready |

All five PRs remain Draft and unmerged. Each exact-head CI also passed Firestore Rules Emulator 13/13, dependency audit, TypeScript, production build and server smoke. No production deploy or Firestore rule deployment has occurred.

PR #65 fixed a target-date planning bug exposed by its new regression test: a block-scoped activeDays variable shadowed the validated active-day array. The latest exact-head suite passes.


## Live execution checkpoint — 2026-11-07 (post PR #66)

Current live branch count: **77** (70 original baseline + audit/remediation branches). Main remains unchanged at `6228150c2f7137678ba1079f5d9b2e8aba527523`.

| PR | Scope | Exact-head Quality Gate | Status |
|---|---|---|---|
| #61 | Journal-first backup import | 42340818280 PASS | Draft, unmerged |
| #62 | Preserve completed/partial revision task history and recalculate uncovered gaps | 42342109962 PASS — 407/0 | Draft, unmerged |
| #63 | Quran audio repeat controller | 42341365536 PASS | Draft, unmerged |
| #64 | Tafsir HTML and malformed JSON handling | 42341470582 PASS | Draft, unmerged |
| #65 | QuranMath/domain-event coordinate validation; PlanningEngine guards | 42342171626 PASS — 417/0 | Draft, unmerged |
| #66 | Prevent false fully-synced UI state; add partial status | 42342306759 PASS | Draft, unmerged |

PR #66 is a safety correction only. It does not implement remote replication. It ensures a zero local outbox count cannot be presented as full sync while remote events are only queried and discarded.

### Current release gates
- Main is unchanged; no PR has been merged.
- PR #61 Vercel Preview Ready. PRs #62–#64 had Vercel daily build-rate limits. PR #65 Preview Ready. PR #66 has no production deployment.
- Remote inbox, durable remote fetch cursor, server-owned monotonic revision/CAS, remote projector, conflict resolution and two-client integration tests remain NOT IMPLEMENTED.
- Do not label cloud sync complete. Keep user-facing state partial until the complete remote replication protocol passes.
