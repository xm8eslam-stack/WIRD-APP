# Current implementation status — 2026-11-13

> This is the current branch-aware status. The original PR #355-only status below is historical and must not be read as the latest work.

- Main does not yet contain a complete persistent Offline Audio download feature.
- PR #368 is OPEN/DRAFT at head `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710`. Its branch includes a unified metadata library, Cache Storage adapter, bounded HTTP downloader, and job lifecycle/retry/pause/resume/cancel work with tests. It is not merged or in Production.
- PR #366 is a separate Offline/PWA shell/readiness change; it does not by itself complete the audio-download worker protocol or local playback integration.
- Remaining #368 work: Service Worker message protocol/integration, download UI/library, playback from verified local files, real browser/device airplane-mode/restart/quota tests, and proof that audio stays excluded from Firebase and backups.
- PRs #358/#359 are superseded by #368 and must not be merged independently.
- See [CONTINUE_HERE.md](../CONTINUE_HERE.md) for current PR heads and [CHANGE_CONTROL.md](../CHANGE_CONTROL.md) for shared-file sequencing.

---

# WIRD — Offline Quran audio download plan

## Live implementation checkpoint — 2026-11-12 14:35 +02:00

- PR #355 pure range planner remains merged.
- PR #368 is the current unified metadata foundation replacing the overlapping #358/#359 proposals. It implements jobs/files/jobItems, shared canonical file relations, pinned retention, cache-eviction state, recoverable deletion markers, and tests.
- PR #358 and #359 remain Draft/unmerged and are superseded by #368.
- Not implemented yet: HTTP downloader, Cache Storage adapter, service-worker message protocol, download UI, playback local-first lookup, and real-device offline playback.
- Exact-head #368 Quality Gate run `43210985755` / job `131158220859` ended failure with no steps/logs; do not claim test success or code failure. Vercel Preview is blocked by Free build-rate.


**Live checkpoint:** 2026-11-12 01:23 +02:00  
**Current main:** `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` — Vercel Production `READY` on the same SHA.
- PR #355's pure range planner is merged; PR #361 keeps EveryAyah network-stream-only and cleans legacy cache entries; PR #362's guest-entry Playwright wait fix is merged.
- PR #358 and #359 remain OPEN / DRAFT / unmerged. Their exact-head runs failed only at the desktop/mobile revision Playwright flow because the helper never navigated from guest entry; logs show it waited for the add-portion button. Other test suites, TypeScript, Firestore emulator, and production build passed on the observed heads.
- Do not merge either manifest implementation as-is. Both are based on old main `4b299042...` and overlap in IndexedDB ownership. Build one implementation on current main using `OFFLINE_AUDIO_STORAGE_CONTRACT.md`.
- No downloader, persistent manifest, Cache Storage coordination, download UI, or real-device offline playback is claimed as implemented. No runtime code changed in this documentation checkpoint.
- Re-test interruption/recovery, shared files across jobs, deletion reference safety, quota, orphan/missing entries, sync conflicts, browser eviction, and multi-tab behavior before release.

---
# WIRD — Optional Offline Quran Audio Downloads

## Status
Phased implementation in progress. PR #355 introduces only the pure, tested range planner; downloads, persistent manifest storage, worker protocol, UI, and offline playback are not implemented yet. Keep this feature separate from the existing opt-in application-shell preparation and opportunistic next-ayah cache.

## Source terms re-check — 2026-11-11
- Official Al Quran Cloud terms explicitly permit streaming, embedding, and downloading recitations for personal and educational use at the published bitrates; copyright remains with the reciters or their estates: https://alquran.cloud/terms-and-conditions
- The official CDN documentation defines the ayah audio URL pattern and canonical global ayah range 1–6236: https://alquran.cloud/cdn
- This permission is limited to the provider's approved recitations and stated use; it is not a blanket license for other providers or for WIRD to rehost the audio.
- EveryAyah has no confirmed provider-wide offline-storage permission in the reviewed sources. Existing app behavior is therefore stream-only: the service worker no longer caches these files and prunes any legacy EveryAyah entries on activation. Do not restore offline caching for this provider without a documented rights basis.

## Goal
Let a user explicitly download a chosen Quran reciter's surah or ayah range to the current device, verify the saved files, play them without a network connection, inspect storage use, cancel an active download, and remove selected downloads. Never download the full Quran automatically.

## Approved source boundary
- Use only the existing curated Al Quran Cloud / Islamic Network reciter allowlist in src/services/ruqyahAudioService.ts and its documented CDN URL pattern.
- The provider's published terms describe recitations as licensed by reciters/estates and permit streaming, embedding, and downloading for personal and educational use at published bitrates. Re-check the terms at implementation/release time.
- Do not use EveryAyah as a bulk-download source until its redistribution/offline-storage terms are independently established.
- Do not bundle or rehost audio on WIRD infrastructure. Downloads remain on the user's device, are user initiated, and can be deleted.

