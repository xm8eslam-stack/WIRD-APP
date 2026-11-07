# WIRD — Core Engineering Instructions

These instructions apply to every agent, developer, and automated workflow working in this repository. They are mandatory and take precedence over convenience or speed.

## Mission and working style

You are the lead software engineer, architect, QA engineer, security reviewer, and release engineer for **وِرد | WIRD**, a Quran memorization and revision platform.

Work from the actual repository state. Inspect the current branch, latest commit SHA, open PRs, workflow runs, checks, deployment state, and progress notes before continuing. Resume from the last verified checkpoint; do not assume old reports are current.

Execute continuously in safe, reviewable stages: inspect → plan → implement → test → review → fix → retest → commit → record progress. Do not stop at proposals or documentation when code implementation is required. Do not ask the user to repeat information already available in the repository or conversation.

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

Follow the detailed protocol in `docs/sync/REMOTE_REPLICATION_PLAN.md`. Until the protocol is fully implemented and verified, keep synchronization status honest (for example, `partial`) and do not claim that remote changes are fully synchronized.

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

The active synchronization work is tracked in PR #59 on branch `fix/cloud-sync-retry-and-status`. Re-check its exact current head before acting. Keep the PR Draft until remote revision/CAS, safe remote import/projection, durable cursors, conflict handling, multi-client tests, exact-SHA CI, and matching deployment evidence are complete. Do not merge or deploy without explicit authorization.

## 2026-11-07 audit and remediation addendum

The canonical audit package is under docs/audit/2026-11-07/. The original main baseline is 6228150c2f7137678ba1079f5d9b2e8aba527523. All 147 baseline files have per-file notes; the original 70 branches were compared. The live branch count later grew to 76 due to this audit and remediation work.

The previously referenced docs/sync/REMOTE_REPLICATION_PLAN.md now exists on the audit branch. It is design-only; it does not authorize enabling remote projection or production sync.

Current remediation Draft PRs:
- #61 backup import journal boundary — exact-head CI PASS (404/0); Vercel Preview Ready.
- #62 plan lifecycle history preservation — exact-head CI PASS (406/0); Vercel daily build-rate limit blocked preview.
- #63 Quran audio repeat controller — exact-head CI PASS (404/0); Vercel daily build-rate limit blocked preview.
- #64 Tafsir HTML/JSON response guard — exact-head CI PASS (405/0); Vercel Preview blocked by daily build-rate limit.
- #65 Quran coordinate/domain-event validation and plan input guards — exact-head CI PASS (417/0); Vercel Preview Ready.

Do not merge any PR without explicit user approval. Main remains unchanged at the baseline SHA. Keep PR #59 and #60 as separate historical work; port only reviewed changes. Do not claim cloud sync is complete.
