# WIRD — Work Session Engineering Checkpoint

> Updated: 2026-11-05
> Status: Initial repository audit in progress. No application code or live Firebase configuration changed in this checkpoint.
> Before every subsequent write, re-fetch current main HEAD and the target file SHA.

## 1. Verified repository state

- Repository: `xm8eslam-stack/WIRD-APP`; default branch: `main`.
- Verified main HEAD at audit start: `15ec5069b4850968588be2e4363fbd182bf2a8fc`.
- GitHub account: `xm8eslam-stack`; repository permissions include push/admin.
- Branches: `main`, `feat/phase4-data-integrity-backup-v4`, `feat/phase5-premium-ui-ux`, `work/wird-audit-remediation`.
- Phase 4 branch is two commits behind main and has no unique commits ahead of main.
- Phase 5 HEAD: `31b6bc9c9971574e4641ecff2adbc111e8800a6c`; compare says 105 commits ahead / 0 behind main.
- PR #2 is OPEN + DRAFT, 33 changed files, 105 commits. Do not merge until behavior review, complete visual review, and release checks.
- Latest surfaced successful Quality Gate run: `42099417707`, conclusion `success`, on Phase 5 SHA `31b6bc9c9971574e4641ecff2adbc111e8800a6c`. This is CI evidence only, not deployment evidence.
- Vercel's last recorded status in the existing PR/checkpoint is daily Free deployment quota exceeded. Recheck current status before release.
- Google AI Studio UI sync cannot be inspected through GitHub; user must confirm actual Studio-side sync.

## 2. Architecture map (main recursive tree: 117 entries; not truncated)

- Bootstrap: `src/main.tsx` → `AuthProvider` → `AuthGate` → `App.tsx`.
- UI components: `src/components/{auth,dashboard,layout,library,plans,progress,revision,session,settings,tests,assistant}`.
- Quran data: `src/data/completeQuranData.json`, `tanzilReferenceData.json`, `verifiedAyahs.ts`, metadata, validation report, lazy loader.
- Domain/services: `src/services` (auth, storage, unified portions, page progress, planning, retention, spaced revision, audio, tafsir, advisor, routing, question generation).
- State/types: `src/context/AuthContext.tsx`, `src/types/quran.ts`.
- API/server: `server.ts`, `api/advisor.ts`, `api/tafsir.ts`; Phase 5 adds `api/advisor/chat.ts`.
- Quality: `src/tests`, service tests, `.github/workflows/ci.yml`.
- Build/deploy/PWA: Vite, TypeScript, `vercel.json`, `public/sw.js`, manifest/icons.
- No Firestore rules file, Firebase Functions directory, or explicit Firestore integration module appears in the verified main tree.

## 3. Confirmed findings

### Authentication
- Firebase Authentication is initialized in `src/lib/firebase.ts`.
- `AuthContext` implements Google sign-in, email/password signup/login, email verification, password reset, logout, and guest mode.
- `AuthGate` allows guests and verified users; unverified email accounts are routed to the auth screen.
- Existing tests exercise helpers and service stubs, not live Firebase project/account behavior.

### Persistence and cloud sync
- `StorageService` persists application data in browser `localStorage` with an in-memory fallback.
- Keys such as `wird_profile`, `wird_plans`, and `wird_logs` are global browser keys, not UID-scoped.
- `App.tsx` initializes profile/plans/revision/logs directly from local storage.
- Firebase bootstrap imports App and Auth only. Repository code searches for `onSnapshot`, `getFirestore`, `firebase/firestore`, `collection(`, and `doc(` returned no matches.
- Conclusion: Firebase Auth exists, but Firestore/cloud persistence/real-time sync is NOT implemented in inspected source. Cross-device progress sync cannot be expected.
- High risk: local data is not isolated by account on a shared browser. Design a non-destructive guest-to-account migration and account-switch isolation policy before enabling sync. Never overwrite a populated cloud profile with empty local defaults.

### Default/demo data
- Clean initialization tests assert zero plans, logs, revision items, memorized portions, and weak-verse records for a new user.
- `CLEAN_INITIAL_PROFILE` is a neutral starter profile, not fabricated progress.
- Sample profiles/plans/logs/revision entries and `DEFAULT_PORTIONS` / `DEFAULT_WEAK_VERSES` are fixtures. Their explicit loaders are `loadDemoData` and `loadDemoPortions`; tests verify demo data is loaded on demand and clean up.
- Keep fixtures isolated for demo/tests; do not delete blindly. Verify no normal production startup calls demo loaders. If all prefilled profile fields must also disappear, adjust the neutral profile separately without deleting user data.

