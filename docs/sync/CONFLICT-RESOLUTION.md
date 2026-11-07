# WIRD Conflict Resolution Policy

## Current implemented policy: detect and preserve

The server uses optimistic concurrency. Every mutation carries `baseRevision`; the Firestore transaction compares it with the authoritative current revision. A stale write is rejected with `REMOTE_REVISION_CONFLICT`. No client clock or Last-Write-Wins policy is used.

When a remote event arrives while a local mutation for that collection is pending, the projector returns `blocked_pending_local`. The remote event remains in the inbox and the projection cursor does not advance. The local outbox mutation remains pending.

PR #78 verifies this with two independently stored devices: one write is accepted, the stale competing write is rejected, and the losing device retains both its local edit and the accepted remote event without overwriting either.

## Not yet implemented

- Dedicated durable conflict entity/state with both local and remote snapshots.
- User-facing compare/choose/merge workflow.
- Safe automatic field-level merge for collections where fields are independently mergeable.
- Conflict-resolution mutation that rebases the chosen result on the latest server revision.
- Recovery/retention policy for unresolved conflicts.

Until these exist, a blocked mutation is a safe unresolved conflict, not a completed resolution. Do not silently discard or automatically rebase the losing local mutation.


## Durable conflict archive — implemented in PR #81

Blocked projection now archives the full remote inbox event and relevant local storage bytes in a UID-scoped IndexedDB store. The original local snapshot is retained across repeated observations. Open records are never pruned; the archive is bounded to 100 entries per UID and may prune only resolved historical records. Settings displays the open conflict count and latest affected record.

This archive prevents diagnostic evidence from disappearing; it does not resolve the conflict. No keep-local/use-remote UI or automatic merge exists. The event remains in the inbox and the projection cursor remains blocked until a separately tested resolution workflow is implemented.


## Atomic reconciliation semantics — PR #85

Conflict archival now validates the immutable event fingerprint against the inbox and any existing conflict record. It rejects stale/orphan archive writes and oversized snapshots. An open conflict is marked `resolved` with resolution `reconciled` only inside the same IndexedDB transaction that advances the projection cursor and deletes the inbox event. This also handles already-applied events through `markRemoteProjected`. A late competing-tab archive cannot recreate an open conflict after the cursor has passed the event.

This is automatic bookkeeping after a successful safe projection, not a user choice between local and remote versions. Manual keep-local/use-remote, field-level merge, and rebase UX remain unimplemented.

## 2026-11-07 — Read-only conflict inspection

PR #104 adds an expandable Settings view of up to 20 open conflict records, including the immutable remote event payload and captured local projection snapshot, guarded by exact active UID scope. This improves user visibility and preserves the archive, but it is deliberately read-only. It does not choose a winner, rebase an Outbox mutation, change the inbox/cursor, or mark a conflict resolved.

Still required: an idempotent user decision state machine for keep-local/use-remote/merge, latest server revision revalidation, preservation of both snapshots until durable commit, failure recovery, and history of the user's decision. Do not infer resolution from the inspector or the existing `reconciled` bookkeeping status.


## 2026-11-07 — populated multi-record sync, Playwright, and conflict-evidence checkpoint

- Current main at checkpoint: `221759fe617e5fd5d719ed6fd36ff3981ed63ed6`.
- PR #122 merged as `beec50a623febdfa79f286f7c2b87d8234b2b150`; exact head `945c0f73e965d0111d46c53179465ee4c98fb83a` passed six Playwright app-shell checks (three desktop, three mobile Chromium/iPhone 13 viewport emulation). Post-merge main run `42360161749` passed.
- PR #125 merged as `ceebd11995bece572d40230ab084858be5a40cf2`; exact head `b24e0eb8221c23498878ee0a58727990ad9f2dfd` passed 521 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright checks. Post-merge main run `42360526021` passed.
- PR #126 merged as `802811d45a6d7e977d3b4082fd08ebf5e95151fa`; exact head `9886ca8a090cf07f04b51943fbc254a4b98ce221` passed 521 automated assertions and 31 Firestore Rules Emulator tests plus the remaining Quality Gate steps, including Playwright. Post-merge main run `42360725981` passed.
- PR #129 merged as `ab1a2cd04a1456a6430985ce6f6e72a1b137907d`; exact head `334a73a05bddc4d574cdf8c25a0299f329b22c49` passed 525 automated assertions, 31 Firestore Rules Emulator tests, dependency audit, TypeScript, production build, server smoke, and six Playwright app-shell checks. Its post-merge main run was cancelled when the subsequent documentation-only PR #130 updated main; current main Quality Gate run `42361224358` is the relevant post-merge validation and was in progress at this checkpoint.
- PR #129 makes normal remote projection and the final IndexedDB cursor/revision transaction document-scoped. Same-document pending writes still block; unrelated test-result documents can progress independently. Grouped `syncMeta` transactions retain collection-wide guards.
- PR #126 adds durable pending local mutation evidence to Conflict Archive, including mutation IDs, fingerprints, base revisions, sequence numbers, and payloads. Repeated observations append by mutation ID; a fingerprint mismatch or combined snapshot size above 500 KB aborts without deleting inbox/outbox entries or advancing the cursor. Settings displays at most ten archived mutation payloads while retaining the full archive.
- This is not yet a user-directed conflict-resolution state machine: keep-local, use-remote, safe merge, and revision revalidation actions remain unimplemented. Tombstones, additive multi-device Ruqyah counters, full auth/sync browser journeys, real two-device verification, and production deployment remain release blockers.
- PR #127 added 16 Ruqyah locator-library browser checks; PR #130 refreshed the Ruqyah checkpoint and release checklist after CORS hardening and locator-library E2E. These browser checks do not replace live Firebase/device tests.
- Vercel continues to report `api-deployments-free-per-day` / `build-rate-limit` on reviewed main updates. No live deployed SHA, live two-device verification, Firebase production-rules deployment, secret/environment-variable change, or production sync activation is claimed.
- PR #2 remains a draft, 115 commits ahead / 276 behind current main. Do not merge it wholesale.
- Next: implement the conflict decision state machine with atomic archival/revalidation and crash recovery; then tombstones, additive Ruqyah counters, broader Playwright workflows, backup/restore stress, and account lifecycle tests.


## 2026-11-07 — evidence preservation implemented; decisions still pending

PR #126 now stores the raw local projection snapshot and pending local outbox mutation entries in the same IndexedDB transaction as the conflict record. Each archived mutation retains its ID, fingerprint, base revision, sequence, and payload. Repeated conflict observations add newly pending mutations by ID and never replace the first local snapshot. Fingerprint mismatches and combined evidence above 500 KB abort closed; the remote inbox event and local outbox remain untouched. Settings displays up to ten mutation payloads while retaining the full archived record.

PR #129 narrows ordinary projection blocking to the exact UID/collection/document at both projector and atomic finalization layers. Same-document pending writes still block. Grouped syncMeta transactions remain collection-wide.

**Not implemented yet:** persisted user decision intents, keep-local rebasing, use-remote discard semantics, field-level merge, latest remote revision revalidation, idempotent resolution completion, and recovery of a resolution interrupted by a crash. The archive is evidence, not a resolution workflow. No conflict is silently overwritten.
