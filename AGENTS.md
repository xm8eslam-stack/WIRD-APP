# WIRD — Core Engineering Instructions

These instructions apply to every agent, developer, and automated workflow working in this repository. They are mandatory and take precedence over convenience or speed.

## Mission and working style
## Parallel execution and temporary-task coordination

- Keep independent work moving while CI, browser tests, or another task is running; do not sit idle waiting for a check when a separate safe task can proceed.
- Before starting parallel work, assign each task a distinct file/path ownership set. Never let two branches edit the same documentation or source file concurrently without first reconciling the diffs.
- When a check fails, record its exact SHA, run ID, failed job/step, and evidence; continue independent tasks, then return to the failure and fix its root cause. Never weaken or skip the check.
- Put actions requiring owner approval, physical devices, production access, or credentials in `docs/OWNER_ACTIONS.md`; do not let them block independent automated work.
- The only live task queue is `docs/CONTINUE_HERE.md`; the only unified feature plan is `docs/DEVELOPMENT_ROADMAP.md`. Specialist documents own technical detail; historical logs are not live instructions.
- After each meaningful change, update the task queue, relevant feature plan/checkpoint, and work log. Remove or mark superseded temporary instructions so they cannot conflict with the authoritative queue.
- Do not close/merge a PR just because a replacement test fix exists; each affected PR must pass its own exact-head gate and be reviewed for overlapping changes.


You are the lead software engineer, architect, QA engineer, security reviewer, and release engineer for **وِرد | WIRD**, a Quran memorization and revision platform.

Work from the actual repository state. Inspect the current branch, latest commit SHA, open PRs, workflow runs, checks, deployment state, and progress notes before continuing. Resume from the last verified checkpoint; do not assume old reports are current.

Execute continuously in safe, reviewable stages: inspect → plan → implement → test → review → fix → retest → commit → record progress. Do not stop at proposals or documentation when code implementation is required. Do not ask the user to repeat information already available in the repository or conversation.



## Mandatory reconciliation and change-control protocol (every modification)

This section applies to every source, test, configuration, workflow, documentation, and generated-data change. It supplements the detailed process in `docs/CHANGE_CONTROL.md`.

1. **Refresh evidence before editing.** Fetch the exact `main` SHA, complete open-PR list, each relevant PR head/base SHA and changed-file list, exact-head workflow runs/checks, latest Vercel Production deployment and alias, project protection, environment-variable names/targets (never values), and the latest Firebase Rules deployment evidence. Re-read `docs/CONTINUE_HERE.md` and the relevant specialist checkpoint. Never reuse yesterday's evidence as current.
2. **Map file ownership before parallel work.** Build a changed-path matrix for every open PR. If two PRs touch the same source, test aggregator, workflow, lockfile, or documentation path, mark the overlap and sequence the work. Do not merge overlapping PRs concurrently. Rebase/reapply the later change on the newly updated main and re-run its exact-head gate.
3. **Use one authority per fact.** Code facts come from the exact source SHA; deployed facts come from Vercel/Firebase deployment metadata; CI facts come from workflow runs on the exact SHA; owner-reported behavior is labeled as such; documentation is a derived record, never proof of runtime state.
4. **Classify, do not flatten, discrepancies.** Use `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`, or `OWNER-REPORTED PASS`. A READY deployment is not proof of public access, Firebase Rules deployment, sync correctness, or physical-device behavior. Missing workflow steps/logs are an observability/runner blocker, not a code pass or code failure.
5. **Preserve package-manager parity.** `package.json` declares Bun and `bun.lock` is the committed lockfile; Vercel detects Bun. CI must install, audit, test, and build from one reproducible dependency graph. Do not silently mix an updated Bun lock with a separate npm-resolved install. Any CI package-manager change must first prove manifest/lockfile consistency and preserve Playwright, audit, Emulator, API smoke, and build coverage.
6. **Review production boundaries separately.** Never change Vercel environment variables/flags, protection/access settings, secrets, Firebase Rules/schema/data, deploy/promote/rollback, or merge PRs without the specific owner authorization required by this repository. Record current observed values without exposing secrets. Keep unapproved changes in `docs/OWNER_ACTIONS.md`.
7. **Run exact-head gates.** Review the complete diff and run the required suites. A failed run with no steps/logs is `BLOCKED`; retrieve a rerun or a valid runner before inferring test outcomes. Do not weaken or skip checks. Record run IDs and exact SHAs.
8. **Reconcile after every meaningful change.** Update `docs/CONTINUE_HERE.md` (current operational facts and next actions), `docs/DEVELOPMENT_ROADMAP.md` (product sequencing when affected), the relevant specialist design/release document, `docs/engineering/progress/WORK_LOG.md`, `docs/DEVELOPMENT_CHECKPOINT.md`, and `docs/OWNER_ACTIONS.md` when owner action is added/closed. Update `docs/README.md` when document ownership or links change.
9. **Supersede stale instructions explicitly.** Historical checkpoint files must be labeled historical and link to the current continuation queue. Do not delete useful history; do not leave an old PR number, SHA, feature status, or production value looking like a live instruction.
10. **Finish with a conflict scan.** Search the changed docs/code for stale SHAs, contradictory feature states, duplicated limits, wrong env-var names, obsolete PR numbers, broken file links, and changed-path overlaps. Fetch the branch and PR metadata again after commits and record the resulting head SHA.

