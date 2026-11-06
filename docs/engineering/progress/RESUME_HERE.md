# WIRD — Resume Here

**Authoritative checkpoint: 2026-11-06, after PR #52. Re-fetch GitHub before any new edit.**

## Canonical repository
- Repository: `xm8eslam-stack/WIRD-APP`
- Canonical branch: `main` (Google AI Studio source)
- Latest verified main SHA: `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`
- PR #49: https://github.com/xm8eslam-stack/WIRD-APP/pull/49 — merged as `15979e4a009ef0aa5b4981cbcbb4f2124f25dfc3`
- PR #50: https://github.com/xm8eslam-stack/WIRD-APP/pull/50 — merged as `dacba8298db954392f7fbcbbf10af9f18ecc31dc`
- PR #51: https://github.com/xm8eslam-stack/WIRD-APP/pull/51 — merged as `99c466b9de6ae977979f8989443fba5b94017a30`
- PR #52: https://github.com/xm8eslam-stack/WIRD-APP/pull/52 — merged as `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`

## Verified quality gates
- PR #49 exact-head run `42267849373`: passed.
- PR #50 exact-head run `42276148126`: passed.
- PR #51 exact-head run `42276561011`: passed; post-merge main run `42276748346` passed.
- PR #52 exact-head run `42277464313`: passed (tests, Firestore emulator, TypeScript, build, server smoke).
- Post-merge main run `42277666291` must be re-checked for the exact main SHA `78fc3daccf187e88edd9f5fc857e7b04c59dd3c8`.

## Deployment interpretation
- Vercel Free daily build limit still returns `build-rate-limit`.
- The owner explicitly says Vercel is not a blocker for merging tested changes into main.
- Never claim production deployment or live-site verification unless the exact main SHA has a confirmed deployment and browser smoke test.

## Completed reliability work
- Journal-first profile/plans/page progress/manual portions/test snapshots/weak-verse failure and resolution/revision ratings.
- Session completion groups memorization progress, activity, profile streak, and matching smart-plan task into one journal event.
- Backup import and factory reset are ordered through the journal; older pending events replay before the new operation.
- The Quran reader has direct Surah-to-Mushaf navigation; Tafsir API route is registered in Express.
- Existing Firestore rules/emulator tests are a foundation only. No Firestore client or cloud sync is active.

## Next exact task
1. Re-fetch `main`, check its exact SHA and post-merge run `42277666291`.
2. Review and merge the current audit/checkpoint PR only after its exact-head CI passes.
3. Finish the local mutation audit, especially legacy localStorage outbox migration/reset interactions, development-only demo loaders, durable-read failures, quota exhaustion, partial projection rollback, and reload recovery.
4. Define immutable domain-event records for sessions, revision attempts, tests, and weak-verse mistakes; derive aggregate logs/streaks/counters from unique event IDs.
5. Implement Firestore adapter/worker behind an inactive feature gate. Preserve local-first behavior and UID isolation.
6. Harden collection-specific Firestore rules and test offline replay, duplicate delivery, account switching, and two-device conflicts in emulators.
7. Do not deploy production rules, activate cloud writes, or perform destructive migration without explicit approval.

## Working rules
- Inspect latest main, create a fresh feature branch, make a focused change, run exact-head GitHub Quality Gate, inspect every job, review the diff, merge, and verify main SHA.
- Vercel failure is not a merge blocker by the owner's instruction; it remains an unverified deployment state.
- Do not merge stale/diverged PRs #2 or #8 wholesale. Reapply only reviewed useful changes.
- Keep Quran text and verified static assets untouched by AI or sync migrations.