### Quran integrity
- Metadata identifies Tanzil Project, `quran-uthmani`, Hafs ‘an ‘Asim, CC BY 3.0.
- Current committed validation report records 114 Surahs, 6,236 Ayahs, 6,236 exact text/metadata matches, and zero mismatches against bundled Tanzil reference data.
- `independentTanzilComparison.ts` recalculates text, numbering, page, juz, and hizb-quarter comparison. Re-run the actual test before a new release claim; the JSON report alone is not a fresh test.
- Preserve source, edition, attribution, and exact canonical text. Never generate Quran text with AI.

### CI and release
- Main CI runs `npm test`, `npm run lint` (TypeScript no-emit), and `npm run build`.
- Successful Actions is not proof of Vercel deployment or AI Studio sync.
- Phase 5's own plan still lists detailed responsive/RTL/accessibility review as remaining.

## 4. Branch decisions

- Do not merge `work/wird-audit-remediation` wholesale: it is diverged (92 commits ahead / 124 behind main at audit time) with overlapping implementation. Review individual fixes only.
- Phase 5 is based directly on main and contains cumulative UI work. Latest surfaced CI passes, but PR #2 remains Draft and its description reports remaining visual review and Preview verification.
- Review all 33 PR files, especially App, revision, storage, retention, unified portions, and session completion, before merge.
- Avoid new branches unless a task genuinely needs isolation.

## 5. Priority backlog

1. P0 — UID-scoped Firestore schema, rules, validated serialization, safe first-login migration, account switching, conflict policy, realtime listeners, offline behavior, and emulator-backed tests.
2. P0 — Account data isolation; preserve guest data and prevent cross-account local data exposure.
3. P1 — Prove demo loaders cannot run during normal startup; keep fabricated progress out of production user profiles.
4. P1 — Verify live Google/email auth, verification refresh, password reset, and error states against the real Firebase project.
5. P1 — Complete Phase 5 visual pass: plans, revision, analytics, settings, tests, RTL, long Arabic labels, dark mode, keyboard, reduced motion, mobile/tablet/desktop, and empty/loading/error/offline states.
6. P1 — Ensure all pages use canonical domain services and consistent refresh/data flows.
7. P2 — Review API validation, security headers, rate limits, dependencies, Firestore rules, Vercel environment parity, and production smoke tests.
8. P2 — Research open-source Quran reader, hifz, and spaced-repetition projects; verify licenses before reuse. Never substitute third-party Quran assets for canonical data.

## 6. Verification actually performed

- Queried repository metadata, branch heads, recursive trees, branch comparisons, PR #2, and GitHub Actions.
- Reviewed main package/config, Firebase bootstrap, AuthContext/AuthGate/AuthService, App bootstrap, StorageService, RetentionService, preset data, clean-init tests, auth tests, Quran integrity tests, Tanzil comparison, and CI workflow.
- GitHub Actions run `42099417707` passed on Phase 5 SHA `31b6bc9c9971574e4641ecff2adbc111e8800a6c`.
- No local npm/test/build command was run in this session. Source inspection is not a fresh local test run.
- No application code, Firestore rules, or production Firebase settings were changed.

## 7. Exact next actions

1. Re-fetch main/Phase 5 heads and PR #2 metadata.
2. Review all 33 PR changed files, focusing on behavior and regression risk, not only CSS.
3. Trace complete auth/storage data flows and design UID-scoped sync before implementation.
4. Add emulator-backed rules, migration, isolation, realtime update, and conflict tests.
5. Inspect actual Firebase project/rules before deploying rules or migrating live user data; obtain approval for irreversible operations.
6. Update this checkpoint after each verified batch with exact SHAs, test results, push/merge state, and separate deployment/AI Studio sync status.


---

## 8. Follow-up audit and verified development batches — 2026-11-05

### Main branch state
- Latest main HEAD before this checkpoint update: `43aa93adc0651a0d87410ab007b6d307e3ea5613` (security audit report).
- Previous full Quality Gate commit: `59486db8eddef6b00a13565024a2754969ff056d`.
- Latest full Quality Gate run: `42103972108`, conclusion `success`.
- CI steps verified: Bun 1.4.4 frozen-lockfile install, npm install, `npm audit --audit-level=high`, automated tests, TypeScript validation, production build/Quran chunk validation, production server startup smoke test.
- The docs-only security-audit commit still needs its own GitHub Actions run; do not assume it passed until confirmed.

