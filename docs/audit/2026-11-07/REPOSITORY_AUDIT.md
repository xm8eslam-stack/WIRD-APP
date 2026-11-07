# WIRD — Comprehensive Repository Audit

**Audit started:** 2026-11-07  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Audit branch:** `chore/full-repository-audit-20261107`  
**Audit baseline:** `main` at `6228150c2f7137678ba1079f5d9b2e8aba527523`  
**Baseline CI:** PASS — GitHub Actions run `42295376778`, exact SHA above.  
**Scope:** Repository structure, all branches, all tracked files, application architecture, local persistence, cloud sync, Quran data integrity, authentication, API routes, tests, security rules, deployment readiness.

> This is a living audit. Structural enumeration is complete; detailed source review is in progress. A file marked PENDING has not yet received a complete code-level review. Do not treat this document as a final release approval.

## 1. Repository snapshot

- Default branch: `main`; repository is public and writable by the connected owner account.
- Main tree at baseline: 181 entries = 147 files + 34 directories.
- Remote branches: 70.
- Open pull requests observed: #2, #8, #48, #59, #60.
- The working audit branch was created from the exact main baseline. No production files, user data, Firebase rules, secrets, or deployment settings were changed.

## 2. Exact-head verification

### Main baseline — PASS
- SHA: `6228150c2f7137678ba1079f5d9b2e8aba527523`
- Run: `42295376778`
- Completed successfully: dependency installation, npm audit, aggregate automated tests, Firestore Rules Emulator, TypeScript, Quran chunk validation/production build, and production server startup smoke test.
- Every step in the run's single Quality Gate job completed successfully.

### PR #59 — separate branch, not merged
- Head: `31c6eb70d6925fc6c3ea32c07c1f8e986095d73b`
- PR and push runs `42292605699` and `42292597903`: PASS on that exact head.
- PR is Draft. Compared with current main, the branch is diverged (15 commits ahead, 4 behind). Do not merge it as-is.
- It improves push retry/idempotency and honest sync status, but explicitly does not implement remote event import/projection, durable remote cursors, revision compare-and-set, or complete two-device synchronization.

### PR #60 — separate branch, not merged
- Head: `02f230882f15e898b8a621f8d708df26bdd4c65b`
- PR and push runs `42294419136` and `42294411936`: FAIL.
- Focused Tafsir tests: 16/16 PASS; production build PASS; production/development API smoke tests PASS.
- Aggregate suite: 403 PASS / 2 FAIL. The two failing groups are stale demo-loader source assertions and independent Tanzil verification on this older branch base.
- TypeScript fails because that branch's SettingsView still references removed `StorageService.loadDemoData` and `RetentionService.loadDemoPortions`.
- The branch is diverged from current main (12 ahead, 2 behind). Current main already contains journaled demo loading and a newer Quran dataset/verification change; port the Tafsir fix onto a fresh main-based branch rather than merging this stale branch.
- Vercel reported the Free-plan daily deployment cap; no deployment for this PR head is verified.

## 3. Architecture inventory

The current project is a React 19 + TypeScript + Vite application, with an Express development/production server, Firebase Authentication, Cloud Firestore, browser local storage, IndexedDB journal/outbox, Quran JSON data, and a Vercel deployment configuration.

Main functional areas:
- App shell, routing, responsive navigation, PWA/service worker.
- Authentication and guest mode.
- Dashboard and progress analytics.
- Quran library, Mushaf reader, Tafsir, audio playback.
- Memorization plans and planning engine.
- Memorization sessions, revision center, tests, weak-ayah tracking.
- Profile/settings, backup export/import, reset.
- Local persistence, journal replay, cloud sync coordinator.
- Advisor API and Tafsir API.
- Quran data validation, generated chunks, Firestore rules, automated tests.

## 4. Confirmed high-priority findings

### P0 — Cloud sync is not release-ready
Main's cloud coordinator performs upload-side Firestore writes and then performs a bounded read of remote events; merely observing those events is not equivalent to importing them into IndexedDB and applying them to local projections. The current main code can therefore present an overly optimistic `synced` state. PR #59 corrects the status to `partial` when remote reconciliation is not implemented, but is not merged and remains incomplete for full replication.

Before enabling full cloud sync, implement server-owned monotonic revisions, base-revision capture, transactional compare-and-set, immutable event idempotency, remote import separate from the upload outbox, durable remote cursors, conflict deferral/resolution, UID guards, and independent multi-client/offline tests. Keep remote projection disabled until the entire gate passes.

### P0 — User data safety
No destructive migration, bulk rewrite, Firestore production write, or production rules deployment is authorized by this audit. Keep backup/restore and rollback guarantees intact. Do not delete any branch until its unique commits have been compared with main and its PR state is understood.

