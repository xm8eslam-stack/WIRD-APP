# WIRD — Master Project State, Engineering Audit & AI Handoff

**Snapshot date:** 2026-11-14  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Default/source branch:** `main` (Google AI Studio source)  
**Verified main SHA at audit:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`  
**Audit branch:** `docs/master-engineering-handoff-20261114`  
**Production URL:** `https://wird-app.vercel.app/`

> This is a verified continuation map, not a claim that the whole product is release-ready. It distinguishes observed repository facts from unverified runtime assumptions. Update this file whenever the actual repository state changes.

## 1. Mission and product boundary

WIRD is a focused Quran reading, listening, memorization/revision, and daily worship companion. It is not intended to become a broad Islamic portal.

Product priorities:
1. Full, continuous Mushaf reading experience; verified local Quran text; audio playback and repeat controls.
2. Reliable memorization, revision, tasmee‘, weak-ayah tracking, and flexible memorized ranges (single/multiple Surahs, Juz, and ayah ranges).
3. Trusted tafsir, Quran search, and source-transparent Seerah learning.
4. Daily adhkar and practical worship tools (prayer times, qibla, Hijri) without guilt-based gamification.
5. Offline-first behavior, local persistence, safe backup/recovery, and carefully gated optional cloud sync.
6. Calm, premium, accessible Islamic UI. WIRD should complement HUKM visually without becoming a copy.

Non-negotiable content rules:
- Never fabricate Quran, hadith, dua attribution, Seerah citations, or fiqh.
- Never render provider-authored Quran text as canonical text.
- External services may provide discovery/index coordinates only when validated; actual Quran text must come from WIRD's verified local corpus.
- No paid API dependency as a required core feature.
- Make source, edition, translation/tafsir, and license provenance explicit.
- No AI-generated scripture or AI answers presented as authoritative religious rulings.

## 2. Current repository facts (verified)

- GitHub default branch is `main`; repository is private and not archived.
- At audit time `main` points to `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`, commit message: `docs(sync): refresh Nov 11 operational audit checkpoint`.
- Recursive Git tree: 310 paths; not truncated.
- `AGENTS.md` is the canonical engineering policy. `GEMINI.md` explicitly directs Google AI Studio/Gemini to read it first.
- Google AI Studio works from `main`, not arbitrary feature branches. Do not tell the owner to paste branch-only changes into AI Studio before they exist on `main`.
- `package.json` on `main` still names the package `react-example`; PR #374 changes it to `wird-app` but is not merged.
- Main package manager is Bun 1.4.4. Main currently has `test:firestore-rules` using `npx firebase-tools`, while PR #372 changes to a single Bun-managed graph and adds Playwright to devDependencies. This is a proposal, not yet adopted on main.
- Main uses a split Quran loader: `src/data/quranDataLoader.ts` uses `import.meta.glob('./quran-surahs/*.json')` and lazily loads per-Surah JSON chunks. The loader evicts failed promises from cache so retries can work.
- Main `src/services/ruqyahContentService.ts` statically imports `VERIFIED_AYAHS` from `src/data/verifiedAyahs`. This is the precise dependency chain PR #373 is designed to remove from the Ruqyah route; verify the exact route bundle after the PR's latest head.
- Main Firebase client imports `firebase-applet-config.json`; it is live configuration, not disposable scaffolding. Main code/config canonical project ID is `wird-quran-app` and default Firestore database `(default)`. Do not replace it based on stale historical notes.
- The repository's current `AGENTS.md` has a historical “Current continuation context” referring to PR #59. This is stale relative to the active November 14 PR set and must be reconciled after verifying all sync history; do not blindly follow it.
- `docs/engineering/WORK_SESSION_CHECKPOINT.md` on main still labels a November 6 task as its latest checkpoint. Later docs and PRs contain newer state. This file needs a careful chronology refresh, not wholesale deletion.
- `docs/engineering/PROGRESS.md`, `docs/engineering/progress/CURRENT_STATUS.md`, `RESUME_HERE.md`, `MASTER_ROADMAP.md`, `WORK_LOG.md`, `docs/CONTINUE_HERE.md`, and `docs/DEVELOPMENT_CHECKPOINT.md` have overlapping historical snapshots. Keep a single canonical entry point and preserve dated evidence.

## 3. Open pull requests — observed snapshot

All listed PRs were open and Draft when fetched on 2026-11-14. None is approved for merge merely by being listed here. Re-fetch each PR head, base SHA, changed files, review comments, checks, and mergeability before acting.

