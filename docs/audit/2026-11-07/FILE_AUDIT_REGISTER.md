# WIRD — Per-file Audit Register

Baseline: `main@6228150c2f7137678ba1079f5d9b2e8aba527523`  
Tree size: 147 files.  
Status meanings: **REVIEWED (initial)** = contents inspected, but may need deeper call-site/test review; **PENDING** = only structural role inferred from path/name; no code-level verdict yet.  
Every row is a note. Update the note after full inspection; never mark a file reviewed merely because it was listed in the tree.

## Root, AI Studio, CI, API, server and documentation

| File | Note | Status |
|---|---|---|
| `.aistudio/artifacts/brain/54884aa9-9ac7-4435-a6bc-5bf9ab6e69b8/blueprint_v1.md` | AI Studio project blueprint; compare its intended architecture with current code and flag stale implementation assumptions. | PENDING |
| `.aistudio/artifacts/brain/54884aa9-9ac7-4435-a6bc-5bf9ab6e69b8/blueprint_v1.md.metadata.json` | AI Studio metadata sidecar; confirm it is generated/required and contains no sensitive values. | PENDING |
| `.aistudio/artifacts/brain/54884aa9-9ac7-4435-a6bc-5bf9ab6e69b8/implementation_plan.md` | AI Studio implementation plan; reconcile milestones against merged PR history and current code. | PENDING |
| `.aistudio/artifacts/brain/54884aa9-9ac7-4435-a6bc-5bf9ab6e69b8/implementation_plan.md.metadata.json` | AI Studio plan metadata; confirm whether generated and safe to retain. | PENDING |
| `.env.example` | Contains placeholders only; Firebase VITE values are public client config, Gemini key is server-side. Confirm deployed Vercel/AI Studio variables match actual code and no secrets are committed. | REVIEWED (initial) |
| `.github/workflows/ci.yml` | Quality Gate; inspected. Covers npm audit, aggregate tests, Firestore emulator, TypeScript, build/data splitting, and server smoke. Check dependency versions and whether checks represent actual cloud replication. | REVIEWED (initial) |
| `.gitignore` | Generated artifacts, secrets and local files exclusion rules; verify generated Quran chunks and environment files are excluded correctly. | PENDING |
| `AGENTS.md` | Canonical agent rules; inspected. Strong data-safety, exact-SHA CI and no-production-mutation rules. Its continuation context points to PR #59 and needs periodic refresh. | REVIEWED (initial) |
| `GEMINI.md` | Google AI Studio entrypoint; inspected. Correctly delegates to AGENTS and sync protocol; verify referenced paths exist on main. | REVIEWED (initial) |
| `api/advisor.ts` | Gemini 3.8 Flash serverless endpoint inspected; model ID is valid. Security blocker: wildcard CORS is not authentication, no Firebase ID-token verification exists, and in-memory per-instance IP rate limiting is bypassable across serverless instances. Validate bounded numeric context, use distributed quotas and protect quota-consuming POST. | REVIEWED (initial) |
| `api/tafsir.ts` | Tafsir proxy; inspected. Current main parses upstream JSON without HTML guards; PR #60 has a tested fix to port onto main. | REVIEWED (initial) |
| `bun.lock` | Dependency lock; verify lockfile matches package.json and CI's Bun/npm installation sequence. | PENDING |
| `docs/DEVELOPMENT_CHECKPOINT.md` | High-level checkpoint; verify it is not stale or contradictory with progress folder. | PENDING |
| `docs/engineering/AUDIO_SOURCE_ATTRIBUTION.md` | Audio source/license attribution; verify each reciter/source and redistribution conditions. | PENDING |
| `docs/engineering/FIRESTORE_SYNC_DESIGN.md` | Cloud data model/security/conflict design; compare each claim with actual adapter/rules and newer remote replication plan. | REVIEWED (initial) |
| `docs/engineering/IMPLEMENTATION_ROADMAP.md` | Engineering roadmap; reconcile phase status and sequencing. | PENDING |
| `docs/engineering/OPEN_SOURCE_RESEARCH.md` | External architecture research; verify license notes, source dates, and that no copied code/data violates licenses. | PENDING |
| `docs/engineering/SECURITY_AUDIT.md` | Security audit; compare claims to current rules, auth, APIs and deployed config; refresh stale findings. | REVIEWED (initial) |
| `docs/engineering/WORK_SESSION_CHECKPOINT.md` | Session notes; identify duplicate/historical notes and link to authoritative resume document. | PENDING |
| `docs/engineering/progress/CONTINUATION_CHECKPOINT_2026-11-06.md` | Detailed historical checkpoint; useful provenance, but distinguish historical state from today's branch state. | REVIEWED (initial) |
| `docs/engineering/progress/CURRENT_STATUS.md` | Status document; inspected. Reports PR #57/#58 state while current main has moved on; refresh after full audit. | REVIEWED (initial) |
| `docs/engineering/progress/EXTERNAL_SOURCES.md` | Source/research log; validate links and license/date metadata. | PENDING |
| `docs/engineering/progress/MASTER_ROADMAP.md` | Phase roadmap; align phase completion with evidence and exact commit SHAs. | PENDING |
| `docs/engineering/progress/RELEASE_CHECKLIST.md` | Release checklist; inspected partially. Several checkboxes/status statements need evidence-based reconciliation. | REVIEWED (initial) |
| `docs/engineering/progress/RESUME_HERE.md` | Resume pointer; inspected. PR #58 is named as next task although main has advanced; update after full branch review. | REVIEWED (initial) |
| `docs/engineering/progress/WORK_LOG.md` | Append-only work history; ensure dated entries are immutable historical facts, not interpreted as current status. | PENDING |
| `firebase-applet-config.json` | Firebase client config; inspect only names/project identifiers, never echo secrets; validate no unintended project target. | PENDING |
| `firebase-blueprint.json` | Firebase provisioning blueprint; compare enabled services/rules/database ID to current deployment. | PENDING |
| `firebase.json` | Firestore rules path and emulator port 8080 configured; UI disabled and single-project mode enabled. No deploy targets are declared here; verify CLI project alias separately before any rules deployment. | REVIEWED (initial) |
| `firestore.rules` | Firestore authorization rules; inspected initially. Generic envelope/event constraints exist; collection-specific schema, revision/CAS and replication semantics remain incomplete. | REVIEWED (initial) |
| `index.html` | HTML entry point, metadata and RTL/font setup; inspect CSP, title, icon and accessibility baseline. | PENDING |
| `metadata.json` | AI Studio metadata; determine whether source-controlled/generated and whether any stale identifiers remain. | PENDING |
| `package.json` | Runtime scripts/dependencies; inspected. React 19/Vite 8/TS 7/Bun lock; `pre*` scripts generate Quran chunks before build/test/lint. Review dependency health and script side effects. | REVIEWED (initial) |
| `public/apple-touch-icon.png` | iOS home-screen icon; verify visual/brand consistency and dimensions. | PENDING |
| `public/icon-192.png` | PWA 192px icon; verify dimensions and content. | PENDING |
| `public/icon-512.png` | PWA 512px icon; verify dimensions and maskable safe area. | PENDING |
| `public/manifest.json` | Arabic RTL standalone PWA manifest inspected; correct 192/512/180 icon declarations and root scope. Portrait-only orientation may unnecessarily constrain tablets; verify actual icon maskable safe area. | REVIEWED (initial) |
| `public/sw.js` | Shell/network-first navigation, cache-first same-origin assets, API exclusion and bounded EveryAyah audio cache inspected. Cache versioning is explicit; test failed precache, stale chunk recovery, cache quota and update lifecycle on iOS/Android. | REVIEWED (initial) |
| `scripts/firestoreRules.test.ts` | Firestore Rules Emulator tests; inspected initially. Covers auth/UID/allowlist/envelope/event immutability/tombstones; verify collection-specific and server revision constraints. | REVIEWED (initial) |
| `scripts/smoke-server.mjs` | Production/development API smoke test; verify it checks expected JSON/error paths and cleans up server processes. | PENDING |
| `scripts/split-quran-data.mjs` | Generator inspected. Checks 114 Surahs, local coordinates/text, page bounds, 6,236 total, 604 pages, 30 Juz and 240 Hizb quarters; writes chunks and generated indexes before dev/build/test/lint. Add global ayah continuity, juz/hizb value bounds and output cleanup/atomic generation. | REVIEWED (initial) |
| `server.ts` | Express server/dev middleware/API mounting; inspected initially. Verify route order, Vite fallback, API error handling, security headers and production parity. | REVIEWED (initial) |
| `tsconfig.json` | TypeScript compiler policy; review strictness, path aliases, test inclusion and noEmit. | PENDING |
| `vercel.json` | Vercel routes/functions config; inspected. SPA fallback may return HTML for missing API paths; ensure API route precedence and per-function limits. | REVIEWED (initial) |
| `vite.config.ts` | React/Tailwind plugins, @ alias, 650KB warning threshold and optional HMR disable inspected. No API proxy is declared; local dev API mounting depends on server.ts. Review Node/Vite compatibility and large chunk budget. | REVIEWED (initial) |

