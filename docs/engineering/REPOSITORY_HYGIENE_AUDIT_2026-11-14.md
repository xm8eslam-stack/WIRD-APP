# WIRD Repository Hygiene Audit — 2026-11-14

## Scope and baseline

- Repository: `xm8eslam-stack/WIRD-APP`
- Default branch: `main`
- Audited baseline: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`
- Working branch: `chore/repository-hygiene-20261114`
- Recursive Git tree: 310 tracked paths; not truncated.
- Top-level inventory: 192 paths under `src/`, 43 under `docs/` (including directories), 19 under `e2e/`, 10 under `.aistudio/`, 10 under `public/`, 9 under `scripts/`, and 78 test/spec-named files across the repository.
- 14 open PRs were observed at audit time. Their branches and PR records were not deleted or closed.

## Changes made on this branch

1. Removed `.aistudio/artifacts/brain/54884aa9-9ac7-4435-a6bc-5bf9ab6e69b8/.tempmediaStorage/media_1794314548557_10eec1ab.jpg`.
   - It was the only tracked file under that `.tempmediaStorage` directory.
   - GitHub code search found no reference to the exact filename or artifact UUID.
   - The associated `blueprint_v1.md` and `implementation_plan.md` were checked for media/file references; none were found.
   - The associated blueprint and metadata were retained because the artifact is explicitly marked user-facing and contains product/architecture information.
2. Replaced the leftover scaffold workspace name `react-example` with `wird-app` in `package.json` and the root workspace entry in `bun.lock`. No dependency versions or lock resolutions were changed.

## Deliberately retained

- Quran text, Quran metadata/chunks, Mushaf assets, religious-source attribution/policy files, and validation scripts.
- Firebase configuration, Firestore rules, authentication/sync code, migrations, user-data recovery paths, journals, outbox/inbox, conflict evidence, and backup/restore logic.
- CI workflows, E2E tests, scripts, and test fixtures until an import/call-site/workflow audit proves them unused.
- Historical engineering checkpoints, release gates, and PR/branch history. These may be stale as current-status documents, but retain valuable decision and verification evidence. Consolidation must preserve the audit trail and must not silently discard unresolved safety constraints.
- The Google AI Studio artifact blueprint and implementation plan. Their contents are not disposable cache data.

## Findings requiring a separate, evidence-led pass

- Documentation has overlapping checkpoint/status files with historical dates. Establish one current index and clearly label superseded checkpoints before considering removal.
- Open PRs #358 and #359 are overlapping early offline-audio manifest efforts; #368 is a later unified direction. They remain open Drafts and were not closed because their latest diffs, shared-path overlap, and dependency relationship need a final exact-head review.
- Open PR #2 is a long-running UI/UX Draft. It was not closed or deleted.
- A repository-wide source import/call-site graph and fixture-aware dead-code analysis has not yet been completed. No runtime source files were deleted based only on filename heuristics.
- Google AI Studio and Vercel synchronization/deployment were not changed or inferred from GitHub state.

## Verification status

- GitHub recursive tree inventory: PASS (310 paths; `truncated=false`).
- Exact media-reference checks: PASS (no matching filename/UUID in indexed code search; no media references in the two associated Markdown artifacts).
- Package metadata/lockfile textual alignment: PASS (both root workspace names updated to `wird-app`).
- TypeScript, unit/integration tests, Firestore Emulator, Playwright, and production build: NOT RUN in this GitHub-only pass.
- GitHub Actions on this new head: NOT VERIFIED.
- Vercel Preview/Production and live smoke: NOT VERIFIED.
- Main branch, Firebase, Vercel settings/secrets, Firestore rules/data, sync flags, and Google AI Studio configuration: UNCHANGED.

## Safety rule for the remaining cleanup

Delete only after proving the candidate is not imported, dynamically loaded, referenced by a workflow/configuration, generated as a required artifact, or needed for recovery/audit. Never use broad filename-only deletion. Work in small commits and re-run the affected gates on the exact resulting SHA.


## CI follow-up — 2026-11-14

- GitHub Quality Gate run `43563485355` completed with conclusion `failure` on the branch head.
- Its only job, `Tests, TypeScript, and production build` (job `132352113280`), reports no step summaries; fetching job logs returned a missing-blob response. This is insufficient evidence to attribute the failure to a source/test assertion.
- A retry request for failed jobs was accepted by the GitHub API, but the available run listing still reports the original run as failed and exposes no new successful attempt.
- The Vercel status context on the same head reports `success` and points to a Vercel deployment record. The deployment's exact ready state, alias, and live HTTP behavior were not independently verified in this pass.
- Therefore the Quality Gate remains **BLOCKED / NOT VERIFIED**, not PASS. Do not merge on the basis of the Vercel status alone.
