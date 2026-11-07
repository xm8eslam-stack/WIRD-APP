# WIRD — Release Readiness and Blocker Report

**Baseline:** main @ 6228150c2f7137678ba1079f5d9b2e8aba527523  
**Exact main CI:** PASS — run 42295376778  
**Current verdict:** NOT READY for a public release that promises complete cloud sync and every listed feature. Core local-first app has a green CI gate, but the blockers below must be addressed and verified. This is not a statement that every local feature is broken.

## Readiness summary

| Area | Status | Evidence |
|---|---|---|
| Main branch automated Quality Gate | PASS | 402 automated checks, 0 failed; 13 Firestore Rules Emulator tests, 0 failed; TS/build/smoke pass |
| Quran text and metadata | PASS at audited baseline | 6,236/6,236 independent Tanzil text+metadata matches; zero mismatches |
| Local storage and journal foundation | PARTIAL / strong base | IndexedDB v3, atomic event/outbox, UID isolation, local replay, failure-injection tests |
| Backup import/export | BLOCKED by inconsistent UI entrypoint | Settings uses journaled import; Progress Analytics still uses synchronous StorageService.importBackup |
| Memorization/revision plans | BLOCKED by lifecycle history loss | Resume/recalculate only preserve memorization task state; revision-only task history can be dropped |
| Mushaf/audio | PARTIAL | Exact page index and reciters exist; multi-repeat audio closure bug |
| Tafsir | NOT READY | Main client parses JSON without checking content type; PR #60 fix is unmerged and CI-red |
| AI Advisor | NOT READY for public quota-backed use | No Firebase token verification; in-memory per-instance limiter; inaccurate metrics and stateless chat |
| Cloud sync | NOT READY | No complete remote import/projection, remote cursor, CAS, conflict convergence or two-device proof |
| Firestore rules | FOUNDATION ONLY | UID/verified gate and immutable event path exist; payload/event semantics and server revision rules incomplete |
| PWA/accessibility | PARTIAL | Manifest/SW and static checks exist; update race and no real-device QA |
| Production deployment | NOT VERIFIED | CI is green; no exact-main production deployment confirmation in this audit |

## P0 — Do not advertise as complete / do not enable

### P0.1 Cloud sync is not true two-way synchronization

**Evidence**
- Main has a CloudSyncCoordinator and reads bounded remote events.
- Remote events are not imported into IndexedDB and applied to local projections.
- No durable remote cursor/inbox and no server-owned monotonic revision/CAS.
- CloudSyncCoordinator tests only cover initial state, guest rejection, subscribers and pending count.
- PR #59 improves retry/idempotency/status but is Draft, diverged and explicitly does not implement full remote import/reconciliation.

**Impact**
Users may believe another device has all progress when it does not. A status badge that says synced can be misleading. Enabling unsafe two-device writes risks lost updates or stale overwrite.

**Required fix**
Implement separate local outbox and remote inbox, immutable event verification, server-owned revision/CAS, bounded incremental pull, durable cursor, deterministic domain merge, tombstones and conflict deferral. Until then, display PARTIAL / upload-only / unavailable accurately and keep remote projection disabled.

**Acceptance**
Two browser profiles on two devices, offline writes on both, reconnect in both orders, duplicate retry, stale snapshot, deletion/tombstone, account switching, and no lost progress; all tests pass against Firestore Emulator.

### P0.2 Advisor endpoint can be used without authenticated quota ownership

**Evidence**
- api/advisor.ts accepts Gemini-consuming POST requests without verifying Firebase ID tokens.
- Wildcard CORS is not authentication.
- Rate limiter is in-memory per serverless instance, not globally authoritative.
- geminiSecurity.test.ts checks for a rate limiter but does not assert authenticated access; it explicitly treats wildcard CORS as acceptable.

**Impact**
An anonymous caller can consume the project's Gemini quota or abuse the endpoint. The local deterministic fallback does not require this endpoint.

**Required fix**
Choose an explicit policy for guests and authenticated users; verify Firebase ID tokens for account-specific usage, enforce distributed/global quota and request limits, add abuse monitoring, and keep Gemini key server-only. If guest access remains public, apply a separate robust quota/abuse boundary.

**Acceptance**
Unauthenticated POST rejected or explicitly quota-limited; invalid/expired token rejected; verified user accepted; quota enforced across independent serverless instances; key never appears in client bundle.

## P1 — Fix before inviting general users

### P1.1 Backup import bypasses the journal in Progress Analytics

**Evidence**
- SettingsView calls importBackupJournaled from backupPersistence.ts.
- ProgressAnalyticsView calls synchronous StorageService.importBackup(content) directly.
- Authenticated import through Progress Analytics therefore bypasses the write-ahead event/outbox and replay cursor.

