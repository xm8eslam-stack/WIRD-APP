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
