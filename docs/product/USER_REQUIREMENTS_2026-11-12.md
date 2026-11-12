# User-requested product requirements — 2026-11-12

**Status:** Accepted into the development queue; implementation not yet verified.
**Baseline:** main `8e98aa350c999b2252cc8e3b5d2a8c6d0264b86b`.
**Coordination:** Keep documentation changes in PR #363. Keep independent runtime work on separate feature branches/PRs. Do not merge or deploy without exact-head quality gates and the existing owner approvals.

## 1. Adaptive Engine Plans capacity and lossless chunked sync

The user explicitly requires the available Engine Plans capacity to adapt to the actual plan/entitlement assigned to each account, and requires large plan synchronization to be split into files/chunks without losing any data.

These are separate constraints and must not be conflated:

- **Local archive capacity:** governed by IndexedDB/browser quota, verified write success, and a protected reserve. Quota estimates inform UX only; they are not guarantees. Never evict Engine Plans, journal, Outbox, Inbox, conflicts, or progress to make room.
- **Account entitlement:** a server-authoritative entitlement contract determines the account's allowed Engine Plans capacity. Do not invent Free/Plus/Pro tiers, limits, or pricing. First discover whether a real entitlement/billing source exists; if none exists, define the versioned contract and owner approval needed before presenting tier-based limits.
- **Sync transport:** plan data must be independently chunkable and resumable. Each immutable chunk carries scope/owner, archive revision, chunk ID/index/count, byte length, schema version, and SHA-256. A manifest carries ordered record IDs, chunk hashes/sizes, total count/bytes, entitlement/capability metadata and whole-archive fingerprint.
- Upload chunks first, read them back and verify; publish the manifest/pointer last with revision compare-and-set. A partial upload must never become active.
- Receivers fetch and verify every chunk, reconstruct and validate the full archive, and commit local materialization before advancing Inbox/projection cursors.
- Keep last-known-good revision and all revisions referenced by pending journal/outbox/inbox/conflict records. No destructive garbage collection until device acknowledgements and old-client capability negotiation are proven.
- An entitlement downgrade must not delete or truncate existing records. It may block new additions or cloud publication with a clear explanation and an export/upgrade path; preserve read/export/restore access to already-owned data subject to the actual product policy.
- The interim 800,000-byte single-document ceiling in PR #367 is not an account quota, not a total archive capacity, and not the final chunk protocol.

**Acceptance:** real server-verified entitlement fixture tests; no fabricated tier fallback; >100 plans; payloads larger than the interim cap; interrupted upload/resume; duplicate/out-of-order/corrupt/missing chunks; manifest CAS races; downgrade/upgrade; old-client capability; account switching; restart/offline replay; A/B/A device reconciliation; no record loss and no cursor advancement before full materialization.

## 2. Saved memorization ranges — multi-selection

The existing “previously memorized” selection workflow must support selecting:

1. Multiple Surahs in one pass.
2. A complete Juz.
3. A custom ayah interval within one Surah (start ayah through end ayah).
4. Multiple custom ranges and a mix of Surahs/Juz/ranges in one selection session where the current domain model supports it.

Use canonical Quran coordinates: `surahNumber`, `startAyah`, `endAyah`, with validation against bundled canonical Surah/Juz metadata. Resolve Juz boundaries across Surah boundaries using the canonical Juz index, not guessed verse numbers. Normalize duplicates/overlaps deterministically and preserve the user's intended covered range. Display a review summary before applying. Do not mutate memorization progress until the user confirms. Keep keyboard, touch, RTL and screen-reader support.

**Acceptance:** single and multi-Surah, complete Juz crossing Surah boundaries, first/last ayah, one-ayah range, reversed endpoints, invalid coordinates, overlapping ranges, duplicate selections, empty selection, reload persistence and regression tests for existing plan generation.

## 3. Memorization session page display settings

The existing page/display controls must be inside a compact, accessible disclosure panel. It starts collapsed by default (or restores the user's explicit local preference), opens on tap/click, and closes on a second activation. It must not occupy reading space when closed.

The expanded panel should organize detailed controls into understandable groups:
- Page/content width and overall interface scale.
- Quran ayah font size and available font/typography choices only where supported by the existing Mushaf renderer.
- Reading density and line spacing.
- Focused ayah versus all-session/page view.
- Comfortable margins/padding and optional reading contrast if supported without changing Quran glyph correctness.
- Reset-to-defaults and a clear preview/current-value summary.

Keep controls keyboard accessible, announce expanded state, preserve the current ayah/scroll position when settings change, and persist display preferences locally per device unless a reviewed cross-device preference contract is explicitly added. Do not include display preferences in Quran progress sync or backup unless deliberately designed and tested.

**Acceptance:** default collapsed state, keyboard/touch toggle, correct aria-expanded/controls relationship, no layout jump or lost ayah position, every control updates the real renderer, reload persistence, responsive RTL/mobile layout, dark mode and a reset-defaults test.

## 4. Seerah — elevated product priority

Treat Seerah as a first-class parallel workstream and give it focused engineering/review capacity. Preserve the continuous book model (parts → chapters → narrative scenes), not short disconnected lessons.

Priorities:
- Complete the continuous reader shell, reliable navigation/anchors, persistent reading position and bookmarks, source/context side panel, typography controls and responsive reading UX.
- Make content a structured, versioned editorial corpus. Every historical claim must link to traceable source references and a specific locator; exact quotations require exact-wording verification.
- Keep disputed reports, chronology uncertainty and source disagreements visible to editors and handled transparently in publication policy. A technical validation contract is not proof of historical truth.
- No invented historical text, names, reports, dates, citations, or fabricated test content in production. No AI-generated historical claims may bypass human scholarly review.
- Research source availability, coverage, licensing, reuse rights, reliability, privacy, API stability and costs before ingestion. No paid APIs without owner approval; do not scrape or republish material without rights.
- Build editorial review workflow (scientific, language, narrative continuity, accessibility), source/claim traceability, draft/review/approved/published states and auditable content versions.
- Build a content coverage map and release only approved chapters. Do not claim complete coverage of the Seerah or Companions without an explicit measurable scope and evidence.
- Continue with tests for content contracts, source traceability, anchors/version migration, bookmark isolation by storage scope, reader reload, RTL/accessibility, and offline/revision behavior.

**Acceptance:** a full, readable, connected, mobile/desktop reader with approved sourced content; every published claim is traceable; bookmarks/position survive reload and are isolated by guest/UID; content updates do not corrupt old reading progress.

## 5. Parallel execution and safety

Run the Seerah, memorized-range selector, session display-settings, Engine Plans archive, offline audio and PWA tracks independently where file ownership permits. Keep shared documentation in PR #363 only. Tests waiting on CI must not block independent work, but no code PR is mergeable without inspectable exact-head Quality Gate evidence. Do not change Production settings, Firebase Rules/data, secrets, sync flags, or deploy without explicit owner approval.

## 6. Current next actions

1. Continue Engine Plans archive caller/transaction audit and define entitlement + manifest/chunk contracts before migration.
2. Inspect the exact “previously memorized” selection UI/domain model and implement multi-select without changing the generated plan semantics.
3. Convert the current session display controls into an accessible collapsed disclosure and add supported typography/layout details.
4. Continue PR #365 Seerah reader improvements; research content sources/rights separately from UI work and keep production content empty until approved.
5. Record exact branch heads, changed files, tests and evidence in the continuation checkpoint after each meaningful step.
