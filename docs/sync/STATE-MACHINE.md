# CURRENT CONFLICT AND PROJECTION STATE — 2026-11-07

This section supersedes older limitation statements below.

## User-directed conflict decisions

- `use-remote` (PR #149): supported upsert conflicts can be resolved by applying the latest validated Firestore state after explicit confirmation. The executor re-reads the authoritative document before commit and atomically updates the local projection, Outbox, conflict record, revision baseline, Inbox, and projection cursor. Prepared decisions are cancelable without deleting evidence.
- `keep-local` (PR #155): supported single-collection upsert conflicts can be resolved by queuing one consolidated local replacement based on the latest verified remote revision. Original pending mutations remain archived. The new mutation is not considered server-accepted until the normal sync transaction acknowledges it.
- Unsupported: tombstones, grouped `syncMeta` keep-local, and Ruqyah counter keep-local. Do not split grouped transactions or treat a tombstone as an empty upsert.

## Automatic Ruqyah V2 convergence (PR #157)

- Per-device monotonic increment components merge by component-wise maximum.
- Reset watermarks make concurrent increments/resets deterministic and idempotent.
- Automatic merge is permitted only for valid V2 snapshots with compatible legacy baselines.
- Divergent V1 legacy baselines are archived and blocked; never guess a sum or max from insufficient history.

## Projection and activation boundary

- Normal remote projection remains revision-ordered and blocks on pending same-document local mutations or unknown base revisions.
- Tombstones remain `blocked_tombstone` until collection-specific delete, resurrection-prevention, recovery, and retention semantics are implemented.
- Production sync flags remain gated. Emulator and CI success do not prove deployed rules or live production sync.
- `synced` requires zero pending writes and complete remote reconciliation; upload acknowledgement alone is insufficient.

---

# WIRD Sync State Machine

## Mutation lifecycle

1. `local_saved`: local intent and outbox record committed durably.
2. `upload_ready`: retry deadline has passed and the mutation is eligible for a batch.
3. `uploading`: coordinator is attempting the Firestore transaction.
4. `server_accepted`: Firestore transaction atomically writes the state envelope, immutable event, and next server sequence.
5. `acknowledged`: local journal records the server revision and removes the pending outbox entry.
6. `remote_imported`: ordered server events are durably imported into the local inbox and the remote import cursor advances.
7. `projected`: event is safely applied to local storage (or proven already applied).
8. `projection_committed`: revision and projection cursor are finalized with inbox-event removal.

The implementation has separate upload and projection gates. `synced` must not mean merely that the upload was accepted; the coordinator requires zero pending mutations and remote reconciliation.

## Blocking states

- `blocked_pending_local`: a local mutation exists for the collection; do not overwrite it with remote data.
- `blocked_base_revision`: local revision does not match the event's base revision.
- `blocked_tombstone`: delete semantics are not implemented; preserve the event and do not advance the projection cursor.
- `projection_failed`: local application/finalization failed; retain recovery intent and inbox data.

## Revision rules

- Server document revision is monotonic and advanced transactionally.
- A mutation must present the exact base revision.
- Stale base revision is rejected with `REMOTE_REVISION_CONFLICT`.
- Client timestamps are descriptive metadata only and are not used for conflict ordering.
- The per-user server sequence orders remote events independently of device clocks.

## Current limitations

The state machine safely detects and blocks conflicts but does not yet persist a dedicated conflict record or offer a conflict-resolution UX. Tombstones are accepted by the remote mutation envelope but intentionally blocked during local projection.
