# WIRD Ruqyah integrations

## External sources

### IslamicAPI Ruqyah

- API root: https://islamicapi.com/api/v1/ruqyah/
- The provider documents 308 instant recitation entries across the brief, medium, and long programs, plus 146 topic articles in 13 categories and 53 languages.
- The current UI calls only `type=instant` with `lang=ar`, one of the three allowlisted programs, and `source=from-quran` through `/api/ruqyah`.
- The server proxy currently allowlists only `instant` + `from-quran`. It does **not** call `instant-category`, `from-sunnah`, `topic-category`, or `topic`; those endpoints are not implemented in WIRD.
- The API requires an api_key query parameter. WIRD sends it only from the server-side proxy (api/ruqyah.ts); it is never placed in browser code or committed files.
- The API documentation describes its Ruqyah dataset as free to access/download, but this implementation does not assume that every API key tier is free. Check the provider's current terms and pricing before enabling the key.

Set the secret as ISLAMICAPI_API_KEY:

- Vercel: Project → Settings → Environment Variables → configure the exact name `ISLAMICAPI_API_KEY` for Preview and Production, then redeploy. The backend reads only `process.env.ISLAMICAPI_API_KEY`; suffixed names such as `ISLAMICAPI_API_KEY1` are not aliases.
- Never place the key in `VITE_` variables, browser code, Git, logs, or prompts.
- Local development: put it in .env.local (never commit that file).

Without the secret, the external library displays a clear configuration message. The local curated Ruqyah section and Quran audio remain usable.

### Al Quran Cloud — current verse-by-verse audio

- Current provider: Al Quran Cloud / Islamic Network.
- Official CDN documentation: https://alquran.cloud/cdn
- Terms: https://alquran.cloud/terms-and-conditions
- WIRD uses a fixed allowlist of seven reviewed Arabic reciters in `src/services/ruqyahAudioService.ts`, and streams individual ayah MP3 files from the documented CDN pattern:
  `https://cdn.islamic.network/quran/audio/{bitrate}/{edition}/{globalAyahNumber}.mp3`
- The API route `/api/quran-audio?type=reciters` returns only this fixed allowlist. The browser cannot supply an arbitrary upstream URL or reciter ID.
- Al Quran Cloud's published terms state that recitations are licensed by the reciters or their estates for free non-commercial redistribution at the published bitrates, and may be streamed/embedded for personal and educational use. Recheck the current terms before changing use or bundling audio.

### Full-program Ruqyah recordings — not integrated

- IslamicAPI documents separate MP3 links for Brief, Medium, and Long programs, but WIRD does **not** currently wire those files into `RuqyahView`.
- The current player queues Quran ayahs from WIRD's canonical local corpus and plays them individually through the approved Al Quran Cloud reciter allowlist. It does not play a complete recording containing both Quran and Sunnah supplications.
- The UI correctly states that complete recordings containing supplications remain under verification. Do not remove that notice or enable full-program playback until the exact audio contents, reciter/source attribution, usage rights, and every non-Quran text/reference have been independently reviewed.
- The public `islamicapi/ruqyah` repository README uses an “Open Source” badge but the reviewed repository root has no `LICENSE` file and the README has no explicit license grant. Do not copy its dataset or audio into WIRD unless the provider supplies a clear license. The current API use is limited to sanitized numeric Quran locators; provider-authored religious text is not rendered.

## Reuse and licensing decisions

- muslimpack/Ruqayyah is GPL-3.0 and contains content associated with a separately credited book. WIRD's repository has no project-level license grant for importing GPL code, so no source code or book content was copied. Its reading-session, resume, and accessibility ideas were reviewed as design references only.
- mbougarne/roqia is MIT-licensed, but is a React Native application. Its content and code were not copied into WIRD.
- kanglerian/api-ruqyah-syariyyah is not used as a production source: its dataset is Indonesian-focused and the reviewed JSON contains incomplete Quran text / inconsistent field naming.
- islamicapi/ruqyah is used only through its documented API as a numeric Quran-locator source. No dataset or audio files are copied; the repository's public “Open Source” badge is not a substitute for an explicit license.

## Religious-content safeguards

- Quran passages are rendered from WIRD's existing verified Quran corpus using surah and ayah coordinates. API-provided Quran text is not trusted as the displayed text.
- API Sunnah entries display their returned reference, without inventing a hadith grading.
- A fixed repetition target is stored only where a cited narration states a count. Other items use repeatTarget: null and the counter is explicitly optional.
- General Quran passages are not described as independently proven treatments for particular diseases or magic.
- Ruqyah guidance states that it does not replace appropriate medical care.

## Current limitations

- IslamicAPI index access requires the server secret `ISLAMICAPI_API_KEY`; the proxy exposes only validated numeric Quran coordinates.
- The three external Quran locator lists are available only if the server key and provider endpoint work. No Sunnah entry or topic-article content is currently exposed by this integration.
- Ruqyah Quran audio is verse-by-verse through the seven-reciter Al Quran Cloud allowlist. Complete Brief/Medium/Long MP3 recordings are not integrated.
- Full program audio and any external religious content remain out of production until their exact contents, attribution, licensing, and source reliability are reviewed.
- Ruqyah progress is UID-scoped locally and has a journaled V2 sync model; production cross-device readiness remains subject to the global release gates.

## Ruqyah progress cloud sync (Phase 2)

Ruqyah completion counters use the dedicated Firestore collection path:

`users/{uid}/ruqyahProgress/snapshot`

The snapshot is validated and persisted through WIRD's IndexedDB write-ahead journal and revisioned outbox. It is not written directly from the browser to Firestore. Remote events are imported and projected through the existing conflict-aware inbox projector. Guests remain local-only.

The collection is included in version-5 backup exports and imports. Versions 1–4 remain supported; older backups without Ruqyah progress leave the current progress unchanged. The journaled full reset writes an empty progress snapshot as part of the same ordered transaction.

The existing cloud sync feature flags still gate network behavior:

- `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` enables revisioned outbox upload.
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` enables remote inbox projection.

These are release-controlled build flags, not routine setup toggles. Do not set production values to `true` until every gate in `docs/sync/RELEASE-GATES.md` passes and the owner explicitly approves activation. Never enable remote projection against Firestore rules that do not contain the `ruqyahProgress` collection allowlist.
