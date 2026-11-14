# WIRD — Master Project State

**Last verified:** 2026-11-14  
**Repository:** `xm8eslam-stack/WIRD-APP`  
**Production:** https://wird-app.vercel.app/  
**Primary branch:** `main`

This is the current verified-state index, not a substitute for re-fetching GitHub, Vercel, Firebase, and exact PR-head evidence before a release decision.

## 1. Repository and deployment identity

| Item | Verified value | Status |
|---|---|---|
| Main SHA | `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` | PASS |
| Production deployment | `DKfbfqsBHqzS95CoTdYZCtPPPZwu` | PASS |
| Production deployment SHA | `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b` | PASS |
| Production state | READY | PASS |
| Local Git working tree | No local checkout exposed in this workflow | NOT VERIFIED |
| Root `README.md` | Not found on inspected main | NOT VERIFIED |

The inspected GitHub query returned 16 open PRs: #375, #374, #373, #372, #371, #370, #369, #368, #367, #366, #365, #364, #363, #359, #358, and #2. Re-fetch every PR's current head SHA before review, merge, or release.

### Exact open PR heads — 2026-11-14

All entries below were re-fetched from GitHub's PR update response; all remain **OPEN / DRAFT**. These are the exact heads to use for review at this checkpoint.

| PR | Head SHA | Review disposition |
|---:|---|---|
| #375 | `310f480266e0001b4eab9b8c79152917e2bd2d1e` | Handoff evidence updated; documentation review |
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Safe hygiene candidate; reconcile package/lockfile with #372 |
| #373 | `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca` | Ruqyah fix; Preview READY; CI BLOCKED |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun CI workflow; runner issue unresolved |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Standalone archive codec; integration/resource bounds required |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Memorization session UX; independent review |
| #369 | `814bb8788449ebe3d07d46f00a596a1a7b398a5a` | Multi-range selection; exact-head CI required |
| #368 | `ffa55b1f9c378a5f50fa4eb3656c1aadf4a27710` | Unified offline store/downloader; cross-tab and lifecycle gaps |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | 800 KB payload budget; not a chunking solution |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/offline shell; device verification required |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah prototype; no publishable content |
| #364 | `ad33875b0304020f930c7b606ef8782d36148707` | Advisor history-boundary fix; Preview READY; CI BLOCKED |
| #363 | `3f6f2bd53ad906af05a65ef7fa76adf31a49fd57` | Documentation consolidation; original Work Log restored |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Superseded standalone manifest; do not merge beside #368 |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Superseded standalone job store; do not merge beside #368 |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy broad UI/UX baseline; do not merge as a unit |

Re-fetch the head before any merge because these values can move after this checkpoint.


## 2. Current feature-branch checkpoints

### Ruqyah — PR #373

Latest verified feature commit: `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca`.

- Per-Surah Quran lazy loading; no static dependency on the complete Quran corpus from the Ruqyah route.
- Retry and online/offline UI for failed local Quran chunk loads.
- Whole-Surah provider locators are accepted only when the exact Arabic/English Surah name and number match local `ALL_SURAHS` metadata. The server emits normalized coordinates and strips provider-authored Quran text/translation.
- Long-program dataset: 171 entries; the one bare-Surah locator `الأعلى ٨٧` resolves to local `87:1-19`.
- Targeted isolated evidence: 20 API proxy tests + 14 Ruqyah view/audio-lock tests PASS; full 171-entry handler fixture PASS.
- Vercel Preview deployment `5PDvHdHztx9Tf6yLR2ojQww2nhs1`: READY. The corresponding build generated 114 Surah chunks and validated 6,236 ayah coordinates. Ruqyah route chunk observed at 68.25 KB (18.77 KB gzip).
- Production API smoke before the fix: short 200/9 entries, medium 200/63 entries, long 502 `INVALID_RUQYAH_SOURCE_RESPONSE`. The fix is not on Production until safely merged and deployed.
- Preview browser verification is BLOCKED by Deployment Protection; no protection setting was changed.

### Advisor — PR #364

Latest verified feature commit: `ad33875b0304020f930c7b606ef8782d36148707`.

Client-supplied history sender labels are discarded before prompt construction. Every previous message is framed as untrusted user-provided context, preventing a client from impersonating an authenticated assistant message. Five targeted source assertions PASS. Preview deployment `13RYRdPik7XUUEHk856JMfbn6j99` is READY. Full security suite and browser verification remain NOT VERIFIED.

### Plans and memorization — PRs #367, #369, #371

