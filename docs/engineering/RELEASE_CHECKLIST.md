# WIRD — Release Checklist

**Last verified:** 2026-11-14  
**Current release decision:** BLOCKED

Use only these statuses: **PASS**, **FAIL**, **BLOCKED**, **NOT VERIFIED**. Record exact SHAs and run/deployment IDs. Never convert missing logs into a test failure or success.

## A. Repository and change control

- [x] PASS — main SHA recorded: `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
- [x] PASS — Production deployment identity matches that main SHA.
- [ ] BLOCKED — every candidate PR must be re-fetched and reviewed at its exact current head.
- [ ] BLOCKED — no merge until required exact-head CI checks are inspectable and pass.
- [ ] NOT VERIFIED — Google AI Studio synchronization after merge.

## B. CI and build

- [ ] BLOCKED — GitHub Actions currently fails before recording steps/logs on several PR heads; retry did not restore observability.
- [ ] NOT VERIFIED — full test suite on a local complete checkout.
- [ ] NOT VERIFIED — TypeScript/lint exact-head run.
- [ ] NOT VERIFIED — Firestore Rules Emulator exact-head run.
- [ ] NOT VERIFIED — Playwright desktop/mobile exact-head run.
- [x] PASS — PR #373 exact-head Vercel Preview build completed on `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca`.
- [x] PASS — PR #364 exact-head Vercel Preview build completed on `ad33875b0304020f930c7b606ef8782d36148707`.
- [x] PASS — main Production build/deployment is READY on `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.

## C. Quran and Ruqyah

- [x] PASS — local Quran text remains the display authority.
- [x] PASS — targeted Ruqyah API proxy/security tests: 20/20 in isolated Node 26.
- [x] PASS — targeted Ruqyah view/audio-lock tests: 14/14 in isolated Node 26.
- [x] PASS — full 171-entry long-program handler fixture normalizes coordinates and strips provider text.
- [x] PASS — Preview build generated 114 Surah chunks and validated 6,236 ayah coordinates.
- [ ] BLOCKED — merge/deploy the long-index whole-Surah locator fix through exact-head CI.
- [ ] NOT VERIFIED — post-fix Production API short/medium/long smoke.
- [ ] NOT VERIFIED — browser-level Ruqyah playback and navigation on protected Preview.
- [ ] NOT VERIFIED — real-device/offline audio playback.

## D. Engine Plans and memorization

- [x] PASS — isolated archive codec tests: 6/6.
- [ ] BLOCKED — integrate archive chunk codec into real IndexedDB archive and sync persistence.
- [ ] BLOCKED — add explicit bounds for total archive bytes, record count, manifest size, and chunk count.
- [ ] NOT VERIFIED — old archive backward compatibility on a complete repository test run.
- [ ] NOT VERIFIED — corrupted archive recovery and rollback with real persisted fixtures.
- [ ] NOT VERIFIED — atomic manifest publication and chunk garbage collection.
- [ ] NOT VERIFIED — two/three-client Firestore Emulator conflict and restart tests.
- [ ] NOT VERIFIED — full memorization-range E2E and generated Juz-boundary validation.

## E. Offline and PWA

- [ ] BLOCKED — cross-tab job ownership/locking for concurrent downloads.
- [ ] BLOCKED — complete Cache Storage orphan cleanup lifecycle.
- [ ] BLOCKED — consistent Cache Storage quota detection and user-facing recovery.
- [ ] NOT VERIFIED — progress, pause/cancel/retry behavior in browser integration.
- [ ] NOT VERIFIED — restart recovery and partial-file cleanup.
- [ ] NOT VERIFIED — service-worker cache version migration and invalidation on supported browsers.
- [ ] NOT VERIFIED — storage quota exhaustion and multi-tab tests.
- [ ] NOT VERIFIED — Android/iOS PWA airplane-mode and restart verification.
- [ ] NOT VERIFIED — offline audio playback integrated with the reader.

## F. Security and Advisor

