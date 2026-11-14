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
| #375 | `self-updating handoff branch; re-fetch before action` | Handoff; latest exact-head CI retry failed before steps/logs |
| #374 | `6673bb149a2ffa58177c35b9f68c76423dfb2a0b` | Safe hygiene candidate; reconcile package/lockfile with #372 |
| #373 | `d93ede79b9f8ca093bd5a8a702a00b31d415c9ca` | Ruqyah fix; Preview READY; CI BLOCKED |
| #372 | `950640ea78d29e87d426a89d8887c15e4de2abac` | Bun CI workflow; runner issue unresolved |
| #371 | `260df95c620cd534337e39d6707b044eb404139a` | Standalone archive codec; integration/resource bounds required |
| #370 | `32bad0846b9f9a64b8ac1b78c292ea1f1c603e0c` | Memorization session UX; independent review |
| #369 | `3478ae22a200a817a240d8b28e532b01674427bf` | Multi-range selection; Juz 30 endpoint fixed; 7 isolated tests PASS; CI BLOCKED |
| #368 | `d0ab926f37ea68a92c28e39796dd3d723e1dd7a8` | Unified offline store; 29 isolated tests PASS; exact-head Preview READY; CI BLOCKED; cross-tab/lifecycle gaps |
| #367 | `fd417faaa96a11920ef3a8e4f1038f567c36a731` | 800 KB payload budget; not a chunking solution |
| #366 | `cade1b630bb429d6a4106de5bf12713df18f3491` | PWA/offline shell; device verification required |
| #365 | `adc1ef01b7a0c5eb7e280395520108c94788af5d` | Seerah prototype; no publishable content |
| #364 | `2a98c6da77bd849811326696ab7075fe6c9c85b8` | Advisor history-boundary + UTF-8 byte limit; 6 assertions PASS; latest Preview blocked |
| #363 | `3f6f2bd53ad906af05a65ef7fa76adf31a49fd57` | Documentation consolidation; original Work Log restored |
| #359 | `7d31af20fe9cdc69aee4855acaf02e278fbf8b70` | Superseded standalone manifest; do not merge beside #368 |
| #358 | `4970b87d6ba712d3899093f4e8dd297bef17985e` | Superseded standalone job store; do not merge beside #368 |
| #2 | `9e6d7a119c26ca7f37e69c21dbf7b934b016ad0d` | Legacy broad UI/UX baseline; do not merge as a unit |

PR #363 and PR #375 are self-updating documentation branches; their head SHAs change when their own files are amended and are intentionally not pinned in this table. Re-fetch their live heads before every action. All 16 PRs remain OPEN / DRAFT at the latest inventory. #2 is not mergeable. Re-fetch every exact head before merge because values can move.


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

- #369: multi-Surah/Juz/custom-range selection and overlap normalization; latest head `3478ae22a200a817a240d8b28e532b01674427bf` fixes the Juz 30 terminal coordinate to 114:6. The PR branch documentation reports seven isolated range tests PASS, but this session did not independently execute them. Exact-head Quality Gate run `43570929405` / job `132374935104` failed before steps/logs; generated-index E2E remains NOT VERIFIED.
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


### Documentation Preview note — 2026-11-14

The current PR #363 exact-head Vercel status is **FAIL** with `build-rate-limit` (upgrade prompt). This is a deployment quota/service limit, not an observed application build error. GitHub Actions run `43570490266` also failed before job steps/logs were recorded. Do not classify either as a code-test failure or a pass.


## 2026-11-14 CI and Production re-check (09:00 local)

- PR #375 exact head: `495b9ccada1bb327abeee469af16faa52ddc9707`. Its Quality Gate run `43570354110` was retried using GitHub's failed-job rerun operation. Latest attempt job `132373650377` again completed `failure` with `steps=null` and `logs_url=null`. This remains **BLOCKED** at runner/job initialization; it is not evidence of an application test failure or a pass.
- Other exact-head Quality Gate runs checked: #373 run `43568676649`, #363 run `43570268180`, #372 run `43391729769`. Each returned one failed job with `steps=null` and `logs_url=null`.
- Production deployment history re-fetched from Vercel: latest Production deployment `dpl_DKfbfqsBHqzS95CoTdYZCtPPPZwu` is READY on main SHA `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`. This confirms deployment identity/readiness only; it does not certify the current feature PRs or live Ruqyah behavior.
- Vercel Production variables were listed without decrypting secrets. `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` and `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` remain present in Production. This violates the disabled-until-release-gates policy. No values or project settings were changed; explicit owner approval is required before any change.
- `ISLAMICAPI_API_KEY` exists as a sensitive Production variable; its value was not read or exposed.


### Additional exact CI evidence — PRs #358 and #359

The last recorded runs for #358 (`43030195498`) and #359 (`43029617572`) did execute. Dependency installation, automated test suites, Firestore Rules Emulator, TypeScript validation, production build, and server-startup smoke all passed. The Desktop and mobile browser smoke step failed on both runs. GitHub returned no stored job log URL, so the underlying Playwright assertion/error is unavailable. This is an observed browser-test failure, not merely a pre-step runner failure. Both PRs are superseded by #368 and must not be merged as competing stores.

