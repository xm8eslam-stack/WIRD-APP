# Printed Mushaf facsimile source and integration boundary

## Selected source

- Publisher artwork: King Fahd Glorious Qur'an Printing Complex (KFGQPC), Hafs ʿan ʿAsim, Madinah Mushaf.
- Digitized edition represented by the vector archive: 1441H, as documented by the source archive.
- Vector and ayah hit-region archive: [quran-ws/quran-svg](https://github.com/quran-ws/quran-svg).
- Pinned release: `v1.1.1` (immutable source commit `3ff27b46cecb0c0519d77531d9c868a579d1f623`); page files are fetched from the documented, CORS-enabled GitHub raw path: `https://raw.githubusercontent.com/quran-ws/quran-svg/3ff27b46cecb0c0519d77531d9c868a579d1f623/mushafs/hafs/kfqc/svg/NNN.svg`.
- One page is fetched on demand. The application does not download or bundle all 604 SVGs.
- The release contains 604 Hafs/KFQPC pages and one transparent `.ayahPolygon` hit region per ayah on each page. The SVG is vector outlines, not selectable Quran text.

## Rights and attribution

The KFGQPC's published usage rights explicitly permit free digital publishing and use in websites and software inside and outside Saudi Arabia. The stated restriction concerns physical Mushaf printing/import for commercial sale; WIRD uses the digital page renderer only.

The source archive distinguishes:
- KFGQPC page artwork: remains KFGQPC intellectual property and is used under the Complex's published digital-use permission.
- Quran.ws ayah hit-region geometry and page metadata: CC BY 4.0, with its published attribution waiver for use inside a product.
- Quran.ws tooling: MIT.

WIRD still displays a source attribution in the page footer. The upstream source's full `NOTICE.md` and the Complex's rights page govern; this note is not a substitute for those terms.

Official rights: https://dm.qurancomplex.gov.sa/rights/
Source notice: https://github.com/quran-ws/quran-svg/blob/v1.1.1/NOTICE.md
Source release: https://github.com/quran-ws/quran-svg/releases/tag/v1.1.1

## Text-integrity boundary

1. The SVG is a visual layer only. It contains vector paths and ayah coordinates, not the Quranic text.
2. WIRD's checked-in Tanzil corpus remains the sole text source for display, search, audio coordinates, tafsir, memorization, bookmarks, and progress.
3. Before interaction is enabled, every `surah:ayah` coordinate in the SVG must resolve to exactly one canonical local WIRD ayah. Across the complete 604-page edition, every local ayah must appear exactly once; unknown, duplicate, missing, or malformed coordinates fail closed. The printed edition's page assignment is authoritative only for the printed view; the flexible reader's page metadata is not rewritten.
4. SVG is sanitized with a strict allowlist: only `svg`, `g`, and `path` elements and the required drawing/coordinate attributes are retained. Text, script, links, external references, and unknown elements are rejected.
5. The original `viewBox` is read from each file. The first two pages are an opening spread with oversized declared bounds, so the rendered ink is measured and fitted after DOM layout.
6. The current release is Hafs/KFGQPC only. Do not reuse its page number or geometry for Warsh, Qalun, or another print.

## Offline and performance behavior

- A page is fetched only after the reader chooses **الصفحة المطبوعة**.
- The service worker caches only the pinned Hafs/KFGQPC SVG host/path, on demand, in a dedicated cache bounded to 24 files (12 page pairs).
- The cache is preserved across service-worker upgrades; old page entries are evicted by the bound.
- If network, SVG parsing, sanitization, or local coordinate matching fails, the reader offers the existing local flexible-text view. It never substitutes remote Quran text.
- The reader resolves the printed page's audio queue and ayah navigation from that page's exact local coordinate set, independent of flexible-layout page metadata. The reader mounts one page at a time rather than a long scrolling SVG document. This reduces the SVG performance cost, but real iOS/Android device testing remains a release gate.

## Validation required before making this the default

- Validate the actual SVG hit-region layer on all 604 pages against the complete local ayah coordinate set and verify one-to-one coverage across the edition.
- Inspect opening pages 1–2 and dense final pages, and test page navigation across surah boundaries.
- Confirm hit-region selection, tafsir opening, page audio, keyboard operation, reduced motion, and small-screen layout.
- Test first-load CORS and offline cache behavior on Safari/iPadOS and Android Chrome.
- Keep flexible local-text mode available as a permanent fallback.

## Final visual release checklist

Automated coordinate coverage proves that each local ayah is represented by a source hit region; it does not prove visual legibility or device performance. Before enabling printed mode by default, record a manual review for:
- Opening spread (pages 1–2), including actual ink bounds and Basmala/heading alignment.
- A dense page near the end of the Mushaf and a page with short/long ayah transitions.
- A surah boundary and a printed page whose ayah coordinates differ from WIRD's flexible page metadata.
- Hit target alignment, selected-ayah contrast, keyboard focus, tafsir opening, and page-audio order.
- First-load, repeat-load, offline reload, and cache eviction behavior on iPadOS Safari and Android Chrome.

Keep printed mode opt-in until this checklist is completed on real devices. The flexible local-text view remains the safe default and fallback.