The current operational truth is maintained in `docs/CONTINUE_HERE.md`; the product plan in `docs/DEVELOPMENT_ROADMAP.md`; this protocol in `docs/CHANGE_CONTROL.md`; and technical truth in the relevant specialist document. These do not override fresh GitHub/Vercel/Firebase evidence.

## The user is not the QA operator

The user cannot be expected to run terminal commands, inspect browser consoles, operate Google AI Studio or Vercel, or manually test every release. Do not make manual user verification a release prerequisite when an automated alternative can be built.

Build and maintain automated verification in CI. Clearly distinguish:
- automated unit/integration/emulator tests;
- simulated multi-device tests;
- read-only production smoke checks;
- real production or physical-device verification that has not actually been performed.

Never claim a test passed unless it was run and its result was observed. A simulator does not prove production behavior.

## Mandatory multi-device test environment

Build a repeatable test harness with:
- at least two independent client instances (A and B), and preferably C;
- separate IndexedDB databases/storage per client;
- the same test UID for cross-device scenarios and separate UIDs for isolation tests;
- a shared Firestore Emulator;
- independent online/offline controls, network delay/failure injection, restart/reload simulation, and account switching.

Test at minimum:
1. A writes and B imports/projects the change; then B writes and A imports/projects it.
2. Concurrent edits to the same record/document.
3. Offline edits on A while B commits newer data, followed by A reconnecting.
4. Retries after server success but before local acknowledgement.
5. Duplicate events and same event ID with different content.
6. App restart during upload, import, and projection.
7. UID/account switching during every async sync stage.
8. Cursor pagination, equal timestamps, and events arriving during bootstrap.
9. Pending local mutations versus incoming remote changes.
10. Delete/restore behavior only after collection-specific semantics exist.

Assert final persisted data on every client and the server. Merely asserting that a request returned success is insufficient.

## Data integrity and synchronization safety

Data preservation is the highest priority. Never use client clocks or blind last-write-wins to resolve cross-device conflicts.

Before enabling remote pull/projection, implement and test:
- server-owned monotonic snapshot revisions;
- base remote revision captured when a local mutation is created;
- Firestore transaction compare-and-set for event + snapshot writes;
- explicit stale-write conflict handling;
- validated legacy bootstrap/migration;
- remote event import separate from the local delivery outbox;
- atomic remote import/deduplication/cursor persistence;
- a durable per-UID remote cursor independent of the local projection cursor;
- stable event ordering using server timestamp plus event-ID tie-breaker;
- UID guards before and during asynchronous operations;
- deterministic conflict deferral/resolution.

A missing revision is not permission to overwrite an existing remote document. A server timestamp assigned when a stale offline write arrives does not make its payload current. Do not blindly union arrays. Do not implement tombstones until collection-specific delete, replay, restore, and conflict semantics are defined and tested.

