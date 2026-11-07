# WIRD Conflict Resolution Policy

## 2026-11-07 — explicit use-remote resolution path (PR #149 merged)

PR #149 implements a deliberately narrow, user-confirmed **use latest remote snapshot** path. Its exact tested head `c675a2d164b88994c08a5368bf1695712f2625f3` passed WIRD Quality Gate run `42368745026` (#2871), and the squash merge commit is `78ada24ecadbda3460178550e871632f6d81d770`.

- The UI requires a separate confirmation and disables the action while offline, syncing, guest, or unverified.
- The service reads the latest Firestore state document and validates its schema/revision envelope. Missing, malformed, or tombstoned documents are rejected.
- The decision is bound to the exact local snapshot and archived mutation identities, then the journal revalidates them at commit time.
- Normal single-collection projections and grouped `syncMeta` transactions are applied through the existing validated storage projection paths.
- The journal atomically closes the conflict, removes only relevant pending Outbox entries already preserved in the archive, updates the authoritative revision baseline, deletes the blocked Inbox event, clears the prepared intent, and advances the projection cursor.
- A prepared decision can be explicitly canceled without deleting the conflict archive or pending writes.
- Recovery recognizes the exact selected remote snapshot if the local projection completed immediately before an IndexedDB interruption, then safely finishes the journal commit. A different local snapshot remains a hard stop.

**Still not implemented:** keep-local re-publication, user-authored merge, collection-specific tombstone resolution, and production multi-device verification. Do not infer that the whole conflict-resolution engine is complete from the use-remote path alone. Production sync flags remain disabled.

## 2026-11-07 — durable decision-intent foundation (PR #148)

PR #148 introduces a versioned, UID-scoped IndexedDB store for a single immutable prepared decision per conflict. A prepared intent is bound to the exact remote event fingerprint and sequence, the raw local snapshot fingerprint, the selected complete snapshot, decision ID/type, supplied server revision, and archived local mutation IDs/fingerprints.

Preparation rechecks that the conflict is still open, the exact event remains in the inbox, the archived mutation set and raw local snapshot have not changed since inspection, no newer relevant local Outbox mutations appeared, and the locally known revision is not newer than the supplied revision. The intent survives reload and exact retries; a different decision cannot overwrite it. Retention is bounded and fails closed rather than silently pruning decision evidence.

**At the PR #148 foundation stage, this was not yet an executable conflict resolver.** The prepared intent alone was not a server acknowledgement, did not replace or acknowledge local Outbox mutations, did not apply a local or remote snapshot, and did not advance the Inbox/projection cursor. Normal projection finalization and direct cursor advancement were blocked while a prepared intent existed, so the automatic projector could not bypass a saved user decision. PR #149 subsequently added the first narrow executor for the use-remote decision; keep-local re-publication and user-authored merge remain separate work.

Production sync flags remain disabled. No Firestore rules, secrets, or production settings changed.


## Current implemented policy: detect and preserve

The server uses optimistic concurrency. Every mutation carries `baseRevision`; the Firestore transaction compares it with the authoritative current revision. A stale write is rejected with `REMOTE_REVISION_CONFLICT`. No client clock or Last-Write-Wins policy is used.

When a normal remote event arrives while a local mutation for the same UID/collection/document is pending, the projector and atomic finalization return `blocked_pending_local`. The remote event remains in the inbox and the projection cursor does not advance. A pending mutation for another document in the same collection does not block it. Grouped `syncMeta` transactions retain collection-wide pending checks.

PR #78 verifies this with two independently stored devices: one write is accepted, the stale competing write is rejected, and the losing device retains both its local edit and the accepted remote event without overwriting either.

## Not yet implemented

- Keep-local re-publication as a separately confirmed and revision-safe decision.
- User-authored merge with collection-specific validation and explicit preservation of both sides.
- Collection-specific tombstone/deletion resolution.
- Deterministic additive merge for independent offline Ruqyah counter increments.
- Cross-tab coordination, comprehensive account lifecycle isolation, and live two-device verification.

The use-remote path is a completed narrow resolution, not completion of the full conflict-resolution engine. A blocked mutation without an explicitly completed decision remains an unresolved conflict. Do not silently discard or automatically rebase the losing local mutation.


## Durable conflict archive — implemented in PR #81

Blocked projection archives the full remote inbox event and raw local storage bytes in a UID-scoped IndexedDB store. PR #126 extends this to preserve pending local outbox mutations for the exact conflicting document, including mutation ID, fingerprint, base revision, sequence, and payload. Repeated observations append newly pending mutations by ID without replacing the first snapshot. Combined evidence is capped at 500 KB; fingerprint mismatch or overflow aborts without deleting inbox/outbox entries or advancing the cursor. Settings displays up to ten archived mutation payloads.

This archive prevents diagnostic evidence from disappearing; it does not itself resolve the conflict. At the time PR #126 was implemented, no keep-local/use-remote UI existed. PR #149 later added the explicit use-latest-remote path; keep-local re-publication, user-authored merge, and automatic merge remain unimplemented.


## Atomic reconciliation semantics — PR #85

Conflict archival now validates the immutable event fingerprint against the inbox and any existing conflict record. It rejects stale/orphan archive writes and oversized snapshots. An open conflict is marked `resolved` with resolution `reconciled` only inside the same IndexedDB transaction that advances the projection cursor and deletes the inbox event. This also handles already-applied events through `markRemoteProjected`. A late competing-tab archive cannot recreate an open conflict after the cursor has passed the event.

This is automatic bookkeeping after a successful safe projection, not a user choice between local and remote versions. Manual keep-local/use-remote, field-level merge, and rebase UX remain unimplemented.

## 2026-11-07 — Read-only conflict inspection

PR #104 adds an expandable Settings view of up to 20 open conflict records, including the immutable remote event payload and captured local projection snapshot. PR #126 adds a bounded preview of preserved pending local mutation payloads (up to ten rendered entries), guarded by exact active UID scope. The inspector remains read-only: it does not choose a winner, rebase an Outbox mutation, change the inbox/cursor, or mark a conflict resolved.

Still required beyond PR #149: separately confirmed keep-local re-publication and user-authored merge, collection-specific validation, preservation of both snapshots until durable commit, failure recovery, and decision history. The inspector remains read-only; do not infer resolution from the inspector or the existing `reconciled` bookkeeping status.


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


## Current conflict evidence bound (PR #126)

The conflict archive transaction includes the outbox store and captures pending mutations for the exact conflicting document. The immutable local snapshot plus all captured mutation payloads share a 500 KB limit. If the combined evidence exceeds that limit or a mutation ID is observed with a different fingerprint, the transaction aborts; the remote inbox event, local outbox, and projection cursor remain unchanged. The archive is diagnostic/recovery evidence, not a resolution decision.
