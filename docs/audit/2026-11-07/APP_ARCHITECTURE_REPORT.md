# WIRD — Application Architecture and Codebase Report

Repository: xm8eslam-stack/WIRD-APP  
Baseline: main @ 6228150c2f7137678ba1079f5d9b2e8aba527523  
Audit branch: chore/full-repository-audit-20261107  
Date: 2026-11-07  
Review coverage: 144/147 tracked files reviewed initially; 3 PNG assets require visual inspection. See FILE_AUDIT_REGISTER.md for per-file notes.

## 1. Product and runtime overview

WIRD is an Arabic RTL, offline-first Quran memorization and revision Progressive Web App. It combines a static verified Quran dataset, local progress/retention tracking, structured memorization plans, session and revision workflows, Tafsir lookup, recitation audio, optional AI guidance, Firebase Authentication and a partially implemented Firestore sync path.

Current stack:
- React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4.
- Express server (server.ts) for local/AI Studio development and Node production smoke testing.
- Vercel serverless handlers under api/ for hosted API endpoints.
- Firebase client SDK 13 (Firebase App + Authentication in src/lib/firebase.ts); Firestore is not initialized as a complete application repository/replication adapter.
- Native IndexedDB v3 journal/outbox, plus localStorage projections and scoped keys.
- Service worker and PWA manifest; external EveryAyah MP3 streaming; Quran.com-backed Tafsir proxy.
- Bun 1.4.4 lockfile, npm scripts, TypeScript no-emit validation, custom test runner and Firestore Emulator Rules tests.

The package name/workspace remains react-example, not wird-app. This is metadata debt, not an application runtime failure.

## 2. Application entry and component hierarchy

- index.html: Arabic RTL document, typography, social and PWA metadata.
- src/main.tsx: React root and service-worker registration.
- AuthProvider (AuthContext.tsx): Firebase auth state, guest preference and verification state.
- AuthGate: decides when the app can access guest or UID-scoped data, initializes storage scope, replays local journal state and runs legacy portion migration.
- App.tsx: global route/state, data loading, mutation orchestration and view composition.
- Header and Sidebar: global navigation, user and sync status.
- Lazy-loaded views: Dashboard, Quran Library/Mushaf/Tafsir, Plans/Wizard, Memorization Session, Revision Center, Tests, Progress Analytics, Advisor and Settings.
- Service layer: Quran math, planning, retention, canonical portions, backup/migration, domain events, local journal, replay, outbox and cloud coordination.
- src/data: Quran text/metadata, presets/demo fixtures, page/Juz/Hizb navigation and generated lazy-loader outputs.
- api/ and server.ts: optional external services; never required for local Quran reading, memorization or data persistence.

App.tsx remains a large orchestration component. Some views still call legacy synchronous storage APIs directly. The local and hosted Advisor APIs are duplicated (api/advisor.ts and server.ts) and can drift. Refactor boundaries only after correctness fixes are covered by tests.

## 3. Quran content and navigation

Canonical content:
- src/data/completeQuranData.json: 114 Surahs and 6,236 ayahs, Uthmani/Hafs.
- src/data/tanzilReferenceData.json: independent reference dataset.
- src/data/quranMeta.ts: Surah metadata.
- src/data/quranNavigation.ts plus generated page/navigation indexes: 604 Mushaf pages, 30 Juz, 60 Hizb / 240 quarters.
- quranDataInfo.ts and quranValidationReport.json: attribution, license and validation evidence.
- quranDataLoader.ts and scripts/split-quran-data.mjs: generate/load one Surah chunk at a time; generated chunks are ignored by Git and created by predev/prebuild/pretest/prelint.

Current main Quality Gate verifies 6,236/6,236 ayah text and metadata comparisons against the independent Tanzil reference, with zero reported character, local/global number, Surah, page, Juz or Hizb-quarter mismatches. The validation report records the Tanzil reference SHA-256; add a checksum for the canonical app dataset too.

Do not hand-edit Quran JSON or use AI to generate Quran text. Any future source update must be a separate controlled data change with attribution, checksum, exact comparison, independent review and regression tests.

Library and session views lazy-load the active Surah. Mushaf reader uses the generated page index. Page progress expands cross-Surah pages into canonical Surah segments and computes the least-secure overlapping status. Tafsir is fetched on demand and cached locally. Audio is streamed from EveryAyah using a fixed reciter registry and verse URL formatter.

