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
