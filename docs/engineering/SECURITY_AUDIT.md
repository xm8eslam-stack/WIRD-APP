# WIRD — Security and Reliability Audit

> Audit date: 2026-11-05
> Repository: `xm8eslam-stack/WIRD-APP`
> Audited branch: `main`
> Latest verified main commit at audit: `59486db8eddef6b00a13565024a2754969ff056d`
> Scope: source/configuration review and GitHub CI. No live Firebase console, production database, Google AI Studio UI, or Vercel deployment access was available.

## Executive summary

- The app has Firebase Authentication and an email-verification gate.
- There is currently no Firestore integration or deployed Firestore Security Rules in the repository; user progress remains local-browser data.
- Global localStorage keys are not UID-scoped. This is the most important account-isolation prerequisite before enabling sync.
- The Vercel advisor API and Express server in `server.ts` are two separate implementations and are not behaviorally equivalent.
- Advisor rate limits are in-memory and process-local. Pruning expired entries bounds memory but does not provide distributed abuse protection.
- The public wildcard CORS endpoint no longer advertises credentialed cross-origin access.
- Production demo-data loading is now development-only and covered by a regression test.
- Dependency audit is clean after pinning patched `@grpc/grpc-js@1.14.6`; CI uses Node 24 and a frozen Bun lockfile.
- GitHub Quality Gate passes. Vercel deployment is still blocked by the account's daily build quota; production deployment has not been verified.

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-01 | Critical prerequisite | No Firestore rules or UID-scoped cloud data model exists. Do not deploy client-side sync before rules and Emulator tests. | Open — design documented |
| SEC-02 | High | Local persistence keys are global, not scoped to Firebase UID. Account switching on one browser can expose prior local progress. | Open — local-scope refactor required |
| SEC-03 | High | Weak-verse persistence in `RetentionService` uses a separate localStorage path instead of the central StorageService adapter. | Open — centralize before sync |
| SEC-04 | Medium | `server.ts` and `api/advisor.ts` duplicate advisor endpoint behavior. The Express chat path does not use the same bounded conversation-history validation as the Vercel route; keep both implementations aligned or extract one shared validator/handler. | Open |
| SEC-05 | Medium | Advisor IP rate limits are in-memory and per process/serverless instance. They can reset across instances/restarts and are not a durable global abuse-control boundary. | Open — document limitation; consider App Check/edge limits |
| SEC-06 | Medium | `vercel.json` contains route rewrites but no explicit security response headers. | Open — add headers after verifying Firebase popup, audio, and microphone behavior |
| SEC-07 | Medium | No dependency-audit step existed initially. CI now runs `npm audit --audit-level=high`; patched gRPC override is locked and tested. | Fixed / monitored |
| SEC-08 | Medium | Production `start` command invoked `node server.ts`, which fails on Node 22.16 without a TypeScript loader. | Fixed: `tsx server.ts`, runtime dependency, Node 24.12+ |
| SEC-09 | Medium | Settings exposed a destructive demo-data loader to production users. | Fixed: DEV-only UI + handler guard + regression test |
| SEC-10 | Low | Vercel production deployment currently fails with the provider's daily build-rate quota. | External blocker; retry after quota reset |

## Authentication and authorization

### Confirmed
- Firebase Auth is initialized in `src/lib/firebase.ts`.
- Auth flows include Google sign-in, email/password signup/login, email verification, password reset, logout, and guest mode.
- `AuthGate` blocks unverified email/password accounts from entering the authenticated app.
- The Gemini API key is read server-side by the advisor handlers; `.env*` is ignored except `.env.example`.
- No administrative role or client-side admin shortcut was found in the inspected auth flow.

### Not yet verified
- Actual Firebase authorized domains, enabled providers, verification templates, and production project settings.
- Real-world Google popup behavior and email verification refresh against the live project.
- Any live Firestore rules (none are present in the inspected repository).
- Whether Google AI Studio has synchronized the latest GitHub main commit.

## API and server security

### Advisor API
- `api/advisor.ts` accepts a bounded payload and applies an in-memory IP rate limit.
- Wildcard CORS is public by design; `Access-Control-Allow-Credentials` was removed because wildcard origin and credentialed requests are incompatible.
- Expired rate-limit entries are pruned when the map grows beyond 1,000 entries.
- The endpoint remains unauthenticated so guest mode can use it. Treat it as a public, quota-sensitive endpoint; rate limiting is not distributed.
- The Express server in `server.ts` contains a separate implementation. Its request validation and chat history handling should be aligned with the Vercel route.

### Tafsir API
- The proxy validates Surah/Ayah coordinates against canonical metadata, uses an upstream timeout, applies bounded response handling, and caches public tafsir responses.
- Its rate limiter is also in-memory and process-local; it is not a global abuse-control service.

### Browser and XSS
- React's normal text rendering escapes text content.
- No deliberate use of `dangerouslySetInnerHTML` was found in the inspected core UI paths.
- A full automated DAST/XSS scan and browser-based penetration test have not been performed.

## Secrets and configuration

- `.gitignore` excludes `.env*` while allowing `.env.example`.
- `.env.example` contains placeholders/public Firebase web configuration names, not a service-account private key.
- Firebase web API keys are client identifiers and must be protected by Firebase API restrictions and Firebase Security Rules; they are not substitutes for database authorization.
- `GEMINI_API_KEY` must remain server-only and must never be prefixed with `VITE_`.
- No live secret rotation or Google Cloud IAM review was possible from GitHub source access.

## Dependency and runtime verification

- Added Node engine requirement `>=24.12.0`.
- CI uses Node 24 and current Node-24-compatible GitHub Actions.
- Pinned `@grpc/grpc-js` to patched `1.14.6` through npm overrides.
- Regenerated `bun.lock` with Bun 1.4.4; CI verifies with `bun install --frozen-lockfile`.
- CI runs `npm audit --audit-level=high`; latest successful run reported no high/critical dependency vulnerabilities.
- The production server is launched with `tsx server.ts`, and a smoke test requests `/api/advisor/status` without a Gemini key.

## CI evidence

Latest verified main Quality Gate:
- Commit: `59486db8eddef6b00a13565024a2754969ff056d`
- Run: https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42103972108
- Bun frozen-lockfile install: passed
- npm dependency audit: passed
- Automated tests: passed
- TypeScript validation: passed
- Production build and Quran chunk validation: passed
- Production server startup smoke test: passed

## Required next security work

1. Implement UID-scoped local persistence and a one-time, backup-preserving legacy-data ownership migration.
2. Centralize weak-verse persistence in the same storage adapter.
3. Add Firestore rules, emulator configuration, and tests for unauthenticated, unverified, cross-UID, malformed, and oversized writes.
4. Implement a per-user cloud sync adapter with idempotent mutations, deterministic conflict resolution, tombstones, offline outbox, and real-time listeners.
5. Align Express and Vercel advisor request validation; consider Firebase App Check or edge-level rate limiting.
6. Add response security headers to both Vercel and Express after verifying Google popup auth, Quran audio, and microphone use.
7. Run a two-account/two-device live smoke test after rules are deployed.

## Explicit limitations

This audit is based on GitHub source and CI evidence. It does not prove that live Firebase rules are deployed, live Auth settings are correct, Google AI Studio is synchronized, Vercel is deployed, or production behavior has been manually inspected.
