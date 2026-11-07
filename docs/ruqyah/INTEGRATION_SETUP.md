# WIRD Ruqyah integrations

## External sources

### IslamicAPI Ruqyah

- API root: https://islamicapi.com/api/v1/ruqyah/
- The provider documents 308 instant recitation entries across the brief, medium, and long programs, plus 146 topic articles in 13 categories and 53 languages.
- WIRD currently requests only the Arabic instant-category and instant endpoints for the three programs; the topic endpoints are proxied and schema-validated for a later reviewed UI.
- The API requires an api_key query parameter. WIRD sends it only from the server-side proxy (api/ruqyah.ts); it is never placed in browser code or committed files.
- The API documentation describes its Ruqyah dataset as free to access/download, but this implementation does not assume that every API key tier is free. Check the provider's current terms and pricing before enabling the key.

Set the secret as ISLAMICAPI_API_KEY:

- Vercel: Project → Settings → Environment Variables → add ISLAMICAPI_API_KEY for Preview and Production, then redeploy.
- Local development: put it in .env.local (never commit that file).

Without the secret, the external library displays a clear configuration message. The local curated Ruqyah section and Quran audio remain usable.

### Al Furqan Quran API

- Reciter directory: https://alfurqan.online/api/v1/reciters
- Verse audio: https://alfurqan.online/api/v1/audio/{reciterId}/{globalAyahNumber}
- The directory currently advertises 44 reciters. It does not require an API key for the documented read-only endpoints.
- WIRD proxies and validates the reciter catalogue, then plays each Quran ayah in the passage queue. Multi-ayah items are not reduced to the first ayah.

### Full program audio

The three program recordings documented by IslamicAPI are configured as direct MP3 sources:
- https://islamicapi.com/audio/ruqyah/total_brief_ruqyah.mp3
- https://islamicapi.com/audio/ruqyah/total_med_ruqyah.mp3
- https://islamicapi.com/audio/ruqyah/total_long_ruqyah.mp3

The provider URLs are configured, but browser playback still needs a real deployed-device smoke test. If a recording is unavailable, users can use Al Furqan's verse-by-verse recitation.

## Reuse and licensing decisions

- muslimpack/Ruqayyah is GPL-3.0 and contains content associated with a separately credited book. WIRD's repository has no project-level license grant for importing GPL code, so no source code or book content was copied. Its reading-session, resume, and accessibility ideas were reviewed as design references only.
- mbougarne/roqia is MIT-licensed, but is a React Native application. Its content and code were not copied into WIRD.
- kanglerian/api-ruqyah-syariyyah is not used as a production source: its dataset is Indonesian-focused and the reviewed JSON contains incomplete Quran text / inconsistent field naming.
- islamicapi/ruqyah is used through its documented API, not by copying its unlicensed repository data into WIRD.

## Religious-content safeguards

- Quran passages are rendered from WIRD's existing verified Quran corpus using surah and ayah coordinates. API-provided Quran text is not trusted as the displayed text.
- API Sunnah entries display their returned reference, without inventing a hadith grading.
- A fixed repetition target is stored only where a cited narration states a count. Other items use repeatTarget: null and the counter is explicitly optional.
- General Quran passages are not described as independently proven treatments for particular diseases or magic.
- Ruqyah guidance states that it does not replace appropriate medical care.

## Current limitations

- Ruqyah progress is persisted in WIRD's UID-scoped storage namespace. Its journaled cloud-sync and version-5 backup integration is documented in the Phase 2 section below.
- The external IslamicAPI library requires the server secret above.
- Full program MP3 playback and the full 44-reciter catalogue need a deployed browser/device verification pass.


## Ruqyah progress cloud sync (Phase 2)

Ruqyah completion counters use the dedicated Firestore collection path:

`users/{uid}/ruqyahProgress/snapshot`

The snapshot is validated and persisted through WIRD's IndexedDB write-ahead journal and revisioned outbox. It is not written directly from the browser to Firestore. Remote events are imported and projected through the existing conflict-aware inbox projector. Guests remain local-only.

The collection is included in version-5 backup exports and imports. Versions 1–4 remain supported; older backups without Ruqyah progress leave the current progress unchanged. The journaled full reset writes an empty progress snapshot as part of the same ordered transaction.

The existing cloud sync feature flags still gate network behavior:

- `VITE_WIRD_REVISIONED_SYNC_ENABLED=true` enables revisioned outbox upload.
- `VITE_WIRD_REMOTE_PROJECTION_ENABLED=true` enables remote inbox projection.

These values must be set in the deployed Vercel environment and a new deployment must complete before cross-device sync can be verified. Never enable remote projection against Firestore rules that do not contain the `ruqyahProgress` collection allowlist.
