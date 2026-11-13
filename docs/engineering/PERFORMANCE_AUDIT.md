# WIRD — Performance Audit
## 2026-11-13 source and build evidence

### Confirmed Quran-corpus bundle duplication

The current production baseline is `main` at `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.

Source chain:
1. `src/components/ruqyah/RuqyahView.tsx` statically imports `getRuqyahAudioQueue`, `getRuqyahDisplayText`, and `getRuqyahAyahs` from `src/services/ruqyahContentService.ts`.
2. `src/services/ruqyahContentService.ts` statically imports `VERIFIED_AYAHS` from `src/data/verifiedAyahs.ts`.
3. `src/data/verifiedAyahs.ts` statically imports `src/data/completeQuranData.json`.
4. The repository tree reports `completeQuranData.json` at 2,513,293 bytes.
5. The existing `src/data/quranDataLoader.ts` already provides `loadSurahVerses(surahNumber)` backed by `import.meta.glob('./quran-surahs/*.json')`, with per-Surah lazy chunks.

The latest docs-only Vercel Preview build from the same main-derived runtime emitted:
- `dist/assets/RuqyahView-*.js`: 1,997.87 kB minified, 355.98 kB gzip.
- Vite warned that one or more chunks exceed the 650 kB configured warning threshold.

This is direct evidence that the Ruqyah route's static import chain pulls the complete canonical Quran JSON into its route chunk despite the existing per-Surah lazy loader. The route is lazy at the app level, but its own first-load payload is unnecessarily large.

### Safe remediation design

1. Refactor `ruqyahContentService` to resolve canonical text through `loadSurahVerses(surahNumber)` asynchronously; preserve exact coordinate, length, and non-empty text validation.
2. Update every Ruqyah view/API-library call site to await the requested Surah chunks. Avoid preloading all 114 Surahs when the selected Ruqyah items reference only a small subset.
3. Keep Quran display text sourced exclusively from WIRD's bundled verified corpus. Do not substitute provider-returned verse text or generate Quran text.
4. Keep audio queue coordinates derived from validated local Surah/ayah records and the approved reciter URL builder.
5. Add tests proving the Ruqyah service does not statically import `verifiedAyahs` / `completeQuranData.json`, each referenced Surah loads on demand, corrupted/missing chunks fail closed, and all brief/medium/long categories resolve their complete expected ayah ranges.
6. Rebuild and compare emitted chunk sizes; verify the Ruqyah chunk no longer contains the full 2.5 MB JSON source. Do not silence the warning by increasing `chunkSizeWarningLimit`.

### Scope and safety

This is a source-level performance finding and remediation plan only. No runtime code was changed in this audit. No Quran corpus, text, tafsir, audio provider, Firestore data, IndexedDB schema, production setting, or user data was modified. Implement the refactor on a separate code branch with exact-head tests and Preview verification before considering merge.
