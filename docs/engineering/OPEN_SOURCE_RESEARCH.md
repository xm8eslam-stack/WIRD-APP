# WIRD — Open-Source Engineering Research

> Reviewed: 2026-11-05
> Scope: Quran reader, memorization practice, review scheduling, architecture, and cross-device sync.
> Policy: Research and design inspiration only. No third-party code, Quran text, audio, fonts, or tafsir were copied into WIRD during this review.

## Executive decisions

1. Keep WIRD's existing React + TypeScript + Vite architecture and canonical Tanzil Quran data.
2. Improve the current app through narrow, tested domain/service additions; do not port another application's framework or architecture.
3. Use a user-UID-scoped cloud persistence adapter for WIRD's requested account-based sync. The opt-in recovery-phrase / zero-PII design below is an interesting alternative, but does not match the requested "sync after login" flow without changing the identity model.
4. Treat Quran content and software licenses separately. A permissive software license does not grant rights to third-party Quran data, audio, translations, fonts, or tafsir.
5. Do not copy from projects with no verifiable license file. AGPL code reuse needs a separate legal decision and is not recommended for this project.

## Projects reviewed

| Project | Verified software license | Useful engineering ideas | WIRD decision |
|---|---|---|---|
| [voidwave/Quran](https://github.com/voidwave/Quran) | Apache-2.0 LICENSE file inspected | Arabic-first RTL reader, Uthmani reading, audio by ayah, continuous playback, search, lazy-loaded tafsir, hifz reveal workflow, resumable offline downloads. Its memorization core separates pure word-alignment logic from microphone/DOM/network adapters. | Strong reference for Quran reader and recitation UX. Re-implement patterns independently; never reuse its text/audio without separately checking source terms. No code copied. |
| [UmmahLibrary/ummah-library](https://github.com/UmmahLibrary/ummah-library) | AGPL-3.0 LICENSE file inspected | Modular monolith, pure domain core with ports/adapters, explicit architecture decision records, local-first data, sync protocol, conflict resolution, incremental sync, and extensive sync tests. ADR 0033 uses per-key HLC/LWW; ADR 0034 upgrades maps/sets to element-level merge; ADR 0035 adds version cursors, bounded dirty push, and atomic merge. | Best architecture research reference for sync and data boundaries. AGPL-3.0 creates network-copyleft obligations if code is reused; do not copy or import its implementation. Adapt only high-level design lessons to WIRD's Firebase-authenticated model. |
| [theilgaz/mahfuz](https://github.com/theilgaz/mahfuz) | No repository LICENSE file found in the inspected tree | Mature monorepo organization, separated memorization package, due-card prioritization, typed sync stores, per-field timestamps, reading-position and bookmark synchronization. | Useful to inspect as a feature/architecture reference only. No code reuse absent a verifiable license. |
| [zaidlh/quran-multi-lang-app](https://github.com/zaidlh/quran-multi-lang-app) | MIT LICENSE file inspected | Broad Quran product surface, RTL/PWA, search, bookmarks, recitation playback, study tools, and cross-platform API architecture. | Potential source for independently implemented UI/product patterns. If any code is later copied, preserve MIT notice and separately verify licenses of assets/data. No code copied. |
| [hadealahmad/MonthlyQuran](https://github.com/hadealahmad/MonthlyQuran) | No LICENSE file found in the inspected tree | Seven-station spaced review schedule and documented storage/sync architecture. | Compare algorithm assumptions against WIRD's existing SM-2-like retention engine; do not transplant code without a license. |
| [abdulrahman1s/quran-memo](https://github.com/abdulrahman1s/quran-memo) | README states no software license is specified | Lightweight looping, audio quizzes, word highlighting, offline caching, and clear data-source attribution. | UX reference only; no code reuse. |
| [hunain-malik/hifz-ai](https://github.com/hunain-malik/hifz-ai) | Not independently verified in this pass | Browser-native speech recognition, Arabic-normalized word alignment, and recitation feedback. | Use only as a research lead. Any speech-derived result must be labelled assistive/uncertain, never a Tajweed or recitation certification. |

## Architecture lessons applicable to WIRD

### Domain logic and adapters
- Keep Quran coordinate validation, progress calculations, retention scheduling, and merge policy deterministic and independently testable.
- Keep Firebase reads/writes, local persistence, auth lifecycle, audio, and browser APIs behind service/adapter boundaries.
- Avoid making React components responsible for conflict resolution or persistence semantics.
- Avoid a wholesale monorepo rewrite; apply these boundaries incrementally around the existing services.

### Synchronization lessons
- Whole-document last-write-wins is unsafe for arrays/maps of plans, portions, logs, and revision records: one device can overwrite unrelated edits from another.
- Prefer stable document identities and per-record writes for collections, with explicit tombstones for deletion where needed.
- Keep a schema version and migration marker. Validate incoming documents before applying them to local state.
- Make merge policy deterministic and test simultaneous edits, stale devices, retries, offline queues, duplicate writes, and account switching.
- Large datasets need bounded writes and incremental change tracking; avoid uploading the full user dataset on every save.
- WIRD can use Firebase Auth UID as the account boundary and Firestore Security Rules as enforcement, while keeping local-first behavior for guests/offline use. This differs from Ummah Library's anonymous recovery-phrase E2EE design.
- The sync implementation must never assume the client-supplied UID is trustworthy; Firestore rules must bind the path UID to `request.auth.uid`.

### Memorization and review lessons
- A due queue should be pure, time-injected, and sorted by due date/overdue amount.
- Keep one canonical identity for each memorized passage/ayah range. Duplicate or overlapping records must not inflate progress metrics.
- Separate "memorization completion" from "review completion" so review never creates new memorized progress.
- Track weak verses as explicit records with stable coordinate IDs and preserve review history.
- Speech recognition is best-effort assistance; it must not be described as proof of correct recitation or Tajweed.

### Reader and audio lessons
- Keep canonical Quran text local and lazily loaded by Surah; never make reading depend on an AI service.
- Separate audio transport/player state from Quran text and memorization progress.
- Preserve the selected Surah/ayah/page when switching reader modes.
- Add offline audio caching only with bounded quotas, explicit storage controls, and source-license checks.

## Next implementation candidates

1. Review Phase 5's current reader and hifz UX against the reference patterns; retain WIRD's own design and verified data.
2. Implement a UID-scoped Firestore adapter and security rules only after finalizing the local-to-cloud migration policy.
3. Add emulator-backed rules tests and deterministic multi-device merge tests before production use.
4. Improve due-review prioritization only where WIRD's current retention engine tests demonstrate a measurable gap.
5. Keep voice recognition optional and clearly labelled as approximate assistance.

## Sources inspected

- voidwave/Quran README and LICENSE; hifz memorization core.
- Ummah Library README, ARCHITECTURE.md, LICENSE, ADR 0033, ADR 0034, ADR 0035, pure Hifz scheduler, and sync store.
- Mahfuz README, repository tree, sync-service.ts, and memorization scheduling module; no LICENSE file was found in the inspected tree.
- Quran Multi-Language App README and LICENSE.
- MonthlyQuran README and repository tree; no LICENSE file was found in the inspected tree.
- Quran Memo README; it states no software license is specified.

