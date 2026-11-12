

## 2026-11-12 — Offline-first completeness and future application direction

This addendum expands the existing offline foundation into a product-wide workstream. It does not claim that the current implementation has passed the complete release matrix.

### Capability contract

Every feature must declare one of these states in both its service contract and UI where relevant:
- Bundled: available on a fresh install without network (for example, verified Quran text and essential static worship data).
- Prepared for offline: available after the user explicitly downloads the app/content package to this device.
- Previously cached: available only if the exact validated content was fetched and retained earlier; show source/version/time and handle expiry.
- Opportunistically cached: best-effort media/assets may be available offline but are not guaranteed or pinned.
- Network required: needs authentication, a server API, a live provider, or content not previously cached. Show a clear offline explanation and preserve the user's place/input.

Never collapse these states into a generic “works offline” label.

### Work plan (ordered, with independent tracks)

1. Inventory: build a route × asset × data × action matrix. Include every lazy route and deep link, dynamically imported Quran datasets, fonts, icons, Mushaf images, audio, tafsir, hadith, Ruqyah, prayer-time/geolocation, Qibla, auth, backup/export, and sync. Record actual source, license, cache policy, maximum size/retention, and offline fallback.
2. Service-worker audit: test install/activate/update lifecycle, manifest validation, content-type checks, cross-origin allowlists, cache version migration, request timeout, cancellation, partial package recovery, and cache cleanup. Verify no private API responses, user records, auth tokens, or credentials enter shared static caches.
3. Data layer: inventory localStorage, IndexedDB journal/outbox/inbox, cache storage, and backup paths. Keep user-owned records separate from public content/media. Introduce transactional IndexedDB only where a concrete crash-atomicity or scale requirement is demonstrated; preserve migration/rollback and UID/guest isolation.
4. Core offline package: ensure all essential routes and their static dependencies are included, including lazy JS/CSS and any same-origin static assets required by those routes. Keep the package bounded and versioned; show package version and incomplete/missing counts.
5. Content: bundle verified Quran text and essential daily worship data with provenance/version. Cache tafsir/hadith only after existing verification gates; stale or missing records must not be replaced by AI-generated religious text. Network-only APIs remain clearly labeled.
6. Audio: retain the 20-ayah opportunistic queue as a separate best-effort cache. Implement explicit pinned downloads only from the approved Al Quran Cloud CDN/reciter allowlist after terms recheck; never bulk-cache EveryAyah without documented rights. Add quota estimates, user budget, resume, cancel, retry, delete, integrity checks, and offline-first playback selection.
7. Offline center and settings: a single panel reports browser support, service-worker controller/version, package completion, storage usage/quota/persistence, audio downloads, cached content, and network-only services. Do not claim persistence is guaranteed when the browser declines it.
8. App preparation: keep web PWA as the primary cross-platform baseline. After offline gates pass, compare Capacitor, Trusted Web Activity (Android), and native options against push/background audio/storage/auth needs, store policy, accessibility, update model, and free/maintenance cost. No wrapper or native plugin is selected or installed yet.
9. Verification: run deterministic unit/service-worker tests, then Playwright offline scenarios on desktop/mobile browsers, then manual real-device airplane-mode tests. Verify offline launch after browser/app restart and after service-worker upgrade. Record device/browser/OS, build SHA, cache state, and exact steps.

### Non-negotiable invariants

- No secrets, Firebase tokens, account-specific API payloads, private backups, or user progress in a shared public content cache.
- No network request is allowed to block local reading or corrupt local progress.
- Offline writes are durable locally first; online replay is idempotent and conflict-safe.
- Cache cleanup never deletes user-pinned downloads or local user data without explicit user action.
- Quran/hadith/tafsir/fiqh content remains source-bound; offline fallback is exact previously verified content or a clear unavailable state.
- Storage estimates are advisory; quota and eviction must be treated as normal runtime conditions.
- Service worker is not a substitute for app-native background execution; do not promise background audio/download guarantees across platforms.

### Definition of done

Offline readiness is certified only when the route/data/action matrix is complete, the package and local data recover after restart, core workflows pass airplane-mode tests, online reconciliation passes replay/conflict tests, no private data enters shared caches, and the exact released SHA is verified in a real installed PWA. Future native packaging has its own separate platform test gate.
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
- Related hadith pages are cached locally only after the existing source, ayah-coordinate, matn, and Sahih validation checks pass. The cache is bounded to 30 pages and expires after 30 days. A missing offline cache must never be replaced by generated hadith content.
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


## 2026-11-12 — Bounded offline navigation fallback

- Service-worker SPA navigation now uses a six-second request timeout before falling back to the cached index.html shell, preventing a slow/unreachable network from indefinitely delaying a local launch.
- Added PWA integration assertions for the timeout constant and its use in the navigation handler.
- This is code-level coverage only; cold-start and restart behavior still require real browser/device airplane-mode verification.
