# WIRD — Offline Quran Audio Storage Contract

**Status:** Proposed engineering contract; not implemented or released.
**Reviewed:** 2026-11-11.
**Related PRs:** #355 (range planner, merged), #356 (planner work superseded by #355), #358 (job + item store proposal), #359 (verified-file manifest proposal), #361 (EveryAyah rights boundary, merged).

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

## 9. Implementation sequence

1. Keep #355's pure range planner; it is already merged.
2. Build one combined repository implementing `jobs`, `files`, and `jobItems` against fake-indexeddb tests.
3. Add a Cache Storage adapter with deterministic cache keys and an injectable test implementation.
4. Add the bounded downloader orchestration and reconciliation.
5. Add opt-in UI only after storage/recovery tests pass.
6. Verify offline playback and deletion on desktop/mobile browsers before calling the feature complete.

**Release boundary:** this contract is a design proposal. It does not mean WIRD currently supports managed offline Quran audio downloads.