# WIRD — Offline Quran Audio Storage Contract

## Implementation checkpoint — 2026-11-12 14:35 +02:00

PR #368 now implements the **device-local metadata foundation only** from this contract:
- One IndexedDB database with `jobs`, canonical `files`, and `jobItems` relation stores.
- Reuse of one verified reciter/ayah file across overlapping jobs.
- `available` state distinct from historical verification, so Cache Storage eviction is not reported as offline-ready.
- `pinned` retention and durable `deletionPending` markers; Cache Storage deletion must succeed before `finalizeOrphanDeletion` removes metadata.
- fake-indexeddb tests for shared references, quota rollback, eviction, stale scans, and deletion races.

PR #358 and #359 remain Draft and are superseded; do not merge independently. PR #368 does **not** fetch audio, coordinate Cache Storage writes/deletes, implement the Service Worker protocol, add download UI, or prove offline playback. The complete contract and release gates remain in force.


**Status:** Proposed engineering contract; not implemented or released.
**Reviewed:** 2026-11-12.
**Related PRs:** #355 (range planner, merged), #356 (planner work superseded by #355), #358 (job + item store proposal), #359 (verified-file manifest proposal), #361 (EveryAyah rights boundary, merged).

> **Implementation status — 2026-11-12:** This is the canonical design contract, not an implementation claim. PR #358 and #359 remain Draft/unmerged and must not be merged separately. Their observed exact-head Playwright failure was the shared guest-entry test setup race; #362 fixed the helper, so the combined implementation must be based on current main and rerun the complete exact-head gate. Current main: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
>
> **Required unified ownership:** one IndexedDB database for `jobs`, canonical `files` keyed by `(reciterId, globalAyah)`, and `jobItems` relations. Audio bytes live only in a dedicated Cache Storage namespace. A file referenced by multiple jobs must not be deleted while another live relation/pin still references it.

## 1. Decision summary

Use one device-local IndexedDB database as the source of truth for download jobs and verified-file metadata, and Cache Storage only for audio bytes. Merge the useful responsibilities of #358 and #359; do not merge either branch unchanged or keep two parallel manifests.

Recommended logical stores:

- `jobs`, key `jobId`: user-requested reciter/range, lifecycle state, timestamps, schema version, and cancellation state.
- `files`, key `reciterId:globalAyahNumber`: one canonical verified-file record per approved reciter and ayah, including exact URL, expected coordinates, byte length, verification timestamp, and schema version.
- `jobItems`, key `jobId:reciterId:globalAyahNumber`: relation between a job and the files it requires; supports one saved file being reused by overlapping jobs without duplicate bytes.

Cache Storage contains the complete MP3 response only. It is not the source of truth for job progress or Quran coordinates.

## 2. Why the current proposals must not both merge

- #358 provides useful job lifecycle and atomic job/progress transactions, but its item key is job-scoped. The same reciter/ayah can be recorded repeatedly across different jobs, even though the audio bytes are identical.
- #359 provides a canonical reciter/ayah key and validates coordinates and URLs, but it has no job lifecycle, range membership, or resumable job state.
- Both use IndexedDB and Cache Storage responsibilities that should be governed by one schema and one reconciliation process. Keeping both stores would create two competing definitions of whether an ayah is downloaded.

## 3. Canonical identity and validation

- Canonical audio identity: `reciterId + ':' + globalAyahNumber`.
- Derive `globalAyahNumber` only from WIRD's local canonical Quran metadata; never trust a caller-provided global coordinate without recomputing it.
- Build URLs through the existing approved reciter URL builder. Validate exact HTTPS host, edition, bitrate, path, and expected ayah number.
- Only approved Al Quran Cloud / Islamic Network recitations with reviewed terms may be stored offline. Re-check provider terms at release time.
- EveryAyah remains stream-only. Do not cache or download it until provider-wide offline-storage rights are documented.
- A manifest entry becomes `verified` only after the full response is received, HTTP 200 is confirmed, content type is audio, the response is non-empty and within a conservative size bound, and the exact Cache Storage write completes.

## 4. Cross-store lifecycle and crash recovery

IndexedDB and Cache Storage do not share one atomic transaction. Use an explicit recoverable sequence:

1. Create or resume the IndexedDB job and its pending job-item records.
2. Fetch with bounded concurrency, timeout, and AbortController; validate the complete response before storing it.
3. Write the complete response to the dedicated versioned Cache Storage namespace.
4. In one IndexedDB read/write transaction, upsert the canonical `files` record, mark the job-item verified, and recompute job progress/state.
5. If step 4 fails, leave no verified manifest state. Delete the just-written cache entry only when no other job/file reference uses it; otherwise retain it as an orphan candidate for reconciliation.
6. On startup/reopen, reconcile manifest records against Cache Storage. A missing cache entry must not be shown as downloaded; mark it missing and allow safe retry. Remove orphan cache entries only after proving they are not referenced.

Never claim cross-store atomicity. A crash between steps 3 and 4 may leave an orphan cache object; a crash after cache eviction may leave stale metadata. Both are expected recovery cases and require tests.

## 5. Job lifecycle and progress

- Supported states: queued, downloading, partial, completed, failed, cancelled.
- Job progress is derived from the verified job-item relations whose canonical file exists in Cache Storage, not from a counter that can drift.
- Duplicate enqueue for the same active range should be idempotent or explicitly reuse the active job; define a stable request fingerprint.
- Pause/resume/cancel must stop future work and abort in-flight requests. Cancellation must not delete files already referenced by another job or saved library item.
- A completed job is immutable; retry creates or resumes a valid pending job rather than silently reopening a terminal record.

