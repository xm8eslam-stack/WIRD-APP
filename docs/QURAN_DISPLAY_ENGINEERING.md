# Quran display engineering audit and staged design

## Current renderer map (2026-11-08)

| Surface | Text source / composition | Font and direction | Ayah, audio, and tafsir linkage |
|---|---|---|---|
| Mushaf page (`QuranMushafReader`) | Local `completeQuranData.json` split into per-surah chunks; `QURAN_PAGE_INDEX` selects ayah ranges, then React inserts natural-flow buttons, surah banners, basmala, and audio buttons. It is a 604-page navigation index, not printed page line data. | Google Fonts Amiri, RTL inherited from document; no page glyph font. | Each button keeps `number/surahNumber/numberInSurah`; audio queue uses sorted ayahs; selection opens `TafsirSheet`. |
| Library study view (`QuranLibraryView`) | Same local ayah records, rendered one article per ayah. | Amiri; RTL inherited; `tracking-wide` was applied to the Quran paragraph and has been removed. | Audio, tafsir, copy, and session actions use the selected ayah coordinate. |
| Memorization/revision session (`MemorizationSessionView`) | Same local ayah record. Word-masking splits only at whitespace into clickable word spans; this preserves each word's internal code point sequence but changes word spacing/layout. | Amiri; RTL inherited. | Audio and `SessionTafsirPanel` use `currentAyah`; repeat and playback rate are separate preferences. |
| Tafsir (`TafsirSheet`, `SessionTafsirPanel`) | Canonical ayah text plus provider tafsir text. | Amiri; RTL inherited. | Tafsir request uses surah and ayah; related hadith follows the same coordinate. |
| Dashboard, revision weak-ayah cards, ruqyah, memorization tests, advisor | Mostly local `Ayah.text`; ruqyah resolver replaces untrusted provider Quran strings with canonical local data. Test prompts and summaries interpolate canonical strings. | Mostly `.font-quran` (Amiri); several have their own font size/line-height. | Identity varies by surface; links are generally coordinate-driven. These remain migration targets for the shared display primitive.

## Verified facts and root-cause assessment

- Canonical stored data is Tanzil `quran-uthmani`, Hafs, with a separately checked-in reference corpus. Existing test `Independent Tanzil Character-by-Character Verification` compares text and metadata exactly; the full suite passed 584/584 before this change.
- Surah 41, ayah 7 is stored exactly as `ٱلَّذِينَ لَا يُؤْتُونَ ٱلزَّكَوٰةَ وَهُم بِٱلْءَاخِرَةِ هُمْ كَٰفِرُونَ`. The suspicious sequence includes U+0621 HAMZA followed by U+0627 ALEF after U+0642 SUKUN in `ٱلْءَاخِرَةِ`; it is not safe to rewrite as a Unicode cleanup. The quoted malformed example is not the stored verse string.
- `index.html` loads Google Fonts Amiri and Cairo only. `.font-quran` names Amiri before `Amiri Quran`, but the latter is not actually loaded. Amiri is a literary Naskh typeface, not a page-specific Madinah Mushaf face.
- Quran body text had `tracking-wide` on the study view; letter-spacing on connected Arabic can degrade joining/mark placement. The shared `.quran-text` primitive now isolates RTL direction and restores normal letter/word spacing while leaving canonical text byte-for-byte unchanged. This is a likely contributing renderer defect, not proof of the exact historical screenshot/root cause.
- The current reader's page ranges establish page/ayah navigation only. Natural browser wrapping, inserted controls, banners, and extra basmala cannot preserve the 15 printed lines or exact page composition.

## Source and font comparison

| Option | Best fit | Evidence / constraint | Decision |
|---|---|---|---|
| Amiri | Connected Arabic text; OFL font | Upstream Amiri project describes a Naskh typeface and publishes it under SIL OFL 1.1. Amiri Quran is a separately built subset/configuration, not currently loaded by the app. | Acceptable fallback; not claim of page-faithful rendering. |
| Amiri Quran | Quran typesetting with Amiri-specific feature settings | Upstream build documents `AmiriQuranColored` as a tailored subset with defaults/features intended for Quran typesetting. Asset/version and webfont availability must be pinned and validated before adoption. | Evaluate in typography lab, do not silently alias to Amiri. |
| Uthmanic Hafs / QPC Hafs | Unicode ayah/connected reading | Quran Foundation documents a compatible Unicode font and recommends it for simple Unicode rendering. A compatible source string is required; the current Tanzil string must not be assumed equivalent to QPC text without exact comparison. | Preferred candidate for connected view after provenance/coverage and visual regression tests. |
| QCF V2 | Exact 604-page glyph-based Madinah Mushaf | Quran Foundation documents page-specific glyph fonts (one per page), `code_v2`, page number and a 15-line page layout. The repo currently has none of `code_v2`, word records, line numbers, or per-page font assets. | Target for paper-like mode only after a licensed, versioned static dataset is obtained and validated. Do not fake it with natural wrapping. |
| KFGQPC official data | Official Unicode and layout-oriented resources | Official King Fahd Quran Complex platform describes Unicode Uthmanic text for ayah display and publishes richer page/line metadata; its Unicode font alone does not reproduce an entire printed page. | Evaluate as an authoritative layout/data candidate; verify downloadable package terms before bundling. |

Tanzil text is to remain verbatim and attributed under its published CC BY 3.0 terms. Quran Foundation's renderer documentation says production API calls require server-issued client credentials; this phase does not add an API, credentials, or new Quran content endpoint. Reuse OSS as reference only; check each asset's license independently before vendoring.

## Staged target architecture

1. **Canonical data:** immutable Tanzil ayah text and verified coordinate metadata; no UI normalization or OCR. Add independent reference regression tests for text and stable coordinates.
2. **Connected text renderer:** one small `QuranText` primitive for lang/dir/isolation/Arabic spacing and predictable wrapping; word masking may segment only at complete whitespace-delimited words.
3. **Reading mode:** continuous selectable ayahs, coordinate-driven audio/tafsir/actions, remembered position, and explicit page jump.
4. **Paper Mushaf mode:** per-page QCF V2 renderer only when a verified line/word/glyph dataset and licensed 604 fonts are locally available; otherwise disclose the existing reflow mode instead of representing it as a facsimile. Ayah hit regions must come from validated word/line geometry or be omitted.
5. **Shared interaction:** one coordinate-based action controller for playback, tafsir, bookmark, range selection, memorization, and review; adapt to a compact mobile sheet and desktop panel.
6. **Rollout gates:** exact source match; all-page layout/coordinate completeness; per-font glyph coverage; browser screenshots for hamza, high marks, waqf, joining and fallback; keyboard, touch and screen-reader checks; then staged rollout.

## Current phase scope and known limits

This phase introduces the non-mutating shared text primitive and typography regression checks for the demonstrated edge case. It does not yet replace all Quran text surfaces, supply QCF page assets, create page-accurate hit regions, or claim visual verification on Safari/iOS/Android. Those require a separately verified asset package and browser/device QA. Existing cloud sync, production secrets, Firebase settings, and deployment configuration remain untouched.