| PR | Intent | Changed-file overlap / risk | Current disposition |
|---|---|---|---|
| #374 | Repository hygiene: remove one verified temporary media artifact; rename scaffold package metadata; add engineering index/audit | `package.json`, `bun.lock`, docs, one temp artifact | Keep separate and Draft until exact-head CI has observable steps and passes. No source behavior change. |
| #373 | Lazy-load Quran Surah chunks for Ruqyah; update service/UI tests | Ruqyah view/content/API services and tests | High priority. Verify no static import chain from route to full Quran corpus, then run bundle-size and behavior tests. |
| #372 | Align Bun lockfile/dependency graph and CI workflow | `.github/workflows/ci.yml`, `bun.lock`, `package.json`, Playwright config | High priority because current CI evidence is unusable. Review Node/Bun versions, actions versions, lockfile reproducibility, and workflow syntax before adoption. |
| #371 | Lossless Engine Plans archive chunk codec | Adds codec + tests; modifies `src/tests/runAllTests.ts` | Review round-trip, corruption preservation, bounded chunking, migration/rollback and compatibility before merge. |
| #370 | Collapse/expand detailed memorization session display settings | Session view/service/tests/E2E | Low-risk UX candidate, but verify accessibility and persistence semantics. |
| #369 | Multi-select memorized Surahs/Juz/ayah ranges | `PlanningEngineWizard.tsx`, `runAllTests.ts`, new selection service/tests | Important product capability. Shared-file conflict with #367; sequence/rebase, do not merge stale branch. |
| #368 | Unified offline Quran audio download jobs and verified local file library | Adds large offline cache/downloader/library services/tests; modifies `runAllTests.ts` | High value but high storage/data-loss risk. Review quota, partial downloads, cancellation, orphan cleanup, deduplication, file integrity, eviction, cross-tab behavior and migration. |
| #367 | Increase/align smart plan sync payload budget | Sync journal/outbox/revision mutation/payload limits; `PlanningEngineWizard.tsx`; `runAllTests.ts` | Must be reviewed with sync invariants and #369/#371; payload increase is not a substitute for archive architecture. |
| #366 | Offline app/PWA readiness | Service worker, Vite config, offline storage and tests | Review cache versioning, stale asset cleanup, cache poisoning, storage pressure, update/rollback and offline route behavior. |
| #365 | Continuous Seerah reader prototype | Adds Seerah reader, manifest/content contract/progress services, E2E; modifies App/router/Sidebar/test runner | Treat as prototype until primary sources, edition/licensing, citations, chronology, content completeness and editorial review are verified. UI shell is not proof of reliable content. |
| #364 | Advisor chat history bounds and prompt safety | `api/advisor.ts`, advisor service, Gemini security tests | Security-sensitive; inspect server validation, prompt injection boundaries, auth/rate limits, data retention and secret handling. |
| #363 | Consolidate docs and roadmap | Large docs sweep; `WORK_LOG.md` deletes 516 lines; adds long continuation/Seerah docs | Review all deletions against history and canonical source files. Preserve evidence and unique decisions; do not accept large deletion as “cleanup” without a line-by-line retention map. |
| #359 | Device-local Quran audio manifest store | Adds manifest store/tests; modifies `runAllTests.ts` and download plan | Overlaps/superseded candidate relative to #368; compare semantics and retain only one canonical implementation. |
| #358 | Local Quran audio download manifest store | Adds download store/tests; modifies `runAllTests.ts` | Overlaps #359/#368. Do not merge independently without proving it is not duplicate or a required migration layer. |
| #2 | Older Phase 5 premium UI/UX | Broad UI/service/test surface | Very stale. Reassess against current main; likely close as superseded only after checking unique useful changes and discussion. |

### Shared-file collision map

- `src/tests/runAllTests.ts`: #365, #367, #368, #369, #371, #358, #359. Rebase and resolve serially; ensure every suite is registered exactly once and failures propagate.
- `src/components/plans/PlanningEngineWizard.tsx`: #367 and #369. #369's range selection behavior must be integrated with #367's payload budget change, not overwritten by either branch.
- Offline audio stores: #358, #359, #368. Choose one canonical data model; document migration/compatibility if older local keys exist.
- Docs: #363 and #374. Avoid parallel rewrites; make #363 chronology consistent with the new canonical state document.

## 4. Exact CI evidence and current blockers

GitHub commit check-runs were fetched for the following exact SHAs:

