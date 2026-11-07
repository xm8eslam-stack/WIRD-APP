# WIRD Ruqyah — Sunni Source and Content Policy

Last reviewed: 2026-11-07

## Non-negotiable rule

WIRD must not publish a religious text, recitation, explanation, ruling, or treatment claim merely because it appears in an API, repository, app, social post, or search result.

A source is eligible only after its exact content, attribution, evidence, grading, and usage rights have been reviewed. When the evidence is unclear or disputed, omit the material until qualified review is complete. Do not present this software as a mufti or a medical diagnostic tool.

## Allowed source hierarchy

1. **Quran:** display Arabic text only from WIRD's verified canonical Quran corpus (`src/data/verifiedAyahs`). Any external API may at most provide a chapter/ayah locator. The external Arabic string is never rendered as Quran text.
2. **Hadith:** prefer the primary recognized Sunni hadith collections. For grading or disputed reports, show the named hadith scholar and exact grading, with a traceable reference. Use the Dorar Hadith Encyclopedia as an index to locate the primary narration and named grading; Dorar itself is not a substitute for identifying the hadith scholar.
3. **Fiqh/adab/health guidance:** include only after review against a named, recognized Sunni scholar/institution or authoritative medical guidance, with clear attribution. Otherwise omit.
4. **Audio:** only publish a recording after verifying the reciter identity, the actual audio contents against the canonical text, the recording host/provenance, and the usage permissions. A filename, API catalogue, or reciter name is not verification.

## Current content references checked

- Al-Fatihah as Ruqyah: Sahih al-Bukhari 5736; Dorar record: https://dorar.net/hadith/sharh/11309
- Ruqyah must be free of shirk: Sahih Muslim 2200; Dorar record: https://dorar.net/h/03Vvfh7h
- Ruqyah wording from Jibril: Sahih Muslim 2186; Dorar record: https://dorar.net/hadith/sharh/17903
- Healing supplication: Sahih al-Bukhari 5750; Dorar record: https://dorar.net/hadith/sharh/2293
- Seeking refuge for al-Hasan and al-Husayn: Sahih al-Bukhari 3371; Dorar record: https://dorar.net/h/mfzXHm4C
- Morning/evening remembrance "Bismillah alladhi la yadurru": Sunan Abi Dawud 5088, graded Sahih by al-Albani; Dorar record: https://dorar.net/h/0nQmCpgK
- The three protective surahs morning/evening: Sunan Abi Dawud 5082, graded Hasan by al-Albani; Dorar record: https://dorar.net/h/xgBR2fIt
- Pain supplication: Sahih Muslim 2202; Dorar record: https://dorar.net/hadith/sharh/64180
- Ayat al-Kursi before sleep: Sahih al-Bukhari 2311 is cited as a suspended narration (mu'allaq) in the Bukhari placement; Dorar notes connected routes in al-Nasa'i and Ibn Khuzaymah: https://dorar.net/hadith/sharh/1766
- Combining Ruqyah and medical treatment: Shaykh Ibn Baz, *هل يترك العلاج ويكتفى بالتوكل على الله؟* — the fatwa states that combining treatment and supplication is better and that taking medical means is legislated: https://binbaz.org.sa/fatwas/16834/هل-يترك-العلاج-ويكتفى-بالتوكل-على-الله

Quran text and verse ranges remain checked against WIRD's canonical corpus. The Quran passages selected for general recitation are not represented as fixed-count prescriptions unless a sound narration explicitly establishes a count.

## Explicitly blocked sources/features

- IslamicAPI's `from-sunnah` content is not rendered or proxied. Its category endpoint is also blocked. The API is only a Quran locator/index; the server validates coordinates and returns only an item ID plus normalized numeric coordinates. All provider-authored titles, Arabic, references, introductions, translations, and category labels are stripped before reaching the browser. WIRD renders only canonical Quran text and local surah metadata.
- IslamicAPI educational topic and category endpoints are hard-disabled in the server proxy, with no environment-variable override. Do not reintroduce them until each article is curated from a named, reviewed Sunni source and protected by source-registry tests.
- IslamicAPI full-program recordings are not playable. Their reciter, complete contents, and source/rights chain have not been independently verified.
- Al Furqan's dynamic reciter catalogue/audio endpoint is not used. The public audio proxy returns `503 QURAN_AUDIO_SOURCE_NOT_VERIFIED`, and the URL builder fails closed.
- The full-program audio tab and individual verse audio controls remain visibly disabled until a verified provider and exact recitation assets are approved.
- Unreviewed optional content without an adequate evidence trail has been removed from the core content list.

## Implementation safeguards

- Backend allowlist accepts only `from-quran` for IslamicAPI instant content.
- API response Quran strings are never displayed; WIRD resolves the returned surah/ayah reference into `VERIFIED_AYAHS`.
- Tests assert third-party Sunnah text is rejected before upstream access.
- Tests assert unreviewed category indexes are blocked and every provider-authored field is stripped from the Quran locator response.
- Tests assert full-program audio has no playable URL.
- Tests assert unverified reciter catalogue/audio requests fail closed.
- No external source should be added to user-visible content without a matching test and a source record in this document.

## Review workflow for any future addition

1. Identify the primary source and exact reference.
2. Verify the Arabic text character-by-character against the primary collection or canonical Quran.
3. Record the narrator, collection, number, and named grading scholar where applicable.
4. Check the ruling/interpretation with a recognized Sunni scholar or institution; do not derive rulings from an API summary.
5. Check content rights and attribution separately from religious authenticity.
6. Add a regression test that prevents unreviewed content from entering the user interface and add the exact approved reference to the source allowlist.
7. Only then enable the content through a reviewed pull request.
