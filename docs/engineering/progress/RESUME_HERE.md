# WIRD — Resume Here

**Authoritative checkpoint: 2026-11-06. Re-fetch GitHub before any new edit.**

## Canonical repository
- Repository: `xm8eslam-stack/WIRD-APP`
- Canonical branch: `main` (Google AI Studio source)
- Latest main SHA: `033b8abda6bbf4f5c58d9b20d835f3268230abb6`
- PR #49–#52 are merged and exact-head quality gates passed; PR #51 and #52 post-merge main runs also passed.
- PR #53 merged as `87c4ec4456c69e35e1d62a368c97a5992d0309ac`; exact-head run `42278253060` and post-merge main run `42278457062` passed.
- Main commit `dee0e7a926700092e3d4b3e5fd63e74565428de0` adds multiple Tafsir sources/book IDs. No Actions run was found for this exact direct commit at checkpoint time.

## Current work — PR #55 local mutation audit
- Branch: `fix/local-mutation-audit-demo-journal-fresh-20261106`, based on latest main SHA above.
- Development demo data now uses one grouped journal transaction for authenticated users and a rollback-safe local transaction for guests.
- Direct demo writer methods were removed from StorageService and RetentionService.
- Added authenticated/guest demo tests and a QuotaExceededError rollback test; legacy test-only seed helpers were updated.
- Latest head: `9d1352c65e371d36a84a1e136912f3835a3925e3`; exact-head Quality Gate run `42281919337` pending. Includes a simulated app-restart replay test. Do not merge until all jobs pass.

## Deployment interpretation
- The latest PR #54 Vercel check reported success, but production deployment and live browser verification against current main remain unconfirmed.
- Owner explicitly says Vercel is not a blocker for merging tested changes into main.

## Completed reliability work
- Journal-first profile/plans/page progress/manual portions/test snapshots/weak-verse failure and resolution/revision ratings.
- Session completion groups memorization progress, activity, streak/profile, and matching smart-plan task into one recoverable event.
- Backup import/reset replay older pending events first and commit grouped snapshots through the journal.
- Quran reader has direct Surah-to-Mushaf navigation; Tafsir route is registered in Express.
- Active App-level direct local-only session/revision handlers were removed in PR #53.

## Next exact tasks
1. Run PR #54 exact-head Quality Gate against latest main, fix any failures, inspect logs, and perform a second review.
2. Merge only after exact-head checks pass; verify merge SHA and post-merge main run.
3. Continue audit of legacy outbox migration/reset and development-only demo loaders.
4. Define deterministic local aggregate derivation from domain events before designing Firestore remote event documents.
5. Implement Firestore adapter/sync coordinator behind a disabled feature gate; preserve local-first behavior and UID isolation.
6. Test offline replay, duplicate delivery, account switching, tombstones, and two-device conflicts.
7. Do not deploy production rules, activate cloud writes, or perform destructive migration without explicit approval.

## Working rules
- Work from freshly fetched `main` on a separate branch.
- Run exact-head GitHub Quality Gate, inspect every job, review the diff, merge, and verify main SHA.
- Vercel failure is not a merge blocker by owner's instruction; it remains an unverified deployment state.
- Do not merge stale/diverged PRs #2 or #8 wholesale; reapply only reviewed useful changes.
