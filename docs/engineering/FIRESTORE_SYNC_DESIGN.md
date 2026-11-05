# WIRD — Cross-Device Sync Architecture

> Status: Local account isolation is implemented on main; Firestore sync and rules are NOT implemented or deployed.
> Reviewed: 2026-11-05
> Constraint: Firebase Spark / free services only; no mandatory paid service.

## 1. Current-state facts

- Firebase Authentication is already initialized in `src/lib/firebase.ts`.
- Verified users are admitted by `AuthGate`; guest mode is local-only.
- No Firestore initialization, Firestore Security Rules, or sync listeners currently exist in the inspected main source.
- `StorageService` now namespaces authenticated local keys by Firebase UID; guest mode remains in a separate legacy/guest scope.
- `AuthGate` prepares the correct local scope before mounting the app.
- First-account legacy data requires an explicit choice: import into the account, or keep it in guest mode. Import copies and verifies destination values before removing legacy source keys.
- `RetentionService` weak-verse reads/writes now use the central StorageService adapter.
- The app still initializes React state from local storage; no Firestore data flow exists yet.
- Therefore, simply adding `onSnapshot` to one collection is insufficient and risks cross-account leakage or data loss.

## 2. Product behavior

1. Guests keep using WIRD locally without Firebase or network requirements.
2. A verified signed-in user receives their cloud data automatically after authentication.
3. Changes made on one signed-in device become visible on other signed-in devices while online.
4. Offline edits remain available locally and are queued for later synchronization.
5. Signing out or switching accounts must never expose the previous account's local data.
6. A new account must never inherit another account's local dataset.
7. The first migration of existing unscoped local data must preserve a backup and bind the legacy dataset to exactly one account. If local legacy data exists, show a clear one-time ownership/import confirmation; after that, normal login sync is automatic.
8. Cloud sync errors must never be reported as successful saves.

## 3. Data model proposal

Use Firebase Auth UID as the ownership boundary. Store each entity separately; do not serialize all user data into one Firestore document (1 MiB document limit and avoid whole-state overwrite).

```text
users/{uid}/profile/main
users/{uid}/plans/{planId}
users/{uid}/enginePlans/{planId}
users/{uid}/portions/{canonicalPortionId}
users/{uid}/weakVerses/{surah_ayah}
users/{uid}/tests/{testId}
users/{uid}/activityEvents/{eventId}
users/{uid}/syncMeta/state
```

- `profile/main`: profile and preferences only.
- `plans`, `enginePlans`: stable existing IDs.
- `portions`: canonical passage IDs; validate Surah/ayah boundaries before writes and after reads.
- `weakVerses`: use a stable coordinate key such as `s{surah}_a{ayah}`, not the current timestamp-based ID.
- `tests`: stable test IDs, bounded payloads.
- `activityEvents`: immutable, uniquely identified session/revision events. Derive daily aggregates from events instead of merging counters blindly.
- `syncMeta/state`: schema version, migration state, and per-device cursor/metadata. Never trust a client-supplied UID.

The current `DailyLog` is an aggregate by date. Two devices can complete different sessions on the same date; replacing the aggregate document with last-write-wins would lose one session. Migrate toward immutable activity events with UUIDs, then derive `DailyLog` values. Preserve existing logs during migration.

The current `WirdPortion.history` is nested inside a portion. Concurrent edits to the same portion can overwrite history entries. Preserve history during migration and consider individual review-event records if concurrent same-portion editing is observed.

Do not sync duplicate projections blindly: `RevisionItem` is derived/legacy-compatible with canonical portions in the current storage migration path. Define one source of truth and regenerate the projection locally.

## 4. Local storage and account isolation

Implemented locally on main:
- Weak-verse reads/writes use the same storage adapter.
- AuthGate sets an explicit guest vs authenticated UID scope before app mount.
- Authenticated local keys are UID-namespaced; account switching does not read another UID's local keys.
- A one-time legacy-data ownership choice prevents silent cross-account import.

