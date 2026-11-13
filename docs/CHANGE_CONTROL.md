# WIRD — Change Control & Evidence Reconciliation

**Status:** Mandatory operating policy  
**Updated:** 2026-11-13  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Production source branch:** `main` (Google AI Studio is configured to use main; actual AI Studio sync must be verified separately)

## 1. Source-of-truth hierarchy

No single system proves the state of another system.

| Fact | Authoritative evidence | Not sufficient |
|---|---|---|
| Source code | GitHub branch/ref + exact commit SHA | Old checkpoint, local recollection |
| PR state and overlap | Current PR metadata + changed-file lists + current heads | PR title or stale handoff |
| CI result | Workflow run tied to exact SHA, job steps and logs | Green badge on another SHA; failure without steps |
| Production deployment | Vercel deployment metadata: target, source SHA, state, alias | Preview READY; GitHub Vercel status alone |
| Public reachability | Project protection configuration + anonymous read-only smoke | Domain verified or deployment READY |
| Runtime config | Vercel variable key/target inventory (values hidden) | Code defaults or stale docs |
| Firebase Rules | Successful Rules deployment run + deployed rules blob/source SHA | Emulator tests or a workflow file |
| Google AI Studio | Direct sync/build evidence from AI Studio | GitHub commit alone |
| Physical device | Recorded device/browser/network test | Playwright emulation or emulator |

When sources disagree, preserve both observations, identify the system and timestamp, and do not silently pick the more convenient value.

## 2. Mandatory workflow for every change

### Before editing
1. Read `AGENTS.md`, `GEMINI.md`, `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_ROADMAP.md`, this policy, and the relevant specialist docs.
2. Fetch current `main` SHA, complete open PRs, relevant head/base SHAs, changed files, review state, and exact-head workflow runs.
3. Fetch current Vercel Production deployment (including target, source SHA and aliases), domain/protection state, and environment-variable key/target inventory without decrypting values.
4. Fetch the latest Firebase Rules deployment evidence and distinguish it from Emulator results.
5. Build a path-ownership table. Identify overlaps in source files, test registries such as `src/tests/runAllTests.ts`, package manifests/lockfiles, workflows, and docs.
6. Put any owner-only decision in `docs/OWNER_ACTIONS.md` before it can block independent work.

### During editing
1. Work from a fresh feature branch or the already-authorized task branch; never edit `main` directly.
2. Keep parallel tasks on disjoint path sets. If a shared file must change, serialize edits and rebase/reapply after the first change lands.
3. Do not raise byte limits or remove data constraints as a substitute for the approved architecture.
4. Keep local data, user data, secrets, Firebase, Production configuration, and public-access settings within their explicit authorization boundaries.
5. Add tests with the implementation. Do not update test assertions merely to match an unverified behavior.
6. Keep one package-manager dependency graph. The committed `bun.lock` is authoritative because `package.json` declares Bun and Vercel detects Bun. CI must not run a second independent npm install for the application graph. If Playwright needs a package, make its dependency treatment explicit and reproducible.

### Commit hygiene
Batch related changes into one or a few coherent commits. Avoid a separate commit per file. If a branch becomes disproportionately long relative to its changed-file set, keep it Draft, inspect the full commit and file history, and prefer a clean/squash strategy only after reviewing the exact diff. Never force-push a shared branch without checking collaborators and authorization.

### Before PR completion
1. Review the complete diff, not only the summary.
2. Run all relevant automated suites and the full required Quality Gate on the exact current PR head.
3. Inspect job steps/logs. If GitHub reports failure but provides no job steps/logs, classify as `BLOCKED` until runner evidence is restored; never call it code failure or pass.
4. Review PR overlaps against all open PRs. Do not merge two PRs that both edit a shared file without sequencing and revalidation.
5. Re-fetch the PR head after all commits and ensure the check SHA exactly matches it.
6. Keep incomplete work Draft. No merge/deploy is implied by the request to audit or repair.

### After a merge (only when authorized)
1. Re-fetch main and record the merge SHA.
2. Verify a post-merge Quality Gate on the exact new main SHA.
3. Verify Vercel Production is READY on that exact SHA and alias, then perform read-only smoke.
4. Verify Firebase Rules deployment separately if Rules changed.
5. Reconcile runtime flags and public-access requirements with the approved owner decision.
6. Update all live docs and perform the stale-fact/link/overlap scan again.

