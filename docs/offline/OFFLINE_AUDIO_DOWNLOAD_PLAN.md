# WIRD — أحدث حالة موثقة

آخر تحقق من GitHub: 2026-11-11 16:15 +02:00
آخر main: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
PR #362 مدمج: `cfe9458e55bd4e66a51e57ce5a5c16e83b65becd` — إصلاح انتظار guest-entry hydration، Quality Gate PASS.
PR #361 مدمج: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe` — EveryAyah stream-only مع تنظيف cache قديم، Quality Gate PASS.
PR #360 القديم فشل في check واحد، وإعادة التشغيل فشلت دون تسجيل خطوات. أُعيد بناء فرع الوثائق فوق main الحالي مع الاحتفاظ بتعديل حقوق EveryAyah؛ هذه النسخة الجديدة تحتاج Quality Gate على رأسها النهائي.
PR #358 و#359 ما زالا متداخلين في ملكية manifest لتخزين الصوت؛ لا تدمجهما قبل عقد تخزين موحد.
PR #356 يحتاج مراجعة diff مقابل مركز الوثائق الحالي.
Production source SHA وlive smoke ومزامنة Google AI Studio: NOT VERIFIED.

هذه الحالة تتقدم على أي لقطة تاريخية أدناه. المصدر الحي للمهام هو هذا الملف؛ لا تعتمد حالات PR قديمة دون إعادة جلب GitHub.

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
