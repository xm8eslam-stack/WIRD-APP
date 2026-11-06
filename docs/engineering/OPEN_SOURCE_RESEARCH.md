# Open-Source Architecture Research — WIRD

**Reviewed:** 2026-11-06  
**Purpose:** reuse proven architectural ideas without importing incompatible code or weakening WIRD's data-integrity requirements.

## 1. Ummah Library — cross-device sync architecture

Repository: https://github.com/UmmahLibrary/ummah-library  
License: AGPL-3.0-only. WIRD has not copied code from this repository. The review is architectural; any future code reuse requires a separate license review and explicit compatibility decision.

Reviewed public ADRs:
- [ADR 0033 — account sync](https://github.com/UmmahLibrary/ummah-library/blob/main/docs/adr/0033-account-sync.md)
- [ADR 0034 — element-level merge](https://github.com/UmmahLibrary/ummah-library/blob/main/docs/adr/0034-sync-element-merge.md)
- [ADR 0035 — incremental cursor and bounded push](https://github.com/UmmahLibrary/ummah-library/blob/main/docs/adr/0035-sync-incremental-cursor.md)

### Ideas worth adopting

1. **Keep domain logic independent of the transport.** Define a sync port and a Firestore adapter; don't let UI components call Firestore directly.
2. **Stable identity per logical record.** Sync a portion, plan, or event by stable ID instead of uploading one mutable JSON array.
3. **Element-level merge.** Different records must merge independently so one device changing one portion cannot erase another device's unrelated progress.
4. **Immutable activity events.** Session completions, reviews, and mistake events should have unique IDs; retries must be idempotent.
5. **Incremental cursor.** Pull only records changed after the last acknowledged cursor.
6. **Dirty/bounded push.** Send only pending local mutations and keep each batch comfortably below backend limits.
7. **Atomic server-side merge.** Mutable state documents need transactions or another concurrency-safe compare-and-merge mechanism.
8. **Explicit tombstones.** Deletions are records with identity and ordering, not physical deletes that stale devices can reverse.

### Ideas not copied directly

- ADR 0033 uses a recovery phrase and end-to-end encryption with a custom backend. WIRD already has Firebase Authentication and a Firestore security model; the first implementation will use UID-owned Firestore documents, not introduce a second identity/recovery system.
- The Ummah Library implementation uses WebCrypto and Upstash Redis. WIRD will use Firebase SDK/Firestore and its own tested adapter.
- Whole-key LWW is not safe for WIRD's portion/history/activity arrays. Use per-record docs and immutable events instead.
- The ADRs and repository are AGPL-3.0; no source files are copied into WIRD.

## 2. Firebase official behavior relevant to the design

Primary documentation:
- [Firestore offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore JavaScript SDK reference](https://firebase.google.com/docs/reference/js/firestore)

Important constraints:
- Firestore web uses memory cache by default.
- Persistent web cache is optional and is not automatically cleared between sessions.
- Multiple writes to the same Firestore document resolve with last-write-wins under offline synchronization.
- Transactions require a network connection; offline local durability must therefore be handled by WIRD's own local outbox if transaction-based conflict resolution is used.
- Firestore batches/transactions have finite write limits; sync must use bounded pages.

Design consequence: start with Firestore memory cache plus a UID-scoped local outbox. Do not enable persistent Firestore web cache by default on a shared browser. Keep offline data durability under WIRD's account-scoped storage.

## 3. WIRD-specific adaptation

WIRD is not a generic notes app. Its data includes:
- memorization portions with overlapping ayah ranges,
- SM-2 revision state and review history,
- weak-verse mistake counts,
- plan schedules,
- per-day activity and streaks,
- test results.

Therefore:
- Never merge by summing whole arrays.
- Never let an older success overwrite a newer failure.
- Never treat a per-day aggregate as an immutable event.
- Derive counters from deduplicated events where possible.
- Keep Quran text out of the sync payload; it is static verified app data.
- Keep local export/restore as the recovery path.

## 4. Research conclusion

Adopt the architecture patterns (ports, stable element identity, immutable events, incremental cursors, dirty bounded push, atomic merge) but implement them natively for Firebase and WIRD's existing local-storage model. The implementation plan is in `FIRESTORE_SYNC_DESIGN.md`.