### P1 — Tafsir HTML-as-JSON failure
Main's `src/services/tafsirService.ts` calls `response.json()` directly and main's `api/tafsir.ts` calls `upstream.json()` directly. HTML fallbacks can therefore produce the reported `Unexpected token '<'` failure. PR #60 contains useful guards and regression tests, but its branch is stale and its exact-head CI is red for unrelated branch drift. Reapply its changes to a fresh branch based on the current main and rerun the full gate.

### P1 — Branch sprawl / stale PRs
70 branches include historical feature/fix/checkpoint branches and several open PR branches. Five open PRs were observed; #2, #8, and #48 are old/diverged and must be individually compared/reviewed. Do not bulk-delete branches. Build an explicit branch disposition register: protect, active, archive-candidate, or needs-investigation.

### P1 — Documentation drift
The root `AGENTS.md` and progress documents contain checkpoint language that is not fully aligned with current main and open PR state. The resume file still references PR #58 as the next task while current main and open PR state have moved on. Update authoritative status only after the source/branch audit is complete.

### P2 — Build size / maintainability
The older PR #60 build output showed very large chunks, including a ~1.97 MB MemorizationTestsView chunk and ~1.08 MB main chunk. Re-measure on current main and profile dynamic imports/data inclusion before changing chunking. Do not optimize by removing functionality or Quran content.

## 5. Files inspected at this stage

Detailed notes are maintained in `FILE_AUDIT_REGISTER.md`. Initial code-level review includes:
- `AGENTS.md`, `GEMINI.md`, `package.json`, `.github/workflows/ci.yml`.
- `src/App.tsx`, `src/components/settings/SettingsView.tsx`, `src/context/AuthContext.tsx`, `src/hooks/useCloudSync.ts`.
- `src/services/cloudSyncCoordinator.ts`, `src/lib/firebase.ts`.
- `api/tafsir.ts`, `src/services/tafsirService.ts`, `server.ts`.
- `firestore.rules`, `scripts/firestoreRules.test.ts`, `src/tests/runAllTests.ts`, `src/tests/independentTanzilComparison.ts`, `vercel.json`.
- Root and engineering progress/checkpoint documents.

A structural inventory exists for all 147 files. The remaining source files require review in batches. Each file's note must record responsibility, dependencies/data flow, test coverage, risks, and recommended action. Avoid adding noisy comments to source files; keep maintainability notes in the per-file audit register and add inline source comments only where they explain non-obvious invariants.

## 6. Branch policy for this audit

- `main`: canonical baseline; do not rewrite.
- `chore/full-repository-audit-20261107`: this audit and report branch.
- PR #59 / `fix/cloud-sync-retry-and-status`: preserve; review and port only after current-main comparison.
- PR #60 / `fix/tafsir-api-html-response`: preserve; port the useful Tafsir fix to a fresh main-based branch.
- PR #2, #8, #48: stale candidates; inspect unique commits and dependencies before closing/archiving/deleting.
- Historical branches: no deletion in this stage. Record compare status and open-PR association first.

## 7. Completion criteria for this audit

1. Review every tracked file (all 147), including tests, JSON data, configs, workflows, server/API, and docs.
2. Record a specific note for every file in the audit register.
3. Compare all 70 branches against main and record ahead/behind/diverged/identical plus PR association.
4. Produce a full app architecture/data-flow report.
5. Produce a separate readiness/blocker report with evidence and severity.
6. Produce a sequenced remediation roadmap with dependencies, risk, acceptance criteria, and exact automated gates.
7. Produce a self-contained continuation prompt.
8. Only then begin implementation on dedicated feature branches; preserve main and user data.

## 8. Audit progress

- [x] Repository identity/default branch/main SHA.
- [x] Full tracked tree enumeration and file count.
- [x] Branch enumeration (70 refs).
- [x] Open PR inventory (5).
- [x] Exact current main Quality Gate evidence.
- [x] PR #59 / #60 exact-head CI and divergence review.
- [x] Initial critical architecture and readiness findings.
- [x] Initial review of all 147 tracked files; per-file notes recorded. Three PNGs visually inspected and found to be uniform dark-teal squares without a discernible logo.
- [x] Exact compare/disposition for all 70 branches (65 diverged, 4 main-only archive candidates, main identical).
- [x] Architecture report created.
- [x] Separate readiness/blocker report created.
- [x] Remediation roadmap and continuation prompt created.
- [ ] Begin remediation after user-facing checkpoint; reports are saved, but no application code has been changed yet.

## 9. Additional findings from the second audit pass

### Exact current-main CI evidence
The latest main Quality Gate run `42295376778` completed successfully on the exact main SHA. The aggregate suite reports **402 passed / 0 failed**. The independent Tanzil check explicitly verifies all **6,236 verses and metadata fields**; failure-looking log lines are expected negative-case assertions inside the test suite, not failing suite results. Firestore Rules Emulator reports **13 passed / 0 failed**. Quran generation reports 114 Surah chunks and a verified 604-page index.