| SHA | Run | Check | Result |
|---|---:|---|---|
| #374 head `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | 43566163275 | Tests, TypeScript, and production build | **FAILURE status, no steps returned** |
| #373 head `740fee2a3a287f0ba8b3fda9217728b63a564f64` | 43486043698 | Same | **FAILURE status, no steps returned** |
| #372 head `950640ea78d29e87d426a89d8887c15e4de2abac` | 43391729769 | Same | **FAILURE status, no steps returned** |
| main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` | 43079260528 | Same | **FAILURE status, no steps returned** |

For each run, the GitHub Jobs API returned a completed failed job with an empty `steps: []`. The run started and ended within a few seconds. This is not enough evidence to conclude a code assertion, TypeScript check, or build failed. It is an observability/runner-level blocker until the raw job log, annotations, workflow syntax, runner setup, or GitHub Actions incident can be inspected.

Do not mark these runs PASS. Do not “fix” code based only on a failure badge. Resolve CI observability first:
1. Fetch the full workflow run, job, annotations, check-run output, and logs via the available GitHub Actions APIs.
2. Validate the workflow YAML and permissions/triggers.
3. Inspect GitHub Actions service incidents and repository/organization runner restrictions if relevant.
4. Trigger one controlled rerun after root cause is understood.
5. If no step execution is still visible, classify BLOCKED and use a reproducible local runner only if a real repository checkout/runtime is available.
6. Do not weaken or skip tests to get a green badge.

**Vercel:** A prior Vercel bot comment reported a Preview Ready for an earlier PR #374 SHA `2fea7fc43c4313b103148900b53891fb500ab233`, but the latest observed commit `6673bb1...` had been reported as Building/Pending in the earlier checkpoint. The GitHub status showed a successful Vercel Preview Comments check on the latest SHA, but this does not prove that the Preview deployment is ready or that a browser smoke test passed. Exact latest Preview and Production alias/SHA mapping remain **NOT VERIFIED** in this audit. Do not claim deployment success from the comment bot alone.

## 5. Feature-specific engineering review findings

### 5.1 Ruqyah and Quran lazy loading

Current main:
- `src/data/quranDataLoader.ts` uses Vite `import.meta.glob` for per-Surah Quran chunks.
- `src/services/ruqyahContentService.ts` statically imports `VERIFIED_AYAHS`; this risks pulling the complete verified corpus into a route/service import graph.
- `api/ruqyah.ts` on main is a same-origin proxy for IslamicAPI. It restricts to `instant`, allowed programs `brief-ruqya`, `a-medium-ruqya`, `a-long-ruqya`, and source `from-quran`; validates IDs and Quran coordinate strings against canonical Surah metadata; strips provider-authored text; returns coordinates only; rate-limits; bounds upstream response size; and keeps the API key server-side.
- `RuqyahApiLibrary.tsx` renders coordinates through WIRD's local Quran text component and supports a cached index.
- The user reported: basic Ruqyah audio worked on the main page after configuring `ISLAMICAPI_API_KEY`, but the Ruqyah page still showed “full recording under verification” and a 500 error while loading the index. This is user-reported historical behavior; re-test current deployment before assuming it persists.
- PR #373 changes the static dependency path and adds lazy-loading regressions. Inspect its exact head and tests before integration.
- Preserve the three short/medium/long categories. Their divisions are organizational aids, not a claim of prophetic prescribed grouping or fixed required count.
- Ensure audio playback is sourced from a vetted Quran audio source; index API does not provide authority for verse text or hadith/dua content.
- Never print or request the secret value. Verify only whether the server environment is configured, through safe status/error handling.

Acceptance criteria:
- Route initial bundle excludes full Quran JSON/verifiedAyahs static graph.
- Opening one item loads only required Surah chunks.
- Failed chunk load can retry (failed promise evicted).
- All visible Arabic Quran text is WIRD's local verified corpus.
- All coordinates are range-checked; malformed external entries fail closed.
- Cache contains only validated coordinates, has bounded TTL/size, and survives temporary outage safely.
- Short/medium/long sections and audio repeat/stop/next/error states have unit + browser tests.
- Test production build chunk output; don't infer from source import alone.

### 5.2 Quran data integrity

- Preserve canonical Uthmani corpus and separately sourced display/simple spelling data, each with provenance/license.
- Validate all 114 Surah chunks, exact ayah counts, stable coordinate ordering, no gaps/duplicates, expected metadata, and text non-emptiness.
- Verify all consumers use the intended text edition and do not mix Tanzil Simple display text with Uthmani canonical text without an explicit UI contract.
- Test Mushaf printed-page coordinate maps against source corpus and all 604 pages before claiming page-map completeness.
- Avoid runtime fallback to untrusted external Quran text.

### 5.3 Memorization plans and ranges

- #369 adds multi-select ranges and is the primary user-facing feature candidate.
- Verify normalized ranges, disjoint/overlapping selection semantics, Surah/Juz boundaries, duplicates, empty/invalid ranges, large selection bounds, accessibility, keyboard use, mobile interaction, serialization and migration.
- #367 changes sync payload budgets; test worst-case payloads and ensure large Engine Plans are chunked losslessly rather than merely increasing limits.
- #371 codec must round-trip exact data; reject malformed/truncated/duplicate chunks; preserve original source on decode/validation failure; support legacy reads and safe migration; cap memory/CPU/payload.
- Verify deletion and recovery semantics. Never silently drop portions of a plan.

### 5.4 Offline audio and PWA

- #368 is the likely consolidation target; #358 and #359 are competing/earlier stores.
- Require a single durable manifest and a single source of truth for download jobs/files.
- Validate HTTP byte ranges, content-length, content-type, checksum/size, cancellation, retries, partial-file cleanup, duplicate jobs, cross-tab locking, storage quota, LRU/explicit eviction, orphan cleanup, and recovery after restart.
- A “downloaded” state must mean the complete audio file exists and passes integrity checks.
- Do not delete a previous good file until a replacement is fully downloaded and verified.
- PWA service worker must avoid caching private/user-specific responses or API secrets; version caches and clean obsolete app shell caches without deleting user audio.
- Use browser storage estimates where supported, but handle unsupported APIs and quota failures gracefully.

### 5.5 Cloud sync and user data

- Read `docs/sync/REMOTE_REPLICATION_PLAN.md` and the latest sync architecture/release gates before any sync changes.
- Main `AGENTS.md` states remote pull/projection must remain disabled until server-owned monotonic revisions, base revision capture, Firestore transactional compare-and-set, stale-write conflict handling, validated bootstrap, separate remote import/outbox, atomic import/dedupe/cursor persistence, durable per-UID cursor, stable ordering, UID guards, and deterministic conflict deferral are complete and tested.
- Never use client clock or blind last-write-wins for conflict resolution.
- Never assume a missing revision permits overwrite; never blindly union arrays; don't add tombstones until collection-specific delete/replay/restore semantics are proven.
- Maintain independent client instances with separate IndexedDB and shared Firestore Emulator; assert final persisted state on both clients and server.
- Test offline writes, concurrent same-record edits, retries after server success/local-ack failure, duplicate event IDs, app restarts mid-flight, account switching, cursor pagination, equal timestamps, and pending-local-vs-remote conflicts.
- Preserve user data and raw corrupt bytes for recovery; fail closed rather than overwrite corruption with empty defaults.
- Keep production flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` off until all gates pass and owner explicitly approves activation.

### 5.6 Seerah content

- PR #365 is a reader prototype, not a content-verified Seerah library.
- Before publishing: choose a bounded, reputable source corpus; document source editions and licenses; store chapter/paragraph references and citations; distinguish authentic reports, disputed reports, and editorial synthesis; include grading/attribution only when source-backed; never invent chronology or hadith grading.
- The Seerah learning plan in #363 requires editorial audit against source texts and must not be treated as an approved curriculum without review.
- User previously requested adding Seerah as a useful adjacent feature but preserving WIRD's core Qur'an/worship focus. Keep it secondary and opt-in, not a sprawling portal.

### 5.7 Security and advisor

