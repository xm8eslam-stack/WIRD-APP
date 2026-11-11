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

## Proposed second core learning feature — Seerah and Companions

**Status:** planned; not an existing route or feature yet.  
**Product priority:** second after Quran memorization/revision.  
**Specialist plan:** `SEERAH_LEARNING_PLAN_AR.md`.

Proposed experience:
1. Journey home: current stage, continue lesson, completed stages, small optional daily goal.
2. Stage/lesson reader: short sections, learning objective, source references, previous/next, bookmarks and resume.
3. Person profiles: names/kunyas/roles and sourced links to events, places, and other people.
4. Event timeline: filters by phase/person/place and clear approximate/disputed date labels.
5. Verified map: only locations with reviewed coordinates and provenance.
6. Lesson quiz: 3–7 questions with answer explanations and sources.
7. Stage and cumulative tests: chronology, matching, multiple choice, recall, and mixed review.
8. Mistake review: weak topics and spaced re-practice without punitive streaks.
9. Progress view: lesson completion and mastery kept separate from Quran memorization/reading metrics.
10. Offline packs: optional approved content bundles with visible version and size.

### Seerah UX and content checklist
- The API is a data provider, not a religious/historical authority; no provider is selected yet.
- Every lesson/claim/question must have source references, editorial state, and content version.
- Disputed narrations and approximate dates must be labelled or excluded from categorical quizzes.
- Never invent dialogue, quotes, chronology, locations, or causal links.
- No unlicensed book text or modern translations; review display, cache, translation, and offline rights.
- Local-first reading and progress; sync only compact user progress, not duplicate public book content in Firestore.
- No leaderboards or shaming; reward learning and review gently.
- Arabic RTL, long names, diacritics, screen readers, reduced motion, touch, and offline states are first-class.

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
