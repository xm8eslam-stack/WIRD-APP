# WIRD — Phase 5 UI/UX Upgrade Plan

## Objective

Turn WIRD into a polished, Arabic-first Quran memorization product with a calm, premium visual language and a consistent experience across desktop, tablet, and mobile. This phase improves presentation and interaction without replacing the existing React 19, TypeScript, Vite, Tailwind CSS 4, routing, Quran data, retention, or storage architecture.

## Design direction

- Editorial, quiet-luxury Islamic identity: deep forest green, warm paper, muted stone, and restrained brass accents.
- Arabic-first RTL layouts, Cairo for interface text and Amiri for Quranic text.
- Strong hierarchy, generous whitespace, clear task focus, readable Arabic line-height, and minimal visual noise.
- Semantic color: green for stable/success, amber for attention, red for errors, and neutral surfaces for ordinary information.
- Responsive by design: desktop sidebar, touch-friendly mobile quick navigation, safe-area-aware spacing, and 48px minimum touch targets where practical.
- Light and dark themes must both remain first-class and readable.
- Motion is subtle, purposeful, and disabled/reduced when the user requests reduced motion.

## Open-source research references

These projects are references for product patterns and UX research, not permission to transplant code blindly:

1. Quran.com frontend and developer ecosystem — reading, search, audio, and Quran-focused information architecture: https://quran.com/developers
2. voidwave/Quran — Arabic-first RTL Quran reader, memorization mode, progressive word reveal, responsive controls, and reading continuity: https://github.com/voidwave/Quran
3. zaidlh/quran-multi-lang-app — Sakinah design-system direction, RTL-first layouts, semantic theme tokens, and accessible study patterns. Its README states MIT for the project; individual data resources have separate licenses: https://github.com/zaidlh/quran-multi-lang-app
4. hunain-malik/hifz-ai — recitation-practice interaction patterns and word-level feedback concepts. No source-code reuse unless its license is independently verified: https://github.com/hunain-malik/hifz-ai

### Reuse and licensing policy

- Prefer implementing independently inspired patterns with existing WIRD components and dependencies.
- Before copying source code, verify the exact repository license and the license of any assets/data separately.
- Preserve required copyright/license notices and attribution.
- Never import Quran text, audio, tafsir, fonts, or page images from a UI inspiration project as a substitute for WIRD's verified canonical sources.
- Do not add paid APIs, subscriptions, large dependencies, or a second UI framework for cosmetic improvements.

## Phase 5 workstreams

### 5A — Foundation and global navigation
- Establish shared color, surface, border, shadow, typography, focus, and motion tokens.
- Refine the application shell, header, desktop navigation, and mobile quick-navigation dock.
- Improve responsive page width and safe-area spacing.
- Remove static or misleading header copy that implies a fixed daily assignment.

### 5B — Dashboard and daily journey
- Prioritize today's actual memorization task and due revision queue.
- Improve progress cards, hierarchy, empty states, quick actions, and weekly activity visualization.
- Keep every metric sourced from real stored progress; no invented streaks, completion, or sample user data.

### 5C — Quran library and reading
- Improve Surah browser/search/filter ergonomics, reading panel, typography, verse actions, and responsive layout.
- Preserve canonical Uthmani text and current source attribution.
- Keep selected Surah loading lazy and audio/tafsir actions intact.

### 5D — Memorization and testing
- Create a distraction-free recitation workspace with clearer progress, reveal controls, repetition, audio, and completion feedback.
- Improve touch interactions and keyboard accessibility without changing memorization semantics.
- **Initial 5D pass completed:** masked-word reveal controls are keyboard-operable buttons; Space-to-repeat no longer intercepts Space on buttons or form controls; ayah-step progress exposes accessible list/current-step semantics.
- Treat browser speech recognition as optional assistance, never a Tajweed certification or a replacement for a teacher.

### 5E — Plans, revision, analytics, and settings
- Unify cards, filters, tabs, forms, charts, legends, dialogs, and empty states.
- Make the next useful action obvious while preserving current plan and retention calculations.
- **Pending:** focused visual pass on plan wizard, revision queue, analytics charts, settings forms, and empty states.
- Improve backup/import affordances without weakening validation or recovery behavior.

### 5F — Quality and release
- Test desktop/mobile layouts, RTL, keyboard navigation, reduced motion, dark mode, empty states, and offline states.
- Run the full test suite, TypeScript validation, and Vite production build through GitHub Actions.
- Inspect chunk sizes and lazy loading; do not add heavy UI dependencies.
- Keep all work on this feature branch until review and CI pass; merge to main only after release checks.
- Current blocker: Vercel status reports the Free-plan daily deployment limit; no new Preview is confirmed for the current Phase 5 head.

## Current implementation snapshot

- Branch: `feat/phase5-premium-ui-ux`
- Base: current `main` at the start of Phase 5.
- Implemented workstreams 5A–5D (first UI/UX pass):
  - Shared WIRD design tokens and global visual system in `src/index.css`.
  - Refined app shell and wider responsive content viewport.
  - Premium forest-green/brass desktop sidebar and persistent mobile quick-navigation dock.
  - Responsive header with shorter mobile CTA and removal of the hard-coded Al-Mulk daily assignment label.
  - Consistent page wrappers for dashboard, library, plans, revision, progress, advisor, tests, settings, and memorization session.
  - Added mobile-navigation, dashboard progress, Surah selection, and memorization control accessibility regression assertions.
  - Dashboard focus cards and metric cards have clearer hierarchy; progress bars expose actual percentages to assistive technology.
  - Removed the fixed 20-minute claim and made the repetition count reflect the configured profile target.
  - Quran library has a dedicated reading surface, responsive Surah browser, refined ayah cards, and keyboard-operable Surah selection.
  - Memorization session word reveal controls are buttons with descriptive labels; Space-to-repeat respects interactive focus.
  - Open-source research includes the MIT-licensed Sakinah reference stylesheet; WIRD uses its own design tokens and implementation. No third-party code or Quran data was copied.
- No new runtime dependency has been added.
- No Quran text, audio, Firebase rules, authentication, secrets, or data migration logic has been changed.

## Next exact steps

1. Verify the current feature branch head and latest GitHub Actions run.
2. Fix any CI or type errors before adding more visual work.
3. Continue with Dashboard 5B, then Quran Library 5C and memorization session 5D.
4. Update this plan and `docs/DEVELOPMENT_CHECKPOINT.md` with exact SHAs and CI state before stopping.
