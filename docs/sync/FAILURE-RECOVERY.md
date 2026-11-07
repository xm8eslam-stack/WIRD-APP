# WIRD Sync Failure Recovery

## Projection crash recovery

Before local projection, the journal records a durable `RemoteProjectionIntent`. The local projection and finalization are serialized through the IndexedDB journal transaction. Finalization commits the remote revision and projection cursor and removes the inbox event atomically. If projection/finalization fails, the intent and event remain for restart recovery.

PR #73 added failure-injection coverage for failed finalization and retry. It was merged as `cc887a6bfa07aec880f495221e64dd36edb14ca8`.

## Retry and offline behavior

- Pending mutations remain in IndexedDB when upload fails.
- Journal retry metadata includes attempt count, next-attempt timestamp, and bounded backoff.
- Imported inbox events remain durable until projection commits.
- Projection is blocked rather than destructive when pending local work or a base-revision mismatch exists.
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
