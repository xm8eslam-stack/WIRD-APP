# WIRD Security & Data Integrity Audit

**Audit date:** 2026-11-06  
**Audited branch:** `main`  
**Audited HEAD:** `1efadcac33a8c57ad8aa4fdb50f8e37fcef94e35`  
**CI:** GitHub Actions run [42169105813](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42169105813) completed successfully.  
**Deployment:** The user reports `https://wird-app.vercel.app/#/dashboard` is working; the Vercel check for this commit is green. This does not verify Firebase production rules or cloud sync.

## Executive summary

WIRD has a sound local-first foundation and Firebase Authentication. UID-scoped local storage and a legacy-data ownership decision are implemented. Several correctness and persistence bugs affecting memorization/revision were fixed and regression-tested in this session, including review/memorization separation, repeat-loop prevention for in-progress passages, single-write page updates, and truthful backup-import feedback.

**Cloud sync is not implemented yet.** Firestore rules and emulator tests exist, but there is no Firestore client adapter, local outbox, merge engine, or live rules deployment confirmation. Do not tell users their progress is cloud-synced until the M4–M7 gates in `IMPLEMENTATION_ROADMAP.md` pass.

## Confirmed protections and fixes

| Area | Current state |
|---|---|
| Auth gating | Verified-user gating exists in AuthGate; unauthenticated/guest/verified account states are separated |
| Local account isolation | Authenticated local data is scoped by exact Firebase UID; guest data remains separate |
| Legacy local data | First authenticated account receives an explicit import-or-keep-as-guest decision |
| Weak-verse persistence | Uses the centralized StorageService raw-key adapter |
| Durable local writes | Failed localStorage writes no longer leak through memory fallback as successful writes |
| Activity/streak write | Session log/profile write reports failure and attempts rollback rather than silently claiming success |
| Review vs memorization | Review sessions no longer add memorized ayahs or create memorization portions |
| Retention score | Overlapping ranges count each ayah once; weakest overlapping status wins |
| Review page count | Uses canonical Mushaf page mapping rather than an ayah-count estimate |
| In-progress memorization | Resumes exact stored range; no clipped child range that leaves a repeating parent |
| Page status updates | Prepares all Surah segments and persists the whole page update in one canonical write |
| Backup import UI | Checks `result.success`; failed imports and file-read errors no longer display false success |
| Daily plan selection | Does not start future engine tasks or silently escape a plan's explicit scope |
| Firestore rules | UID ownership, verified-user check, allowlist, generic envelope, tombstone-only delete model, default deny |
| Rules tests | Firebase Emulator rules tests run in CI |

## Important unresolved risks

### Critical — cloud sync is absent

- `src/lib/firebase.ts` initializes Firebase App/Auth only.
- No application Firestore client, `onSnapshot` listener, cloud repository, or sync engine is present.
- `LocalSyncOutbox` exists but is not yet called by session, review, weak-verse, test, or plan mutation flows.
- Firestore rules are not confirmed deployed to the live Firebase project.
- Cross-device progress must be considered unavailable until sync is implemented and verified.

### High — current Firestore rules are only a foundation

- Rules currently validate a generic envelope, not the full schema for each collection.
- Collection-specific payload key/type/range validation and size limits remain required.
- Event collections should become create-only.
- No live Firebase rules deployment was performed.

### High — current activity and weak-verse data are aggregate projections

- Daily logs are currently updated as per-day aggregates. A cross-device read-modify-write would lose concurrent increments; migrate to immutable activity events before sync.
- Weak-verse mistake counts are aggregated; migrate to immutable mistake events before sync.
- Review history and portion state need unique event IDs and deterministic merge semantics.
- Some multi-key local operations can still partially succeed; the outbox stage must make local state + queued mutation atomic or provide rollback.

### Medium — plan and progress UX

- Daily quick-start and review/memorization modes were corrected, but the remaining components and all mutation call sites still need a complete file-by-file audit.
- Page/Juz plans are deliberately blocked from automatic quick-start until exact ayah-range resolution is available; they must not be widened to whole Surahs.

### Medium — serverless AI endpoint

- `api/advisor.ts` uses an in-memory per-IP rate limiter. Serverless instances can scale independently, so this is not a globally authoritative quota.
- The endpoint should remain optional and must not be required for memorization, revision, or data integrity.
- Keep `GEMINI_API_KEY` server-only; never expose it as a `VITE_` variable.

## Firestore rules model currently present

- Path: `users/{uid}/{collection}/{documentId}`
- Verified Firebase auth required.
- `request.auth.uid == uid`.
- Collection allowlist currently includes profile, plans, enginePlans, portions, weakVerses, tests, activityEvents, and syncMeta.
- Generic envelope includes schema version, payload, client update time, device ID, mutation ID, and optional tombstone.
- Physical deletes denied; unknown paths default denied.

This model must be tightened per collection before production sync.

## Verification evidence

Latest Actions run: [42170716768](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42170716768) — success.
- Automated test suites: 228 passed, 0 failed.
- Firestore Emulator security-rule tests: passed.
- TypeScript validation: passed.
- Production build, including Quran chunk validation: passed.
- Production server startup smoke test: passed.

The Vercel status check for the audited commit is successful. No Firebase production rules deployment or real two-device sync test has been performed.

## Next security actions

1. Finish the remaining file-by-file audit and document every data mutation path.
2. Implement a UID-scoped local event ledger and durable outbox.
3. Implement deterministic merge functions and tests before Firestore integration.
4. Harden rules with collection-specific schemas, immutable events, and size limits.
5. Run two-client emulator tests for account isolation, concurrency, retries, and offline replay.
6. Request explicit approval before deploying rules or enabling cloud sync for real users.
