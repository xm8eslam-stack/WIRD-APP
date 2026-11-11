## Seerah API research — follow-up 2026-11-11

- Read the actual Islamic Network People/Events OpenAPI JSON. People records support language-keyed biographies, dates, person type, linked event/quote/story aggregates and related people; Arabic may be absent per record. Events is calendar-oriented and uses Hijri month/day anniversaries distinct from the optional historical year; do not treat it as a complete chronological Seerah source.
- SeerahBook is a read-only graph with per-IP limits and provenance, but its content is based on a specific lecture series; its own About page labels approximate/disputed/weak reports and possible dramatized wording. Never present reconstructed wording as verbatim quotation.
- Dorar's official API terms prohibit bulk download/republication, require attribution + clickable source URL and server-side token, limit cache to 24–48h, 60 req/min, and require approval/preview review. It cannot be used as a permanent offline corpus.
- WIRD should publish from its own reviewed/versioned Seerah Content Registry; APIs are discovery/verification adapters only until rights for offline/republication are confirmed.
- Read `docs/SEERAH_LEARNING_PLAN_AR.md` section 14 and `docs/DEVELOPMENT_ROADMAP.md` before implementing.
- CI retry evidence for previous PR #363 head: run `43051925917` failed with no recorded steps/logs; rerun job `130632989788` failed the same way. Do not treat as test-level failure or pass. Re-fetch the new PR head and exact-head gate.
- No runtime integration, API content ingestion, secrets, Firebase changes, production changes or deployment was performed.

---

# Follow-up handoff — 2026-11-11 (Seerah learning roadmap)

> This section supersedes earlier status snapshots only for the new Seerah feature direction. Re-fetch live repository/PR/CI/deployment state before acting.

- New specialist plan: `docs/SEERAH_LEARNING_PLAN_AR.md`.
- Product priority: Quran memorization/revision remains first; Seerah of the Prophet ﷺ and Companions is the second core learning feature.
- The planned experience includes staged lessons, people/events/places, a sourced timeline, verified maps, lesson and stage quizzes, cumulative tests, mistake review, and local-first/offline progress.
- API research is preliminary: SeerahBook (read-only people/events/place graph, based on a specific lecture series), Dorar Historical Encyclopedia API (manual approval and bearer token), and Islamic Network People/Events (Early Access). No provider is approved or integrated.
- Do not ingest/publish API data automatically. Every claim and quiz item needs source references and editorial review; no AI-authored historical/religious content, no unlicensed book reproduction, and no depictions of the Prophet ﷺ or Companions.
- Read `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_ROADMAP.md`, and `docs/SEERAH_LEARNING_PLAN_AR.md` before planning this feature.
- Documentation-only changes are on PR #363 branch `docs/wird-docs-roadmap-reconciled-20261111`; exact current head and CI must be fetched before any merge decision. Production and Google AI Studio sync are not proven by these commits.
- No runtime code, Firebase/Firestore, production data/settings, secrets, sync flags, or deployment configuration changed.

---

# GOOGLE AI STUDIO — Latest handoff (2026-11-11 16:30 +02:00)

