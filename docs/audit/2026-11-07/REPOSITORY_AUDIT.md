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
- [ ] Detailed review of all 147 files.
- [ ] Exact compare/disposition for all 70 branches.
- [ ] Final full architecture report.
- [ ] Final separate not-ready report.
- [ ] Final remediation roadmap and continuation prompt.
- [ ] Begin remediation after reports are complete.