### Files added/updated on main
- `docs/engineering/OPEN_SOURCE_RESEARCH.md`: source/license review and reuse decisions.
- `docs/engineering/FIRESTORE_SYNC_DESIGN.md`: UID-scoped, local-first sync design, migration/conflict/offline/security policy, free-tier constraints.
- `docs/engineering/SECURITY_AUDIT.md`: source-level security/reliability findings and explicit limitations.
- `docs/engineering/WORK_SESSION_CHECKPOINT.md`: this update.
- `src/components/settings/SettingsView.tsx`: destructive demo-data UI and confirmation are DEV-only; handler refuses to run outside development.
- `src/tests/cleanInitialization.test.ts`: checks clean zero-progress initialization, no demo seeding from normal startup, and production isolation of the demo loader.
- `src/tests/geminiSecurity.test.ts`: guards wildcard CORS against credentialed CORS and checks expired rate-limit record pruning.
- `api/advisor.ts`: removed wildcard-plus-credentials CORS header; added bounded cleanup of expired in-memory rate-limit entries.
- `server.ts`: added cleanup of expired in-memory rate-limit entries.
- `package.json`: Node engine `>=24.12.0`, package manager Bun 1.4.4, `tsx` runtime dependency, `start: tsx server.ts`, `@grpc/grpc-js` override 1.14.6, and production server smoke script.
- `bun.lock`: regenerated with Bun 1.4.4 to resolve the patched gRPC package, ordered-map dependency, esbuild version drift, and runtime dependency placement.
- `scripts/smoke-server.mjs`: starts the production server and checks `/api/advisor/status` with no Gemini API key.
- `.github/workflows/ci.yml`: Node 24, current Node-24-compatible checkout/setup-node actions, Bun frozen-lockfile verification, npm audit, and production server smoke test.

### Verified outcomes
- The demo-data feature is still available to developers/tests only; it is not exposed to production users.
- The first dependency audit found four high-severity advisories through `@grpc/grpc-js`. A non-breaking npm override to `1.14.6` resolved them; no forced Firebase downgrade was used.
- Node 22.16 could not start `server.ts` directly. The app now starts through `tsx`, and the production server smoke test passed.
- Full Quality Gate run `42103972108` passed on main SHA `59486db8eddef6b00a13565024a2754969ff056d`.
- The main commit status still reports Vercel failure with `build-rate-limit`; this is an external quota blocker, not a verified application build failure.
- GitHub cannot prove Google AI Studio's UI has synchronized the latest main commit.

### Additional confirmed architectural/security findings
- `RetentionService` weak-verse records use a separate localStorage path; centralize before sync.
- Existing localStorage keys are global rather than UID-scoped; account switching on one browser is a high-priority isolation risk.
- `server.ts` and Vercel `api/advisor.ts` are separate implementations and their request/history handling is not fully aligned.
- Advisor rate limits remain process-local/in-memory; pruning prevents unbounded map growth but does not create a distributed rate limiter.
- `vercel.json` currently has rewrites but no explicit security response headers.
- Firestore, rules, real-time listeners, and cross-device sync remain unimplemented. The design document is not proof of a working sync system.

### Phase 5 branch — separate, not yet merged
- Branch: `feat/phase5-premium-ui-ux`.
- Latest head: `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d`.
- PR #2 remains OPEN + DRAFT and is based on the old main SHA `15ec5069b4850968588be2e4363fbd182bf2a8fc`; GitHub reports it is not currently mergeable. Do not merge until its base is reconciled and the full diff is reviewed.
- Phase 5 also gates demo data in production and adds the same regression test.
- Added `src/services/dailySessionSelection.ts` and `src/services/dailySessionSelection.test.ts`; registered the suite in `src/tests/runAllTests.ts`.
- Fix: daily quick-start now ignores future tasks, ignores inactive/paused engine plans, and does not widen Juz/page presets into unrelated whole-Surah ranges. Unsupported plan scopes produce an explicit message instead of starting an unrelated global range.
- Phase 5 Quality Gate run `42103642438` passed on SHA `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d`.
- Visual browser/Preview review is still outstanding because Vercel Preview deployment is quota-blocked.

### Next exact work
1. Reconcile the Phase 5 branch with the new main commits before any merge; review every changed file and resolve overlap deliberately.
2. Centralize weak-verse persistence and implement UID-scoped local storage with a one-time, backup-preserving legacy-data ownership migration.
3. Add Firestore rules and Emulator tests for unauthenticated/unverified/cross-UID access, malformed payloads, and size limits.
4. Implement Firestore sync with per-user collections, idempotent mutations, conflict handling, tombstones, offline outbox, and real-time listeners.
5. Test two accounts on two devices, then deploy rules only after explicit live-project review.
6. Align Express/Vercel advisor validation and assess distributed rate limiting/security headers.
7. Re-run Vercel deployment after the quota resets; verify the actual production URL separately.