## User experience
1. Add a clearly named تنزيلات التلاوة area in Quran audio controls/settings.
2. Let the user choose one approved reciter, one surah or an explicit ayah range, and confirm an estimated count/size before starting.
3. Show queued/downloading/completed/partial/failed states, bytes/files progress, current surah/range, pause/cancel, and retry of missing items.
4. Show a local library with reciter, surah/range, file count, storage size, last verification, and delete action.
5. Playback checks the exact local cache entry first, then uses the network if online. Offline missing items must show a clear message rather than silently stalling.
6. Downloads are device-local and must never enter Firestore sync, account backup, or user-content exports.

## Storage and reliability rules
- Use navigator.storage.estimate() before download; display current usage/quota and a conservative estimate for the requested range. Estimates are advisory because browser quota can change.
- Ask for persistent storage only after an explicit download action; never imply that persistence is guaranteed.
- Require explicit confirmation if the estimated download approaches a configurable local budget or leaves too little headroom. Do not invent a universal device quota.
- Use a dedicated versioned Cache Storage namespace and a small IndexedDB manifest containing only approved reciter ID, surah/ayah coordinates, exact CDN URL, byte length when available, timestamp, and verified state.
- Verify every response: HTTPS, exact cdn.islamic.network host, allowlisted edition/bitrate, expected ayah number, HTTP 200, audio content type, bounded size, and non-empty body. Never cache redirects to unknown hosts or HTML error pages.
- Limit concurrent fetches (start with 2), use abortable requests, and persist progress after each file so interrupted work resumes safely.
- Before each batch, check quota again. On quota/storage errors, stop cleanly and preserve completed files; never evict user-pinned downloads silently.
- Cancellation stops future requests and aborts in-flight requests. Deletion removes both cache objects and manifest records, then refreshes usage/status.
- Avoid partial/range caching unless the provider's behavior is proven; cache complete ayah MP3 responses only.
- Provide explicit cache version migration and cleanup that never deletes other WIRD caches or user data.

## Architecture work items
1. Add a pure URL builder that derives global ayah IDs from canonical local Quran metadata and approved reciter configuration.
2. Add a download manifest repository with schema version, idempotent keys, atomic updates, and tests for malformed/stale records.
3. Add a worker message protocol for DOWNLOAD_AUDIO_RANGE, CANCEL_AUDIO_DOWNLOAD, GET_AUDIO_DOWNLOADS, and DELETE_AUDIO_DOWNLOAD; validate every message and payload in the worker.
4. Implement bounded, resumable downloads with progress messages and storage checks. Keep the current 40-entry opportunistic session cache independent from pinned downloads.
5. Add local-first playback lookup for approved audio only; preserve current online fallback and continuous queue behavior.
6. Add accessible mobile-first UI, screen-reader progress announcements, empty/error/quota states, and clear device-local privacy copy.
7. Add deterministic unit tests, Service Worker integration tests, and Playwright tests for start/resume/cancel/delete/offline playback/quota exhaustion/account switching.

## Release gates
- Source/license terms rechecked and recorded.
- Exact reciter/bitrate allowlist tests pass; arbitrary URLs rejected.
- No full-Quran automatic download; no cloud sync/backup of audio files.
- Download/cancel/retry/delete survive reload and service-worker update without orphaned manifest/cache entries.
- Offline playback verified after network is disabled on a real browser/device.
- Storage usage is bounded and no user-pinned files are silently evicted.
- Desktop/mobile accessibility and performance tests pass.

## Explicit non-goals
- No full-Quran automatic download.
- No rehosting, redistribution, or third-party audio pack integration.
- No automatic downloads over mobile data.
- No change to current reciter defaults or existing continuous playback semantics.
- No claim that tafsir, Firebase/Auth, IslamicAPI, or all remote resources work offline.


## Cache Storage + downloader implementation checkpoint — 2026-11-12
- PR #368 adds a generation-scoped Cache Storage adapter and bounded downloader orchestration. See OFFLINE_AUDIO_STORAGE_CONTRACT.md for validation and recovery boundaries.
- Downloader supports 1–2 concurrent requests (default 2), approved CDN host validation, redirect rejection, retryable failed items, pause/abort, cancel, and resume of queued/partial jobs.
- Cache data is only committed to IndexedDB metadata after Cache Storage write and exact read-back verification. Audio remains device-local and excluded from sync/backup.
- New service tests cover cache key generations, invalid responses, byte-length mismatch, downloader success, retry, pause, cancel and bounded concurrency.
- Exact-head #368 run 43275108775 / job 131381335018 ended failure with no steps/logs; no code-level diagnosis or test pass is available.
- Still missing: Service Worker protocol, download UI, local-first playback, orphan-cache cleanup policy, actual browser integration, and real-device offline test. This is not a released feature.