## 3. Evidence vocabulary

- **PASS:** the stated test or check ran and succeeded on the recorded SHA.
- **FAIL:** the stated test ran and failed, with an identified step/log.
- **BLOCKED:** an external dependency, permission, quota, runner, or missing observability prevents a valid result.
- **NOT TESTED:** no execution/evidence exists.
- **OWNER-REPORTED PASS:** the owner reports a real-world result, but no independent trace exists.
- **READY:** Vercel deployment lifecycle state only; it does not mean public, correct, secure, or fully tested.

Never turn a blocked or untested item into a pass by inference.

## 4. Conflict register — 2026-11-13

This is a dated observation, not permission to change production settings.

| Area | Verified observation | Reconciliation / action |
|---|---|---|
| GitHub main | `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` | Current source baseline at audit time |
| Production deployment | `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, READY, target production, alias `wird-app.vercel.app`, exact same SHA as main | Source/deployment parity PASS; live functional smoke is separate |
| Public access | SSO protection enabled for all non-custom domains; only `wird-app.vercel.app` is listed and verified | Anonymous public access is not established; owner decision required; do not change protection automatically |
| Sync flags | `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` for Production | Runtime state is ON; full release certification is still HOLD. Do not silently call the flags OFF or toggle them without specific approval |
| IslamicAPI key | `ISLAMICAPI_API_KEY` exists as a sensitive variable for Preview and Production | Old notes claiming Production only has `ISLAMICAPI_API_KEY1` are stale. Never read or disclose the value |
| Branch protection | `main` reports `protected=false`; required checks enforcement is off; repository rulesets list is empty | GitHub enforcement gap. No settings change performed; owner/admin authorization and an agreed ruleset are required |
| CI | Recent PR workflow runs ended in 3–4 seconds; jobs had no steps; log retrieval returned `BlobNotFound`. No recent main-branch workflow run was returned | Runner/log observability BLOCKED. This is not evidence of source failure or a pass |
| Package manager | `package.json` declares `bun@1.4.4`; `bun.lock` exists; Vercel detects Bun; CI runs `bun install --force` then `npm install` and `npm audit` | Dependency graph parity conflict. Replace with one Bun-based frozen install/audit/test/build only after validating the lockfile and Playwright dependency path |
| Engine Plans | Main still uses localStorage with a 100-plan limit; #367 is only a temporary 800,000-byte sync budget; #371 is a codec-only PR | IndexedDB archive integration/migration remains unimplemented; do not raise limits as a substitute |
| Offline audio | #368 is an unmerged Draft branch with repository, Cache Storage adapter, downloader and job lifecycle work | These changes are not in main/Production; no UI/SW/offline playback/device completion claim |
| PR coordination | #365, #367, #368, #369 and #371 all modify `src/tests/runAllTests.ts`; #367 and #369 also modify `PlanningEngineWizard.tsx`; #358/#359 use an older base and are superseded by #368 | Serialize test-registry and wizard changes; rebase/reapply and rerun exact-head checks after each preceding merge |
| Firebase Rules | Emulator coverage exists; latest deployed Production Rules source/blob was not independently verified in this audit | Emulator PASS does not prove Production Rules deployment |
| Google AI Studio | `main` is configured as source; actual sync/build state not observed | Keep as NOT TESTED until direct evidence |

## 5. Mandatory document reconciliation

After each meaningful change, update:
- `docs/CONTINUE_HERE.md` — current live state and next action;
- `docs/DEVELOPMENT_ROADMAP.md` — product sequencing if affected;
- the relevant specialist design/release document;
- `docs/engineering/progress/WORK_LOG.md` — append-only evidence log;
- `docs/DEVELOPMENT_CHECKPOINT.md` — latest verified checkpoint;
- `docs/OWNER_ACTIONS.md` — add/close owner decisions;
- `docs/README.md` — document map if links/ownership change.

Older checkpoint files are historical. Add a banner pointing to the current continuation file; preserve their dated evidence, but never present old SHA/PR/environment facts as current.

## 6. Non-negotiable approval boundaries

No automatic merge, production deploy/promotion/rollback, Firebase Rules deployment, production data mutation, Vercel environment/protection change, secret rotation, or sync-flag change. Obtain the specific owner approval first and preserve an auditable before/after record.

## 7. Bun lockfile and CI dependency-graph incident — 2026-11-13

The main-branch source was re-read at `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`:
- `package.json` declares `packageManager: bun@1.4.4`, Node `>=24.12.0 <27`, and override `@grpc/grpc-js: 1.14.6`.
- `bun.lock` is stale against that manifest: its workspace dependency map omits manifest entries (including the Firebase Rules test dependency), records `esbuild ^0.25.0` while the manifest requires `^0.28.2`, and does not reflect the current override configuration.
- `.github/workflows/ci.yml` currently runs `bun install --force` (refreshing the lock), then a separate `npm install`, a no-save npm Playwright install, and npm audit/test/lint/build. This creates two dependency-resolution graphs and means the committed lock is not the graph actually used for most checks.
- Isolated Bun 1.4.4 verification already showed `bun install --frozen-lockfile` fails on the committed lock with “lockfile had changes, but lockfile is frozen”; regenerating the lock in an isolated package-only sandbox then allowed frozen install and `bun audit --audit-level=high` (0 advisories / 360 packages). That regenerated lock was not committed. Full private source tests, typecheck, build and Playwright were NOT TESTED.

**Required repair sequence:**
1. Obtain a trusted full-source checkout at the exact target SHA in an authorized isolated environment; do not rely on package-only verification as app validation.
2. Regenerate `bun.lock` using Bun 1.4.4 against the unchanged manifest, then prove `bun install --frozen-lockfile` succeeds from a clean state.
3. Add Playwright as an explicit pinned dev dependency (or document and prove another reproducible Bun-native runner arrangement); remove `npm install`, `npm audit`, and the transient no-save Playwright installation from the app dependency path.
4. Run Bun-native audit, tests, TypeScript validation, production build, server/API smoke, Firestore emulator tests, and Playwright browser tests from that one graph. Keep tool-only ephemeral CLI use explicitly separate from application dependencies.
5. Review the exact diff and lockfile package graph; then require a fresh exact-head CI run with inspectable steps/logs. Do not weaken checks or edit main directly.

Until all five steps pass, classify the dependency repair as IN PROGRESS / BLOCKED for full-source validation. Do not claim the isolated audit is a full app security or build pass.


## 8. Exact changed-path overlap refresh — 2026-11-13

The paginated GitHub changed-filename lists were fetched for PRs #2, #358–#371. This is the exact overlap register from those lists (not inferred from PR titles):

| Shared path | PRs | Required handling |
|---|---|---|
| `src/tests/runAllTests.ts` | #365, #367, #368, #369, #371, #358, #359, #2 | One-at-a-time serialization. After each accepted change, reapply the next patch to the new base and rerun its exact-head suite. |
| `src/components/plans/PlanningEngineWizard.tsx` | #367, #369, #2 | Resolve #367/#369 product interaction in sequence; #2 is stale and must not be merged wholesale. |
| `src/App.tsx`, `src/components/layout/Sidebar.tsx` | #365, #2 | #365 owns current Seerah integration; inspect #2 only for isolated non-stale changes. |
| `src/components/settings/SettingsView.tsx` | #366, #2 | #366 owns current offline settings integration; do not merge #2 wholesale. |
| `src/components/session/MemorizationSessionView.tsx` | #370, #2 | #370 owns current display preferences UI; selectively reconcile any still-needed #2 behavior. |
| `api/advisor.ts`, `src/services/advisorService.ts`, `src/tests/geminiSecurity.test.ts` | #364, #2 | #364 is the isolated current Advisor security patch; #2 remains stale. |
| `docs/DEVELOPMENT_CHECKPOINT.md`, `docs/engineering/FIRESTORE_SYNC_DESIGN.md` | #363, #2 | #363 is the canonical documentation consolidation; do not merge #2's historical copies. |
| `docs/offline/OFFLINE_AUDIO_DOWNLOAD_PLAN.md` | #363, #359 | #363 owns current offline audio contract/plan. #359 is a stale predecessor to #368 and must not overwrite it. |

PR #2 touches 37 paths and overlaps current work across advisor, Seerah/App shell, settings, session, plan wizard, test registry and docs. It remains OPEN/DRAFT/non-mergeable on a stale base; do not merge or rebase wholesale. If a specific still-needed change is discovered, extract only that commit/hunk after reviewing its provenance and re-test on current main. #358/#359 are also stale predecessors; #368 is the unified audio implementation branch, but it still requires its own exact-head validation and remaining SW/UI/playback work.

Current active PR changed-file counts from the paginated lists: #363 36, #364 3, #365 16, #366 7, #367 9, #368 7, #369 6, #370 5, #371 3. The exact path list remains queryable from GitHub; the table above records all cross-PR collisions.


## 9. Bun single-graph CI candidate — 2026-11-13

PR #372 (`fix/bun-single-graph-ci-clean-20261113`) proposes one Bun 1.4.4 application dependency graph:
- `package.json`: add pinned `@playwright/test@1.56.1`; add `trustedDependencies` for `@firebase/util`, `esbuild`, and `protobufjs`; use `bunx firebase-tools@15.0.0` for the Firestore CLI.
- `bun.lock`: regenerated from the existing main lock as the seed (not from an empty graph), resolving the manifest drift and adding Playwright.
- `.github/workflows/ci.yml`: replace Bun force-refresh + npm install/audit/test with `bun install --frozen-lockfile`, `bun audit`, and `bun run`/`bunx` commands. Existing test, mushaf, API smoke, approved audio CDN, Firestore Rules, TypeScript, build, server smoke, and Playwright checks are retained.
- `playwright.config.ts`: preview web server now runs via `bun run preview`.

Isolated package validation on Bun 1.4.4: force install PASS; frozen install PASS; `bun audit --audit-level=high` PASS (0 advisories / 360 packages); Playwright CLI 1.56.1 PASS; Firebase CLI 15.0.0 PASS; Bun pretest/prebuild lifecycle behavior PASS in a fixture. The package-only sandbox did not contain private app source, so full app tests/typecheck/build/Firestore/browser tests remain NOT TESTED.

An experiment adding `firebase-tools@15.0.0` to the application devDependencies caused high advisories in its separate CLI graph (including `basic-ftp` and `zod`); it was removed from the app graph and pinned as a `bunx` tool instead. The final app graph audit passed.

PR #372 head `950640ea78d29e87d426a89d8887c15e4de2abac`, one commit, 4 changed files, OPEN/DRAFT, not merged. Its GitHub Actions run `43391729769` failed immediately; attempt 2 job `131773203535` again had `steps=null` and `logs_url=null`; fetching logs returned `BlobNotFound`. This is BLOCKED runner/log observability, not evidence of a source test failure or pass. Vercel status on this SHA says `Deployment rate limited — retry in 24 hours`; no preview deployment was created. Production remains READY on main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.

Do not merge #372 until exact-head full-source checks run with inspectable steps/logs and all checks pass. Do not weaken the Quality Gate. No main, production, Firebase Rules, secrets, or sync flags were changed.


## 10. PR #372 path isolation and Vercel preview policy — 2026-11-13

PR #372 changes exactly four paths: `package.json`, `bun.lock`, `.github/workflows/ci.yml`, and `playwright.config.ts`. A fresh changed-file comparison against PRs #363–#371, #358, #359, and #2 found **no shared paths**. It can be validated independently of the `runAllTests.ts` and `PlanningEngineWizard.tsx` overlap queue.

The repository `vercel.json` explicitly sets `git.deploymentEnabled` to `* = false` and `main = true`; feature-branch Vercel preview deployments are therefore disabled by repository policy. In addition, the Vercel commit status on #372 SHA reports `Deployment rate limited — retry in 24 hours`. Do not change this branch deployment policy or Vercel settings to force previews. Production remains the separate READY deployment on main.

PR #372 remains OPEN/DRAFT, one commit, head `950640ea78d29e87d426a89d8887c15e4de2abac`, mergeable=true at last read. GitHub Actions attempt 2 remains BLOCKED due missing job steps/logs (BlobNotFound).
