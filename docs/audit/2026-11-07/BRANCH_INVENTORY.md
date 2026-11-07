# WIRD — Branch Inventory and Disposition Register

Baseline main: `6228150c2f7137678ba1079f5d9b2e8aba527523`  
Remote branches enumerated: **70** (all names and current heads captured from GitHub refs).  
Policy: no bulk deletion, force-push, or branch rewrite during audit. A branch is an archive candidate only after a three-way comparison against current main, open-PR check, and confirmation that its unique commits are already represented or intentionally abandoned.

## Active/open PR associations

| PR | Branch | Head SHA | Base SHA | State | Comparison to current main | Disposition |
|---|---|---|---|---|---|---|
| #2 | `feat/phase5-premium-ui-ux` | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | `15ec5069b4850968588be2e4363fbd182bf2a8fc` | Open Draft | Diverged; 115 ahead / 219 behind | Preserve; stale UX branch; extract only reviewed unique UI work |
| #8 | `fix/phase1-portion-merge-integrity` | `45fe09d59e17810062b50f067a6639d5b105108d` | `d1ea5921f6a4eca92c229efd27a0f4ada53aa695` | Open, non-draft | Diverged; 21 ahead / 90 behind | Preserve; inspect unique storage commits before closing/archiving |
| #48 | `docs/checkpoint-pr47-revision-ratings` | `063ffa765a2c9905435c589b10a6cec3f1eca134` | `4fa6a1acffb0723c89bb963b237e67e6f4b7173f` | Open, non-draft | Diverged; 8 ahead / 17 behind | Preserve until documentation history reconciled; do not merge stale checkpoint wholesale |
| #59 | `fix/cloud-sync-retry-and-status` | `31c6eb70d6925fc6c3ea32c07c1f8e986095d73b` | `8163b5a3ae9422498c1c766c240d173f5ddddf2d` | Open Draft | Diverged; 15 ahead / 4 behind | Preserve; valuable safer-push/status work; port/rebase reviewed changes to current main |
| #60 | `fix/tafsir-api-html-response` | `02f230882f15e898b8a621f8d708df26bdd4c65b` | `daa6d471f942c4b4086f5b878edb85b72e122d30` | Open Draft | Diverged; 12 ahead / 2 behind | Preserve; port Tafsir fix/tests to fresh main branch; exact-head CI is red |

## All 70 refs

The rows below record the exact observed ref heads. The full compare status for every ref is now recorded in `BRANCH_COMPARE_MATRIX.md`; branch names are not sufficient evidence for deletion.