## Application shell, components, context and hooks

| File | Note | Status |
|---|---|---|
| `src/App.tsx` | Main orchestration inspected. Lazy-loads views and routes all primary mutations through journaled services; PWA update immediately reloads after SKIP_WAITING without waiting for controllerchange, and toast timers lack cleanup. Split orchestration after correctness fixes. | REVIEWED (initial) |
| `src/components/assistant/QuranAdvisorView.tsx` | Advisor chat UI; review prompt safety, loading/error states, Arabic UX and response provenance. | PENDING |
| `src/components/auth/AuthGate.tsx` | Scope is derived from guest or verified UID; initializes scope, replays authenticated journal, then runs legacy portion migration, with cancellation/scope checks. Review edge races during account changes and duplicate initialization under React StrictMode. | REVIEWED (initial) |
| `src/components/auth/AuthScreen.tsx` | Email/Google/guest and verification UI inspected. Clipboard write is not awaited/caught; resend cooldown uses an interval without unmount cleanup; validate accessible feedback and avoid silent password mismatch submission. | REVIEWED (initial) |
| `src/components/dashboard/DashboardView.tsx` | Daily task derives from due revisions/active plan and unique retention metrics; async ayah preview is cancellation-safe. Verify logs are chronological before `slice(-7)` and remove/check the weak-verse value if unused. | REVIEWED (initial) |
| `src/components/layout/Header.tsx` | Responsive header inspected. It independently mounts `useCloudSync` and presents the coordinator's `synced` status as complete; wording must change until true remote projection exists. | REVIEWED (initial) |
| `src/components/layout/Sidebar.tsx` | Navigation inventory inspected: nine tabs, mobile drawer and profile card. Verify focus trap/Escape handling and route/tab parity in App/router; profile display is local projection. | REVIEWED (initial) |
| `src/components/library/QuranLibraryView.tsx` | Surah/Juz/study and Mushaf entry, lazy loading and cancellation inspected. **Bug candidate confirmed by closure semantics:** `audio.onended` captures stale `currentRepeatCount`, so multi-repeat playback can loop indefinitely; add a regression test and use a ref/functional counter. | REVIEWED (initial) |
| `src/components/library/QuranMushafReader.tsx` | Page-based local chunks, 604-page navigation, Juz/Hizb, bookmarks and sequential audio inspected. Last-page/bookmark keys are global localStorage keys, not UID-scoped; decide whether they are intentionally device preferences or need account scoping. | REVIEWED (initial) |
| `src/components/library/TafsirSheet.tsx` | Tafsir modal inspected. Uses AbortController, book selection, font prefs, sanitized segments and retry UI. Clipboard fallback cleanup and accurate source attribution/error messaging need tests. | REVIEWED (initial) |
| `src/components/plans/MemorizationPlansView.tsx` | Preset/active plan management; review scope validation, journal writes and empty/error states. | PENDING |
| `src/components/plans/PlanningEngineWizard.tsx` | Smart planning wizard; review constraints, date/time calculations, impossible schedules and accessibility. | PENDING |
| `src/components/progress/ProgressAnalyticsView.tsx` | Analytics/reporting; verify date boundaries, unique ayah metrics and chart performance. | PENDING |
| `src/components/revision/RevisionCenterView.tsx` | Revision queue and rating UI; verify due ordering, duplicate submissions and journal transaction integrity. | PENDING |
| `src/components/session/MemorizationSessionView.tsx` | Memorization session; review exact Quran range, reveal/audio controls, session completion and retry identity. | PENDING |
| `src/components/settings/SettingsView.tsx` | Settings, backup/reset, auth and cloud status; inspected initially. Main uses journaled demo loader; UI text currently overstates conflict-free/full sync and must reflect partial status. | REVIEWED (initial) |
| `src/components/shared/AudioPlaybackRateControl.tsx` | Shared playback-rate control; verify allowed speeds, accessibility and state persistence. | PENDING |
| `src/components/tests/MemorizationTestsView.tsx` | Memorization assessment UI; inspect question generation, answer validation, weak ayah recording and large bundle. | PENDING |
| `src/context/AuthContext.tsx` | Auth provider inspected. Handles redirect result, auth state listener, guest preference, email verification reload and logout; review race between redirect result and auth listener plus guest mode when Firebase config is absent. | REVIEWED (initial) |
| `src/hooks/useCloudSync.ts` | React hook around coordinator; inspected. Starts periodic sync and subscribes; check lifecycle, duplicate triggers and cleanup. | REVIEWED (initial) |

