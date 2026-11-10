# WIRD Offline-First Architecture

Last updated: 2026-11-10

## User-visible guarantees

WIRD uses a local-first approach for personal activity and an explicit offline package for the full application code. The application shell is cached during service-worker installation. Users can optionally download lazy-loaded application assets from Settings so sections they have not opened before can still load offline.

The offline package is resumable. A separate content cache keeps downloaded assets across service-worker shell upgrades. The readiness check reads the cached build manifest and reports the exact number of valid cached assets, missing assets, and total assets.

## Local content and data

- Quran text and bundled worship content are shipped as local application data and lazy-loaded chunks.
- User activity continues to use the existing local storage and durable journal/outbox architecture.
- Cloud synchronization remains a separate layer. Offline changes stay local and are retried when the browser reports connectivity and the authenticated scope is valid.
- Tafsir pages are cached locally when viewed; an uncached tafsir edition/ayah still requires its configured source.
- Related hadith pages are eligible for local caching only after the existing source, ayah-coordinate, matn, and Sahih validation checks pass. A missing offline cache must never be replaced by generated hadith content.
- Ruqyah text is resolved from WIRD's bundled verified Quran text and local ruqyah data. The optional external library remains network-dependent.

## Audio behavior

When a user starts Quran or ruqyah playback while online, WIRD asks the service worker to cache a short upcoming segment (up to 20 ayahs). The worker accepts only HTTPS URLs from the reviewed EveryAyah reciter folders and the curated Al Quran Cloud reciter editions. It validates the response type and content type, and keeps a bounded 40-entry audio cache.

This is opportunistic segment caching, not a full-surah download or a complete offline recitation library. Playback is never blocked by a cache failure. Browser storage pressure may evict cached media.

## Storage protection

When the user explicitly starts offline preparation, WIRD requests persistent browser storage where supported and reports whether the browser granted it plus the current usage/quota estimate. Browsers may deny the request; the app must continue working without claiming that persistence is guaranteed.

## Network and security boundaries

- Application API routes, account data, Firebase documents, and credentials are never included in the static offline package.
- Service-worker static asset caching is same-origin and extension/content-type allowlisted.
- External audio caching is restricted to exact reviewed hosts, reciter editions, HTTPS paths, and provider-appropriate CORS responses.
- No paid APIs or client-side secrets are introduced.
- Remote sync feature flags and Firestore release gates are not changed by offline package work.

## Verification still required

The release gate must verify first-visit shell caching, explicit package download and resume, package status accuracy, offline reload after a browser restart, Quran and ruqyah playback from cached segments, local user-data persistence, offline-to-online sync reconciliation, and browser storage eviction behavior.

A green unit/build/browser suite does not by itself prove that every optional external service is available offline. The UI and release notes must distinguish bundled, previously cached, and network-only content.