## 6. Deletion and quota

- Deleting a job removes its job-item relations. It removes audio bytes only when no other job or saved-library reference points to that canonical file.
- Deleting a saved file removes its Cache Storage object and canonical `files` record in a recoverable order; if either side fails, mark the record for reconciliation rather than claiming deletion succeeded.
- Estimate quota before the user confirms a range and re-check during batches. Never evict user-pinned audio silently.
- Limit concurrency initially to 2; bound each response size and the total requested range; no automatic full-Quran download.

## 7. Migration and compatibility

- Neither #358 nor #359 is merged, so their proposed database names are not released user data. Prefer one clean schema rather than shipping two migrations.
- Use an explicit database version and migration tests. If a pre-release database is encountered, validate each record and either migrate losslessly or ignore it with a clear recovery state; never fabricate a verified file.
- Keep all audio-download state device-local and excluded from Firestore sync, cloud backup, and account exports.

## 8. Required tests before implementation/merge

1. Canonical key uniqueness across overlapping jobs and duplicate enqueue.
2. One file reused by two jobs; deleting one job must preserve the shared file.
3. Cache write succeeds but IndexedDB transaction fails; no verified record is shown.
4. Crash/reopen between Cache Storage write and manifest commit; orphan reconciliation is safe.
5. Cache eviction after manifest commit; file is reported missing and can be retried.
6. Quota failure during Cache Storage and IndexedDB writes; no false completion or data loss.
7. Cancel/pause/resume with in-flight abort and bounded concurrency.
8. Invalid host, redirect, HTML response, wrong content type, empty body, oversized response, wrong coordinates, and unapproved reciter all fail closed.
9. Cross-tab database upgrade/versionchange and blocked-open recovery.
10. Deletion of jobs/files with shared references, retries, and stale orphan cleanup.
11. Account/sync isolation: cloud sync, backup restore, account deletion, or a sync conflict must not mutate or resurrect local audio jobs/files; verify the device-local ownership boundary and no cross-account metadata leakage.
12. Browser storage limits: persistent-storage denial, browser-managed Cache Storage eviction, private-browsing restrictions, and quota changes must produce an honest missing/partial state without false completion.
13. Multi-tab races: two tabs enqueue/resume/cancel the same job concurrently; one canonical file is retained and progress remains monotonic without duplicate bytes or unsafe deletion.

## 9. Implementation sequence

1. Keep #355's pure range planner; it is already merged.
2. Build one combined repository implementing `jobs`, `files`, and `jobItems` against fake-indexeddb tests.
3. Add a Cache Storage adapter with deterministic cache keys and an injectable test implementation.
4. Add the bounded downloader orchestration and reconciliation.
5. Add opt-in UI only after storage/recovery tests pass.
6. Verify offline playback and deletion on desktop/mobile browsers before calling the feature complete.

**Release boundary:** this contract is a design proposal. It does not mean WIRD currently supports managed offline Quran audio downloads.

## Cache key generation safety — 2026-11-12

The future Cache Storage adapter must not use only the canonical reciter/ayah URL as the stored cache key. Each completed download needs an immutable `cacheGenerationId`; the cache key must include the canonical file identity plus that generation. `OfflineQuranAudioLibrary` stores the generation and returns it with orphan candidates. Cleanup deletes only the exact generation it was asked to remove. A re-download creates a new generation, so delayed cleanup for an older generation cannot delete the replacement. Cache generation IDs are local metadata and are never synchronized to Firestore.



## Current implementation checkpoint — 2026-11-12

PR #368 currently provides the IndexedDB metadata repository (`jobs`, `files`, `jobItems`) and integrity protections for timestamps, shared-file references, deletion, and cache-generation reconciliation. It does **not** yet fetch audio bytes, write Cache Storage, coordinate a Service Worker, expose a download UI, or provide offline playback. Its state must not be presented to users as a completed download until the Cache Storage adapter confirms the exact generation is present and verified.

The next code slice after the metadata foundation is a separately testable Cache Storage adapter with generation-scoped keys and injectable cache implementation. Only after that should bounded HTTP download orchestration and worker messaging be added. Preserve the device-local boundary: no audio jobs, cache generations, or bytes enter Firebase sync, account backup, or exports.


## Cache Storage adapter + bounded downloader implementation slice — 2026-11-12

PR #368 now includes an unmerged implementation slice beyond metadata:
- Generation-scoped synthetic Cache Storage keys include approved reciter ID, canonical global ayah number, and immutable cacheGenerationId.
- Cache writes require HTTP 200, non-opaque response, audio content type, non-empty body, bounded byte length, optional content-length consistency, and exact read-back byte equality before returning success.
- Cache lookup revalidates content type/body and metadata byte length; deletion targets exactly one cache generation.
- A bounded downloader orchestrator uses the existing canonical CDN URL builder, HTTPS + exact cdn.islamic.network host validation, redirect:error, credentials:omit, cache:no-store, and concurrency limited to 1–2 (default 2).
- Job items can be marked failed and retried. Pause aborts in-flight requests and returns a queued/partial job; cancel is terminal. Metadata commits only after Cache Storage write/read-back succeeds; if metadata commit fails, the just-written generation is deleted best-effort.
- New Cache Storage and downloader test suites are registered in runAllTests.

**Still not implemented:** Service Worker message protocol, user-facing download manager UI, local-first playback integration, orphan cache-key garbage collection, real browser Cache Storage integration, and real-device offline playback. Do not claim offline downloads are user-ready.
