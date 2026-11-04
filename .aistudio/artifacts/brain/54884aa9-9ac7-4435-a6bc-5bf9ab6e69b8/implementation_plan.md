# Comprehensive UI/UX Audit & Production Polish Plan — WIRD | وِرد

A detailed audit and enhancement blueprint to elevate **WIRD | وِرد** into a unified, commercial-grade Arabic-first Quran memorization platform. This plan maintains 100% of the existing technical architecture and zero-API-cost client-side model, while systematically resolving visual inconsistencies, alignment anomalies in RTL, typographic hierarchies, and component polish across all 9 screens.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:
> - **Primary Audit Scope**: Comprehensive polish across all 9 screens and navigation.
> - **Visual Density & Aesthetic Tone**: Balanced spacious luxury with warm ivory backgrounds (`#faf8f5`), deep emerald green (`#064e3b` / `#065f46`), muted gold accents (`#d97706` / `#c59b27`), and subtle hairline borders (`border-stone-200/80` and `dark:border-stone-800`).

---

## 1. Audit Findings & Systematic Improvements

### A. RTL Directionality & Icon Orientations
- **Issue**: Several chevron arrows, back/next controls, and input adornments used physical left/right translations or manual `rotate-180` transforms that create inconsistencies across different device viewports.
- **Fix**: Standardize all directional affordances to authentic Arabic RTL semantics:
  - "Next" / "Forward" action points Left (`ChevronLeft` / `ArrowLeft`).
  - "Previous" / "Back" action points Right (`ChevronRight` / `ArrowRight`).
  - Search inputs and dropdown carets placed with exact RTL inset spacing (`right-3.5` for search magnifying glass, `left-3.5` for dropdown carets).

### B. Typography & Arabic Numerals
- **Issue**: Test answer options and ayah counters mixed Western and Arabic figures inconsistently; ayah markers in some viewports experienced vertical baseline shifts.
- **Fix**:
  - Adopt Arabic test choice labels (`أ`, `ب`, `ج`, `د`) for Quranic multiple-choice questions.
  - Enforce `tabular-nums` on all progress counters, page numbers, and timers.
  - Fine-tune Amiri font rendering in `ayah-number` badges with consistent circular baselines.

### C. Visual Hierarchy & "Zero-Pill" Anti-Slop Discipline
- **Issue**: Certain badge clusters in the dashboard and revision center had pill enclosures that created visual noise.
- **Fix**:
  - Convert static metadata (dates, counts, Juz numbers) to clean, unboxed typography separated by quiet middle dots (`·`) and subtle typographic weights.
  - Retain rounded containers strictly for functional buttons, active segmented tabs, and interactive scorecards.
  - Ensure nested radius math follows $r_{\text{inner}} = r_{\text{outer}} - \text{padding}$.

### D. Daily Memorization Session Polish
- **Issue**: Masked words in Progressive Word Masking used standard `blur-xs` which can trigger browser repaint flickering on mobile.
- **Fix**:
  - Replace blur with elegant shaded placeholder blocks with subtle dashed borders and smooth hover/tap reveals.
  - Add visual completion ripple and haptic-like counter animation when tapping the repetition tracker.
  - Ensure the audio recitation player integrates smoothly with immediate play/pause states.

### E. Quran Library & Empty State Enhancements
- **Issue**: Selecting a Surah that only had metadata showed a generic empty card instead of full surah details, recitation streaming, and session launching.
- **Fix**:
  - Provide rich Surah detail headers for all 114 Surahs, including Ayah count, revelation type, Juz span, direct streaming player from EveryAyah, and interactive session launchers for any selected passage.

---

