# WIRD Engineering Documentation Index

Last reviewed: 2026-11-14  
Repository: `xm8eslam-stack/WIRD-APP`

This index separates current repository evidence from historical checkpoints. A date or SHA written inside an older checkpoint is evidence of what was known then; it is not proof of the current branch, deployment, or release state. Always re-fetch GitHub and provider state before making implementation or release decisions.

## Start here

1. **Current repository state:** inspect the live `main` ref and open PRs on GitHub. Do not infer current state from a historical SHA in a document.
2. **Latest engineering continuation record:** [WORK_SESSION_CHECKPOINT.md](./WORK_SESSION_CHECKPOINT.md). Its latest dated entry is 2026-11-11; older sections are historical.
3. **Current implementation history:** [PROGRESS.md](./PROGRESS.md) and [progress/WORK_LOG.md](./progress/WORK_LOG.md). These are cumulative historical logs, not a live dashboard.
4. **Current sync architecture and release constraints:** review `../sync/` documents, especially `ARCHITECTURE.md`, `STATE-MACHINE.md`, `CONFLICT-RESOLUTION.md`, `FAILURE-RECOVERY.md`, and `RELEASE-GATES.md`. Reconcile them against current code and open PRs.
5. **Security:** [SECURITY_AUDIT.md](./SECURITY_AUDIT.md). Treat findings as historical until revalidated against current code.
6. **Ruqyah:** review `../ruqyah/` and `../engineering/AUDIO_SOURCE_ATTRIBUTION.md`; do not treat an API locator as an authority for displayed Quran text.
7. **Offline:** review `../offline/` for architecture and audio-download constraints.

## Historical / superseded status snapshots

The following files are retained for traceability. Their historical status, SHA, next-action, and deployment statements must not be copied as current without revalidation:

- `progress/CONTINUATION_CHECKPOINT_2026-11-06.md` — dated 2026-11-06.
- `progress/CURRENT_STATUS.md` — dated 2026-11-07.
- `progress/RESUME_HERE.md` — dated 2026-11-07.
- `progress/MASTER_ROADMAP.md` — dated 2026-11-06.
- `progress/RELEASE_CHECKLIST.md` — cumulative checklist with early-phase statements; reconcile each item against current implementation and release gates before using it as a readiness verdict.
- `progress/WORK_LOG.md` — append-only historical engineering record; its latest reviewed entry is dated 2026-11-08.
- `PROGRESS.md` — cumulative checkpoint record; its latest reviewed entry is dated 2026-11-07.

Do not delete these records merely because their dates are old. They contain test evidence, design decisions, supersession history, and recovery constraints.

## Required update discipline

For every substantial engineering change:

- Update the relevant domain design/release document.
- Append a concise exact-SHA checkpoint to `WORK_SESSION_CHECKPOINT.md` only after the SHA and test evidence are known.
- Keep historical logs append-only; correct factual errors with explicit dated addenda rather than silently rewriting past evidence.
- State separately: code merged, CI exact-head result, Preview result, Production deployment SHA/state, live smoke, real-device verification, and Google AI Studio synchronization.
- Mark unverified items as `NOT VERIFIED`; never translate a successful Vercel status check into proof of a live Production deployment.
- Preserve source attribution, Quran corpus integrity, user data, backups, journals/outbox/inbox, conflict evidence, migrations, and Firebase security artifacts.

## Cleanup policy

Documentation consolidation means better navigation and explicit status labels, not indiscriminate deletion. Delete or archive a document only after proving that it has no unique decisions, citations, test evidence, recovery steps, or links from active engineering workflows. Keep one clear entry point while preserving the historical record.