- [x] PASS — client-controlled history sender labels are no longer rendered as authenticated assistant messages on PR #364.
- [x] PASS — five targeted source assertions in isolated Node 26.
- [ ] NOT VERIFIED — full advisor security suite and exact-head CI.
- [ ] BLOCKED — evaluate a distributed/global rate-limit strategy; current in-memory limit is best-effort per serverless instance.
- [ ] NOT VERIFIED — production request/abuse monitoring after release.
- [ ] PASS — no API secret values were read, logged, or changed during this audit.

## G. Seerah

- [x] PASS — prototype UI explicitly labels itself as non-published and uses draft navigation fixtures only.
- [ ] NOT VERIFIED — historical source reliability and edition-level citations.
- [ ] NOT VERIFIED — quotation rights and source license/permission evidence.
- [ ] BLOCKED — no chapter may be published until claims, sources, rights notes, scientific review, language review, narrative continuity, and accessibility review pass.

## H. Firebase and sync safety

- [x] PASS — inspected client configuration identifies `wird-quran-app`.
- [x] PASS — repository Firestore rules inspected; no rules/database/user data changed.
- [ ] FAIL — Vercel Production flags `VITE_WIRD_REVISIONED_SYNC_ENABLED` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED` are both currently `true`.
- [ ] BLOCKED — explicit owner authorization required before disabling the two Production flags; no settings changed.
- [ ] BLOCKED — sync must not be treated as release-safe until server-owned revisions, base-revision capture, transactional compare-and-swap, validated bootstrap, durable cursors, atomic imports, duplicate handling, UID guards, conflict deferral, and multi-client emulator tests are all evidenced.
- [ ] NOT VERIFIED — deployed Firestore rules match repository rules at the current production project/version.

## I. Production verification

- [x] PASS — Production deployment is READY on the exact main SHA.
- [x] PASS — Vercel environment metadata confirms `ISLAMICAPI_API_KEY` exists in Preview and Production; secret value not read.
- [x] PASS — short and medium Ruqyah production API requests returned HTTP 200 before the feature fix.
- [ ] FAIL — long Ruqyah production API request returned HTTP 502 before the feature fix; post-fix Production verification is pending.
- [ ] NOT VERIFIED — full read-only live application smoke across Quran, audio, tafsir, memorization, adhkar, and prayer tools.
- [ ] NOT VERIFIED — physical-device offline behavior.

## J. Documentation and handoff

- [x] PASS — the documentation branch preserves the complete previous main work log as an exact substring (589 lines on the current PR #363 documentation branch versus 537 on main).
- [ ] BLOCKED — canonical state, architecture, release checklist, and work-log files are being consolidated; keep historical paths as compatibility pointers.
- [ ] NOT VERIFIED — all relative links and all docs references after final consolidation.
- [ ] NOT VERIFIED — final Google AI Studio handoff/sync.

## Release rule

A release is **BLOCKED** while any critical section above remains BLOCKED or FAIL. Do not enable remote sync, change Production settings, deploy Firestore rules, or merge a candidate PR without exact-head evidence and required owner authorization.


## 2026-11-14 09:00 local — latest re-check

| Gate | Evidence | Status |
|---|---|---|
| PR inventory | 16 open PRs; latest heads re-fetched; #375 advanced to `495b9ccada1bb327abeee469af16faa52ddc9707` | PASS |
| GitHub Quality Gate | #375 rerun run `43570354110`, latest job `132373650377`; `steps=null`, `logs_url=null` | BLOCKED |
| Cross-PR CI telemetry | #373 run `43568676649`, #363 `43570268180`, #372 `43391729769`; all fail before steps/logs | BLOCKED |
| Production deployment | `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu`, READY on main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` | PASS |
| Production sync configuration | Both required-disabled flags read as `true`; no changes made | FAIL |
| Production Ruqyah long index after #373 | Feature PR not merged; live post-fix smoke not run | NOT VERIFIED |
| Full repository tests/build on exact PR heads | No complete local checkout or inspectable CI steps | NOT VERIFIED |

No PR is merge-eligible while the required exact-head Quality Gate is not inspectable and passing. Production sync settings remain untouched pending explicit owner approval.