The canonical JSON source files are large and should remain data assets rather than being hand-edited: `completeQuranData.json` is 2,513,293 bytes and `tanzilReferenceData.json` is 2,903,158 bytes. Main currently has a 1,848-byte validation report. Source attribution declares Tanzil / Uthmani / Hafs / CC BY 3.0.

### Additional P1/P2 code findings

- **P1 — Quran library repeated-audio counter:** `QuranLibraryView.handlePlayAyah` installs `audio.onended` with a closure over `currentRepeatCount`. The callback replays the same Audio instance after a state update, so the callback continues reading the original captured count; when target repeats exceed one, it can replay indefinitely. Add a deterministic fake-Audio regression test and replace closure state with a ref or a callback that reads current state.
- **P1 — Advisor API quota protection:** `api/advisor.ts` exposes a Gemini-consuming POST without Firebase ID-token verification. Wildcard CORS is not authentication. Its in-memory IP rate limiter is per serverless instance and therefore not a reliable abuse-control boundary. Add verified auth/guest policy, distributed quota enforcement, request-size/range validation and usage monitoring before public release. The configured model ID `gemini-3.8-flash` is a valid current Google model; the issue is access control, not the model string.
- **P1 — Firestore conflict safety:** rules correctly require verified UID ownership, allowlisted collections, typed envelopes and immutable events. However they do not enforce server-owned monotonic revision/CAS or restrict eventType to the supported domain-event set; client-supplied timestamps/payloads are structurally accepted. Do not enable two-device last-writer-wins or remote projection based on these rules.
- **P1 — Web Locks browser compatibility:** the local journal replayer and journaled writer refuse to proceed when Web Locks are unavailable. This is safe against concurrent corruption, but browser compatibility must be tested on iOS Safari/older browsers and an equally safe locking strategy chosen before declaring all devices supported.
- **P2 — PWA update lifecycle:** `App.handleApplyPwaUpdate` sends `SKIP_WAITING` then reloads immediately; it should wait for `controllerchange` or an explicit activation acknowledgement to avoid a stale-controller reload race.
- **P2 — Auth screen lifecycle:** verification resend cooldown timer lacks unmount cleanup; clipboard action does not await/catch the clipboard promise. Fix alongside auth UX tests.
- **P2 — Domain-event coordinates:** event validator accepts any ayah number up to 286 for any Surah. Use canonical per-Surah verse counts, not a global upper bound.
- **P2 — PWA orientation and attribution:** manifest is portrait-only; review tablet landscape behavior. Tanzil license/source date is present in metadata but the exact source URL/version/checksum and user-visible attribution need a single authoritative record.
- **P2 — Error boundaries:** the root app entry has no visible React error boundary. Add a recovery boundary that preserves local data and offers reload/export rather than a blank screen.

### Branch audit completion

The complete matrix is saved in `BRANCH_COMPARE_MATRIX.md`. All 70 refs were compared. Four branches have zero unique commits and are behind main; they are archive candidates, but this connector exposes no branch deletion operation, so they were left untouched. The other 65 non-main refs are diverged and contain unique commits; preserve them until their unique patches are reviewed. The five open PRs remain unchanged.

### Updated file review count

The per-file register now has 147 exact rows: **57 reviewed initially, 90 pending**. "Reviewed initially" is not final sign-off; tests, callers, and full remaining line ranges still need cross-checking. The remaining review must cover all UI, planning, revision, progress, audio, tests, utilities, backup validation, service-worker/PWA assets and all docs/config files.

## 10. Final file inventory closure

All 147 tracked files now have an individual note in FILE_AUDIT_REGISTER.md. The three PNG files were fetched as base64 and visually inspected: each renders as a flat dark-teal square with no discernible WIRD mark/wordmark. This is a P2 PWA-branding defect, not a missing binary inspection. All 147 file rows are marked REVIEWED (initial); the notes still distinguish initial inspection from deeper follow-up needed for specific call sites/tests.

## 11. Remediation execution checkpoint

The initial audit phase is complete: 147/147 baseline files have per-file notes, and the original 70 branches were compared. The live repository now has 76 branches because five remediation branches and one audit branch were created after the baseline snapshot.

Draft remediation PRs:
- #61 backup import journal boundary — CI PASS, 404/0, Vercel Preview Ready.
- #62 plan lifecycle history preservation — CI PASS, 406/0, Vercel daily build-rate limit blocked preview.
- #63 Quran audio repeat controller — CI PASS, 404/0, Vercel daily build-rate limit blocked preview.
- #64 Tafsir HTML/JSON guard — CI pending at last check.

Main SHA remains unchanged. No merges, production deployments or Firestore rule deployments have been performed. The remote replication design document referenced by AGENTS.md was added on the audit branch at docs/sync/REMOTE_REPLICATION_PLAN.md.

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