## 2. User Experience & Visual Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WIRD TOP BAR (3-Zone Contract)                       │
│  [ وِرد / الشاشة الحالية ]   [ الورد اليومي · المواظبة 14 يوماً ]   [ تبديل المظهر | جلسة الحفظ ]  │
├─────────────┬──────────────────────────────────────────────────────────┤
│ SIDEBAR     │ VIEWPORT WORKSPACE (Max-W 7xl, RTL Native)               │
│ (260px)     │                                                          │
│             │  ┌────────────────────────────────────────────────────┐  │
│ • الرئيسية  │  │ 1. Hero Banner: Welcome, Daily Ayah & Action Hub   │  │
│ • المصحف    │  └────────────────────────────────────────────────────┘  │
│ • الخطط     │                                                          │
│ • الجلسة    │  ┌─────────────────────────┐  ┌───────────────────────┐  │
│ • المراجعة  │  │ الحفظ الجديد (الورد)    │  │ المراجعة (التكرار)    │  │
│ • الاختبارات │  │ سورة الملك (1-10)       │  │ صغرى: 2 · كبرى: 3    │  │
│ • التقارير  │  │ [ابدأ جلسة الحفظ]       │  │ [بدء المراجعة]        │  │
│ • المستشار  │  └─────────────────────────┘  └───────────────────────┘  │
│ • الإعدادات │                                                          │
│             │  ┌────────────────────────────────────────────────────┐  │
│ [الملف]     │  │ 3. Weekly Chart (7 Days) + Quick Action Cards      │  │
│             │  └────────────────────────────────────────────────────┘  │
└─────────────┴──────────────────────────────────────────────────────────┘
```

### Visual System Tokens:
- **Canvas Neutral (60%)**: `#faf8f5` (Warm Ivory in light mode), `#0c120c` / `#0f172a` (Night Slate in dark mode).
- **Structural Surfaces (30%)**: `#ffffff` with hairline `border-stone-200/80` (Light) and `#1c1917` / `#1e293b` (Dark).
- **Primary Brand Accent (10%)**: Deep Emerald (`#064e3b` / `#047857`) and Muted Gold (`#d97706` / `#c59b27`).
- **Typography Pairing**:
  - UI Sans: `Cairo` (Weights 400, 600, 700, 800)
  - Quranic Naskh: `Amiri` (Regular and Bold, Uthmanic feel)
  - Data / Figures: `font-mono tabular-nums`

---

## 3. Screen-by-Screen Enhancement Scope

| # | Screen | Audit Enhancements |
|---|---|---|
| **1** | **Top Header & Sidebar** | Align breadcrumbs, fix mobile drawer swipe/close gestures, fix RTL chevron directions, clean up brand typography. |
| **2** | **Main Dashboard** | Balance spacing between New Memorization and Revision cards; improve weekly chart tooltips; add smooth progress rings. |
| **3** | **Quran Library** | Enhance search responsiveness; streamline Juz and Makki/Madani filter tabs; make audio player sticky with current Ayah title. |
| **4** | **Memorization Plans** | Polish custom wizard steps with live daily workload calculation; improve plan cards visual breathing room. |
| **5** | **Daily Memorization Session** | Upgrade progressive word masking with elegant shaded tokens; add keyboard shortcuts (Space to repeat); optimize audio sync. |
| **6** | **Revision Center** | Clarify Minor (صغرى) vs Major (كبرى) revision queues; polish Spaced Repetition rating modal with clear interval days preview. |
| **7** | **Memorization Tests** | Replace English markers with Arabic (`أ`, `ب`, `ج`, `د`); add clear visual feedback for correct/incorrect answers with rule explanations. |
| **8** | **Progress & Analytics** | Refine 30-Juz visual heatmap with clear progress percentage per Juz; verify JSON backup export & restore flow. |
| **9** | **Quran Advisor & Settings** | Organize methodology cards with actionable steps; add live Quran font size preview slider; smooth dark/light theme transitions. |

---

## 4. Technical Implementation & Vercel Verification

- **Architecture**: 100% Client-side React 19 + TypeScript + Tailwind CSS v4 Single Page Application.
- **Persistence**: Safe, schema-versioned `localStorage` with initial demo data that persists across refreshes.
- **Zero Paid Dependencies**: Audio streamed via public EveryAyah CDN; no paid APIs required.
- **Deployment**: Verified compatible with GitHub and Vercel build pipelines (`npm run build` -> `dist`).
- **Verification Gates**:
  1. `compile_applet` succeeds with 0 errors.
  2. `lint_applet` (`tsc --noEmit`) passes with 0 warnings/errors.
  3. Interactive validation across all 9 views in desktop and mobile viewports.