- #364 is security-sensitive. Validate request size and message count server-side; constrain roles and content; treat conversation history as untrusted; protect against prompt injection; apply auth, rate limits, and privacy controls; keep provider keys server-only; avoid logging raw private conversations.
- Review all API routes for method, content-type, body size, auth, origin/CORS, rate-limit, timeout, response-size, and error redaction.
- Treat public Firebase web config as client configuration, not a server secret; do not reveal actual environment secret values.

## 6. Documentation cleanup rules

Keep:
- `AGENTS.md` as canonical agent policy.
- `GEMINI.md` as short pointer to `AGENTS.md`.
- This file as the master continuation state, updated to the exact current main/PR heads.
- One canonical roadmap with current priorities.
- Dated audit/checkpoint records when they contain unique decisions, test evidence, security findings, migration rationale, or exact SHAs.

Consolidate or mark historical:
- `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_CHECKPOINT.md`, `docs/engineering/WORK_SESSION_CHECKPOINT.md`, `PROGRESS.md`, `progress/CURRENT_STATUS.md`, `RESUME_HERE.md`, `MASTER_ROADMAP.md`, and `WORK_LOG.md`.
- Do not delete historical work logs merely because newer docs supersede them.
- For every deleted/condensed section, map its unique information into a retained canonical document first.
- Remove stale instructions that refer to old PRs/branches only after checking whether the work was merged and whether it still contains a valid engineering invariant.
- Make every roadmap item one of: shipped and verified, implemented but unverified, in progress, blocked, deferred, superseded, or not started.

## 7. Required end-to-end execution order

A branch-aware coding agent should continue in this order, updating the exact SHA and evidence after each milestone:

1. **Refresh reality:** fetch main SHA, all open PR metadata/diffs/comments/checks, branch heads, GitHub Actions logs, Vercel deployment/alias state, latest docs and Firebase config. Rebuild the PR collision map.
2. **Unblock CI observability:** investigate empty-step failed jobs; repair workflow only from evidence; run a controlled check. No other PR is merge-ready without exact-head quality gates.
3. **Merge strategy, not bulk merging:** rebase each useful PR onto the latest base in dependency order; resolve shared files serially; remove duplicate/superseded code only after comparison.
4. **Ruqyah lazy loading and UX:** integrate #373; verify bundle graph and actual short/medium/long audio, cache/error/retry and verified local text.
5. **Offline audio/PWA consolidation:** compare #358/#359/#368; select one architecture; merge only after all failure/quota/restart tests.
6. **Plan range + Engine Plans archive:** integrate #369/#367/#371 in one compatible sequence; verify codec migrations and payload limits.
7. **Session UX:** evaluate #370 and keep only accessible, tested behavior.
8. **Advisor security:** review #364 and harden as needed.
9. **Seerah:** keep reader prototype behind a content readiness gate; audit citations/licensing before user-facing release.
10. **Documentation:** reconcile #363 with actual code and current gates; update `AGENTS.md` stale PR #59 reference; keep one source of truth.
11. **Full verification:** Bun install frozen; audit; all unit/integration tests; Quran data/chunk validation; API import smoke; Firestore Rules Emulator; TypeScript; production build; production server smoke; Playwright desktop/mobile; multi-client sync suite; exact SHA checks.
12. **Preview/live verification:** verify Preview belongs to exact tested SHA; read-only smoke essential routes; verify Production alias/deployed SHA and no console/network errors where permitted. Do not change production settings or data.
13. **Release decision:** produce a gate matrix. Keep Draft/blocked PRs open. Merge only changes that pass exact SHA gates and are authorized by the owner. Do not turn on production sync flags or deploy rules/secrets without explicit approval.

## 8. Release evidence matrix (as of this snapshot)

