# WIRD Ruqyah engineering checkpoint

Last updated: 2026-11-07


## Active work

- Repository: xm8eslam-stack/WIRD-APP
- Base branch: main (base SHA 473619ef16386ccb7b18ea7d32058bfe67bdfd6a at PR creation)
- Working branch: feat/ruqyah-phase1-canonical-quran-v2
- Pull request: #88
- Do not merge until the current PR head has passing automated checks and the build has been independently verified.

## Completed in this branch

1. Quran display is resolved from WIRD's existing verified Quran corpus using validated surah/ayah ranges.
2. Complete multi-ayah audio queues are generated from canonical global ayah numbers; the obsolete audioVerseKey first-ayah-only fields were removed.
3. Al Furqan integration added:
   - server-side reciter catalogue proxy;
   - schema validation and cache headers;
   - validated global-ayah audio URL builder;
   - fallback reciter catalogue;
   - player now queues all verses in a passage.
4. IslamicAPI integration added:
   - server-only API key proxy with allowlisted parameters, Arabic-only requests, input validation, upstream JSON/schema checks, timeouts, rate limits, and CDN caching;
   - client service rejects HTML SPA fallbacks and malformed envelopes;
   - external library view for Quran and Sunnah program entries;
   - external Quran entries are resolved against WIRD's canonical corpus by numeric reference.
5. Full-program audio options now use the provider's documented brief/medium/long Ruqyah MP3 paths rather than incorrectly labelling a Surah Al-Fatiha MP3 as a complete Ruqyah stream.
6. Progress counts now persist in the active UID-scoped storage namespace, with corruption detection and explicit recovery. Account-wide reset clears this local key.
7. Repetition targets were audited and corrected:
   - fixed counts retained only where a cited narration states them;
   - generic Quran passages and unnumbered Ruqyah supplications use null;
   - pain supplication separates the three Bismillah utterances from the seven repetitions of the supplication;
   - unsubstantiated disease/magic claims were removed from descriptions.
8. Regression suites were added for canonical Quran mapping, complete audio queues, API proxy security, audio catalogue validation, API Quran matching, progress persistence, and count rules.

## Verification status

- Source-level review performed on the branch.
- Automated tests have been authored and registered in src/tests/runAllTests.ts.
- An intermediate GitHub Actions run executed the complete unit suite: 488 passed, 0 failed; Firestore rules suite: 27 passed, 0 failed. That run was cancelled after these steps when later commits were pushed, before TypeScript and production build completed.
- A prior CI run exposed an incorrect test import path; it was corrected. The latest PR head still requires a fresh full CI run covering tests, TypeScript, production build, and Firestore rules.
- Current main already had an external Vercel status failure caused by build rate limiting; distinguish provider quota failures from code test failures.
- Do not merge PR #88 until the exact current head SHA is checked and the CI/build gates pass.

## Next actions, in order

1. Fetch PR #88 and current main; record exact base/head SHAs and all check runs. Never rely on a head SHA copied from this document.
2. Run npm test, npm run typecheck (or the repository's actual scripts), production build, Firestore rules tests, and server smoke tests in a real runner.
3. Fix all compile/test failures, rerun the full suite, then merge only when the required checks pass.
4. Configure ISLAMICAPI_API_KEY as a server secret after confirming the provider's current plan/terms; never put it in client code.
5. Smoke-test:
   - reciter catalogue loading;
   - single and multi-ayah playback;
   - pause/resume and switching reciters;
   - each full-program MP3 URL;
   - API categories and Quran/Sunnah entries;
   - missing-key, upstream-HTML, timeout, and rate-limit states.
6. Integrate Ruqyah progress into the cloud-sync and journaled backup model only after designing and testing the required schema changes. It is currently local-only by design.
7. Continue the visual/accessibility review against the rest of WIRD (mobile widths, dark/light themes, keyboard navigation, screen readers, and RTL).

## Resume instruction

Start by reading this checkpoint, the current PR #88 diff, and the current main head. Do not assume this branch or its head SHA is unchanged. Continue from the first unfinished action above; preserve all already completed work and do not merge without passing checks.