The newer exact-head PR runs #373, #374, #363, #364, #365, #366, #367, #368, #369, #370, #371, #372, and #375 failed before steps/logs were recorded (`steps=null`, `logs_url=null`). PR #373's safe retry repeated that pre-step failure. These runs do not establish application test outcomes.


### CI log retrieval follow-up

For #375's latest retry job `132373650377` and its prior attempt job `132368486361`, the dedicated step endpoint returned an empty list and the log endpoint returned Azure `BlobNotFound` 404. This corroborates the missing step/log telemetry; it does not reveal a failing command. The exact current heads of #363 and #375 are intentionally marked self-updating above because documentation commits advance those PRs; always fetch them live before acting.


## 4. Shared-file conflict map — re-fetched 2026-11-14

These are path-level overlaps from the current PR changed-file lists, not assumptions based on PR titles.

| PR group | Shared paths | Safe integration order |
|---|---|---|
| #367 + #369 | `src/components/plans/PlanningEngineWizard.tsx`, `src/tests/runAllTests.ts` | Serialize UI changes; merge only after combined range/sync tests are run on one integrated head |
| #367 + #371 + #369 + #368 | `src/tests/runAllTests.ts` | Reconcile test registration once; preserve every suite, avoid duplicate imports/runner entries |
| #368 + #358 + #359 | `src/tests/runAllTests.ts` | Keep #368 as the unified store candidate; #358/#359 remain superseded and must not introduce competing stores |
| #372 + #374 | `package.json`, `bun.lock` | Resolve lockfile/package graph together; never merge one stale lockfile over the other |
| #363 + #374 | `docs/engineering/README.md` | Reconcile the hygiene audit/index changes with the canonical docs index; preserve canonical links |
| #366 + #368 | No changed-path overlap in the current PR file lists | Still requires semantic integration review: service-worker cache versioning must agree with Cache Storage ownership and lifecycle |

Additional notes:
- #374 also changes one temporary AI Studio media artifact under `.aistudio/artifacts/brain/.../.tempmediaStorage/`; verify it is truly generated/unreferenced before accepting its deletion. Do not delete any user-authored project content based only on the filename.
- #365 has no publishable source text, so its reader shell remains a content-governance blocker rather than a release-ready feature.
- The current path list is not a semantic proof of independence. Re-review diffs after any branch advances.


### #374 hygiene PR integration detail

#374's new `docs/engineering/README.md` currently points readers to `progress/WORK_LOG.md` as the active history, while #363 establishes `docs/engineering/WORK_LOG.md` as canonical and retains the old path only as a pointer. Reconcile the README before either docs PR is merged; do not merge contradictory source-of-truth instructions.

#374's `package.json` and `bun.lock` changes only rename the scaffold package to `wird-app`, but the same files are also changed by #372's Bun dependency-graph migration. Integrate the name correction into the final #372 graph or rebase/reconcile both exact diffs together. Do not merge stale lockfile snapshots independently.


### #371 archive codec — deeper resource-bound review

The pure codec correctly canonicalizes JSON, uses SHA-256, splits individual records into bounded byte chunks, rejects missing/extra/corrupted fragments, and reconstructs in stable record order. Its six isolated tests are useful, but the current implementation is not yet safe as a persistence protocol for arbitrarily large archives:

1. No hard maximum for total archive bytes, record count, total chunk count, or maximum fragments per record. A caller can supply enough records or a huge record to allocate an unbounded `chunks` array.
2. The builder retains every fragment in memory and separately builds a full archive fingerprint payload; the decoder allocates all record fragments plus a concatenated record buffer. This multiplies peak memory for large archives.
3. The manifest contains every chunk descriptor and every record ID in one object, with no encoded manifest byte ceiling. Even if each data chunk is 192 KB, the manifest itself can exceed Firestore's document limit.
4. `validateManifest` verifies descriptor field shapes, but the complete fragment sequence/aggregate size checks occur later during materialization. A bounded preflight validator should reject excessive descriptor counts and aggregate declared bytes before reading chunk data.
5. `manifest.orderedRecordIds.includes()` is repeated for each descriptor; use a bounded ID set after enforcing a maximum record count.
6. No storage adapter, IndexedDB migration, remote chunk writer/reader, atomic manifest publication, garbage-collection protocol, or rollback/recovery path is integrated. A codec-only merge would not fix the 800 KB single-document sync bottleneck.

Required before merge: define product-independent protocol maxima and negotiated server-enforced entitlement separately; validate total archive bytes/records/chunks/manifest bytes before allocation; avoid whole-archive duplicate buffers or use streaming digest/materialization; integrate immutable chunk records with atomic revisioned manifest publication and CAS; retain old archive until new manifest is verified; implement rollback and orphan collection; add adversarial resource-exhaustion and old/new archive compatibility tests. Do not silently discard an archive when any limit is reached.