- #369: multi-Surah/Juz/custom-range selection and overlap normalization reviewed; merge remains blocked pending exact-head CI and regression gates.
- #371: lossless archive codec and SHA-256 integrity tests; six isolated codec tests PASS. The codec is not integrated into actual Outbox/Inbox/Firestore persistence.
- #367: aligns a single-payload limit at 800 KB. This is interim sizing, not chunked archive transport. Do not merge as a complete archive solution.
- Before integration: add bounded manifest/resource validation, chunk persistence and retrieval, atomic manifest publication, backward-compatible reads, corruption recovery, migration/rollback evidence, and multi-client emulator tests.

### Offline/PWA — PRs #358, #359, #366, #368

#368 contains IndexedDB job tracking, a downloader, and Cache Storage persistence. Review found missing cross-tab job ownership/locking, incomplete end-to-end orphan cleanup, and inconsistent Cache Storage quota handling. User-facing download management/playback integration and real-device restart/airplane-mode verification are not complete. Do not merge #358/#359 as competing stores alongside #368. Review #366's versioned service-worker caches with the unified store.

### Seerah — PR #365

The reader is a navigation/UI prototype with draft-only placeholder scenes. It contains no publishable historical narrative. Source reliability, edition-level rights, claim verification, and editorial approval remain NOT VERIFIED. Do not publish historical content from the prototype.

## 3. CI and test evidence

GitHub Actions currently has a repeated runner/log-observability failure pattern:

- PR #373 run `43568676649`: failed job with `steps=null` and `logs_url=null`; rerun failed in the same pre-step state.
- PR #364 run `43569132395`: failed job with `steps=null` and `logs_url=null`.
- PR #363 current observed run `43033433173`: failed job with `steps=null` and `logs_url=null`.

These results do not establish that application tests failed. They also do not establish a pass. Do not disable tests or merge without an inspectable successful exact-head Quality Gate.

Targeted isolated tests are not GitHub CI and not the full repository suite. No full repository test-suite pass is claimed.

## 4. Firebase and sync safety — critical

Repository Firebase client configuration identifies project `wird-quran-app`. Repository Firestore rules were inspected; no Firebase project, rules, production database, or user data was changed.

Vercel Production environment metadata confirms both flags are currently `true`:

- `VITE_WIRD_REVISIONED_SYNC_ENABLED`
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED`

This contradicts the required policy that remote sync remain disabled until release gates are verified. No production setting was changed. Explicit owner authorization is required before disabling either flag. Do not perform sync-related production actions while this discrepancy remains unresolved.

`ISLAMICAPI_API_KEY` exists in Preview and Production; its value was not read or disclosed.

## 5. Vercel runtime observations

- Production deployment is READY on the exact main SHA.
- The inspected 24-hour runtime-error query returned no errors; the inspected 30-minute Ruqyah log query returned no matching logs.
- Absence of recent logs is not proof that a historical failure is fixed.
- Production post-fix Long-index verification remains NOT VERIFIED because the fix is still on PR #373.

## 6. Current release blockers

1. Production sync flags are true; explicit owner approval is required before any change.
2. GitHub Actions jobs fail before recording steps/logs; no exact-head Quality Gate pass.
3. Ruqyah Long-index fix is feature-branch only; Production still needs gated merge/deployment and post-deploy smoke.
4. Engine Plan chunk codec is not integrated into actual persistence/transport.
5. Offline audio lacks cross-tab ownership, complete cleanup/quota handling, and device recovery verification.
6. Seerah has no verified/publishable historical content.
7. Full repository tests, real-device offline behavior, preview browser verification, and post-fix production verification remain NOT VERIFIED.

## 7. Authoritative documentation

- Engineering index: [README.md](./README.md)
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Release gates: [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
- Append-only history: [WORK_LOG.md](./WORK_LOG.md)
- Sync architecture: [../sync/ARCHITECTURE.md](../sync/ARCHITECTURE.md)
- Sync state machine: [../sync/STATE-MACHINE.md](../sync/STATE-MACHINE.md)
- Sync release gates: [../sync/RELEASE-GATES.md](../sync/RELEASE-GATES.md)
- Sync test matrix: [../sync/TEST-MATRIX.md](../sync/TEST-MATRIX.md)
- Current continuation queue: [../CONTINUE_HERE.md](../CONTINUE_HERE.md)
- Unified roadmap: [../DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md)

## 8. Release decision

**Current overall status: BLOCKED.**

Do not merge a PR or enable/alter Production sync based on this document alone. Require exact-head CI evidence, appropriate preview verification, and explicit approval for restricted Production changes.