Repository: `xm8eslam-stack/WIRD-APP`; source branch expected: `main`.
Latest main SHA: `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
PR #362 merged (`cfe9458e55bd4e66a51e57ce5a5c16e83b65becd`): guest-entry hydration test helper.
PR #361 merged (`2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`): EveryAyah stays stream-only; legacy cached entries pruned.
PR #360 closed as superseded; replacement docs PR #363 remains Draft. Its first Quality Gate run and rerun failed before job steps/logs appeared; do not treat as passed.
PR #356 closed as superseded; pure range planner is already in main from #355; unique activity cutover protocol was preserved in the sync design document.
PR #358/#359 remain unmerged and overlap in manifest responsibilities. Follow `docs/offline/OFFLINE_AUDIO_STORAGE_CONTRACT.md`; do not merge either unchanged.
Production source SHA/live smoke and Google AI Studio sync remain NOT VERIFIED.

> Read `AGENTS.md`, then `docs/CONTINUE_HERE.md`, `docs/DEVELOPMENT_ROADMAP.md`, and `docs/DOCUMENTATION_CATALOG.md` before making changes.

---
## PR #363 — الحالة الحية

- PR #363 مفتوح كـ Draft على الفرع `docs/wird-docs-roadmap-reconciled-20261111`، مبني على main الحالي `2c9aa9722592ae7f9f0f317cc15cf9fe6ffd6cfe`.
- أول Quality Gate run `43039009676` فشل على job واحد؛ إعادة التشغيل attempt 2 انتهت بالفشل خلال ثوانٍ دون أي job steps أو logs متاحة. هذا ليس نجاحًا ولا فشل اختبار موثقًا؛ CI غير محسوم.
- لا تدمج حتى يعمل Quality Gate على الرأس النهائي وتظهر كل خطوات الاختبار.

---
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
# GOOGLE AI STUDIO — Latest handoff (2026-11-11 15:52 +02:00)

> Read `AGENTS.md`, then [`docs/CONTINUE_HERE.md`](../CONTINUE_HERE.md), [`docs/DEVELOPMENT_ROADMAP.md`](../DEVELOPMENT_ROADMAP.md), and [`docs/DOCUMENTATION_CATALOG.md`](../DOCUMENTATION_CATALOG.md). This is a documentation handoff, not proof that Google AI Studio has synchronized.

- Repository: `xm8eslam-stack/WIRD-APP`; expected source branch: `main`.
- Latest main SHA observed: `8dd21522430cc014db4eb5da8437f89c42f190f9`.
- #362 exact-head Quality Gate PASS (`e2079734a0d150c1046307611a2b28346fdcdb1d)); #361 PASS (`3008c4788caba61930be008e3cb40dcf52cfd78f`).
- #360 exact-head run `43030878508` failed only at Desktop/Mobile Playwright smoke; #358/#359/#356 also have Playwright smoke failures and remain Draft. Check [CONTINUE_HERE](../CONTINUE_HERE.md) before action.
- #358/#359 are competing/overlapping offline audio manifest designs; do not combine blindly.
- Vercel status on main is not Production proof. Production source SHA, live smoke, and AI Studio synchronization are NOT VERIFIED.
- Do not alter secrets, Production settings, Firebase rules/data, or sync flags.

---

# GOOGLE AI STUDIO — Latest handoff (2026-11-11)

> Start with [`docs/CONTINUE_HERE.md`](../CONTINUE_HERE.md), then [`docs/DEVELOPMENT_ROADMAP.md`](../DEVELOPMENT_ROADMAP.md) and [`docs/DOCUMENTATION_CATALOG.md`](../DOCUMENTATION_CATALOG.md). Older notes below are historical snapshots.

- Repository: `xm8eslam-stack/WIRD-APP`; Google AI Studio is expected to use branch `main`.
- Latest main SHA directly observed: `8dd21522430cc014db4eb5da8437f89c42f190f9`; PR #353 merged.
- PR #353 exact-head Quality Gate run `43028294037` passed; a separate post-merge main-only run was not observed in this review.
- GitHub Vercel status on main SHA reports success; Production source SHA and live smoke remain unverified.
- Active PRs at review: #360 documentation consolidation (latest run `43030765045` pending), #359 offline audio manifest (run `43029617572` in progress), #358 offline download job/item store (run `43028986222` passed), and #356 sync documentation update (run `43029328133` passed). Re-fetch exact checks before continuing.
- #358 models persistent download jobs and verified ayah items; #359 models verified-file metadata alongside Cache Storage. Do not merge both implementations without a unified storage contract.
- No secrets, production variables, Firestore data/rules, sync flags, or deployment settings were changed.

## Instructions for the next session
1. Read root `AGENTS.md`, then `docs/CONTINUE_HERE.md`.
2. Fetch the latest main SHA, PRs, exact-head Quality Gates, and deployment evidence.
3. Continue the highest-priority unblocked work; do not repeat merged work.
4. Keep implementation on feature branches and record exact test evidence.
5. Leave owner-only production/device steps until the end.

---


### GOOGLE AI STUDIO HANDOFF


## 2026-11-11 — Latest verified state after PR #328 merge

