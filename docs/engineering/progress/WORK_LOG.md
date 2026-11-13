

## 2026-11-13 — Documentation reconciliation commit

- Appended targeted Engine Plans direct-consumer and sync-boundary audit to RFC section 16, and reconciled current main/Production/PR/CI state in the live continuation, change-control policy and checkpoint.
- PR #363 documentation branch advanced to `c0596ba24c7c00def8f67a77be1372b9dd67f839`; PR remains OPEN/DRAFT. No main change, merge or deploy.
- The live continuation now records its own latest docs head and keeps archive migration on HOLD until the complete caller/fixture/E2E matrix is finished.


## 2026-11-13 — Engine Plans second-pass code-source audit

- Re-read exact main ref `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` and refreshed PR heads #363–#372. All remain OPEN/DRAFT; no merges or deployments.
- Scanned all 183 TS/TSX/JS files in the repository tree: 159 src, 18 e2e, 1 scripts, 5 api. Added the complete call-site-to-test matrix to RFC section 17.
- Expanded inventory to cover dailySessionSelection, cloudSyncCoordinator, demoDataPersistence, revisionedRemoteMutation, PlanningEngineWizard, Firestore Rules tests, and all direct StorageService projection/backup/scope methods.
- Identified missing dedicated tests for AuthGate archive hydration, archive migration/crash/quota, Engine Plans scope switching, demo transaction, session plan snapshot, remote Inbox archive materialization/cursor, and Engine Plans conflict resolution.
- Identified payload ceiling mismatch for future large-plan conflict handling: normal Engine Plans journal mutation ceiling 450,000 bytes; conflict intent/use-remote/keep-local generic payload checks and legacy localStorage Outbox parser remain 128,000 bytes.
- Rechecked PR #372 run `43391729769` / job `131773203535`: no steps/logs; log endpoint returned BlobNotFound. BLOCKED observability. No full-source tests, typecheck, build, emulator or Playwright executed.
- No source code or production settings changed. No test execution in this documentation/audit pass. Engine Plans migration remains HOLD.


- Additional corruption-safety finding: `StorageService.getEnginePlans()` delegates to `readJsonArrayArchive` (`storageService.ts:378-395`), which filters malformed records or returns an empty array while preserving the original bytes. Migration must use a strict raw-byte read/validator and fail closed rather than hydrate from a filtered/empty fallback.