## Quran data and metadata

| File | Note | Status |
|---|---|---|
| `src/data/completeQuranData.json` | Canonical full Uthmani Quran dataset; critical immutable content. Verify 114 Surahs/6,236 ayahs, exact text/diacritics, metadata, provenance/license and checksum. Never rewrite casually. | PENDING |
| `src/data/mutashabihatData.ts` | Similar-verse dataset; verify each coordinate/text and scholarly/source provenance. | PENDING |
| `src/data/presetPlans.ts` | Preset memorization plans; validate ranges, boundaries and user-facing descriptions. | PENDING |
| `src/data/quranDataInfo.ts` | Attributes Uthmani Hafs data to Tanzil with CC BY 3.0, counts and verifiedDate 2026-11-04. Add immutable source URL/version/checksum and surface required attribution in app/about documentation. | REVIEWED (initial) |
| `src/data/quranDataLoader.ts` | `import.meta.glob` lazy-loads per-Surah JSON and caches in-flight promises; failed imports evict cache. Missing chunks throw explicitly. Validate generated-chunk existence in build and no fallback to unverified text. | REVIEWED (initial) |
| `src/data/quranMeta.ts` | 114 Surah metadata entries and totals (6,236 ayahs, 604 pages, 30 Juz) inspected. Cross-validation is partly enforced by CI generator; audit all metadata fields against independent reference and generated navigation indexes. | REVIEWED (initial) |
| `src/data/quranNavigation.ts` | Page/Juz/Hizb navigation index; verify exact 604-page/30-Juz/240-quarter boundaries. | PENDING |
| `src/data/quranValidationReport.json` | Generated verification report; verify timestamp/checksum and whether it matches current dataset. | REVIEWED (initial) |
| `src/data/tanzilReferenceData.json` | Independent reference dataset; verify source attribution/license/checksum and preserve original bytes. | PENDING |
| `src/data/verifiedAyahs.ts` | Verified verse helper/data; inspect whether canonical text duplicates are necessary and stay synchronized. | PENDING |