- Repository: `xm8eslam-stack/WIRD-APP`; current `main` SHA is `50bb25eeba2f1ed4ceae228b347c67b40f60c697`.
- PR #325 (stale full-snapshot compare-and-set guard) merged as `966d5fecae0dbd6c27b2a83ef300b0dde3dbd5a6`.
- PR #326 (continuous Quran audio queue, Mushaf display controls, and 10-second opportunistic offline pre-cache timeout) merged as `3667a8c003b79984546d48a9defc20c6f2bcd367`. Exact-head Quality Gate run `42919276966` passed: 674 automated assertions, 604-page coordinate-map validation, 31 Firestore Rules Emulator tests, 8/8 approved audio probes, 150 desktop/mobile Playwright tests, TypeScript, production build, and server smoke.
- Memorization display sizing/navigation is already present: PR #202/#206 merged; PR #206 merge `391be261e32f4d3634b0bf0010972c0297077d67` is an ancestor of Production. Session controls: UI scale 80–110%, ayah font 20–44px, compact/comfortable spacing, focused/all-session ayah view, and sticky navigation. Preferences are device-local and excluded from cloud sync/backups.
- PR #328 merged as `50bb25eeba2f1ed4ceae228b347c67b40f60c697`; exact PR head `0c41126b1e018892119ced669936335326f8b1e7` passed Quality Gate run `42921569974` (152 Playwright passed, 2 skipped; dependency audit, Firestore Rules Emulator, TypeScript, production build, and server smoke succeeded).
- Latest documented Production remains `dac125dd8770cc4881e2c6cea6fe94623ad52144` (`READY`, alias `wird-app.vercel.app`); it predates PR #325/#326/#328. The post-merge GitHub Vercel status for `50bb25e` now reports `success`, but the Vercel deployment detail endpoint returned team-scope 403. Its exact source SHA/Production state and live smoke remain unverified. No manual deployment or settings change was made.
- No Firestore rules/schema, secrets, environment variables, or remote-sync flags changed. Google AI Studio synchronization has not been independently verified; do not claim it is synced until the owner verifies the connected `main` source.
- Sync limitations remain: whole-snapshot `keep-local/use-remote` decisions for `weakVerses` and `activityEvents` stay blocked by `syncConflictSafety`; tombstone/delete semantics and a real two-device post-merge test remain outstanding. PR #325 adds a stale-snapshot safety guard, not proof that bidirectional sync is fully released.

## 2026-11-10 — Current verified state and continuation

- Application-code `main` SHA at this checkpoint (before this documentation-only PR): `182aae6a757668eb4c54782601682ba91c3d1251`. Main Quality Gate run `42716625092` passed.
- PR #191 merged opt-in offline app preparation. It caches same-origin JS/CSS, including lazy Quran chunks, after an explicit user action. Its exact PR head passed 614 assertions, 31 Firestore Rules tests, and 54 desktop/mobile Playwright tests. It does not cache audio, tafsir, API responses, Firebase/auth, or remote data.
- Vercel Production deployment `dpl_7MrJV9KtkTT2PYEwnij2kXCRnXwW` is `READY` on the exact main SHA, but its build logs still emit `TS2688` for `vite/client`.
- PR #192 is open on `bbd7966e1589a5392410e8b4e68a31f60cf1634d`; exact-head CI run `42721449912` passed and its preview is Ready. Preview logs no longer contain TS2688. It is not merged.
- Firestore rules deployment workflow run `42691610063` succeeded against canonical project `wird-quran-app`; the deployed source commit `5de1c2cd0eefa34d6c35d4c039ef2d3ecf8bb674` has the same `firestore.rules` blob SHA as current main (`6c9cbf1e7a1ebe4325240d751d40aec9efabc760`).
- Vercel Production currently has both sync build flags set to `true`, although the repository release gate still does not approve full activation. This was observed only; no production setting was changed. Owner confirmation is required.
- Vercel currently has `ISLAMICAPI_API_KEY` only for Preview; Production has `ISLAMICAPI_API_KEY1`, which `api/ruqyah.ts` does not read. This likely causes the explicit missing-key 503 in Production; it does not alone explain a reported 500. Secret values were not decrypted.
- Vercel Authentication protection is enabled for all non-custom domains; only `wird-app.vercel.app` is listed. External public smoke and public-user access may be blocked. Do not change this without owner approval.
- Ruqyah status: the UI uses seven curated Al Quran Cloud reciters for verse-by-verse playback. Complete Brief/Medium/Long recordings are not integrated; provider MP3 links remain unverified. The IslamicAPI proxy currently exposes only validated Quran coordinates, never provider-authored religious text.
- Detailed current evidence and blockers: `docs/sync/RELEASE-GATES.md`; integration truth: `docs/ruqyah/INTEGRATION_SETUP.md`.
- Release status: **HOLD**. No production smoke, full cloud-sync certification, or Google AI Studio synchronization is claimed.

