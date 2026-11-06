# WIRD Work Session Checkpoint

**Last updated:** 2026-11-06  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Branch:** `main`  
**Current HEAD:** `0831e01fcebd79e15978437bd0f702259c3d02d7`  
**Google AI Studio source branch:** `main`  
**Latest CI run:** [42169105813 — success](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42169105813)

## Resume instructions

Continue from the current `main` HEAD. Do not reset, force-push, or merge the divergent Phase 5 branch wholesale. Before every write, fetch the current main SHA and use a non-forced compare-and-swap update. Commit one reviewed milestone at a time.

## User goal

Build reliable, no-paid-mandatory-service cloud sync for Qur’an memorization/revision, while auditing and fixing all bugs that can damage the save/revision experience. Each substantial milestone must be tested twice and committed to `main` only after passing.

## Work completed in this session

Commits on main (in order):
- `6355677` — isolate review sessions from memorization progress; add session completion tests; make session activity/streak write rollback-aware.
- `761e973` — correct review completion labels, ayah metric, and actual streak display.
- `2b55ad3` — surface failed localStorage writes and propagate save failures through profile/plans/revision/test workflows; add a failed-write regression test.
- `db5285e` — unique-ayah retention score, exact Mushaf pages for reviewed ranges, and persistence failure handling in revision flows.
- `c67c788` — due-date-aware daily session selection, explicit plan scope handling, and next-uncovered range selection.
- `0831e01` — accurate dashboard page preview/effect dependencies and partial plan-day completion state.

The exact full SHAs are available in the GitHub commit history. The current HEAD is the source of truth.

## Confirmed current architecture

- Firebase Authentication exists.
- UID-scoped local storage and guest separation exist.
- Legacy data ownership decision exists.
- Firestore rules, emulator configuration, and emulator tests exist.
- Firestore client integration, sync outbox, merge engine, and cross-device sync do **not** exist yet.
- Firestore rules are not confirmed deployed to the production Firebase project.
- User reports the Vercel app is live at `https://wird-app.vercel.app/#/dashboard`.

## Important discovered risks

1. Daily activity is still stored as aggregate per-day logs; concurrent device updates would be lossy.
2. Weak-verse mistake counts are aggregated; they need immutable events or a transaction-safe model.
3. Portion review history needs stable unique event IDs before merging across devices.
4. Multi-key local operations need explicit transaction/rollback behavior before outbox integration.
5. Firestore rules currently validate a generic envelope; collection-specific payload validation and immutable event restrictions remain.
6. A green Vercel deployment does not prove Firebase rules deployment or sync.

## Mandatory next sequence

### Step A — finish the file-by-file audit
Review every remaining tracked source/config/test file, with special attention to:
- all StorageService and RetentionService write call sites,
- backup import/export and migration,
- plan lifecycle and revision queue,
- Quran data loading and source integrity,
- PWA/service worker cache behavior,
- API endpoints and environment-variable handling,
- all tests and GitHub Actions workflow.

Record each finding with file path, severity, evidence, fix, and test.

### Step B — local event ledger + durable outbox
Do not start Firestore writes first. Implement:
- UUID event/mutation IDs,
- append-only activity and weak-verse events,
- daily-log/streak derivation,
- UID-scoped durable outbox,
- atomic local state + outbox behavior,
- retry and duplicate-idempotency tests.

### Step C — Firestore adapter + deterministic merge
- Use per-record documents, transactions for mutable state, immutable event documents, tombstones, server timestamps, and bounded incremental sync.
- Use memory cache initially; do not enable persistent Firestore web cache by default because cache is not automatically cleared between sessions.
- Keep all local data available offline.

### Step D — rules and integration tests
- Per-collection payload schemas and size limits.
- Create-only event collections.
- Two-client emulator tests for concurrent changes, account switching, offline replay, stale snapshots, and duplicate retries.

### Step E — controlled production rollout
Only after explicit user approval:
- back up local data,
- deploy reviewed rules to the correct Firebase project,
- test on two devices and two accounts,
- enable sync behind a controlled rollout,
- retain local export/restore and rollback.

## Do not do

- Do not claim cloud sync works before M4–M7 pass.
- Do not replace local arrays wholesale with a cloud snapshot.
- Do not merge `feat/phase5-premium-ui-ux` wholesale; it is divergent.
- Do not change the Quran text or generate Quran text with AI.
- Do not deploy production Firebase rules without approval.
- Do not delete local data as part of initial cloud migration.

## Source documents

- `docs/engineering/IMPLEMENTATION_ROADMAP.md`
- `docs/engineering/FIRESTORE_SYNC_DESIGN.md`
- `docs/engineering/SECURITY_AUDIT.md`
- `docs/engineering/OPEN_SOURCE_RESEARCH.md`