Content governance risks:
- Five curated Mutashabihat entries and their explanations have no scholarly provenance metadata; they need review by a qualified Quran teacher before being presented as authoritative.
- Advisor methodology claims and the quoted Ibn al-Jazari reference need reliable source citations/review.
- EveryAyah audio rights are distinct from Tanzil text licensing. Keep attribution and external links visible; do not bundle/mirror audio without reciter-specific permission.

## 4. Local persistence architecture

Guest data is separate from authenticated data. Authenticated keys are scoped by Firebase UID. The first account on a device receives an explicit decision about existing legacy data: import to the account or keep as guest. Account switching and migration are guarded by storage scope checks.

Expected authenticated mutation path:

    UI action
      → domain snapshot/transaction builder
      → IndexedDbSyncJournal (append event + outbox atomically)
      → local projection replay under cross-tab lock
      → StorageService/RetentionService projection
      → pending outbox mutation for remote delivery

Key files:
- domainEvents.ts: typed event union and schema-v1 validation.
- journaledSnapshotService.ts: journal-first single/grouped mutations.
- indexedDbSyncJournal.ts: IndexedDB v3 schema, event ledger, sequence/cursor and outbox records.
- journalProjectionReplayer.ts: replays committed events into local projections and advances a contiguous cursor.
- localSyncOutbox.ts: async outbox facade, legacy queue migration, retry/backoff and stable identity.
- backupPersistence.ts: journaled import/reset and legacy migration.
- storageService.ts / unifiedPortionService.ts / retentionService.ts: domain data and local projections.

Strengths:
- Event and outbox records are atomically committed in IndexedDB.
- Mutation IDs and device identity use Web Crypto UUIDs.
- Repeated identical enqueue is idempotent; same ID with changed payload is rejected.
- UID scoping isolates outbox records.
- Cross-tab journal sequences are serialized and monotonic.
- Corrupt localStorage archives are preserved rather than normalized to empty and overwritten.
- Replay stops before invalid events and does not advance cursor after a failed projection.
- Authenticated IndexedDB failures do not silently downgrade to unsafe local-only writes.

Remaining local persistence risks:
- Web Locks API is required for safe cross-tab projection; unsupported browsers fail closed. Define a supported browser matrix or implement a transaction-backed lock fallback.
- Legacy synchronous storage APIs still exist for compatibility and at least one authenticated UI path bypasses journaled backup import (ProgressAnalyticsView).
- Multi-key localStorage operations can roll back ordinary failures but are not crash-atomic; IndexedDB journal is the stronger recovery boundary.
- domainEvents.ts allows ayah coordinates up to 286 without validating actual verse count for the selected Surah.
- quranMath.ts does not consistently reject non-integer/invalid coordinates in every public function.
- planLifecycle.ts can drop revision-only task history during resume/recalculation.

## 5. Cloud synchronization: what exists and what is missing

What exists:
- Firebase Authentication and email verification gating.
- Firestore rules with UID ownership, verified-user requirement, allowlisted collections, generic envelope validation, immutable users/{uid}/events/{eventId} path, no physical deletes and default deny.
- Firestore Emulator rules tests (13 passing on current main CI).
- cloudSyncCoordinator.ts, useCloudSync.ts, Header/Settings sync status UI.
- IndexedDB outbox and local event ledger foundations.
- PR #59 has additional retry/idempotency/status improvements, but is Draft, diverged and not merged.

What is not complete:
- No complete Firestore repository/adapter that guarantees server-owned revisions and transaction/CAS semantics.
- No proven remote event import into the local journal/projection.
- No durable remote cursor/checkpoint for complete incremental pull.
- No deterministic two-device conflict reconciliation.
- No tombstone convergence proof against stale clients.
- No real two-device test evidence.
- No confirmed production Firestore rules deployment.
- The main coordinator can read remote events without importing/applying them; this does not constitute full synchronization. Its status must not say fully synced while remote reconciliation is absent.

A user can be told cloud sync is complete only after local mutation/outbox atomicity, verified idempotent push, server-owned revision/CAS, remote event import, durable cursor, idempotent projection, conflict handling and offline/two-device/account-switch tests all pass.

## 6. APIs, AI and external services