Next: owner decision on Production sync flags and public Vercel access; add the exact `ISLAMICAPI_API_KEY` Production variable and redeploy via approved settings; review/merge PR #192 only after exact-SHA checks and branch protections; continue tombstone/grouped-conflict and offline replay tests. Do not decrypt or copy secrets, alter production settings, or enable additional remote features without explicit approval.

---

- Date: 2026-11-07
- Task: WIRD Canonical Firebase Project Unification & Atomic Transaction Resilience Verification
- Modified files:
  - `/.env.example`
  - `/firebase-applet-config.json`
  - `/src/lib/firebase.ts`
  - `/src/tests/firebaseAuth.test.ts`
  - `/src/services/cloudSyncCoordinator.test.ts`
  - `docs/agent-handoffs/LATEST-GOOGLE-STUDIO.md`
- Changes:
  - Unified Firebase configuration explicitly to canonical project `wird-quran-app` and default Firestore database `(default)`.
  - Added strict project guard `isExpectedWirdFirebaseProject` and explicit `WIRD_FIRESTORE_DATABASE_ID` invariant preventing fallback to legacy project `elliptical-rampart-bxq1s` or named databases.
  - Implemented and verified isolated atomic transaction test suite for engine plan deletion and network failure retry resilience.
- Tests: 570/570 passing (`npm test` - 0 failures, `compile_applet` PASSED, `lint_applet` PASSED)
- Commit SHA: Local main branch working state (Verified)
- Status: Completed
- Next step: Maintain canonical Firebase project alignment across Google AI Studio and Vercel environments.
- Warnings: None.


## 2026-11-08 — WIRD visual identity and UX redesign (in progress)

- Base branch: `main` at `8201911e0b939fd27d6006a14ca5422982cbc8c7`.
- Working branch: `feat/wird-visual-identity-ux`.
- Scope: introduce a calm warm-paper / muted-sage design token foundation; group the desktop navigation into task-oriented sections; add a five-destination mobile bottom bar with secondary destinations in the More drawer; simplify header hierarchy and content width; make the memorization-session tafsir panel collapsed by default, user-toggleable, and preference-persistent. Tafsir fetching is deferred until the panel is opened.
- Safety: no Quran corpus, Firebase, authentication, sync, production secrets, or remote-sync flags changed.
- Historical status at checkpoint creation: PR #169 was still Draft and CI/production/visual E2E were pending. PR #169 was subsequently merged to main on 2026-11-08 after its exact-head checks passed; see the verified checkpoint below.

## 2026-11-09 — Verified production and engineering checkpoint

