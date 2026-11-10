# WIRD UX Page and Tool Map

Baseline: `main`, inspected 2026-11-10.

## Non-negotiable design rules
- WIRD's verified local Quran corpus remains authoritative for text, coordinates, audio identity, tafsir references, bookmarks, and progress.
- The flexible reader distributes ayahs within a responsive page. It is not an exact printed-line replica. Do not claim line fidelity without verified layout data.
- Keep local-first and offline-safe behavior. UI work must not change sync schemas, production settings, Firebase rules, or release flags.
- Design for phone, iPad/tablet, desktop, touch, keyboard, and screen readers. Prefer one primary action per screen and 44px touch targets.
- Every change needs focused tests, responsive browser checks, exact-head CI, and a separate deployment-status check.

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

Current navigation groups: Home and Quran; Memorization and retention; Progress and support; App settings. Mobile quick navigation prioritizes home, Quran, memorization, and revision; secondary destinations are under More.

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
1. Finish exact-head gates for the active Mushaf, test, and dashboard work.
2. Audit Quran library end-to-end on phone and iPad.
3. Audit plans and revision state transitions against saved data.
4. Audit progress and advisor for truthful metrics and useful actions.
5. Audit ruqyah provenance, loading/error states, and audio.
6. Finish settings/account/backup/sync UX without changing release flags.
7. Only then scope new daily-worship destinations.

## Checkpoints
- Navigation shell, settings UX, and session UX improvements are present in current `main`.
- Printed Mushaf mode: PR #238, not approved as default.
- Memorization test UX: PR #233, pending exact-head gates.
- Dashboard UX: PR #236, pending exact-head gates.
- Green CI is not proof of deployment. Report Vercel status and live verification separately.
