# WIRD — Complete Branch Comparison Matrix

Compared every one of the 70 observed remote branch refs against the current main baseline. The matrix distinguishes commits unique to main from commits unique to the branch. Counts are GitHub's compare API ahead/behind counts, not file counts.

**Summary:** 70 branches = 65 diverged, 4 fully behind main with zero unique branch commits, 1 identical (main). Five diverged branches are tied to open PRs (#2, #8, #48, #59, #60).

- `Main only` = branch is an ancestor of main; branch has zero unique commits and is an archive/deletion candidate if no PR/protection/other dependency exists.
- `Diverged` = branch contains unique commits. Preserve until unique commits are reviewed/ported.
- `Open PR` = preserve; do not delete or bulk merge.
- Counts use **main-only / branch-only** order.

| Branch | Compare status | Main-only commits | Branch-only commits | PR / disposition |
|---|---:|---:|---:|---|
| `main` | identical | 0 | 0 | Canonical; keep |
| `audit/storage-reliability-phase2-20261106` | diverged | 16 | 6 | Preserve; review unique audit work |
| `chore/remove-legacy-outbox-writer-20261106` | main only | 5 | 0 | Archive candidate; no open PR found |
| `chore/storage-audit-checkpoint-phase2-20261106` | diverged | 13 | 14 | Preserve; review unique audit work |
| `docs/backup-durable-snapshot-checkpoint-20261106` | diverged | 43 | 3 | Preserve; compare checkpoint docs |
| `docs/checkpoint-after-pr55-20261106` | diverged | 8 | 5 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr24-reset-rollback` | diverged | 39 | 6 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr26-legacy-import-rollback` | diverged | 37 | 3 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr28-canonical-write-transaction` | diverged | 35 | 6 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr32-indexeddb-outbox` | diverged | 31 | 7 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr34-sequence-cursor` | diverged | 29 | 7 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr36-pr37-journal-replay` | diverged | 26 | 7 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr43-pr45-journal-progress` | diverged | 19 | 8 | Preserve; compare checkpoint docs |
| `docs/checkpoint-pr47-revision-ratings` | diverged | 17 | 8 | PR #48; preserve |
| `docs/engineering-progress-checkpoints` | diverged | 115 | 16 | Preserve; review historical docs |
| `docs/phase2-mushaf-checkpoint-20261106` | diverged | 47 | 7 | Preserve; compare checkpoint docs |
| `docs/phase2-portion-rollback-checkpoint-20261106` | diverged | 45 | 3 | Preserve; compare checkpoint docs |
| `feat/async-indexeddb-outbox-adapter` | diverged | 32 | 4 | Preserve; review unique commits |
| `feat/domain-event-envelope-phase3-20261106` | diverged | 12 | 16 | Preserve; review unique commits |
| `feat/domain-event-envelope-phase3-20261106-fresh` | diverged | 11 | 16 | Preserve; compare duplicate/fresh variant |
| `feat/indexeddb-sync-journal-foundation` | diverged | 34 | 7 | Preserve; review unique commits |
| `feat/journal-atomic-group-transactions` | diverged | 22 | 6 | Preserve; review unique commits |
| `feat/journal-first-manual-portion-add` | diverged | 24 | 4 | Preserve; review unique commits |
| `feat/journal-first-portion-status` | diverged | 26 | 3 | Preserve; compare with -main variant |
| `feat/journal-first-portion-status-main` | diverged | 25 | 3 | Preserve; compare with base variant |
| `feat/journal-first-profile-and-plans` | diverged | 27 | 21 | Preserve; review unique commits |
| `feat/journal-first-revision-ratings` | diverged | 18 | 8 | Preserve; review unique commits |
| `feat/journal-first-test-results` | diverged | 23 | 7 | Preserve; review unique commits |
| `feat/journal-first-weak-verse-failures` | diverged | 21 | 21 | Preserve; review unique commits |
| `feat/journal-first-weak-verse-resolution` | diverged | 20 | 6 | Preserve; review unique commits |
| `feat/journal-local-projection-replay` | diverged | 29 | 15 | Preserve; review unique commits |
| `feat/journal-local-projection-replay-main` | diverged | 28 | 10 | Preserve; compare with base variant |
| `feat/journal-sequence-projection-cursor` | diverged | 31 | 13 | Preserve; review unique commits |
| `feat/journal-sequence-projection-cursor-main` | diverged | 30 | 3 | Preserve; compare with base variant |
| `feat/migrate-legacy-outbox-to-indexeddb` | diverged | 33 | 15 | Preserve; review unique commits |
| `feat/phase1-record-validation-v1` | diverged | 109 | 33 | Preserve; review unique commits |
| `feat/phase4-data-integrity-backup-v4` | main only | 221 | 0 | Archive candidate; no open PR found |
| `feat/phase5-premium-ui-ux` | diverged | 219 | 115 | PR #2; preserve, stale UI branch |
| `feat/replace-local-outbox-with-indexeddb` | main only | 33 | 0 | Archive candidate; no open PR found |
| `feat/wird-reader-audio-20261106` | diverged | 50 | 25 | Preserve; review unique UI/audio work |
| `fix/backup-durable-snapshot-20261106` | diverged | 44 | 2 | Preserve; review unique commits |
| `fix/backup-journal-ordering-phase2-20261106` | diverged | 14 | 8 | Preserve; review unique commits |
| `fix/cloud-sync-retry-and-status` | diverged | 4 | 15 | PR #59; preserve, port/rebase to main |
| `fix/journal-legacy-portion-migration-20261106` | diverged | 7 | 13 | Preserve; review unique commits |
| `fix/journal-scope-guard-20261106` | diverged | 6 | 9 | Preserve; review unique commits |
| `fix/legacy-scope-import-rollback` | diverged | 38 | 4 | Preserve; review unique commits |
| `fix/local-mutation-audit-demo-journal-20261106` | diverged | 10 | 10 | Preserve; compare with fresh variant |
| `fix/local-mutation-audit-demo-journal-fresh-20261106` | diverged | 9 | 20 | Preserve; compare with base variant |
| `fix/phase1-outbox-integrity` | diverged | 97 | 3 | Preserve; review unique commits |
| `fix/phase1-portion-merge-integrity` | diverged | 90 | 21 | PR #8; preserve, stale storage branch |
| `fix/phase1-unified-portion-merge` | diverged | 85 | 31 | Preserve; review unique commits |
| `fix/phase2-multi-key-rollback-audit` | diverged | 64 | 20 | Preserve; review unique commits |
| `fix/phase2-multikey-rollback-status-20261106` | diverged | 49 | 14 | Preserve; review unique commits |
| `fix/phase2-outbox-rollback-verification-20261106` | diverged | 48 | 2 | Preserve; review unique commits |
| `fix/phase2-portion-write-status-20261106` | diverged | 46 | 2 | Preserve; review unique commits |
| `fix/phase2-queue-metrics-audit` | diverged | 71 | 15 | Preserve; review unique commits |
| `fix/phase2-retention-mutation-audit` | diverged | 78 | 33 | Preserve; review unique commits |
| `fix/phase2-rollback-failure-injection-20261106` | diverged | 64 | 2 | Preserve; review unique commits |
| `fix/phase2-session-counter-validation` | diverged | 104 | 17 | Preserve; review unique commits |
| `fix/phase2-verified-storage-writes-20261106` | diverged | 57 | 6 | Preserve; review unique commits |
| `fix/quran-reader-tafsir-navigation-20261106` | diverged | 17 | 16 | Preserve; review unique commits |
| `fix/reset-all-data-transactional-rollback` | diverged | 40 | 3 | Preserve; review unique commits |
| `fix/reset-atomicity-20261106` | main only | 42 | 0 | Archive candidate; no open PR found |
| `fix/session-plan-atomicity-phase2-20261106` | diverged | 15 | 3 | Preserve; review unique commits |
| `fix/tafsir-api-html-response` | diverged | 2 | 12 | PR #60; preserve, port Tafsir fix |
| `fix/unified-portions-transactional-write` | diverged | 37 | 5 | Preserve; review unique commits |
| `fix/unified-portions-transactional-write-main` | diverged | 36 | 2 | Preserve; compare with base variant |
| `fix/vercel-main-only-deployments` | diverged | 41 | 1 | Preserve; review unique deployment config |
| `test/audio-speed-all-views-20261106` | diverged | 42 | 1 | Preserve; review unique test work |
| `work/wird-audit-remediation` | diverged | 343 | 92 | Preserve; substantial unique remediation branch; inspect before use |

## Branch cleanup decision

Four branches are proven ancestors of current main and have no association with the five open PRs:
- `chore/remove-legacy-outbox-writer-20261106`
- `feat/phase4-data-integrity-backup-v4`
- `feat/replace-local-outbox-with-indexeddb`
- `fix/reset-atomicity-20261106`

They are **safe archive/deletion candidates**, but no branch-delete action is exposed by the connected GitHub operations in this session. Leave them intact; do not simulate deletion by rewriting refs. The audit register is the durable record.

All other non-PR branches contain unique commits and must be preserved until those commits are inspected and classified. Similar names (e.g. `-fresh` / `-main`) are not proof of duplicate content; compare patches before consolidating.

## Additional branches created after the 70-ref baseline snapshot

The baseline matrix remains an exact snapshot of the original 70 refs. Five new working branches were created during audit/remediation; they were also compared to main and are included in the current 75-ref count:

| Branch | Compare status | Main-only commits | Branch-only commits | Purpose / state |
|---|---:|---:|---:|---|
| `chore/full-repository-audit-20261107` | ahead | 0 | 42 | Documentation-only audit branch; all changed paths are under docs/; preserve |
| `fix/progress-import-journal-20261107` | ahead | 0 | 4 | PR #61 Draft; journaled backup import fix; exact-head CI PASS |
| `fix/plan-lifecycle-preserve-revisions-20261107` | ahead | 0 | 10 | PR #62 Draft; plan lifecycle preservation; exact-head CI PASS |

Current remote branch count after these additions: **75**. Do not confuse the original 70-ref baseline matrix with the current live count.

| `fix/quran-audio-repeat-20261107` | ahead | 0 | 4 | PR #63 Draft; repeat-controller fix; exact-head CI PASS |
| `fix/tafsir-json-response-20261107` | ahead | 0 | 4 | PR #64 Draft; HTML/JSON guard; exact-head CI pending at last check |

Current remote branch count after all audit/remediation branches: **75**.

| `fix/quran-coordinate-validation-20261107` | ahead | 0 | 13 | PR #65 Draft; coordinate/domain-event validation; exact-head CI PASS (417/0), Vercel Preview Ready |

Current live remote branch count: **76** (70 baseline + 6 post-baseline branches).