- Repository: `xm8eslam-stack/WIRD-APP`; source branch: `main`.
- Verified main HEAD: `f620d9ed5241245147baa66753a3e7f7e421ed7e` — `fix(hadith): preserve source reference identity`.
- PR #175 is merged. It preserves Quran Foundation's top-level hadith-reference URN separately from the nested hadith URN and deduplicates by stable source identity without collapsing distinct narrations.
- Exact-main Quality Gate: GitHub Actions run #3200 / run ID `42526907158`, completed successfully on the exact main SHA above. The job passed dependency audit, automated tests, native API import smoke, approved Quran audio CDN/byte-range checks, Firestore Rules Emulator, TypeScript, production build, server startup smoke, and desktop/mobile Playwright.
- Production: Vercel deployment `dpl_5w3rMw5GphfGTUyoCj45kMmqo4nN` is `READY` and targets the same exact main SHA; production alias `https://wird-app.vercel.app`. Build output validated 114 Surahs / 6,236 ayahs and generated the verified Quran page and lazy Surah chunks.
- Recent Vercel runtime-error aggregation (24-hour window) surfaced one Node `DEP0169` deprecation-warning group (14 occurrences across 8 users, observed on Quran/tafsir/hadith/ruqyah API routes). This is a warning, not proof of failed requests. The 30-minute production error/fatal log query returned no records; a wider 2-hour log query was unavailable under the current Hobby retention window.
- At the start of this checkpoint, PR #161 was stale (17 commits behind and 2 ahead of main) and non-mergeable. Its regression was reapplied on a clean branch in PR #176, passed exact-head CI, and was merged as `faf1eadcdb89ddcb0f8be16679983a20b5de2670`; PR #161 was then closed as superseded. No force-push was used.
- PR #176 added a Playwright regression asserting that a delayed `HTMLMediaElement.play()` promise cannot restore the obsolete playing state after the user changes the Ruqyah category. It passed on desktop and mobile and is now merged. The change is test/documentation-only; no Quran data, audio source, Firebase, secrets, sync, or production settings changed.
- Vercel's variable-name inventory includes `QF_CLIENT_ID` and `QF_CLIENT_SECRET`; secret values were intentionally not read. Their validity/scopes and a successful production hadith API response have not been independently verified.
- A direct anonymous external probe of the production alias was not accessible in this run. The Vercel deployment record is READY, but this must not be described as a completed authenticated user-session smoke test. Vercel reports SSO protection enabled for non-custom domains.
- Google AI Studio synchronization is not independently observable from this GitHub/Vercel inspection; do not claim it is synchronized.
- Post-merge main HEAD is `faf1eadcdb89ddcb0f8be16679983a20b5de2670`. PR #176 exact-head Quality Gate run #3204 (`42528845552`) passed: 596 automated assertions, 31 Firestore Rules tests, 8/8 audio CDN probes, 50 desktop/mobile Playwright tests, dependency audit, native API import smoke, TypeScript, production build, and server smoke. The push-triggered main run #3205 (`42529180221`) was still running at this handoff refresh; monitor its final conclusion.
- Production's latest verified deployment remains `dpl_5w3rMw5GphfGTUyoCj45kMmqo4nN` on SHA `f620d9ed5241245147baa66753a3e7f7e421ed7e`. The merged commit changes only E2E tests and handoff documentation, so it does not alter runtime behavior; no production deployment for `faf1ead` was present at verification time, and no new production release is claimed.
- Owner review needed: Vercel reports SSO protection enabled for all non-custom domains, while the only listed domain is `wird-app.vercel.app`. This may prevent public users without team SSO from opening the app. Do not change this production access setting without explicit owner approval; confirm whether public access is intended and configure a custom domain/protection policy accordingly.
- Next: confirm main push run #3205 completes; obtain a safe stack trace for the Node `DEP0169` deprecation warning if possible; verify Ruqyah and related-hadith API paths with an authenticated, non-secret-leaking smoke test; review the Vercel SSO/public-access setting with the owner; keep production Firebase sync flags and all production secrets/settings unchanged.


## 2026-11-11 — Post-merge memorization navigation and sync design checkpoint