**Impact**
Imported state can differ from the journal/outbox state. A later replay or cloud upload may overwrite or fail to represent the imported snapshot.

**Fix**
Route every authenticated backup import entrypoint through importBackupJournaled; keep guest path rollback-safe local-only. Audit all import/reset call sites.

**Acceptance**
Tests prove both UI entrypoints use the same journaled import boundary; restart/replay and export round-trip preserve imported data; failure leaves previous data and journal intact.

### P1.2 Plan resume/recalculation can drop revision task history

**Evidence**
- planLifecycle.ts rebuilds retained completed tasks from days with completed memorizationTask.
- Pending reconstruction also filters by memorizationTask.
- Completed revision-only tasks, minor/major revision history and some partial days are not preserved.
- planningEngine.test.ts only checks a completed memorization task survives resume; no revision-only regression exists.

**Impact**
A user can lose recorded revision tasks when pausing/resuming or recalculating a plan.

**Fix**
Preserve every completed task/day by stable ID and date, retain completed revision tasks, and reschedule only future uncompleted tasks. Add explicit migration-safe behavior for partial days.

**Acceptance**
Tests cover completed memorization, completed minor revision, completed major revision, revision-only day, partially completed day, pause/resume, recalculation and repeated calls without duplicate/lost history.

### P1.3 Quran Library multi-repeat can run indefinitely

**Evidence**
QuranLibraryView assigns audio.onended a callback that closes over currentRepeatCount. Replaying the same Audio instance reuses that closure after React state changes.

**Impact**
Repeat targets greater than one can become unbounded/infinite.

**Fix**
Use a ref or stable callback reading the latest counter; stop at exact target; reset safely when Surah/ayah/target changes.

**Acceptance**
Fake Audio test for target 1, 2, 5 and 10; exact number of plays; no replay after stop/unmount/navigation.

### P1.4 Tafsir HTML response still breaks JSON parsing on main

**Evidence**
- src/services/tafsirService.ts calls response.json() directly.
- api/tafsir.ts catches upstream parse failures but does not prevent a hosting/SPA route from returning HTML.
- User-observed error: Unexpected token '<', <!doctype...
- PR #60 contains response-type guards and regression tests, but is Draft, 12 commits ahead/2 behind, and its exact-head CI fails.

**Fix**
Port PR #60's useful client/server guards to a fresh branch from current main. Verify API route precedence and actual response Content-Type; return a structured JSON error for HTML/non-JSON responses. Do not merge stale PR #60 wholesale.

**Acceptance**
Client tests for HTML 404/SPA fallback, empty body, malformed JSON, wrong content type, 429, 5xx, timeout, abort and valid Tafsir; smoke test actual Vercel function route when deployment is available.

### P1.5 Firestore rules do not enforce server-owned revisions or event semantics

**Evidence**
- Generic envelope accepts client-supplied updatedAtMs.
- Event validator checks shape/type length but not supported eventType allowlist or event-specific payload.
- No server-owned monotonic revision or compare-and-set.
- The blueprint describes stronger semantics than the rules enforce.

**Impact**
A verified client can submit structurally valid but semantically unsupported events or stale client timestamps. Rules alone cannot prevent lost updates.

**Fix**
Use server-controlled revision metadata/transactions, strict per-event schemas and collection payload limits; enforce create-only events and exact tombstone semantics. Keep remote projection disabled until verified.

**Acceptance**
Positive/negative emulator tests for every collection/event type, spoofed UID, invalid coordinate, unsupported event, stale revision, changed immutable event and oversized payload.

### P1.6 AI Advisor sends incorrect metrics and ignores chat history

**Evidence**
- AdvisorService sums portion lengths without deduplicating overlapping ayahs.
- It sends weekly completionRate under a retentionScore label.
- DeterministicAdvisorEngine hardcodes bestDay as Sunday/Tuesday.
- Both server handlers ignore chat history although the client sends it.
- Several religious methodology claims have no source metadata.

**Impact**
AI recommendations can be based on false progress metrics, and the UI implies context-aware conversation that does not exist.

**Fix**
Use unique-ayah/retention calculations; separate completion rate from retention score; calculate best day from real logs or omit; implement bounded, validated chat history or label the chat as stateless; cite and review religious content.

**Acceptance**
Unit tests with overlapping portions and varied log dates; no hardcoded best day; multi-turn chat test proves prior context is used or explicitly not promised; reviewed scholarly sources.

### P1.7 Web Locks support is a compatibility gate

**Evidence**
Journal projection and journaled writers fail closed without Web Locks.

**Impact**
Older/unsupported browsers may be unable to replay pending journal data or save authenticated changes.

