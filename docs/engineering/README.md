# WIRD Engineering Documentation

Start with these files in order:

1. [MASTER_PROJECT_STATE.md](./MASTER_PROJECT_STATE.md) — current verified repository, PR, CI, Vercel, Firebase, and release state. Re-fetch live provider data before acting.
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — application boundaries, Quran trust boundary, local/offline persistence, API and sync architecture.
3. [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — evidence-based release gates with PASS/FAIL/BLOCKED/NOT VERIFIED statuses.
4. [WORK_LOG.md](./WORK_LOG.md) — canonical append-only chronological engineering history.

## Specialist design documents

- [Sync architecture](../sync/ARCHITECTURE.md)
- [Sync state machine](../sync/STATE-MACHINE.md)
- [Sync release gates](../sync/RELEASE-GATES.md)
- [Sync test matrix](../sync/TEST-MATRIX.md)
- [Firestore sync design](./FIRESTORE_SYNC_DESIGN.md)
- [Security audit](./SECURITY_AUDIT.md)
- [Offline-first architecture](../offline/OFFLINE_FIRST_ARCHITECTURE.md)
- [Offline audio storage contract](../offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md)
- [Ruqyah engineering checkpoint](../ruqyah/ENGINEERING_CHECKPOINT.md)

## Live work coordination

- [Continue Here](../CONTINUE_HERE.md) is the only live task queue.
- [Development Roadmap](../DEVELOPMENT_ROADMAP.md) is the unified feature roadmap.
- [Owner Actions](../OWNER_ACTIONS.md) contains production, physical-device, credential, and approval-only tasks.
- [Documentation Catalog](../DOCUMENTATION_CATALOG.md) indexes the wider documentation set.

## Historical records

The previous `docs/engineering/progress/WORK_LOG.md` path remains as a compatibility pointer to the canonical `WORK_LOG.md`. Other dated checkpoints and roadmap snapshots under `progress/` are historical evidence, not current release verdicts. Preserve unique decisions and test evidence; append corrections as dated addenda rather than rewriting history.
