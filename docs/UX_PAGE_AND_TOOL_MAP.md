# WIRD UX Page and Tool Map

Baseline: current repository UX inventory reviewed 2026-11-11. Proposed destinations are explicitly marked; they are not claims about existing navigation.

## Non-negotiable design rules
- WIRD's verified local Quran corpus remains authoritative for text, coordinates, audio identity, tafsir references, bookmarks, and progress.
- The flexible reader distributes ayahs within a responsive page. It is not an exact printed-line replica. Do not claim line fidelity without verified layout data.
- Keep local-first and offline-safe behavior. UI work must not change sync schemas, production settings, Firebase rules, or release flags.
- Design for phone, iPad/tablet, desktop, touch, keyboard, and screen readers. Prefer one primary action per screen and 44px touch targets.
- Every change needs focused tests, responsive browser checks, exact-head CI, and a separate deployment-status check.
- Any Seerah lesson, historical claim, date, map marker, or quiz answer must link to a reviewed source record. Do not publish AI-generated historical/religious content.
- Do not depict the Prophet ﷺ or Companions; use abstract patterns, landscapes, verified maps, calligraphy, and non-figurative illustrations.

## Current pages

| Page | Tab | Main tools | Priority |
|---|---|---|---:|
| Home | `dashboard` | Daily task, due revision, Quran progress, weekly activity, quick actions | 1 |
| Quran library / Mushaf | `library` | Surah/page navigation, text, audio, tafsir, bookmarks, display controls | 2 |
| Memorization session | `session` | Ayah range, repeat, masking, audio, tafsir, completion | 3 |
| Revision center | `revision` | Due portions, review scheduling, weak ayahs | 4 |
| Memorization plans | `plans` | User and generated plans | 5 |
| Memorization tests | `tests` | Complete ayah, reverse recall, random recall, mutashabihat | 6 |
| Progress | `progress` | Persisted activity and memorization/revision metrics | 7 |
| Quran advisor | `advisor` | Plan-aware memorization guidance | 8 |
| Ruqyah | `ruqyah` | Ruqyah reading and audio | 9 |
| Settings | `settings` | Profile, preferences, backup, account and sync controls | 10 |
| Brand showcase | `showcase` | Internal design reference; keep out of normal navigation | Exclude |

## Proposed second core learning feature — كتاب «حكاية السيرة»

**Status:** planned; not an existing route or implemented feature.  
**Product priority:** second after Quran memorization/revision.  
**Specialist plan:** `SEERAH_LEARNING_PLAN_AR.md`.

The product is a connected historical book, not a sequence of short lessons or quiz cards:

1. **Book home:** introduce the scope and show parts, current reading position, chapter progress, and a clear resume action.
2. **Part introduction and contents:** explain the historical period and its context, then list linked chapters in an editorially reviewed order.
3. **Continuous chapter reader:** present connected Arabic prose divided into narrative scenes with quiet headings; do not turn each paragraph into a separate card or force a fixed scene length.
4. **Optional reading-and-learning layer:** open sourced people/place/event context, maps, timeline, or a comprehension pause without interrupting the text or losing the reading anchor.
5. **Chapter ending:** concise connected summary, why the events matter, a bridge to the next chapter, and optional reviewed questions.
6. **Progress:** save part/chapter/scene plus a stable text anchor, scroll position, and contentVersion; this is reading progress, not Quran memorization or mastery.
7. **Offline:** optional bundles only for reviewed content with explicit reuse/storage rights and visible version/size.

### Seerah UX and content checklist
- An API is a discovery/provider channel, not a historical authority; no provider is approved yet.
- Every narrative body block and atomic claim, date, quotation, map marker, question, answer, and explanation must have auditable source references, editorial status, and content version.
- Disputed reports and approximate dates must be labelled; unresolved claims must not appear as categorical quiz answers.
- Never invent dialogue, emotions, intentions, quotations, chronology, locations, or causal links. Never present reconstructed wording as verbatim quotation.
- No unlicensed book text or modern translations; review display, caching, translation, and offline rights.
- Local-first reading progress and stable anchors; sync only compact user progress after a separate safety gate, not public book content or private notes.
- No forced quizzes, autoplay, popups, leaderboards, or shaming. The reader must remain usable when all optional aids are closed.
- Arabic RTL, long names, diacritics, screen readers, reduced motion, large text, touch, reload, and offline states are first-class.
- No figurative depictions of the Prophet ﷺ or Companions.

## Tool-specific audit checklist

### Quran library and Mushaf
- Keep flexible local text as the default and permanent fallback.
- Printed facsimile stays opt-in until coordinate, license, visual, offline, and real-device gates pass.
- Preserve text scale, page width, surah/page/juz/hizb navigation, bookmarks, reciter, speed, audio, tafsir, and reading-khatma behavior.
- Never treat SVG artwork as Quran text.

### Memorization and revision
- Keep new memorization separate from due revision.
- Preserve journaled completion and atomic persistence.
- Test modes based on saved memorization must use eligible saved portions; curated mutashabihat stays distinct.
- Make keyboard controls, progress, selection, and feedback accessible.

### Home and progress
- Show one primary daily task; do not repeat the same review item in a second queue.
- Expose weekly day/minute/ayah values to assistive technology.
- Derive metrics from persisted records; never invent progress.

### Settings and account
- Keep device-local display preferences separate from cloud data.
- Preserve backup/import recovery and explicit sync status.
- Do not change production secrets, Firebase rules, or sync flags during UX work.

## Candidate scope, not existing navigation
The current navigation has no dedicated destination for daily adhkar, prayer tracking, prayer times, qibla, or Hijri date. Research free/open-source sources, licensing, reliability, privacy, offline behavior, and maintenance before adding any. Do not use unverified religious content.

## Execution order
1. Finish exact-head gates for the active documentation, Mushaf, plans, Ruqyah, and offline-audio work.
2. Audit Quran library end-to-end on phone and iPad.
3. Audit plans and revision state transitions against saved data.
4. Audit progress and advisor for truthful metrics and useful actions.
5. Audit ruqyah provenance, loading/error states, and audio.
6. Finish settings/account/backup/sync UX without changing release flags.
7. Run the Seerah source/licensing POC and editorial sample before building the planned Seerah destination.
8. Only then scope new daily-worship destinations.

## Checkpoints
- Navigation shell, settings UX, and session UX improvements are present in current `main`.
- Printed Mushaf mode: PR #285, exact-head CI pending; remains opt-in pending visual and real-device review.
- Memorization test accessibility: PR #233 merged after exact-head CI success.
- Dashboard weekly activity and quick-action accessibility: PR #236 merged after exact-head CI success.
- Revision failed-rating dialog keyboard accessibility: PR #266 merged after CI success.
- Plan selector, empty state, and delete-dialog accessibility: PR #279 merged after exact-head CI success.
- Ruqyah audio queue progress and touch controls: PR #276 merged after exact-head CI success; redundant empty-wrapper cleanup is in PR #284.
- Page/tool inventory: this document is tracked in PR #363.
- Green CI is not proof of deployment. Report Vercel status and live verification separately.