| Gate | Status | Evidence / next action |
|---|---|---|
| Repository inventory | PASS | 310-path recursive tree fetched; no truncation. |
| Main SHA verified | PASS | `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. |
| Open PR inventory | PASS | 14 open PRs fetched (#374..#363, #359, #358, #2). |
| PR code quality | BLOCKED | Relevant PR checks failed without any job steps/log detail; no assertions are known to have run. |
| Ruqyah source sanitization | PASS (code inspection only) | Main proxy validates coordinates and strips provider-authored text; runtime behavior not reverified. |
| Ruqyah route bundle size | NOT TESTED | Need exact #373 build and bundle graph. |
| Quran lazy chunks | PARTIAL | Loader exists; static Ruqyah service import remains on main. |
| Offline audio architecture | NOT VERIFIED | Competing open PRs; must consolidate and test before release. |
| Multi-range memorization | NOT VERIFIED | Feature in Draft #369; integrate/test against #367/#371. |
| Engine Plans archive | NOT VERIFIED | Draft #371; codec tests not run here. |
| Seerah content accuracy/licensing | NOT VERIFIED | Draft reader shell and plan are not editorial approval. |
| Advisor security | NOT VERIFIED | Draft #364; review and tests pending. |
| Firebase active project consistency | PASS (source inspection) | Main code/config align on `wird-quran-app`; no production writes performed. |
| Firestore remote replication release gates | BLOCKED / NOT RELEASE-READY | `AGENTS.md` requires revision/CAS/import/cursor/conflict/multi-client gates. Keep remote projection flags off. |
| GitHub Actions runner observability | BLOCKED | Multiple completed failed jobs expose zero steps; inspect raw logs/annotations/runner. |
| Vercel Preview exact SHA | NOT VERIFIED | Bot/check evidence is insufficient to prove latest deployment and browser smoke. |
| Vercel Production exact SHA | NOT VERIFIED | No authoritative deployment/alias mapping verified in this audit. |
| Live user flows | NOT TESTED | No live browser session executed. |

## 9. Change-control and safety rules

- Work on a dedicated branch; do not write to `main` directly.
- Never merge a Draft PR or close/delete branches until its unique changes are reviewed and preserved.
- Do not merge merely because GitHub says `mergeable=true`.
- Do not change production Firebase rules/data, user data, secrets, environment variables, or Vercel production settings without explicit specific approval.
- Do not activate remote sync flags. They are a release gate, not a cleanup toggle.
- No destructive cleanup of Quran data, user data, offline audio, backups, archives, historical docs, or migration keys without verified recovery/migration tests.
- Prefer additive, reversible migrations. Preserve corrupt source bytes and explain recovery.
- Avoid large parallel changes to shared files. Sequence/rebase/test one PR at a time.
- Do not ask the user to manually run tests when automated tests can be added and executed by the coding environment.
- If a capability is unavailable (terminal, browser, Vercel deployment access, runner logs), state BLOCKED; never fabricate the result.

## 10. Master prompt for the next branch-aware AI

Copy the prompt below as a single instruction to a coding agent that can access this GitHub repository and run a real checkout/terminal. Google AI Studio only sees `main`; if using it, first merge approved, tested changes into main through the normal authorized process. Do not pretend a branch-only document is visible in AI Studio.

---

### MASTER EXECUTION PROMPT — WIRD

You are the autonomous lead engineer, software architect, QA lead, security reviewer, performance engineer, and release engineer for `xm8eslam-stack/WIRD-APP`.

**Primary objective:** finish the outstanding engineering work safely and leave WIRD in a coherent, verified, maintainable state. Do not stop at audit reports, recommendations, or plans. Inspect, implement, test, review, fix, retest, commit, and document. Work continuously through independent tasks without asking the owner to repeat known context.

**Mandatory first reads:**
1. `AGENTS.md` — mandatory and canonical.
2. `GEMINI.md`.
3. `docs/engineering/MASTER_PROJECT_STATE_AND_AI_HANDOFF_2026-11-14.md` — this document.
4. `docs/sync/REMOTE_REPLICATION_PLAN.md` and current sync release gates before any sync change.
5. Current Ruqyah, offline, Quran data provenance, and product requirements docs relevant to the task.

**Reality check before editing:** fetch the current `main` SHA, all open PRs and branch heads, full diffs, comments/reviews, CI runs/logs, and Vercel deployment state. This document is a snapshot, not authority over newer repository facts. Reconcile every stale SHA and status. The owner expects implementation, not another prompt, so continue autonomously within the boundaries below.

**Product direction:** WIRD remains focused on Qur'an reading/listening, verified tafsir/search, memorization/revision/tasmee‘, adhkar and daily worship, practical tools, and reliable offline/local-first behavior. Seerah may be a secondary, source-cited learning area. No broad portal expansion, no mandatory paid API, no untrusted Quran text, no AI-generated scripture or authoritative fatwa.

**Work order:**
A. Diagnose and repair GitHub Actions empty-step failures. Do not infer code failure from a failure badge. Restore meaningful CI evidence without disabling tests.
B. Reconcile all open PRs. Rebase sequentially and resolve shared-file collisions. Specifically coordinate #373 Ruqyah lazy loading; #372 Bun CI; #368 versus #358/#359 offline audio; #367/#369/#371 plans/archive; #370 session UX; #364 advisor security; #365 Seerah; #363 docs; #374 hygiene. Preserve unique changes; close superseded work only after confirming its changes are included elsewhere.
C. Fix Ruqyah so the route no longer statically imports the entire Quran corpus. Preserve short/medium/long groups, audio behavior, safe caching, retry, and accessible loading/error states. IslamicAPI is only a coordinate index; validate every coordinate and render Quran text only from WIRD's verified local corpus.
D. Consolidate offline audio into one durable, bounded, recoverable implementation. Test quota errors, partial/cancelled downloads, checksums, duplicate jobs, concurrent tabs, retries, restarts, cleanup, and no deletion of a good file before a verified replacement.
E. Finish flexible memorized range selection and Engine Plans archive chunking without data loss. Test range normalization/bounds/overlap, codec round-trip, corruption, migrations, payload limits, restart and recovery.
F. Audit session display preferences, PWA caching, service worker updates, and advisor endpoint security.
G. Treat Seerah as not publishable until source corpus, citations, licensing, edition, chronology, and disputed reports are reviewed. Build a source map and content validation, never invent religious sourcing.
H. Reconcile documentation into one canonical current state. Update stale PR/branch references, preserve unique history and exact test evidence, remove only proven dead/duplicated data. Make `AGENTS.md` and `GEMINI.md` consistent.
I. Run full quality gates on exact final SHA: frozen Bun install, dependency audit, unit/integration, Quran data validation, Mushaf page coverage, API import smoke, Firestore Rules Emulator, TypeScript, production build, server smoke, Playwright desktop/mobile, and multi-client sync tests. Add missing automated tests where needed.
J. Verify Preview and Production SHA mapping and read-only user flows. If Vercel quota or access blocks it, record BLOCKED; never imply CI equals deployment.

**Sync safety is absolute:** follow `AGENTS.md` and `REMOTE_REPLICATION_PLAN.md`. No blind last-write-wins, no client-clock conflict ordering, no blind array union, no unsafe tombstones. Implement server-owned monotonic revisions, base revision capture, transactional compare-and-set, stale conflict handling, safe legacy bootstrap, separate remote import/outbox, atomic dedupe/cursor persistence, durable per-UID remote cursor, deterministic ordering, UID guards, and independent two-client tests before remote projection can be enabled. Keep `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` off until every release gate passes and the owner explicitly approves activation.

**Religious content integrity:** canonical Quran text must come from the verified local corpus. Third-party APIs can only supply validated references when explicitly approved. Never render unverified provider text. Keep provenance and licensing. Distinguish established reports from disputed narrations; do not invent hadith grading, citations, or rulings.

**Change control:** feature branches only. No direct main edits. No production deployment/promotion, Firestore Rules deployment, production data writes, secret/environment changes, or sync flag activation without explicit specific approval. Keep incomplete PRs Draft. Merge only exact-SHA verified changes under the owner's existing authorization for safe merges; do not bypass protections.

**Testing/reporting:** never claim tests passed unless actually run and observed. Use PASS / FAIL / BLOCKED / NOT TESTED. Record exact SHA, workflow run ID, test command, assertions, and results. A local build is not a deployment; emulator tests are not production; simulated clients are not physical devices. Do not ask the owner to run manual terminal/browser tests when automated verification is feasible.

**Completion definition:** the task is not complete until all safe work is implemented, exact-SHA gates pass, duplicate/superseded PRs are resolved, documentation is reconciled, and Preview/live status is either verified or explicitly blocked with evidence. Produce a final report with: merged/retained PRs, exact final SHA, tests and runs, deployment SHA/status, user-facing changes, data migrations/rollback, remaining blockers, and one concise next action. If a gate is blocked by infrastructure or permissions, do as much independent work as possible and leave a precise executable handoff rather than fabricating completion.

Proceed now. Do not stop after writing this prompt. Execute the work.


### Follow-up log retrieval (2026-11-14)

The GitHub Actions job-log download endpoint was attempted for all four job IDs listed above (132360373984, 132094643958, 132059785133, 130727161970). Each returned HTTP 404 from GitHub's temporary log-blob storage (`BlobNotFound`). This confirms that the raw job logs are no longer retrievable through that endpoint at the time of this audit; it does not explain why the jobs failed. Keep the root cause **BLOCKED / unknown**. Inspect workflow/run metadata and trigger a new controlled run only after reviewing workflow configuration and runner availability.


### Vercel connector access check (2026-11-14)

The connected WIRD Vercel account was selected explicitly, but the read-only project lookup for `wird-app` returned HTTP 403 `forbidden / Not authorized`. No project/deployment records were exposed, and no CLI fallback is available in this execution environment. Therefore deployment/alias verification remains **BLOCKED**, not merely unqueried. Do not retry the same unauthorized request or infer project state from the public URL.


---

## 20. VERIFIED EXECUTION FOLLOW-UP — 2026-11-14

This section supersedes earlier historical statements only where it records newer, exact evidence. It does not authorize production configuration changes or PR merges.

### 20.1 Repository and release checkpoint

- Current `main`: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Production Vercel deployment: **READY**, deployment `DKfbfqsBHqzS95CoTdYZCtPPPZwu`, associated with the same `main` SHA.
- No PR has been merged during this follow-up.
- 16 PRs are currently open: #375, #374, #373, #372, #371, #370, #369, #368, #367, #366, #365, #364, #363, #359, #358, and #2.

Exact open PR heads re-fetched on 2026-11-14 (all OPEN / DRAFT):

| PR | Head SHA | Disposition |
|---:|---|---|
| #375 | `self-reference; re-fetch current PR head` | Handoff evidence updated |
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Package/lockfile overlap with #372 |
| #373 | `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca` | Ruqyah fix; Preview READY; CI BLOCKED |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun workflow; runner issue unresolved |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Codec not integrated |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Session UX |
| #369 | `3478ae22a200a817a240d8b28e532b01674427bf` | Juz 30 endpoint fixed; 7 isolated tests PASS; CI BLOCKED |
| #368 | `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8` | 29 isolated offline tests PASS; cross-tab/lifecycle gaps |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | 800 KB cap; not chunking |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/offline shell |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah prototype only |
| #364 | `ad33875b0304020f930c7b606ef8782d36148707` | Advisor history fix; Preview READY |
| #363 | `74fca7bba8eb64f1676f78d2b413590012365561` | Docs consolidation; Work Log preserved; Preview blocked by build-rate-limit |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Superseded standalone manifest |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Superseded standalone job store |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy broad UI/UX; do not merge as a unit |


- A local Git working tree/branch is **NOT VERIFIED**. The available workflow used remote GitHub file operations and isolated Vercel sandboxes; no claim of a local full-suite run is made.

### 20.2 Ruqyah — implementation and evidence

PR #373 was updated on its feature branch. Latest verified feature commit:

`d93ede79b9f8ca093bd5a8a702a00b31d415c9ca`

Changes:
- Keeps verified Quran text sourced from WIRD's local corpus and uses the existing per-Surah lazy loader.
- Adds online/offline state and a retry control for failed local Quran chunk loads.
- Adds strict support for a provider locator containing an exact canonical whole-Surah name and number. The server resolves that locator through local `ALL_SURAHS` metadata and emits only a normalized coordinate range; provider Quran text and translations remain stripped.
- The previously failing long-program dataset contains 171 Quran entries. Its one bare-Surah locator, `الأعلى ٨٧`, now resolves to local coordinates `87:1-19`.

Observed tests in isolated Node 26:
- Ruqyah API proxy/security tests: 20 PASS, 0 FAIL.
- Ruqyah view/audio-lock tests: 14 PASS, 0 FAIL.
- Full 171-entry provider dataset passed through the actual API handler with mocked upstream transport: 171 normalized coordinate entries, whole-Surah locator resolved, provider-authored text stripped.
- These are targeted isolated tests, not GitHub Actions or the full repository test suite.

Vercel Preview for the exact PR #373 commit: **READY**, deployment `5PDvHdHztx9Tf6yLR2ojQww2nhs1`.
- Vite build completed.
- 114 Surah chunks generated; 6,236 Quran ayah coordinates validated.
- Ruqyah route chunk observed at 68.25 KB (18.77 KB gzip) in the corresponding feature build.
- Preview browser/API verification remains **BLOCKED** by Vercel Deployment Protection; protection settings were not changed.

Production API smoke test before the feature fix:
- Short program: HTTP 200, 9 entries.
- Medium program: HTTP 200, 63 entries.
- Long program: HTTP 502, `INVALID_RUQYAH_SOURCE_RESPONSE`.
The long-program fix is on PR #373 only. Production remains **NOT VERIFIED FIXED** until a gated merge and production deployment.

### 20.3 CI — exact failure evidence

The latest PR #373 run `43568676649` and its retry both failed before any job steps were recorded. The retry job has `steps: null` and `logs_url: null`; job-log retrieval returned no stored logs. This does not establish an application test failure.

Important exception: historical PR #358 run `43030195498` and PR #359 run `43029617572` did execute their earlier checks successfully (install, automated tests, Rules Emulator, TypeScript, build, server smoke) and then failed the Desktop/mobile browser smoke step. Their log URLs are unavailable, so the exact Playwright assertion is NOT VERIFIED. These are observed browser-test failures, not pre-step runner failures. Both PRs are superseded by #368.

PR #364 run `43569132395` shows the same pattern: failed job, `steps: null`, `logs_url: null`.

No CI pass is claimed. Do not disable tests or infer that the Bun workflow change fixes runner-start failures.

### 20.4 Advisor security

PR #364 was updated at commit:

`ad33875b0304020f930c7b606ef8782d36148707`

Client-supplied history sender labels are no longer rendered as authenticated assistant messages. All prior messages are framed as untrusted user-provided context. Five targeted source assertions passed in an isolated Node 26 check.

Vercel Preview for this commit: **READY**, deployment `13RYRdPik7XUUEHk856JMfbn6j99`. GitHub Actions remains failed before steps; no full security test suite or browser verification is claimed.

### 20.5 Engine Plans and memorization

- #369 multi-range selection now fixes a Juz 30 off-by-one that previously ended at 114:5; all 7 isolated range-selection tests PASS with a canonical boundary fixture. Generated-index E2E and GitHub CI remain NOT VERIFIED.
- #371 archive codec tests: 6 PASS in isolation. The codec is not wired into the actual Outbox/Inbox/Firestore persistence path.
- #367 still raises the single-payload budget to 800 KB. Do not merge it as a complete solution to archive payload growth. Chunk transport integration, bounded manifest/resource validation, backward-compatible reads, corruption recovery, and rollback evidence remain required.

### 20.6 Offline/PWA

PR #368 contains an IndexedDB job library, downloader, and Cache Storage adapter despite its older PR description. Review found missing cross-tab job ownership/locking, incomplete end-to-end orphan cleanup, and inconsistent Cache Storage quota handling. No real-device, restart-recovery, or airplane-mode verification is claimed.

Do not merge #358/#359 as competing stores alongside #368. Review #366's service-worker caches together with the unified audio store.

### 20.7 Documentation and history

- The current #363 documentation branch is `docs/wird-docs-roadmap-reconciled-20261111`, latest verified commit `3f6f2bd53ad906af05a65ef7fa76adf31a49fd57`. It initially contained only 52 new lines at the old work-log path; the 537-line original main history was restored ahead of those entries. Canonical `docs/engineering/WORK_LOG.md` now contains 589 lines and preserves the complete original log as an exact substring; the former `progress/WORK_LOG.md` path is a compatibility pointer. Canonical `MASTER_PROJECT_STATE.md`, `ARCHITECTURE.md`, `RELEASE_CHECKLIST.md`, and an engineering index were added. The exact-head CI run `43570268180` still fails before steps/logs (`steps=null`, `logs_url=null`).
- The requested canonical files `docs/engineering/MASTER_PROJECT_STATE.md`, `docs/engineering/ARCHITECTURE.md`, and `docs/engineering/RELEASE_CHECKLIST.md` are not yet present in the inspected documentation branch.
- `docs/sync/REMOTE_REPLICATION_PLAN.md`, referenced by current `AGENTS.md`, was not found. Related sync architecture/state/release-gate documents exist in the documentation consolidation branch.
- A root `README.md` was not found on inspected `main`.

### 20.8 Firebase and Vercel safety — critical

- Repository Firebase client configuration identifies project `wird-quran-app`; repository Firestore rules were inspected. No Firebase project, rules, database, or user data was changed.
- Vercel environment metadata confirms `ISLAMICAPI_API_KEY` exists in Preview and Production. Its value was not read or disclosed.
- **Both Production sync flags were read as `true`:**
  - `VITE_WIRD_REVISIONED_SYNC_ENABLED`
  - `VITE_WIRD_REMOTE_PROJECTION_ENABLED`
- This conflicts with the required disabled-until-gates-verified policy. No environment value was changed. Explicit owner approval is required before disabling either flag.
- Production runtime error query returned no errors in the inspected 24-hour window; no Ruqyah runtime logs appeared in the inspected 30-minute window. Absence of recent logs is not proof that historical failures are resolved.

### 20.9 Status summary

| Area | Status |
|---|---|
| Main SHA and Production deployment identity | PASS |
| Ruqyah targeted tests and full 171-entry handler fixture | PASS |
| Ruqyah production Long index | FAIL before feature fix; fix pending PR merge |
| Ruqyah Preview build | PASS |
| PR #373 GitHub Actions | BLOCKED — runner failure before steps/logs |
| PR #364 targeted source assertions and Preview build | PASS |
| PR #364 GitHub Actions | BLOCKED — runner failure before steps/logs |
| Plans archive integration | BLOCKED |
| Offline cross-tab/recovery/device verification | BLOCKED |
| Seerah source verification | NOT VERIFIED |
| Documentation canonical hierarchy | BLOCKED |
| Production sync flags | FAIL — both currently true; no change made |
| Full repository test suite and production post-fix smoke | NOT VERIFIED |

Continue from these exact findings. Do not merge a PR or change Production/Firebase settings based solely on this checkpoint.


---

## Latest re-verification — 2026-11-14 09:00 local

This section supersedes stale exact-head and Vercel statements above where they conflict.

### Current main and production

- Current main SHA verified from the latest Vercel Production deployment metadata: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- Latest Production deployment: `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, state READY, source branch `main`, same SHA.
- This is deployment metadata/readiness only. It is not proof that the live application routes or feature APIs have passed post-deploy smoke.