Still required before enabling cloud sync:
- Add a durable outbox per UID containing mutation ID, entity type, document ID, schema version, and payload.
- Keep remote snapshot application from re-enqueueing the same mutation.
- Do not clear local state on sign-out until pending writes are acknowledged or safely retained in that UID's namespace.
- Add a durable outbox per UID containing mutation ID, entity type, document ID, schema version, and payload.
- Remote snapshot application must not re-enqueue the same mutation.
- Do not clear local state on sign-out until pending writes are acknowledged or safely retained in that UID's namespace.
- On account switch, unsubscribe listeners, flush/retain the old account's outbox, then load the new UID scope.
- Existing legacy global keys are handled by a one-time in-app ownership choice and a migration marker. Choosing import copies and verifies before deleting the legacy source; choosing guest preserves the old dataset in guest mode.

## 5. Conflict and deletion policy

- Use stable IDs and per-record writes, not a whole-app last-write-wins blob.
- Scalar profile/preferences and plan metadata may use deterministic per-record last-write-wins with `updatedAtMs` plus a stable `deviceId` tie-breaker. Document clock-skew limitations.
- Immutable activity/revision events use unique event IDs so concurrent sessions do not overwrite each other.
- Weak-verse mistakes should be represented as uniquely identified events or transactionally merged counters; a naive read-modify-write counter is not safe offline.
- Deletions use tombstones with `deletedAt` and a mutation ID; do not immediately resurrect old local documents.
- Every remote payload is schema-validated and Quran-coordinate-validated before applying it locally.
- Sync operations are idempotent; retries cannot duplicate session counts.

## 6. Real-time and offline behavior

- Subscribe to the user's scoped collections with Firestore `onSnapshot`; process document changes rather than repeatedly replacing entire app state.
- Firestore web offline persistence is disabled by default. WIRD already needs local-first data and an outbox; begin with memory cache plus the UID-scoped local store/outbox rather than silently enabling a persistent shared-device IndexedDB cache.
- If persistent Firestore cache is later enabled, implement and test cache-clearing/account-switch behavior. Firebase documents that the web cache is not automatically cleared between sessions.
- Use explicit sync states: `local-only`, `syncing`, `synced`, `offline-pending`, `error`. Never label a local write as cloud-synced until server acknowledgement is observed.
- Avoid one listener per ayah. Keep one document per actual tracked portion and use incremental queries/cursors for larger collections.

## 7. Firestore security rules

Proposed baseline (must be tightened to the final document schema and tested in the Emulator before deployment):

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email_verified == true;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- No client-settable admin role.
- No public collection access.
- UID path must match the verified Firebase Auth token.
- Add field allowlists, type/size limits, and schema validation for each document family.
- Guest users receive no Firestore access.
- Verify Google sign-in and email/password verification claims against the real Firebase project before deploying.

## 8. Free-tier and offline constraints

Official Firebase documentation currently lists Cloud Firestore Standard free quota as:
- 1 GiB stored data.
- 50,000 document reads/day.
- 20,000 document writes/day.
- 20,000 document deletes/day.
- 10 GiB outbound transfer/month.
- One free database per project.

On Spark, exceeding a no-cost quota can shut off that product's usage for the remainder of the month. Keep listeners narrow, avoid full rewrites, and expose a graceful local-only state if quota/network errors block sync.

References:
- https://firebase.google.com/docs/firestore/pricing
- https://firebase.google.com/docs/firestore/manage-data/enable-offline
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## 9. Required implementation and release gates

1. Centralize local persistence and make all entities scope-aware.
2. Add deterministic migration/merge functions and tests before cloud writes.
3. Add Firestore adapter, security rules, and Firebase Emulator configuration.
4. Test unauthenticated denial, unverified denial, cross-UID denial, malformed payload denial, duplicate mutation IDs, two-device updates, account switching, offline queue replay, and tombstones.
5. Verify free-tier project/database state and current Firebase Auth providers in the actual project.
6. Deploy rules only after emulator tests and manual review.
7. Test with two separate real accounts/devices and confirm server-side document ownership.
8. Only then enable automatic sync for production users.

No live Firestore rules, account records, or user data were changed by this design document.