Tafsir:
- Client: src/services/tafsirService.ts.
- Hosted proxy: api/tafsir.ts.
- Express development route: mounted before Vite SPA fallback in server.ts.
- Five supported Tafsir edition IDs; local bounded cache; source/book validation; Quran coordinate validation.
- Main client calls response.json() without verifying content type; an HTML SPA/error response causes the reported Unexpected token '<'. PR #60 has guards and tests, but is Draft, stale and CI red. Port the fix to a fresh main-based branch and test the actual hosted function route.

AI Advisor:
- Client: advisorService.ts with deterministic offline fallback.
- Hosted function: api/advisor.ts; Express implementation is duplicated in server.ts.
- Gemini model gemini-3.8-flash; API key is server-side.
- Request body is bounded and prompts are truncated; an in-memory per-IP rate limiter exists.
- Security blocker: no Firebase ID-token verification; wildcard CORS does not protect the quota-consuming endpoint; in-memory limits are not shared across serverless instances.
- Data quality issue: client sends overlapping portion sum as memorized ayah count and weekly completion rate as retention score. The deterministic advisor hardcodes best day and contains uncited religious-method claims.
- Chat history is passed from the client but ignored by both server handlers, so the visible conversation is not context-aware.

## 7. PWA, UX and performance

PWA manifest and service worker support standalone RTL app shell, network-first navigation, same-origin asset cache, API exclusion and bounded EveryAyah session audio cache. Session view loads one Surah, tracks timer/repetition, masks words and separates review vs memorization completion. Shared playback-rate control stores device preference in localStorage. The 604-page map uses the canonical generated index and has a 48px touch-target source test.

Known issues:
- QuranLibrary multi-repeat playback can loop indefinitely because the same audio.onended closure reads stale currentRepeatCount.
- PWA update action reloads immediately after SKIP_WAITING rather than waiting for controllerchange.
- Auth resend timer lacks unmount cleanup; clipboard promise is not awaited/caught.
- Root React entry has no visible ErrorBoundary.
- Manifest is portrait-only; verify tablet landscape.
- Mobile tests are static source assertions, not real device/browser accessibility tests.
- Build output has previously shown large chunks; measure current main bundle and split only after profiling.

## 8. Testing and CI

Main exact-head Quality Gate run 42295376778 on 6228150c2f7137678ba1079f5d9b2e8aba527523 passed:
- 402 aggregate automated assertions/tests, 0 failed.
- 13 Firestore Emulator Rules tests, 0 failed.
- Dependency audit.
- TypeScript tsc --noEmit.
- Quran split/index generation and production Vite build.
- Production and development server smoke tests.

Test strengths: strong localStorage failure injection; fake IndexedDB tests for UID isolation, transaction atomicity, cross-tab sequencing, retry and migration; Quran content/reference and page-index integrity; review vs memorization completion; Firestore rules positive/negative emulator coverage.

Test gaps: cloud coordinator suite has only basic state/guest/subscription tests, not remote push/pull/conflict. Many UI/mobile/PWA/lazy-load checks inspect source text rather than exercising a browser. No dedicated regression test for QuranLibrary repeat count, plan revision-only task preservation, ProgressAnalytics journaled backup import, real AI authorization, or valid deployed Tafsir route. TypeScript is not strict; any and unsafe optional access remain possible.

## 9. Documentation and configuration status

Main tree is 147 files/34 directories; 144 text/config/source/data files were reviewed and recorded. Three PNG icon assets could not be decoded by the GitHub text-file endpoint and need visual inspection.

Several documents are stale: AI Studio blueprint, Development Checkpoint, Work Session Checkpoint, Implementation Roadmap, Master Roadmap and Security Audit refer to old SHAs, old PRs or no-sync architecture. Treat them as historical records, not current operational instructions. Keep WORK_LOG append-only; append a current audit entry rather than rewriting history.

.gitignore excludes secrets and generated Quran chunks/index. Firebase client config contains public client identifiers/API key, not a service-account credential. Never expose privileged credentials. firebase-blueprint.json describes intended event schema; align it with actual Firestore rules and server-owned revision requirements.

## 10. Overall judgment

WIRD has a strong local-first persistence foundation and a verified Quran dataset. Current main passes its automated Quality Gate. It is not yet safe to describe the whole application as production-ready for all advertised features because cloud synchronization is incomplete, the Tafsir HTML-response issue remains on main, the Advisor endpoint is not protected against quota abuse, and several local data/UX paths have confirmed defects.

Immediate priority: fix correctness and safety at existing boundaries before extending features or performing a large UI refactor.