### Current PR inventory

All 16 listed PRs were re-fetched from GitHub and remain OPEN / DRAFT. Current exact heads:

| PR | Head SHA | Status / disposition |
|---:|---|---|
| #375 | `638e71aa844c69072f6d721669af93a6103cfcea` before this handoff update | Documentation handoff; keep Draft until CI telemetry is inspectable |
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Hygiene; reconcile dependency files with #372 |
| #373 | `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca` | Ruqyah feature; Preview READY, CI BLOCKED, Production fix NOT VERIFIED |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun CI candidate; exact-head run fails before steps/logs |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Codec tests pass in isolation; persistence integration incomplete |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Session display settings; exact-head CI required |
| #369 | `814bb8788449ebe3d07d46f00a596a1a7b398a5a` | Multi-range memorization; exact-head CI required |
| #368 | `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710` | Unified offline store/downloader; lifecycle gaps remain |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | 800 KB payload cap is not chunked transport |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | Offline/PWA; device and recovery verification incomplete |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah reader prototype; content not publishable |
| #364 | `ad33875b0304020f930c7b606ef8782d36148707` | Advisor prompt-boundary fix; Preview READY, CI BLOCKED |
| #363 | `fa944cfcb09f724cbc3ea51f5e3f2229365d7f71` | Documentation consolidation; canonical docs and original Work Log preserved |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Superseded manifest implementation; do not merge alongside #368 |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Superseded manifest implementation; do not merge alongside #368 |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy broad UI/UX; non-mergeable as a unit |