- Current main: `50bb25eeba2f1ed4ceae228b347c67b40f60c697`.
- PR #328 merged successfully. It adds direct selection of any ayah in the active memorization/revision range in the sticky navigation and stops active playback before the selected ayah changes.
- Existing session sizing controls remain available: interface scale 80–110%, ayah font 20–44px, comfortable/compact density, and focused/all-session ayah display. These preferences remain device-local and outside cloud sync/backups.
- Exact PR Quality Gate run [42921569974](https://github.com/xm8eslam-stack/WIRD-APP/actions/runs/42921569974) passed: 152 Playwright checks passed, 2 skipped, dependency audit reported 0 vulnerabilities, Firestore Rules Emulator, TypeScript, production build, and server smoke succeeded.
- Sync discovery and a staged, non-destructive activity-event ledger design are documented in `docs/sync/ACTIVITY_EVENT_PROJECTION_DESIGN.md`. No sync runtime code, Firestore Rules/schema, secrets, production flags, or user data changed.
- Sync remains uncertified: full-snapshot conflict choices for `weakVerses`/`activityEvents` remain blocked; tombstones/deletes remain unsupported; a fresh real-device A↔B round trip after PR #325 is not verified.
- Last documented READY Production deployment remains `dac125dd8770cc4881e2c6cea6fe94623ad52144`; the post-merge Vercel status for `50bb25e` was pending at the last GitHub check. No exact-SHA Production deployment or live smoke is claimed.
- Google AI Studio synchronization remains unverified.

Next: implement the pure activity-event reducer and its migration/replay tests only after the baseline cutover contract is accepted; keep production sync flags, Firestore Rules, and tombstone behavior unchanged.


## 2026-11-11 — Authoritative continuation checkpoint (supersedes earlier stale entries)

- Repository: `xm8eslam-stack/WIRD-APP`; current `main` SHA: `6692e9703aed369b5d34d6b5f0a7f08f739a3f01`.
- PR #332 merged as `ff8665a67fee2252e91d94dc2cba9e6a11937b5c`. It adds device-local memorization page width modes, one-action reset, and automatic visibility of the selected ayah. Exact-head GitHub Quality Gate run #3801 succeeded: automated tests, dependency audit, TypeScript, Firestore Emulator, production build/server smoke, and desktop/mobile browser smoke all passed. Vercel Preview for PR #332 failed only with the free-plan `api-deployments-free-per-day` limit.
- PR #334 (Ruqyah audio seek/volume touch-target regression coverage) is merged; current Production deployment `dpl_5n4xEtsjLp1F2iLKZGsMfaz1AtKs` is `READY` on the exact `main` SHA `6692e9703aed369b5d34d6b5f0a7f08f739a3f01`. Deployment evidence is verified; authenticated interactive smoke on the live site remains unverified.
- PR #338 is the current sync activity cutover documentation update. PRs #339–#341 separately cover settings-dialog focus handling, progress/revision browser regression coverage, and duplicate plan-deletion protection. Their exact-head Quality Gates were still running at this checkpoint; do not merge until every required job and branch-protection condition passes on the final SHA.
- Ruqyah production investigation: the current server proxy is designed to return explicit JSON 502/503 responses for provider failures and does not expose provider-authored religious text. Vercel's 7-day aggregated route query found only Node `DEP0169` deprecation-warning events (7 occurrences, 4 users), not a captured HTTP 500 stack trace. A 30-minute production error/fatal log query returned no matching records; the Hobby plan rejected a 7-day individual-log query because its retention window is shorter. The user's earlier HTTP 500 therefore remains un-reproduced and not root-caused; do not claim it is fixed based on this absence of logs.
- Vercel environment-variable metadata (queried without decrypting values) currently lists `ISLAMICAPI_API_KEY` for both Preview and Production. The key value was not read or tested against the provider. Production sync build flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are currently `true`; this is an observed pre-existing production state, not an approved activation. Do not change these flags, Firestore rules/schema, secrets, or production settings without explicit owner approval. Full bidirectional sync remains uncertified because server-visible device cutover, tombstone/delete semantics, and a fresh real two-device round trip remain outstanding.
- Sync safety decision: local journal has deviceId, sequence, nextSequence, lastProjectedSequence, outbox and acknowledgement records; this is not a server-visible per-device cutover registry. Existing session completion remains date-keyed DailyLog and the domain event lacks captured localDate/timezoneOffsetMinutes. Phase-2 projection remains blocked; do not change Firestore schema/rules or rewrite/delete legacy data without explicit owner approval.
- Google AI Studio synchronization remains independently unverified.
- No Production secrets/settings, Firebase rules/schema, remote-sync flags, or user data were changed in this cycle.
- Next parallel work: finish PRs #338–#341 exact-head checks; keep the sync cutover design read-only until the owner-approved protocol exists; continue Ruqyah root-cause verification without reading secrets or weakening content safeguards; continue review of remaining feature branches and port only changes demonstrably missing from current main.


## 2026-11-11 — Verified continuation after PRs #342 and #344

- Current `main` SHA at this checkpoint: `3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188`.
- PR #342 (settings dialog focus management and keyboard handling) merged as `52b0165da0421c6b44ff14914544ad8b4953e2eb`.
- PR #344 (prevent duplicate memorization-plan deletion; keep failure state honest) merged as `3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188`.
- PR #343's original test-only branch was closed after exact-head Playwright smoke failures showed incorrect assumptions about rendered labels/dialog roles. A corrected test-only PR #346 was opened on current main; exact head `66119fe9837911f7b74df4fe80d946bd4f57d518`, base `3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188`, run `43023399225` was still in progress at checkpoint. Do not merge until the exact-head gate completes and failures are reviewed.
- Vercel Production deployment `dpl_AU9ATDJEsm99z4CWir3WLvvdn32m` is `READY` on the exact `3dd4fbfd1d2c9ed27ce0afe77ede5916f575f188` SHA. No live interactive smoke was verified.
- Production environment metadata (decrypt=false) confirms `ISLAMICAPI_API_KEY` exists for both Preview and Production; no value was read. Both `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` remain enabled in Production. No setting or secret was changed.
- Vercel runtime error aggregation for `/api/ruqyah` over 7 days showed only 7 Node `DEP0169` url.parse deprecation warnings across 4 users; it did not expose an HTTP 500 stack trace. Production function logs for the last 30 minutes returned no matching ruqyah error records. Wider 24-hour log queries are unavailable on the current Hobby retention window. The cause of the reported HTTP 500 remains unconfirmed.
- Offline package currently downloads same-origin app JS/CSS and related approved static assets only after explicit user action. Audio caching is opportunistic and bounded (20 URLs per message; 40 entries retained); no full-Quran audio download manager or complete offline tafsir/API/Firebase availability is claimed.
- Ruqyah proxy `api/ruqyah.ts` uses `process.env.ISLAMICAPI_API_KEY`, accepts only the allowlisted `instant` + `from-quran` programs, and returns sanitized numeric Quran coordinates. Quran text must continue to come from WIRD's verified local corpus. Full Brief/Medium/Long recordings remain disabled pending exact-content and redistribution-rights verification.
- Release and live-verification status remains bounded: GitHub CI, Vercel READY, owner-reported sync experience, and live smoke are separate evidence categories. Do not change production sync flags, Vercel protection, secrets, Firebase rules/schema, or user data without explicit owner approval.


## Seerah narrative direction — 2026-11-11
The owner clarified that Seerah must feel like one compelling, complete story, not a sequence of standalone lessons. Treat the experience as an interactive historical book: major parts → connected chapters → narrative scenes. Reading continuity is primary; optional maps, timelines, people/place context, reflection prompts and chapter/part quizzes support the story without interrupting it. Preserve source-level provenance and editorial review. Never invent dialogue, inner thoughts, scenes, or direct quotations; distinguish disputed/weak reports and approximate dates. See docs/SEERAH_LEARNING_PLAN_AR.md §16. Acceptance requires a real multi-scene chapter in a continuous reader with saved reading position; a lesson list or quiz grid is not sufficient. No runtime implementation or production changes are authorized by this documentation update.

## Seerah chapter production contract — 2026-11-11
The Seerah feature is an immersive historical book, not standalone lessons. See `docs/SEERAH_LEARNING_PLAN_AR.md` §§16–17 for the product contract, reader experience, detailed entities, claim-to-body-block mapping, editorial workflow and opening chapter research outline. Each narrative body block must map to atomic claims and traceable source references. Required review gates: scientific/source review, Arabic language review, narrative continuity review, and UX/accessibility review. The proposed opening chapter outline is a research scaffold only, not approved historical content. No API ingestion, AI-generated published history, runtime implementation, Firebase or production changes are authorized by this documentation direction. Acceptance requires a connected multi-scene chapter in a continuous reader with saved progress; a lesson list or quiz grid is insufficient.