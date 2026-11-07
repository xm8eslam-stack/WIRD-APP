# WIRD Sync Failure Recovery

## Projection crash recovery

Before local projection, the journal records a durable `RemoteProjectionIntent`. The local projection and finalization are serialized through the IndexedDB journal transaction. Finalization commits the remote revision and projection cursor and removes the inbox event atomically. If projection/finalization fails, the intent and event remain for restart recovery.

PR #73 added failure-injection coverage for failed finalization and retry. It was merged as `cc887a6bfa07aec880f495221e64dd36edb14ca8`.

## Retry and offline behavior

- Pending mutations remain in IndexedDB when upload fails.
- Journal retry metadata includes attempt count, next-attempt timestamp, and bounded backoff.
- Imported inbox events remain durable until projection commits.
- Ordinary remote projection is blocked rather than destructive when a pending local write targets the same UID/collection/document or a base-revision mismatch exists. A pending write to a different document in the same collection does not block the event. Grouped syncMeta transactions retain collection-wide pending checks.
- Network reconnect triggers a coordinator sync attempt; this does not certify every offline duration or stress scenario.

## Known unverified scenarios

- Long offline windows (hours/days) and thousands of queued mutations.
- Browser crash at every upload/acknowledgement boundary under real browser storage.
- Multi-tab competing sync workers under real browser contexts.
- IndexedDB blocked/upgrade failure and account-switch races across all coordinator operations.
- Tombstone replay/retention/garbage collection.
- Dedicated conflict resolution and rebasing.

## Account scope changes during an in-flight sync

The coordinator captures the authenticated UID and expected storage scope at the start of a sync cycle. Every outbox operation that follows a legacy migration is bound to that UID, and the coordinator revalidates the current authenticated UID, email-verification state, and exact `user:<uid>` storage scope after asynchronous boundaries.

If the account changes while a write is in flight:
- Abort the old cycle before reading or mutating the new account's outbox.
- Do not acknowledge, rebase, or mark failed a mutation under the new account's scope.
- If the old user's Firestore write already committed, leave its local mutation pending; the original account can retry the same mutation ID idempotently when it returns.
- Keep both users' pending mutations isolated and recoverable.

PR #110 adds a regression test with the same mutation ID in two accounts, checking that stale A operations cannot read or mutate B's outbox. This is automated service/coordinator evidence; real browser auth-switch E2E and multi-tab lifecycle tests remain required.


## 2026-11-07 — conflict evidence and bounded recovery

Conflict archiving now captures pending local outbox entries together with the local raw snapshot. The archive is updated atomically with the inbox/conflict stores and is bounded to 500 KB combined. If serialization fails, a mutation fingerprint changes, or the evidence exceeds the bound, the transaction aborts and leaves the inbox event, outbox entries, and projection cursor unchanged. Repeated observations append previously unseen mutation IDs without replacing original evidence.

After a future user decision is implemented, the next recovery requirement is to persist the decision and its idempotency key before applying any local/remote mutation, then revalidate the latest remote revision inside the same transaction boundary. Until then, conflicts remain blocked and recoverable rather than being automatically resolved.


## Current resolution status (PR #126/#129)

The archive now preserves local pending mutation evidence and the projector/finalizer distinguish same-document conflicts from unrelated documents. User-directed keep-local/use-remote/merge decisions, latest remote revision revalidation, idempotent completion, and interrupted-resolution recovery remain unimplemented. Keep unresolved conflicts blocked.


## 2026-11-07 — refreshed recovery audit after PR #134–#139

- Latest main SHA: `28a1c4339d31bb66549402db36cfc40357caf65f`.
- PR #134 ensures grouped transaction conflict archival captures pending Outbox mutations in every validated affected collection. Archive overflow/fingerprint mismatch remains fail-closed; Inbox and Outbox are not deleted and projection cursor does not advance.
- The existing projection intent only recovers remote event projection. It is not a durable user resolution decision and must not be treated as one.
- User decision persistence, latest-revision revalidation, resolution-mutation acknowledgement, and crash recovery across the decision/commit boundary remain unimplemented.
- PR #135 adds fail-closed handling for corrupt Ruqyah progress: stale in-memory counts are cleared while original corrupt bytes are preserved and writes remain blocked until explicit recovery.
- PR #137 requires explicit confirmation for category counter reset and disables reset while progress is not hydrated or corrupt. PR #139 restores keyboard focus and supports Escape cancellation.
- Current main Vercel status is limited by the Free-plan daily deployment quota; production deployment/live behavior remains unverified.