PR #375's head advances when this addendum is committed; re-fetch the exact head before any future gate or merge decision.

### GitHub Actions — repeated pre-step failure

- #375 Quality Gate run `43570354110` was retried with the failed-job rerun operation. The latest attempt job `132373650377` again completed as failure with `steps=null` and `logs_url=null`.
- Other exact-head runs checked: #373 `43568676649`, #363 `43570268180`, and #372 `43391729769`; each exposes one failed job but no steps/log URL.
- This is BLOCKED runner/job initialization or telemetry. It is not evidence that tests failed, and it is not a pass. Do not disable tests or relax required gates.

### Vercel Production configuration — owner action required

A read-only environment listing (without decrypting secrets) confirms both Production flags are currently `true`:
- `VITE_WIRD_REVISIONED_SYNC_ENABLED`
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED`

This conflicts with the project rule that remote sync remain disabled until all release gates pass. No values were changed. Do not alter these Production flags or perform sync-related Production actions until the owner explicitly authorizes the change. Sensitive environment values were not read or disclosed.

### Immediate engineering decision

- Do not merge any PR while exact-head Quality Gate runs remain uninspectable.
- Keep #373 Preview-only; require successful exact-head CI, safe merge, matching Production deployment, and live short/medium/long Ruqyah smoke.
- Continue Plans/Offline source review and integration work on branches, with no competing audio stores and no payload-limit-only workaround.
- Keep Seerah as a sourced-content blocker, not a launch-ready feature.
- Keep documentation history append-only. Canonical Work Log is `docs/engineering/WORK_LOG.md`; the old `docs/engineering/progress/WORK_LOG.md` path is a compatibility pointer.


### 20.10 Vercel Preview inventory — 2026-11-14

The latest deployment inventory shows:
- PR #368: READY on exact feature SHA `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8`, deployment `dpl_EmsTdmmgjmQktcNZiAiE9qxppyRs`.
- Production: READY on main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- PR #373: READY on exact feature SHA `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca`, deployment `dpl_5PDvHdHztx9Tf6yLR2ojQww2nhs1`.
- PR #364: READY on exact feature SHA `ad33875b0304020f930c7b606ef8782d36148707`, deployment `dpl_13RYRdPik7XUUEHk856JMfbn6j99`.
- PR #374: READY on exact feature SHA `6673bb149a2ffa58177c35b9f68c76423dfb2a0b`, deployment `dpl_GFt7aRTuzAzPMoDKnbjD6Szunqaq`.
- PR #363 current head `b33218c3b337e3a6271046e66e0abc8330bbd61e`: Vercel status FAIL with `build-rate-limit`. Its latest successful Preview in the deployment inventory is older SHA `7675d7ece7fda857d5a22f3e2eb0c0fdccdbc8db`, deployment `dpl_AFh8BR8VtmBB6XtQNTX3nCCQseks`; this is not the current head.
- PR #375 current head is this handoff branch; its latest successful Preview in the deployment inventory is older SHA `988a511317`, deployment `dpl_F97xFiW2trAiqXajM7JcwDYpKe7D`. No Preview for the current handoff head was verified.
- Multiple recent documentation deployments were CANCELED or failed due to deployment-rate limits. This is a platform quota issue, not evidence of application build failure.

Do not treat an older READY Preview as verification of a newer branch head. No Deployment Protection, Vercel project setting, or Production environment value was changed.