**Fix**
Publish supported browser matrix and test iOS Safari, Android Chrome and desktop browsers. If needed, implement an IndexedDB-transaction-backed cross-tab lock; never fall back to an unsafe in-memory lock for multi-tab writes.

**Acceptance**
Same journal tests pass across supported browser engines, including concurrent tabs and account switching.

## P2 — Reliability, UX, performance and maintainability

1. quranMath.ts: reject fractional/non-integer coordinates and invalid Surah values in every public operation; avoid silent clamping where it hides invalid input.
2. plan wizard: selectedExistingSurahs starts with [1,78] rather than actual progress. Derive from real progress or leave empty and ask the user.
3. pageProgressService.buildPageStatusUpdate resets nextDueDate, intervalDays and repetitionCount when status changes. Decide whether manual page status intentionally resets spaced repetition; test/document it.
4. PWA update: wait for controllerchange after SKIP_WAITING before reloading.
5. Root error boundary: add safe recovery UI that preserves local data and offers export/reload.
6. Auth screen: clean resend interval on unmount and await/catch clipboard API.
7. Tafsir sanitizer: use String.fromCodePoint with bounds for numeric HTML entities above U+FFFF; fuzz nested/malformed HTML.
8. TypeScript config: strict/noImplicitAny/noUncheckedIndexedAccess are not enabled; plan staged strictness and replace any.
9. Browser tests: replace brittle source-text checks with real UI, offline, update and accessibility tests.
10. Build: profile large chunks before code splitting; do not remove Quran features/data to reduce bundle size.
11. SpacedRevisionEngine uses UTC date strings. Confirm whether it is a live path; if so migrate to local-date helper, otherwise mark deprecated/remove after call-site proof.
12. Mutashabihat and deterministic advisor religious claims need qualified content review and source citations.
13. Three PNG icons were visually inspected and appear as flat dark-teal squares with no discernible WIRD mark; replace with approved branded assets.
14. Several engineering documents are stale. Keep WORK_LOG append-only and designate one current resume/status document.
15. Verify Vercel Production deployment for exact main SHA. Green CI does not prove deployment.

## What is already verified and should not be repeated

- Main Quality Gate run 42295376778 passed exact SHA.
- Aggregate test result: 402 passed / 0 failed.
- Firestore Rules Emulator: 13 passed / 0 failed.
- Quran integrity: 6,236/6,236 independent text+metadata matches, zero mismatches.
- IndexedDB v3 local journal/outbox foundation and failure-injection tests exist.
- UID-scoped local storage and guest/account isolation exist.
- Backup validation and rollback tests are extensive.
- Do not rebuild these foundations from scratch; close the specific gaps above.

## Remediation branch status (2026-11-07)

The following fixes are implemented in separate Draft PRs but are **not merged**, so main retains the blockers until review and merge:
- PR #61: journaled backup import across Settings and Progress Analytics; exact CI PASS (404/0), Vercel Preview Ready.
- PR #62: preserve revision-only/partial task history and out-of-order memorization gaps; exact CI PASS (406/0), Vercel Preview blocked by Vercel daily build-rate limit.
- PR #63: exact ayah repeat count and live target handling; exact CI PASS (404/0), Vercel Preview blocked by Vercel daily build-rate limit.
- PR #64: Tafsir HTML/malformed JSON guards; exact CI pending/no job assigned at last check.

No PR was merged because AGENTS.md explicitly requires user approval before merge. No production Firestore or Vercel configuration was changed.

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


## Live re-check — 2026-11-07

**Confirmed P0 defect in main:** `src/services/cloudSyncCoordinator.ts` drains the local outbox, then `pullRemoteReconciliation()` merely queries up to 20 events and discards the snapshot. The caller may nevertheless set status to `synced` when local pending count reaches zero. This is not bidirectional synchronization and can mislead users. PR #59 contains a safer partial-status change, but its branch is 4 commits behind main and must not be merged wholesale. Port only reviewed changes to a fresh branch from current main.

**Remote replication remains NOT IMPLEMENTED:** no durable remote inbox, remote fetch cursor, remote event projection pipeline, monotonic server revision/CAS, or multi-client integration proof. Existing local IndexedDB journal and local projection replay do not provide remote replication.

Latest remediation status:
- #61 exact-head CI PASS.
- #62 current exact-head `48fe031d67c358e3034dd5e64134d6b46513aab4`, run 42342109962 PASS.
- #63 exact-head CI PASS.
- #64 exact-head CI PASS.
- Quran coordinate/domain-event validation working branch `fix/quran-coordinate-validation-20261107`, SHA `25d73e93e60bd6cc57102b7cfa643addbaa6ced2`; run 42342171626 still in progress at last check, with tests, rules, TypeScript and build passed, production smoke pending.