| Branch | Observed head SHA | Initial grouping | Disposition |
|---|---|---|---|
| `audit/storage-reliability-phase2-20261106` | `963fcadc7f44d642ae74252d33440ccffa1dfff3` | audit | Compare commits and identify unique work |
| `chore/remove-legacy-outbox-writer-20261106` | `d9d88fbcce725ca35bf34d011455f9e7489bd3f7` | chore | Compare commits and identify unique work |
| `chore/storage-audit-checkpoint-phase2-20261106` | `af3076e40d1d0f5f0c5b8f99303e75c2d323d210` | chore | Compare commits and identify unique work |
| `docs/backup-durable-snapshot-checkpoint-20261106` | `1ad3281b736c5b2a748199582c77cd3ae127670a` | docs | Compare commits and identify unique work |
| `docs/checkpoint-after-pr55-20261106` | `adc2d75d8f6690bcdae12a79622f725e07b547f5` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr24-reset-rollback` | `57c9e310daa3368e1f5d93c74532d6c73e578323` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr26-legacy-import-rollback` | `5f2729849dbd1665fbbfd9591b42cae946c24680` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr28-canonical-write-transaction` | `529d565cdc4aee4f3c678661d754c2fc62c030ba` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr32-indexeddb-outbox` | `2038fa5444d6ad8bf14d2847a80b356ac5a0f99d` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr34-sequence-cursor` | `8e4d431b5ef6367140921526fd2039abb895ed96` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr36-pr37-journal-replay` | `cdf363870bd0d22a9b71d54a61475f1a2e08c15f` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr43-pr45-journal-progress` | `0edceef6cb958293389ed1fc58685d617fbf8d98` | docs | Compare commits and identify unique work |
| `docs/checkpoint-pr47-revision-ratings` | `063ffa765a2c9905435c589b10a6cec3f1eca134` | docs / PR #48 | Preserve; see open PR row |
| `docs/engineering-progress-checkpoints` | `882129877fae6770024e25b7365e3d246dbdd0b4` | docs | Compare commits and identify unique work |
| `docs/phase2-mushaf-checkpoint-20261106` | `f8951948a93cd7be9d6b9956e01410dc59d97666` | docs | Compare commits and identify unique work |
| `docs/phase2-portion-rollback-checkpoint-20261106` | `aef07e705fb78f2024989ef9a359f1d6a81b2984` | docs | Compare commits and identify unique work |
| `feat/async-indexeddb-outbox-adapter` | `d97d8cf10cd076a726dbf377c8a4078b8c2dec2c` | feat | Compare commits and identify unique work |
| `feat/domain-event-envelope-phase3-20261106` | `2568c3dfc17f782dc34e557783c48245e511fee7` | feat | Compare commits and identify unique work |
| `feat/domain-event-envelope-phase3-20261106-fresh` | `9cec38e6cf132347e426684526d24b30eafb730c` | feat | Compare commits and identify unique work |
| `feat/indexeddb-sync-journal-foundation` | `9bc4945d92737df086396f436b2388a92972bf92` | feat | Compare commits and identify unique work |
| `feat/journal-atomic-group-transactions` | `73faac0434cf626c6d55907f579aa245ba037a1e` | feat | Compare commits and identify unique work |
| `feat/journal-first-manual-portion-add` | `beb2b0462739f1bae61a7bf0f4abbd026b6c2ed0` | feat | Compare commits and identify unique work |
| `feat/journal-first-portion-status` | `31de4d1ea13edb7f78627877be6817d2a6ea588a` | feat | Compare commits and identify unique work |
| `feat/journal-first-portion-status-main` | `f5cc2696954e701c0e4bf8e465809c2c1e41ac5c` | feat | Compare commits and identify unique work |
| `feat/journal-first-profile-and-plans` | `d45dd9e7284101e332f15b2f408cd62001a961be` | feat | Compare commits and identify unique work |
| `feat/journal-first-revision-ratings` | `7a476f5439091110bd3254b3498499335dd47be2` | feat | Compare commits and identify unique work |
| `feat/journal-first-test-results` | `30b26c65d4d43386fd1c0c0bb4d9ca4748b026ea` | feat | Compare commits and identify unique work |
| `feat/journal-first-weak-verse-failures` | `d01d31605204ebb50ff93467d4739323f280b5ed` | feat | Compare commits and identify unique work |
| `feat/journal-first-weak-verse-resolution` | `e2a28de43cc4f31176883af8022a34cb2e1ec773` | feat | Compare commits and identify unique work |
| `feat/journal-local-projection-replay` | `a142b7dd5bf6854b5318637b8afc1090b427838a` | feat | Compare commits and identify unique work |
| `feat/journal-local-projection-replay-main` | `964a5a55b91806acdb85fc29053f2cb720ee8d78` | feat | Compare commits and identify unique work |
| `feat/journal-sequence-projection-cursor` | `f9788132e7f93e8e6bbb64412f97ba0df5afed7e` | feat | Compare commits and identify unique work |
| `feat/journal-sequence-projection-cursor-main` | `148e7b27873219f552edee41b819f7b08949e7a5` | feat | Compare commits and identify unique work |
| `feat/migrate-legacy-outbox-to-indexeddb` | `2f6e82213188110c9ae69cf057c376b1eb40051d` | feat | Compare commits and identify unique work |
| `feat/phase1-record-validation-v1` | `2e04d7abf8a55b0c7dc58730ec843dcfed372d5a` | feat | Compare commits and identify unique work |
| `feat/phase4-data-integrity-backup-v4` | `a043da31f7f8d170bcbfb0c41a0d687cf2c6b2ec` | feat | Compare commits and identify unique work |
| `feat/phase5-premium-ui-ux` | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | feat / PR #2 | Preserve; see open PR row |
| `feat/replace-local-outbox-with-indexeddb` | `6c48b2937bd99ddead88c5ca829381bf096e0c94` | feat | Compare commits and identify unique work |
| `feat/wird-reader-audio-20261106` | `5cfb55501927517f4accc618e00b4a0847ef1841` | feat | Compare commits and identify unique work |
| `fix/backup-durable-snapshot-20261106` | `f077464ce37402f633ebcf3ab1a8519f9290a34b` | fix | Compare commits and identify unique work |
| `fix/backup-journal-ordering-phase2-20261106` | `e8a9045a5399142bda7588a7c2f0be85f9d29760` | fix | Compare commits and identify unique work |
| `fix/cloud-sync-retry-and-status` | `31c6eb70d6925fc6c3ea32c07c1f8e986095d73b` | fix / PR #59 | Preserve; see open PR row |
| `fix/journal-legacy-portion-migration-20261106` | `456f94640b257ba4f019d5228304be020adabe42` | fix | Compare commits and identify unique work |
| `fix/journal-scope-guard-20261106` | `71a21e2a19a52b78f40b04bbaf3a14c5c02cd41f` | fix | Compare commits and identify unique work |
| `fix/legacy-scope-import-rollback` | `24682b573b31240d23950ed7e92ddea69947ce24` | fix | Compare commits and identify unique work |
| `fix/local-mutation-audit-demo-journal-20261106` | `50cdc18f2acb668bb188a4c1abdb997c522f4917` | fix | Compare commits and identify unique work |
| `fix/local-mutation-audit-demo-journal-fresh-20261106` | `b4ce2021df87ddd8ecfa956525e384a01170b235` | fix | Compare commits and identify unique work |
| `fix/phase1-outbox-integrity` | `801596b5502c20ed240d249dde461445ebb146e1` | fix | Compare commits and identify unique work |
| `fix/phase1-portion-merge-integrity` | `45fe09d59e17810062b50f067a6639d5b105108d` | fix / PR #8 | Preserve; see open PR row |
| `fix/phase1-unified-portion-merge` | `2b520ebcf6c51ae155de508ddf49e49d421ba7ab` | fix | Compare commits and identify unique work |
| `fix/phase2-multi-key-rollback-audit` | `36b9060a52cfcce73abac5f65206ce0c729ce2fe` | fix | Compare commits and identify unique work |
| `fix/phase2-multikey-rollback-status-20261106` | `f734b97ee90ede7780f400d00179ca7a5d4fb146` | fix | Compare commits and identify unique work |
| `fix/phase2-outbox-rollback-verification-20261106` | `18c17c5784be36ad18f30ce30f6bfd45663dce6d` | fix | Compare commits and identify unique work |
| `fix/phase2-portion-write-status-20261106` | `331cb357fd45a960c9acdecb4b643036bc856aeb` | fix | Compare commits and identify unique work |
| `fix/phase2-queue-metrics-audit` | `1c7e57e6beeed1327900acc38c5642298ba37aad` | fix | Compare commits and identify unique work |
| `fix/phase2-retention-mutation-audit` | `958067b1b1e3c64513b1732c947e81c18a830a52` | fix | Compare commits and identify unique work |
| `fix/phase2-rollback-failure-injection-20261106` | `522bbc549074217af8e3d434538078cc5a8204bc` | fix | Compare commits and identify unique work |
| `fix/phase2-session-counter-validation` | `068289fd80a473aaad7c6668813f36a8fdb4ee17` | fix | Compare commits and identify unique work |
| `fix/phase2-verified-storage-writes-20261106` | `d6753835d70a71b7f3a5f15a7f3512d9f92bf843` | fix | Compare commits and identify unique work |
| `fix/quran-reader-tafsir-navigation-20261106` | `386e34476fa942100afff28c0fb3f9cbfcb66f17` | fix | Compare commits and identify unique work |
| `fix/reset-all-data-transactional-rollback` | `545d7f7921a185d7a2cc8e4c92a38896484828d6` | fix | Compare commits and identify unique work |
| `fix/reset-atomicity-20261106` | `79d4f71666a3f9bfcfcf7f726510e1119b2f4751` | fix | Compare commits and identify unique work |
| `fix/session-plan-atomicity-phase2-20261106` | `9d89334439c8fb972430bbc29a16e608ce9899b4` | fix | Compare commits and identify unique work |
| `fix/tafsir-api-html-response` | `02f230882f15e898b8a621f8d708df26bdd4c65b` | fix / PR #60 | Preserve; see open PR row |
| `fix/unified-portions-transactional-write` | `8075ac6f2d834a52fbeb1d8b7edcab4fa7e12ad2` | fix | Compare commits and identify unique work |
| `fix/unified-portions-transactional-write-main` | `bb5a5224671fc3d1ef83b619b01556f8c6c39c01` | fix | Compare commits and identify unique work |
| `fix/vercel-main-only-deployments` | `8c88046cbd742ce2fd30df78d525286479bf219c` | fix | Compare commits and identify unique work |
| `main` | `6228150c2f7137678ba1079f5d9b2e8aba527523` | protected canonical branch | Preserve; baseline |
| `test/audio-speed-all-views-20261106` | `a0e07101d9e0863c841c7fffc5f96cf109488c4b` | test | Compare commits and identify unique work |
| `work/wird-audit-remediation` | `1cb91ac12faa963b341a0f39682c42481a79ba4d` | work | Compare commits and identify unique work |

## Next branch-audit operations

1. Fetch compare metadata for every remaining branch against current main.
2. Record whether each branch is identical, behind, ahead, or diverged and list unique changed files/commits.
3. Check open PRs, CI evidence and whether commits were merged under another PR.
4. Mark branches as `KEEP_ACTIVE`, `KEEP_REFERENCE`, `PORT_UNIQUE_COMMITS`, `CLOSE_PR_THEN_ARCHIVE`, or `DELETE_CANDIDATE`.
5. Delete only branches with proven no unique required work and no open PR, after preserving the audit record. Do not delete main, active branches, or branches tied to open PRs.

## Final comparison result (2026-11-07)

All 70 branches were compared to the exact main baseline:
- 65 diverged branches with unique branch commits — preserve and review.
- 4 branches are ancestors of main with zero unique branch commits — archive/deletion candidates, no open PR association.
- main is identical to itself.
- All five open PRs (#2, #8, #48, #59, #60) are diverged and preserved.

See `BRANCH_COMPARE_MATRIX.md` for exact ahead/behind counts for every ref. No refs were deleted because the connected GitHub tool set does not expose a safe branch-delete operation. This is a tooling limitation, not a claim that the branches were deleted.

## Post-baseline working branches (current live count: 73)

Three branches were created after the original 70-ref snapshot:
- `chore/full-repository-audit-20261107` — documentation-only audit branch, 53 commits ahead at the last exact comparison; re-fetch before future work.
- `fix/progress-import-journal-20261107` — PR #61 Draft, 4 commits ahead, exact-head CI PASS.
- `fix/plan-lifecycle-preserve-revisions-20261107` — active plan-history fix branch, 7 commits ahead; latest CI run is in progress after an earlier compile error was corrected.

These branches are additional to the original 70-ref baseline. Current remote branch count is 73. The branch compare matrix records their current comparisons.

Additional current branches:
- `fix/quran-audio-repeat-20261107` — PR #63 Draft, 4 commits ahead; exact-head Quality Gate run 42341365536 PASS (404/0); Vercel Preview blocked by daily build-rate limit.
- `fix/tafsir-json-response-20261107` — PR #64 Draft, 4 commits ahead; exact-head run 42341419175 pending/no jobs at last check.

Current live branch count: **75** (70 original baseline + audit branch + four remediation branches).

- `fix/quran-coordinate-validation-20261107` — PR #65 Draft, 13 commits ahead; exact-head Quality Gate run 42342071131 PASS (417/0); Firestore Rules 13/13; Vercel Preview Ready.

Current live branch count: **76** (original 70 + audit branch + five remediation branches).
