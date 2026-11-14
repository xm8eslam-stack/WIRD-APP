# WIRD — Application Architecture

**Last reconciled:** 2026-11-14  
**Source of truth:** current repository code and exact deployment metadata. Re-check both before changing architecture.

## 1. Product boundaries

WIRD is a focused Quran and daily-worship application. Its primary domains are Quran reading/listening/search/tafsir, memorization and revision, daily adhkar and worship routines, prayer tools, and carefully sourced secondary Seerah content. It is not a general Islamic portal.

Religious-content trust rules:
- Quran display text must come from the verified local Quran corpus.
- External services may supply locators/coordinates or transport metadata only; they do not become a source for displayed Quran text.
- AI output is not an authenticated Quran, Hadith, Tafsir, or Fiqh source.
- Seerah claims require traceable sources, rights clearance, and editorial review before publication.

## 2. Runtime topology

```text
Browser / PWA
  ├─ React + TypeScript application
  │   ├─ feature views and route services
  │   ├─ verified local Quran corpus and lazy Surah loaders
  │   ├─ IndexedDB/local-first progress and plan storage
  │   ├─ Cache Storage for approved offline assets/audio
  │   └─ service worker for versioned app-shell/content caching
  │
  ├─ Vercel serverless API routes
  │   ├─ Ruqyah locator proxy (server-side IslamicAPI key)
  │   └─ Advisor endpoint (server-side Gemini key)
  │
  └─ Firebase
      ├─ Authentication
      └─ Firestore data/rules for supported cloud features
```

Production is delivered by GitHub `main` → Vercel. The inspected Production deployment is READY on main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.

## 3. Quran data boundary

- `src/data/quranDataLoader.ts` is the per-Surah lazy-loading boundary.
- Feature routes must not statically import the complete Quran corpus when a lazy loader exists.
- Ruqyah content services resolve external locators to local verified Surah/ayah data.
- API responses are reduced to validated identifiers and normalized coordinates. Provider-authored Arabic text and translations are not rendered as Quran.
- Quran chunk generation/validation is part of the Vite prebuild/build pipeline; the inspected Ruqyah Preview build generated 114 Surah chunks and validated 6,236 ayah coordinates.

## 4. Local persistence and offline boundary

- IndexedDB owns local application state and offline job metadata.
- Cache Storage owns downloaded byte assets; metadata and cached bytes are separate stores and require reconciliation after crashes/eviction.
- The service worker owns versioned app-shell and bounded content caches. It must not delete private user data.
- Offline audio jobs require idempotent lifecycle management, bounded concurrency/size, quota handling, partial cleanup, cross-tab ownership, restart recovery, and cache reconciliation.
- A successful downloader unit test does not prove airplane-mode or device-restart behavior.

## 5. Firebase and synchronization boundary

Firebase project identity in the inspected client configuration is `wird-quran-app`. Repository rules are maintained in `firestore.rules`; emulator tests are the required path for rule behavior.

Sync architecture separates:
- local state and journal;
- durable local delivery Outbox;
- remote event import/Inbox and cursor;
- server-owned revisions and transactional compare-and-swap;
- remote projection and conflict resolution.

Do not use client timestamps as conflict authority, blind last-write-wins, empty defaults, or destructive import fallbacks. Preserve corrupted raw data and conflict evidence.

**Production safety finding:** both `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` were read as `true` in Vercel Production on 2026-11-14. This conflicts with the disabled-until-release-gates policy. No settings were changed; explicit owner approval is required before changing them. Do not run sync-related production actions while unresolved.

Read the detailed sync design, state machine, release gates, and test matrix before modifying this boundary.

## 6. Server-side API boundary

- API keys stay server-side in Vercel environment variables.
- Ruqyah API validates query/program/source inputs, bounds upstream responses, validates coordinate references against local Surah metadata, and strips external Quran text.
- Advisor API bounds request/history sizes and must treat all client-supplied content as untrusted. Client-provided history sender labels are not authenticated assistant roles.
- Rate limiting in a serverless in-memory map is best-effort per instance, not a durable global quota.
- Do not log secrets, raw provider payloads, or sensitive user context.

## 7. Release evidence boundaries

Always report these independently:
1. local/isolated tests;
2. GitHub Actions exact-head checks;
3. production build;
4. Vercel Preview deployment;
5. Production deployment SHA/status;
6. live route smoke checks;
7. browser/real-device/offline verification;
8. Google AI Studio synchronization.

A READY Preview is not Production. A successful build is not runtime verification. A simulated multi-client test is not physical-device verification.

## 8. Architecture change rules

- Prefer small, evidence-backed changes within existing boundaries.
- Keep independent tasks on separate branches and serialize overlapping file changes.
- Add regression tests before changing persistence, Quran loading, API validation, or sync semantics.
- Preserve backward compatibility and recovery data before migrations.
- Keep remote sync activation and Production settings unchanged without explicit authorization.
- Update this document and the relevant domain design after material architecture changes.