## Services and persistence

| File | Note | Status |
|---|---|---|
| `src/services/advisorService.ts` | Advisor client service; review request schema, timeout, retries, error handling and secret boundary. | PENDING |
| `src/services/audioPreferences.test.ts` | Audio preference tests; verify all views use shared settings and edge cases are covered. | PENDING |
| `src/services/audioPreferences.ts` | Shared audio preference state; review validation and local persistence. | PENDING |
| `src/services/audioService.ts` | Reciter/audio URL construction and playback; verify sources, attribution, URL integrity and playback failure recovery. | PENDING |
| `src/services/authService.ts` | Firebase auth operations; inspect provider behavior, redirect/popup flow and error normalization. | PENDING |
| `src/services/authUtils.ts` | Auth verification helpers; review state mapping and tests. | PENDING |
| `src/services/backupPersistence.test.ts` | Backup/reset transaction tests; inspect corruption, import ordering, rollback and quota coverage. | PENDING |
| `src/services/backupPersistence.ts` | Journaled import/reset and legacy migration inspected. Import validates payload and groups up to eight projections in one journal event; reset is journaled but removes a retired legacy progress key afterward, so failure messaging must distinguish committed reset from cleanup failure. | REVIEWED (initial) |
| `src/services/cloudSyncCoordinator.test.ts` | Cloud sync tests; determine whether they test real push/pull/conflict behavior or only guest/state paths. | PENDING |
| `src/services/cloudSyncCoordinator.ts` | Cloud sync coordinator; inspected. Main pushes snapshots/events and performs bounded remote read but does not import/project remote events; status semantics and revision/CAS are release blockers. | REVIEWED (initial) |
| `src/services/dailySessionSelection.test.ts` | Daily session selection tests; verify overdue ordering, due revision priority and scope bounds. | PENDING |
| `src/services/dailySessionSelection.ts` | Daily memorization/revision selection; review deterministic ordering and date handling. | PENDING |
| `src/services/demoDataPersistence.ts` | Demo data persistence; ensure development-only, journal-first, idempotent and inaccessible in production. | PENDING |
| `src/services/deterministicAdvisor.test.ts` | Deterministic advisor tests; verify no nondeterministic or unsafe recommendations. | PENDING |
| `src/services/deterministicAdvisor.ts` | Non-AI advisor logic; inspect rule transparency and deterministic output. | PENDING |
| `src/services/domainEvents.ts` | Typed event union and schema-v1 validation inspected. Coordinate validation only bounds ayah to 286 rather than checking actual Surah verse count; validate against ALL_SURAHS and add payload-specific upper bounds before remote acceptance. | REVIEWED (initial) |
| `src/services/indexedDbSyncJournal.test.ts` | IndexedDB journal tests; verify atomicity, cross-tab concurrency, crash recovery, quota and upgrade coverage. | PENDING |
| `src/services/indexedDbSyncJournal.ts` | IndexedDB v3 journal inspected. Event + outbox are committed atomically; UID-prefixed stores, stable fingerprints, monotonic per-UID sequence and migration paths exist. Review transaction lifetime, upgrade error/blocked recovery and cursor reset behavior in remaining methods/tests. | REVIEWED (initial) |
| `src/services/journalProjectionReplayer.test.ts` | Projection replay tests; verify contiguous cursor, idempotence and rollback. | PENDING |
| `src/services/journalProjectionReplayer.ts` | Replayer requires Web Locks for cross-tab safety, verifies UID/scope and contiguous sequence, applies event before advancing cursor. On browsers without Web Locks, an existing journal blocks replay rather than risking concurrent writes; assess browser support/fallback strategy. | REVIEWED (initial) |
| `src/services/journaledSnapshotService.test.ts` | Snapshot service tests; cover all journaled domain mutation types and failure paths. | PENDING |
| `src/services/journaledSnapshotService.ts` | Journal-first writes validate optional domain event, capture expected scope, use exclusive projection lock and do not silently downgrade authenticated IndexedDB failures. Review complete grouped rollback and cloud-trigger behavior in remaining methods. | REVIEWED (initial) |
| `src/services/localSyncOutbox.test.ts` | Outbox tests; verify retry, idempotency, acknowledgement and legacy migration. | PENDING |
| `src/services/localSyncOutbox.ts` | Async facade migrates legacy localStorage outbox into IndexedDB atomically and keeps source as recovery copy; stable fingerprints and bounded payload/backoff are present. Verify duplicate legacy writers and retention limits with multi-tab tests. | REVIEWED (initial) |
| `src/services/pageProgressService.test.ts` | Page progress tests; verify all ayahs per page and journal persistence. | PENDING |
| `src/services/pageProgressService.ts` | Page progress mapping/service; verify exact canonical page coverage and duplicate ranges. | PENDING |
| `src/services/planLifecycle.ts` | Plan task state transitions; review completion/pause/resume and stable IDs. | PENDING |
| `src/services/planningEngine.test.ts` | Planning engine tests; test constraints, leap years, missed days and impossible schedules. | PENDING |
| `src/services/planningEngine.ts` | Smart plan generation; audit algorithms, date math, user constraints and deterministic behavior. | PENDING |
| `src/services/quranMath.ts` | Quran coordinate/range math; verify global/local ayah, page and Juz boundary calculations. | PENDING |
| `src/services/retentionService.test.ts` | Retention tests; ensure overlapping portions are deduplicated and failed review priority is conservative. | PENDING |
| `src/services/retentionService.ts` | Retention/revision scheduling; review SM-2 behavior, calendar boundaries and persistence side effects. | PENDING |
| `src/services/revisionPersistence.test.ts` | Revision persistence tests; verify transaction/rollback and event history integrity. | PENDING |
| `src/services/router.ts` | Hash router and deep links; verify malformed routes and safe coordinate parsing. | PENDING |
| `src/services/secureId.test.ts` | ID generation tests; verify cryptographic UUID availability and uniqueness. | PENDING |
| `src/services/secureId.ts` | Secure ID generator; ensure no weak Math.random fallback for durable mutation IDs. | PENDING |
| `src/services/sessionCompletion.ts` | Session completion domain logic; review event grouping and exact progress calculation. | PENDING |
| `src/services/sessionPersistence.test.ts` | Session persistence tests; cover retries, duplicate completion and rollback. | PENDING |
| `src/services/sessionPersistence.ts` | Journaled session completion groups portion, activity, profile/streak and optional engine-plan snapshot; validates range and uses stable mutation ID from App. Legacy synchronous writer remains exported for compatibility; ensure production call sites use only journaled API. | REVIEWED (initial) |
| `src/services/spacedRevisionEngine.ts` | Spaced repetition algorithm; review grade mappings, interval caps and legacy compatibility. | PENDING |
| `src/services/storageScope.test.ts` | Storage scope isolation tests; cover guest/account switch and legacy import. | PENDING |
| `src/services/storageService.ts` | Scope/ownership and storage transaction layer inspected. Account import snapshots all source/destination keys, verifies copies before source removal, and rolls back on failure; malformed JSON readers preserve raw bytes but may return empty projections, so verify every mutation path gates writes through validators. | REVIEWED (initial) |
| `src/services/tafsirService.test.ts` | Tafsir client tests; add/retain HTML, malformed JSON, wrong-book and timeout regressions. | REVIEWED (initial) |
| `src/services/tafsirService.ts` | Tafsir fetch/cache; inspected. Main uses response.json directly and can leak HTML parser errors; PR #60 contains client guard. | REVIEWED (initial) |
| `src/services/testQuestionGenerator.ts` | Assessment question generation; inspect canonical verse selection, randomization, scope and duplicate questions. | PENDING |
| `src/services/unifiedPortionService.ts` | Local-date arithmetic, canonical IDs, overlap-safe unique ayah/page counts and plan scope resolution inspected. Strict range validation and conservative weakest-status aggregation exist; full migration conflict/history logic still needs line-by-line review. | REVIEWED (initial) |
| `src/services/weakVerseRecording.test.ts` | Weak-verse tests; verify stable IDs, duplicate prevention, counters and rollback. | PENDING |
| `src/services/weakVerseRecording.ts` | Journaled failure snapshot prepares portion + weak-verse projections together; validates Surah/ayah against canonical metadata and preserves old archives. Legacy synchronous recordWeakVerseFailure also remains exported; confirm no authenticated UI path still calls it. | REVIEWED (initial) |

