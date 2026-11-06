# WIRD — Resume Here

**Authoritative checkpoint: 2026-11-06. Re-fetch GitHub before any new edit.**

## Canonical repository
- Repository: `xm8eslam-stack/WIRD-APP`
- Canonical branch: `main` (Google AI Studio source)
- Latest main SHA: `a6a4eabf2572f1c0f7812fe891ddbaec27b3536d`
- PRs #49–#57 are merged. PR #54 added typed domain-event envelopes; PR #55 journaled demo fixture writes; PR #57 removed read-side mutations and journaled legacy portion migration.
- PR #57 exact-head runs `42283803166` and `42283813448` passed; post-merge main run `42284039747` passed.
- Latest PR #55 main merge includes the preceding direct Quran Library tabs/Juz-index commit `033b8abda6bbf4f5c58d9b20d835f3268230abb6`.

## Completed reliability work
- Journal-first profile/plans/page progress/manual portions/test snapshots/weak-verse failure and resolution/revision ratings.
- Session completion groups memorization progress, activity, streak/profile, and matching smart-plan task into one recoverable event.
- Backup import/reset replay older pending events first and commit grouped snapshots through the journal.
- Domain-event envelopes for session completion, revision ratings, test completion, and weak-verse failure/resolution are validated and stored in append-only IndexedDB journal entries.
- Development demo data now uses one journaled transaction for authenticated users and one rollback-safe local transaction for guests; old direct demo writer methods are removed.
- Quota rollback and simulated IndexedDB restart/replay recovery tests are included.
- Quran reader has direct Surah-to-Mushaf navigation; Tafsir route is registered in Express.

## Current next task — PR #58 account-scope guard
- Branch: `fix/journal-scope-guard-20261106`; verify exact-head CI and merge after review.
- It aborts a legacy migration if the active account scope changes while the journal lock is pending.

## Remaining local mutation audit
1. Review legacy outbox migration/reset and IndexedDB-loss/blocked scenarios.
2. Review remaining multi-key mutation callers; device-local reader/Tafsir/audio preferences are intentionally local and catch storage exceptions.
3. Add any missing failure-injection coverage for quota/read/write/rollback behavior.
4. Keep the local-first experience intact; guests must not open a cloud outbox.

## Subsequent phases
- Derive daily aggregates and streaks deterministically from the typed domain-event ledger.
- Define record-level Firestore mapping and conflict semantics.
- Implement Firestore adapter/sync coordinator behind a disabled feature gate.
- Test offline replay, duplicate delivery, account isolation, tombstones, and two-device conflicts.
- Do not deploy production rules, activate cloud writes, or perform destructive migration without explicit approval.

## Deployment interpretation
- Owner says Vercel status is not a blocker for merging tested changes.
- Production deployment and live browser verification against the current main SHA remain unconfirmed.

## Working rules
- Work from freshly fetched `main` on a separate branch.
- Run exact-head GitHub Quality Gate, inspect every job, review the diff, merge, and verify main SHA.
- Vercel failure is not a merge blocker by owner's instruction; it remains an unverified deployment state.
- Do not merge stale/diverged PRs #2 or #8 wholesale; reapply only reviewed useful changes.