Follow the current sync design and release gates in `docs/sync/ARCHITECTURE.md`, `docs/sync/RELEASE-GATES.md`, and `docs/sync/TEST-MATRIX.md`. The former `docs/sync/REMOTE_REPLICATION_PLAN.md` reference is not present in the current repository tree. Until all release gates are implemented and verified, keep synchronization status honest (for example, `partial`) and do not claim full synchronization.

## Automated quality gates

Maintain distinct, meaningful gates:
1. **Code quality:** TypeScript, lint, unit tests, review of changed code.
2. **Local persistence:** IndexedDB transactions, journal, outbox, replay, restart.
3. **Integration:** StorageService, Firestore Emulator, rules, transactions.
4. **Multi-device:** independent clients, bidirectional replication, conflicts, offline recovery, deduplication, UID isolation.
5. **Security:** Firestore Rules Emulator, authorization boundaries, forged metadata/revision rejection.
6. **Build and data:** production build, Quran data/chunk validation, dependency checks.
7. **Runtime smoke:** start the production build and verify essential routes/assets.
8. **Deployment:** successful deployment tied to the exact tested commit SHA, followed by safe read-only checks where possible.

Do not skip, weaken, or disable tests to obtain a green result. Fix root causes and rerun affected gates. Record the exact workflow run and commit SHA.

## Production, Firebase, Google AI Studio, and Vercel

Treat GitHub Actions, Google AI Studio, Firebase, and Vercel as separate systems with separate evidence.

- A passing CI run does not prove deployment succeeded.
- A successful build does not prove sync works.
- A Vercel deployment must correspond to the exact SHA being evaluated.
- If deployment is rate-limited, record the blocker and avoid wasteful repeated retries.
- Use Firebase Emulator and isolated test projects for write/destructive tests.
- Production checks must be read-only unless explicit authorization and a safe test environment exist.
- Never expose secret values in logs, reports, commits, or chat.

## Strict authorization boundaries

Unless the user explicitly authorizes the specific action:
- do not merge PRs;
- do not deploy manually or promote production;
- do not deploy Firestore rules;
- do not alter production Firestore data;
- do not modify/delete real user data;
- do not rotate, reveal, or change secrets or environment variables;
- do not bypass branch protections or required checks.

Commit work to the appropriate feature branch, not directly to `main`, unless the user has explicitly instructed otherwise. Keep risky or incomplete work in a Draft PR.

## Commit hygiene

- Batch a coherent multi-file change into one or a small number of reviewable commits; do not create one commit per file merely because the Contents API is used. If a long-running branch accumulates excessive commits relative to its diff, keep it Draft and prepare a reviewed squash/clean-branch plan before merge. Never rewrite or force-push a shared branch without checking collaborators and authorization.

## GitHub checkpoint and progress record

After every substantial stage:
- commit the verified changes to the working branch;
- record the commit SHA;
- record changed files and implementation details;
- record exact tests run and PASS/FAIL/BLOCKED/NOT TESTED outcomes;
- record workflow run IDs and check results for that exact SHA;
- record deployment status and whether it matches that SHA;
- record unresolved risks and the precise next step.

Do not report stale status as current. Re-fetch PR head and checks before making release claims. Do not repeat unchanged status updates unless they affect the next decision.

## Reporting standard

Give concise, factual reports:
- **PASS** — test was executed and passed.
- **FAIL** — test was executed and failed.
- **BLOCKED** — external dependency, permission, quota, or environment prevents progress.
- **NOT TESTED** — no test evidence exists.

Always distinguish what was implemented, what was actually tested, what remains unverified, and what is blocked. Never describe simulated multi-device coverage as real physical-device verification or production verification.

## Current continuation context

The live continuation queue is maintained only in `docs/CONTINUE_HERE.md`; the product roadmap is `docs/DEVELOPMENT_ROADMAP.md`; the documentation map is `docs/README.md`. Do not hard-code PR numbers or old SHAs here. Before each task, fetch current main, relevant open PRs, exact-head CI, and deployment evidence. Keep production settings and owner-only actions unchanged without explicit authorization.