## Tests, types and utilities

| File | Note | Status |
|---|---|---|
| `src/tests/backupValidation.test.ts` | Backup schema/import validation; cover malformed/oversized payloads and backwards compatibility. | PENDING |
| `src/tests/cleanInitialization.test.ts` | Fresh install/initialization tests; verify no demo data leaks and account startup is deterministic. | PENDING |
| `src/tests/firebaseAuth.test.ts` | Auth tests; verify guest, Google/email, verification and account scope transitions. | PENDING |
| `src/tests/geminiSecurity.test.ts` | AI security tests; verify secrets remain server-side and untrusted content is bounded. | PENDING |
| `src/tests/independentTanzilComparison.ts` | Quran text/metadata verification; inspected. It writes a generated report and handles Basmalah prefixes; independently verify normalization cannot mask a real mismatch. | REVIEWED (initial) |
| `src/tests/mobileErgonomics.test.ts` | Mobile interaction assertions; supplement with browser/device accessibility checks. | PENDING |
| `src/tests/phase3CoreRemediation.test.ts` | Core domain regression suite; map coverage to current architecture and remove brittle source-text assertions. | PENDING |
| `src/tests/planRangeSelection.test.ts` | Plan range tests; verify explicit scope boundaries. | PENDING |
| `src/tests/pwaIntegration.test.ts` | PWA tests; cover service worker cache upgrade, offline launch and stale asset recovery. | PENDING |
| `src/tests/quranContentIntegrity.test.ts` | Quran data integrity suite; validate text, count, metadata and reference checksum. | PENDING |
| `src/tests/quranLazyLoading.test.ts` | Lazy-loading tests; verify no eager full-dataset inclusion in critical routes. | PENDING |
| `src/tests/quranMushafReader.test.ts` | Mushaf reader tests; verify page/Surah/Juz navigation and exact ayah mapping. | PENDING |
| `src/tests/runAllTests.ts` | Aggregate custom test runner; inspected initially. Review suite isolation, reliable failure aggregation and brittle source-code assertions. | REVIEWED (initial) |
| `src/tests/sessionCompletion.test.ts` | Session completion behavior tests; cover grouped journal event and idempotent retries. | PENDING |
| `src/tests/storageReliability.test.ts` | Storage reliability tests; review failure injection breadth and false-positive rollback claims. | PENDING |
| `src/tests/streakCalculations.test.ts` | Streak/date calculation tests; test local timezone, DST and year boundaries. | PENDING |
| `src/tests/tafsirProxy.test.ts` | Tafsir proxy tests; add upstream HTML/malformed payload and rate-limit coverage. | REVIEWED (initial) |
| `src/tests/uniqueRetentionScore.test.ts` | Retention metric tests; verify unique ayah counting and conservative status selection. | PENDING |
| `src/types/quran.ts` | Core Quran/progress/profile types inspected. conflictAudit.value: any weakens safety; legacy IDs and optional duplicated revision structures need migration/compatibility policy. | REVIEWED (initial) |
| `src/utils/tafsirSanitizer.test.ts` | Tafsir sanitization tests; test malformed HTML, unsafe markup and valid Arabic formatting. | PENDING |
| `src/utils/tafsirSanitizer.ts` | Tafsir text sanitization; inspect XSS boundary and whether rendering uses safe text/HTML. | PENDING |
| `src/index.css` | Global design system, RTL and responsive styling; audit token consistency, contrast, focus, dark mode and unused CSS. | PENDING |
| `src/main.tsx` | React root wraps AuthProvider/AuthGate/App and registers service worker in production. No visible top-level error boundary; verify process.env replacement in Vite and add SW update/recovery tests. | REVIEWED (initial) |
| `src/lib/firebase.ts` | Firebase config and initialization; inspected. Uses public client config/environment fallbacks and optional initialization; verify target project/database and no privileged secrets. | REVIEWED (initial) |

## Audit note format for every future review

For each file, expand the row note to cover:
1. **Responsibility:** actual behavior and entry points.
2. **Dependencies:** imports, consumers/callers, external APIs/data.
3. **Data safety:** persistence, validation, auth/UID boundary, rollback, secrets.
4. **Tests:** exact suites and missing regression cases.
5. **Finding:** PASS / RISK / BUG / DUPLICATE / DEAD CODE / NEEDS REFACTOR.
6. **Action:** keep, comment, split, consolidate, move, test, or remove (removal only after usage/branch proof).
7. **Evidence:** relevant line/function names and exact commit/PR if applicable.

Never claim full review until every row is upgraded from PENDING or REVIEWED (initial) to a final audited status.
