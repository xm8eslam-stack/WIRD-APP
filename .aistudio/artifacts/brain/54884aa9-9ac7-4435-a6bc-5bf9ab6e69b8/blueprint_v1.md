# WIRD (وِرْد) — Master Product Blueprint & Full Application Audit
**Document Version:** 2.0 (Phase 2 Master Blueprint)  
**System Role:** Lead Product Architect, Senior Software Architect, UX Architect & Technical Auditor  
**Repository Target:** `xm8eslam-stack/WIRD-APP` (Deploy target: GitHub -> Vercel + Firebase Spark)  
**Review Status:** Complete, Implementation-Ready Architecture Specification

---

## Executive Summary & Strategic Context

**WIRD (وِرْد)** is an offline-first Quranic memorization companion and spaced-retention platform designed to bridge the gap between passive reading and deliberate, long-term Quranic retention (*Hifz* and *Muraja'ah*).

This document represents the definitive technical and architectural master plan for WIRD. It was produced through exhaustive static analysis of the live codebase, behavioral verification of runtime modules, and rigorous architectural reconciliation. Every recommendation in this blueprint directly informs a concrete engineering deliverable for the upcoming development phases.

### Core Architecture Tenets
1. **Zero Fake Metrics (حقيقة الإنجاز):** Every number, streak, percentage, and heat-map cell displayed to the user must derive deterministically from genuine user sessions or explicitly logged records. No placeholder constants.
2. **Local-First, Cloud-Optional (محلي أولاً):** The entire application operates 100% offline via localStorage, in-memory fallbacks, and Service Worker caching. Cloud synchronization via Firebase Firestore is strictly additive, free-tier bounded (Spark plan), and gated behind email verification.
3. **Intentional Session Boundaries:** In strict compliance with Quranic reverence and user agency, browsing or reading Quran text (in the Library or Mushaf) never initiates a memorization session or mutates retention state. Sessions are explicit, focused acts.
4. **Vercel & Git-Centric Reliability:** The codebase must build cleanly (`vite build`, `tsc --noEmit`), execute in standard Node/browser runtimes without proprietary vendor lock-in, and deploy seamlessly to Vercel via automated GitHub CI/CD workflows.

---

## 1. Master Product Requirements (13 Core Product Decisions)

### 1.1 Navigation Hierarchy & Information Architecture
*   **Current State (Verified):** Tab-based in-memory state in `App.tsx` (`currentTab: NavTabId`). Browser back button exits or reloads the app; deep-linking to a specific Surah, plan, or test is impossible.
*   **Architectural Decision:** Implement lightweight browser history integration via a hash router or standard React Router (`react-router-dom` v6 / `wouter`).
*   **Route Hierarchy:**
    *   `/` -> **Dashboard** (Daily Wird command center)
    *   `/library` -> **Quran Mushaf / Library** (114 Surahs, Ayah inspection, Tafsir)
    *   `/library/:surahId` -> **Surah Viewer**
    *   `/plans` -> **Active Plan & Milestone Manager**
    *   `/plans/new` -> **Plan Wizard**
    *   `/session` -> **Active Session Flow** (Query params: `?mode=memorize|review&surah=X&start=Y&end=Z`)
    *   `/revision` -> **Spaced Revision Queue** (SM-2 prioritized deck)
    *   `/tests` -> **Retention Testing Arena** (4 distinct test modes)
    *   `/progress` -> **604-Page Quran Progress Map & Analytics**
    *   `/advisor` -> **Pedagogical Assistant** (Free Gemini Flash + Deterministic fallback)
    *   `/settings` -> **Data Management, Audio, Font & Account Controls**
*   **Back Button Discipline:** When inside an active session (`/session`), pressing the browser back button or modal close must prompt an explicit exit confirmation modal to prevent accidental loss of repeat counts.

### 1.2 Home Screen / Dashboard Hierarchy ("ما هو وِردي اليوم؟")
*   **Core Question Answered:** The dashboard exists for one singular purpose: answering *"What is my Quranic duty today?"* within 2 seconds of opening the application.
*   **Visual Hierarchy (Top-to-Bottom):**
    1.  **Daily Wird Hero Card (بطاقة الورد اليومي):**
        *   Dual Track: **New Memorization (الحفظ الجديد)** (e.g., Al-Mulk: 1-10) + **Overdue Revision (المراجعة الواجبة)** (e.g., Al-Waqi'ah: 1-30).
        *   One-tap "Start Wird" primary CTA button launching directly into `/session`.
    2.  **Daily Progress Micro-Bar:** 3 states: Pending (لم يبدأ), In Progress (قيد الإنجاز), Completed (تم بحمد الله).
    3.  **Active Plan Trajectory:** Remaining days, overall progress bar (real calculated %), and current milestone.
    4.  **Retention Health Status:** Total active portions categorized into: *Stable (راسخ)*, *Needs Revision (يحتاج مراجعة)*, *Weak (ضعيف)*.
    5.  **Quick Action Bar:** Quick Test, Browse Mushaf, Export Backup.

### 1.3 Memorization Session Lifecycle & UX State Machine
The session is modeled as a strictly typed Finite State Machine (FSM):
```
[IDLE] 
  │ Launch with Surah/Ayah range + Mode (New/Review)
  ▼
[WARMUP / LISTENING] 
  │ Audio recitation playback with synchronized Ayah highlighting
  ▼
[PRACTICE / REPETITIONS] 
  │ Interactive word masking (0% -> 30% -> 60% -> 100%)
  │ Spacebar / Tap counter for target repetitions (e.g., 5x, 10x, 20x)
  ▼
[SELF-ASSESSMENT MODAL]
  │ Strict self-grading: Again (1) | Hard (2) | Good (3) | Strong (5)
  ▼
[ATOMIC PERSISTENCE]
  │ Update Unified Progress Model -> Update LocalStorage -> Trigger Streak Update
  ▼
[COMPLETION SUMMARY]
  │ Next Wird suggestion -> Return to Dashboard
```
*   **UX Rules:**
    *   Spacebar, on-screen tap, or Bluetooth clicker increments the repeat counter.
    *   Audio loop count matches target repeats with configurable delay between verses (1s, 2s, 3s).
    *   Masking levels: Level 0 (Full text), Level 1 (Hide alternate words), Level 2 (First letter only), Level 3 (Blanked out with length hints).

### 1.4 Overdue Revision Handling & Backlog Triage
*   **The Problem:** In conventional apps, missing 5 days generates an overwhelming, demotivating pile of 50+ overdue review items, causing total user abandonment.
*   **WIRD Backlog Triage Policy:**
    1.  **Cap Daily Review Queue:** Maximum 20 review portions per day, prioritized by lowest Stability and highest Ease Factor decay.
    2.  **Grace Period (فترة سماح):** 24-hour grace window where overdue items do not penalize the SM-2 Ease Factor.
    3.  **Freeze / Catch-up Mode (تجميد الحفظ الجديد):** If overdue items exceed 15 portions, the dashboard automatically suggests pausing new memorization for 48 hours to consolidate existing retention.
    4.  **Bulk Re-anchoring:** Allow one-click redistribution of excessive overdue tasks across the following 7 days.

### 1.5 Adaptive Planning & Workload Rescheduling
*   **Planning Logic:**
    *   **Pacing Modes:** Fixed End Date (Target date determines daily verse quota) vs. Fixed Daily Pace (User chooses 1 page/day or 5 ayahs/day, engine computes end date).
    *   **Weekly Rest Day (يوم الاستراحة والمراجعة الكبرى):** Configurable off-day (default: Friday) where no new memorization is assigned; the day is reserved exclusively for major revision (المراجعة الكبرى) of the past 2 weeks.
    *   **Pacing Adaptation:** If a user falls behind by >3 scheduled tasks, `PlanningEngine` provides an explicit "Re-align Plan (إعادة جدولة)" button that recalculates future uncompleted milestones while preserving already completed records.

### 1.6 Truthful Metrics vs. Vanity Statistics
*   **Strict Audit Finding (Verified in Code):** In `src/components/dashboard/DashboardView.tsx` (lines 55-56), the application currently displays:
    ```typescript
    const totalMemorizedAyahs = 172; // Hardcoded static dummy value
    const totalMemorizedPages = 14;  // Hardcoded static dummy value
    ```
*   **Mandatory Metric Replacement:**
    *   `totalMemorizedAyahs`: Sum of unique Ayahs across all portions where status is `stable` or `recently_memorized`.
    *   `totalMemorizedPages`: Calculated by mapping unique memorized Ayahs to page numbers using the 604-page mapping table in Tanzil metadata.
    *   `currentStreak`: Computed by scanning daily session logs in `StorageService` backwards from today/yesterday.
    *   `retentionIndex`: Weighted formula: `(Count(Stable) * 1.0 + Count(RecentlyMemorized) * 0.8 + Count(NeedsRevision) * 0.4) / TotalTrackedPortions * 100`.

### 1.7 Guest Mode vs. Authenticated Account Capabilities
| Feature | Guest Mode (Local-First) | Authenticated (Firebase Spark) |
| :--- | :---: | :---: |
| Full 114 Surah Tanzil Text & Audio | ✅ Unrestricted | ✅ Unrestricted |
| Memorization & Spaced Revision Engines | ✅ LocalStorage | ✅ Local + Cloud Sync |
| Custom Plan Generation | ✅ Unlimited | ✅ Unlimited |
| Data Export / Import (JSON Backup) | ✅ Full Support | ✅ Full Support |
| Cross-Device Automatic Synchronization | ❌ Local device only | ✅ Automatic sync |
| Cloud Backup Protection against browser wipe | ❌ Vulnerable to cache clear | ✅ Permanent cloud backup |
| AI Pedagogical Advisor | ✅ Rate-limited (15 RPM) | ✅ Rate-limited (15 RPM) |

### 1.8 Local vs. Cloud Persistence & The Firebase Spark Guarantee
*   **Spark Compatibility Contract:**
    *   All features work indefinitely without Firebase billing (Blaze is prohibited).
    *   Firestore document model is strictly bounded to prevent exceeding 50,000 reads/day and 20,000 writes/day:
        *   User profile document: `users/{uid}` (Settings, active plan ID, streak, summary stats).
        *   Portions document: `users/{uid}/data/portions` (Compressed JSON or array of portion records, batched write on session end).
        *   Daily logs collection: `users/{uid}/logs/{YYYY-MM-DD}` (One document write per active day).
*   **Email Verification Gating:** Unverified email accounts are treated as Local-Only with a banner. Cloud Firestore read/write rules reject synchronization until `request.auth.token.email_verified == true`.
*   **Guest-to-Account Migration Pipeline:** When a guest registers or logs in:
    1. Detect existing localStorage data.
    2. Prompt user: *"We found existing memorization progress on this device. Merge with your account?"*
    3. On confirmation: write local snapshot into Firestore via batched write, preserve all local timestamps.

### 1.9 First-Time Onboarding Experience
*   **Step 1: Welcome & Diagnostic Choice:**
    *   Option A: *"I am a beginner starting fresh"* -> Quick preset selection (Juz Amma, Surah Al-Mulk, or Surah Al-Baqarah).
    *   Option B: *"I already have existing memorization"* -> Interactive 30-Juz checklist to rapidly mark already-memorized Surahs/Juz before setting up a revision plan.
    *   Option C: *"Import JSON backup"* -> Instant restoration for migrating users.
*   **Step 2: Pace & Time Commitment:**
    *   Selection of daily capacity (5 mins, 15 mins, 30 mins) and preferred recitation reciter.
*   **Step 3: Instant First Wird:** Immediately presents Day 1 task with zero configuration friction.

### 1.10 Accessibility, Arabic Typography & Visual Mushaf Standards
*   **Arabic Typeface:**
    *   Primary text: High-legibility Uthmani font (`KFGQPC Uthman Taha Naskh` / `Amiri Quran`) with crisp diacritical rendering (*Tashkeel*).
    *   Strict typography rules: `line-height: 2.2` to `2.6` to prevent diacritic clipping on superscripts (*Damma*, *Shadda*, *Tanween*) and subscripts (*Kasra*).
    *   Dynamic font scaling: Slider ranging from 1.25rem (compact) to 2.5rem (large print for senior users).
*   **Color Contrast & Mushaf Aesthetics:**
    *   Dark mode: Deep warm slate background (`#0F172A`), cream/gold text (`#F8FAFC` / `#FDE047`), avoiding pure harsh `#000000` or eye-straining `#FFFFFF`.
    *   Ayah End Markers: Ornate Quranic glyphs `۝` containing the verse number rendered in muted gold (`#D97706`).

### 1.11 Tafsir & Ayah Reflection Integration
*   **Source Data:** Integration with free, reliable, lightweight classical Tafsir (e.g., *Tafsir Al-Muyassar* / *تفسير الميسر* and *Mukhtasar fi Tafsir*).
*   **Implementation Design:**
    *   Stored as clean, static JSON chunks indexed by `surah:ayah` or fetched on-demand from free open public endpoints (e.g., `cdn.jsdelivr.net` / Quran.com API).
    *   Rendered inside a slide-over sheet or modal when long-pressing or tapping an Ayah during a memorization session or library reading.
    *   Zero cost, zero API keys required.

### 1.12 Free Gemini AI Advisor Boundaries & Deterministic Fallback
*   **Current Backend (Verified):** `server.ts` mounts `/api/advisor` routing to Gemini `gemini-2.5-flash` with in-memory sliding-window rate-limiting (15 requests/minute per IP).
*   **Safety & Operational Constraints:**
    *   **Strict Islamic Pedagogical Prompting:** System instruction explicitly prohibits issuing fatwas, theological rulings, or sectarian debates. The assistant is strictly an educational coach (organizing revision schedules, memorization techniques like *Tafkeek*, and psychological motivation).
    *   **Deterministic Offline Engine (`DeterministicAdvisorEngine`):** If the network is offline, if the API key is absent, or if the rate limit is exceeded, the app seamlessly falls back to local rule-based coaching without throwing UI errors.

### 1.13 Progressive Web App (PWA) & Mobile Touch Ergonomics
*   **Vite PWA Configuration:**
    *   Manifest with standalone display mode, Arabic RTL metadata, theme color `#0F172A`.
    *   Service worker caching core HTML, CSS, JavaScript, Tanzil Quran text, and offline icons.
*   **Audio Recitation Caching:**
    *   Audio recitations from EveryAyah CDN (`https://everyayah.com/data/...`) are streamed on demand.
    *   PWA runtime caching rule caches the active session's verses into the CacheStorage API so repeated playback during a session never fails on intermittent mobile data.
*   **Touch Targets:** Minimum 48x48px tap targets for Ayah markers, audio play controls, and repeat buttons to accommodate thumb navigation on mobile devices.

---

## 2. Current Application Architecture Assessment

### 2.1 Technology Stack & Runtime Profile
*   **Framework:** React 18.3.1 SPA with TypeScript 5.5.3, bundled via Vite 6.0.5.
*   **Styling:** Tailwind CSS with `@tailwindcss/vite` plugin and `lucide-react` icons.
*   **Backend Server:** Express 4.21.2 (`server.ts`) running `vite.middlewares` in development, serving static assets in production, and hosting `/api/advisor`.
*   **Test Environment:** Custom Node.js runner (`node run-tests.js`) executing TypeScript test suites compiled with `tsx`. Currently 76 passing tests.

### 2.2 Component Hierarchy & State Distribution
```
App.tsx (Global Root State)
  ├── AuthProvider (AuthContext.tsx)
  │     ├── currentUser (Firebase User | null)
  │     ├── isGuest (boolean, backed by 'wird_guest_mode_preference')
  │     └── emailVerificationSent (null | boolean)
  ├── Header.tsx (Global navigation, streak counter, user pill)
  ├── Sidebar.tsx (9 Navigation items, mobile responsive drawer)
  └── Active Tab View:
        ├── DashboardView.tsx
        ├── QuranLibraryView.tsx
        ├── MemorizationPlansView.tsx
        ├── MemorizationSessionView.tsx
        ├── SpacedRevisionView.tsx
        ├── MemorizationTestsView.tsx
        ├── ProgressAnalyticsView.tsx
        ├── AIAdvisorView.tsx
        └── SettingsView.tsx
```

### 2.3 Data Storage & Local Persistence Inventory
The application currently manages several separate localStorage keys through `StorageService`:
1.  `wird_plans`: Array of `MemorizationPlan` objects generated by `PlanningEngine`.
2.  `wird_portions_status`: Array of `PortionStatusRecord` objects (SM-2 implementation in `RetentionService`).
3.  `wird_revision`: Array of `RevisionItem` objects (Secondary SM-2 implementation in `SpacedRevisionEngine`).
4.  `wird_sessions`: Array of historical session logs (`SessionHistoryEntry`).
5.  `wird_settings`: User preference object (theme, reciter, daily goal, font size).
6.  `wird_guest_mode_preference`: String boolean `'true'` indicating explicit guest selection.

---

## 3. Full Application & UX Audit: Verified Findings & Technical Debt

### 3.1 Critical Architectural Inconsistencies

#### Finding 3.1.1 — Dual Conflicting Revision Engines & Storage Keys (HIGH SEVERITY)
*   **Verified Code Facts:**
    *   Engine A: `src/services/retentionService.ts` defines `PortionStatusRecord` with 6 statuses (`stable`, `recently_memorized`, `needs_revision`, `weak`, `currently_memorizing`, `not_memorized`) and stores to key `'wird_portions_status'`.
    *   Engine B: `src/services/spacedRevisionEngine.ts` defines `RevisionItem` with 3 statuses (`strong`, `medium`, `weak`) and stores to key `'wird_revision'`.
    *   `ProgressAnalyticsView.tsx` and `DashboardView.tsx` read from `retentionService.ts`, while `SpacedRevisionView.tsx` reads and writes to `spacedRevisionEngine.ts`.
*   **Consequence:** Completing a revision in `SpacedRevisionView` does not update the visual 604-page grid in `ProgressAnalyticsView`, and marking a portion memorized in `ProgressAnalyticsView` does not schedule it in `SpacedRevisionView`.
*   **Remediation:** Consolidate into a single, unified `WirdPortion` schema and single SM-2 engine. Deprecate `spacedRevisionEngine.ts` in favor of an upgraded `retentionService.ts`.

#### Finding 3.1.2 — Fake Hardcoded Dashboard Statistics (HIGH SEVERITY)
*   **Verified Code Facts:** In `src/components/dashboard/DashboardView.tsx`, lines 55-56:
    ```typescript
    const totalMemorizedAyahs = 172;
    const totalMemorizedPages = 14;
    ```
*   **Consequence:** Regardless of whether the user is a brand new guest or has memorized the entire Quran, the dashboard permanently displays "172 آية" and "14 صفحة". This violates Core Tenet 1 (Zero Fake Metrics).
*   **Remediation:** Compute these figures live from `storageService.getPortionsStatus()`.

#### Finding 3.1.3 — Hardcoded Static Test Questions in Testing Suite (HIGH SEVERITY)
*   **Verified Code Facts:** In `src/components/tests/MemorizationTestsView.tsx` (lines 40-75), the four testing modes (`complete_verse`, `bidirectional_recall`, `next_verse`, `surah_identification`) pull questions from static hardcoded arrays containing only Al-Fatiha, Al-Baqarah 1-5, and Ayat al-Kursi.
*   **Consequence:** The user cannot test their retention on the Surahs they actually studied; every test presents the exact same 4 sample questions.
*   **Remediation:** Replace static arrays with a dynamic `TestQuestionGenerator` that queries `completeQuranData.json` filtered by the user's memorized portions.

#### Finding 3.1.4 — Developer Diagnostic Unit Runner Exposed in User UI (MEDIUM SEVERITY)
*   **Verified Code Facts:** In `src/components/plans/MemorizationPlansView.tsx` (lines 147-156 and 315-334), a tab named "فحوصات النظام (Diagnostics)" executes `runAllPlanningEngineTests()` and renders unit test pass/fail results directly in the production UI.
*   **Consequence:** Clutters user-facing production UI with internal developer tooling.
*   **Remediation:** Remove the Diagnostics tab from the public UI; developer tests belong exclusively in the automated CLI test runner (`npm test`).

#### Finding 3.1.5 — 2.0MB Unchunked Quran JSON in Main Client Bundle (PERFORMANCE RISK)
*   **Verified Code Facts:** `completeQuranData.json` is a single 2,042,488 byte (2.0MB) file imported statically via `import COMPLETE_QURAN_DATA from '../../data/completeQuranData.json'` in `verifiedAyahs.ts`.
*   **Consequence:** Increases initial JavaScript bundle download size and memory consumption on lower-end mobile devices.
*   **Remediation:** Retain Tanzil reference metadata for validation, but lazy-load Surah text chunks or rely on dynamic imports by Juz/Surah in Phase 3.

#### Finding 3.1.6 — Navigation Lacks URL Routing & Back Button Support (UX RISK)
*   **Verified Code Facts:** `App.tsx` controls navigation using `const [currentTab, setCurrentTab] = useState<NavTabId>('dashboard')`.
*   **Consequence:** When a user opens a session or views a plan and taps the physical/browser "Back" button, the browser leaves the application entirely instead of navigating to the previous view.
*   **Remediation:** Introduce router state synchronization.

---

## 4. Memorization, Revision, and Planning Redesign

### 4.1 Unified Data Model: `WirdPortion`
We replace `PortionStatusRecord` and `RevisionItem` with one authoritative interface:

```typescript
export type PortionStatus = 
  | 'stable'                // راسخ (Interval >= 21 days, EaseFactor >= 2.3)
  | 'recently_memorized'    // حديث الحفظ (Interval between 3 and 20 days)
  | 'needs_revision'        // يحتاج مراجعة (DueDate <= Today)
  | 'weak'                  // ضعيف (Grade < 3 in last session)
  | 'currently_memorizing'  // قيد الحفظ (Active target in plan)
  | 'not_memorized';        // لم يُحفظ بعد

export interface WirdPortion {
  id: string;               // Normalized ID: "s{surah}_a{start}_a{end}" (e.g. "s67_a1_a10")
  surahNumber: number;      // 1 - 114
  startAyah: number;        // 1 - MaxAyah
  endAyah: number;          // 1 - MaxAyah
  pageStart: number;        // 1 - 604
  pageEnd: number;          // 1 - 604
  juzNumber: number;        // 1 - 30
  status: PortionStatus;
  
  // SM-2 Spaced Repetition Core Parameters
  repetitionCount: number;  // n: Number of consecutive successful reviews
  intervalDays: number;     // I: Current interval in days
  easeFactor: number;       // EF: Minimum 1.3, standard default 2.5
  dueDate: string;          // ISO string 'YYYY-MM-DD'
  lastReviewedDate?: string;// ISO string 'YYYY-MM-DD'
  
  // Performance History & Analytics
  totalReviews: number;
  totalLapses: number;      // Number of times graded < 3
  lastGrade?: number;       // 1 (Again), 2 (Hard), 3 (Good), 5 (Strong)
  averageDurationSec?: number;
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Standardized SuperMemo SM-2 Algorithm Implementation
Every review grading updates the portion according to the following mathematical rules:
```typescript
export function calculateSM2(
  portion: WirdPortion,
  grade: 1 | 2 | 3 | 5 // 1: Again, 2: Hard, 3: Good, 5: Strong
): { intervalDays: number; easeFactor: number; repetitionCount: number; dueDate: string } {
  let { repetitionCount, intervalDays, easeFactor } = portion;

  if (grade >= 3) {
    // Successful recall
    if (repetitionCount === 0) {
      intervalDays = 1;
    } else if (repetitionCount === 1) {
      intervalDays = grade === 5 ? 4 : 3;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitionCount += 1;
  } else {
    // Lapse (Grade 1 or 2)
    repetitionCount = 0;
    intervalDays = 1;
  }

  // Update Ease Factor: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  if (easeFactor > 2.8) easeFactor = 2.8;

  // Calculate next due date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + intervalDays);
  const dueDate = nextDate.toISOString().split('T')[0];

  return { intervalDays, easeFactor, repetitionCount, dueDate };
}
```

### 4.3 Dynamic Test Question Generator
Instead of static arrays, the test generator inspects the user's active and stable portions to produce targeted questions:
1.  **Complete the Ayah (أكمل الآية التالية):** Selects random Ayah $N$ from memorized portions; user must select or type Ayah $N+1$.
2.  **Surah Identification (من أي سورة؟):** Displays an Ayah from a memorized portion; user identifies the Surah from 4 multiple-choice options.
3.  **Verse Order & Context (الربط والسياق):** Shows verse text with a blanked center word; user picks the correct word (tests Mutashabihat and exactness).
4.  **Reverse Lookup (بداية الربع أو الصفحة):** User is asked to identify the opening verse of a given page or quarter.

---

## 5. Data Architecture & Migration Strategy

### 5.1 Storage Hierarchy & Spark Budget Allocation
Firebase Spark (free tier) limits:
*   Cloud Firestore: 1GB total storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day.
*   Firebase Authentication: Unlimited email/password and anonymous accounts.
*   Hosting: 10GB storage, 360MB/day bandwidth (or Vercel unlimited for frontend).

To guarantee that WIRD never breaches Spark free quotas, the cloud database is structured as **compact consolidated documents** rather than one document per Ayah:

```
firestore
  └── users/{uid}
        ├── document: profile
        │     ├── email: string
        │     ├── displayName: string
        │     ├── activePlanId: string
        │     ├── streakCount: number
        │     ├── lastActiveDate: string
        │     └── summaryMetrics: { totalMemorizedAyahs, totalPages, retentionIndex }
        │
        ├── document: portions_blob
        │     ├── version: 2
        │     ├── lastSyncedAt: timestamp
        │     └── portions: [ { id, surah, start, end, status, interval, dueDate, ... } ]
        │
        └── collection: daily_logs
              └── document: {YYYY-MM-DD}
                    ├── date: string
                    ├── sessionsCompleted: number
                    ├── ayahsStudied: number
                    ├── totalMinutes: number
                    └── gradesSummary: { again: X, hard: Y, good: Z, strong: W }
```
*Total writes per active user per day: 1 write to `portions_blob` + 1 write to `daily_logs` + 1 write to `profile` = 3 writes/day. 1,000 daily active users generate ~3,000 writes/day, well below the 20,000 daily limit.*

### 5.2 Atomic Backup & Migration Pipeline
1.  **JSON Backup Format (Version 2.0):**
    ```json
    {
      "app": "WIRD",
      "version": "2.0",
      "exportedAt": "2026-11-05T12:00:00Z",
      "user": { "isGuest": true },
      "plans": [ ... ],
      "portions": [ ... ],
      "sessions": [ ... ],
      "settings": { ... }
    }
    ```
2.  **Schema Versioning & Upgrader:**
    *   When `StorageService.loadInitialData()` runs, it checks `wird_schema_version`.
    *   If version is 1 (or missing), a lossless migration utility maps legacy `wird_portions_status` and `wird_revision` into the unified `WirdPortion` schema and writes the new `wird_portions_v2` key.

---

## 6. Prioritized MVP-to-Launch Roadmap

```
Phase 2 (Current) ──────► Phase 3 (Core Remediation) ──────► Phase 4 (Polish & PWA) ──────► Phase 5 (Beta Launch)
Blueprint & Audit       P0 Data & Routing Fixes             UI/UX & Mobile Ergonomics       Verification & Deploy
```

### 6.1 Phase 3: P0 Launch Blockers (Beta Critical)
*   [ ] **Task 3.1: Data Model Unification**
    *   Deprecate duplicate revision model (`RevisionItem` vs `PortionStatusRecord`).
    *   Implement unified `WirdPortion` and upgraded `RetentionService`.
    *   Add automated migration for existing localStorage keys.
*   [ ] **Task 3.2: Truthful Metrics Engine**
    *   Eliminate hardcoded constants (`172 ayahs`, `14 pages`) in `DashboardView.tsx`.
    *   Wire real calculations from active portions and session logs.
*   [ ] **Task 3.3: Dynamic Test Question Generator**
    *   Replace static question arrays in `MemorizationTestsView.tsx` with dynamic queries against `COMPLETE_QURAN_DATA` for user-memorized verses.
*   [ ] **Task 3.4: Production UI Cleanup**
    *   Remove Developer Diagnostics tab from `MemorizationPlansView.tsx`.
*   [ ] **Task 3.5: Router Integration**
    *   Implement lightweight hash-based routing to support browser back button navigation and deep links for sessions.

### 6.2 Phase 4: P1 Polish & Mobile Readiness
*   [ ] **Task 4.1: Tanzil Data Chunking**
    *   Split `completeQuranData.json` into lazy-loaded Surah/Juz chunks to optimize bundle size and TTI.
*   [ ] **Task 4.2: Mobile Mushaf Touch Ergonomics**
    *   Optimize 604-page visual map for mobile viewport with zoomable / virtualized list.
    *   Ensure all tap targets meet 48x48px accessibility minimums.
*   [ ] **Task 4.3: Service Worker Audio Caching**
    *   Configure PWA runtime cache for current session audio files.
*   [ ] **Task 4.4: Tafsir Sheet Integration**
    *   Integrate lightweight static *Tafsir Al-Muyassar* overlay modal.

### 6.3 Phase 5: Cloud Sync (Firebase Spark) & Final Beta Deployment
*   [ ] **Task 5.1: Consolidated Firestore Sync Service**
    *   Implement `SyncService` for verified email accounts conforming to Spark write-budget rules.
    *   Implement guest-to-cloud merge prompt.
*   [ ] **Task 5.2: Final Verification & Vercel Production Deployment**
    *   Execute full test suite (`npm test`), lint (`tsc --noEmit`), and production build (`vite build`).
    *   Verify GitHub Actions and Vercel production preview.

---

## 7. Architectural Sign-Off & Verification Criteria

| Verification Gate | Requirement | Target Status |
| :--- | :--- | :---: |
| **Code Modification in Phase 2** | No application code modified during blueprint phase | ✅ ENFORCED |
| **Quran Text Integrity** | Zero changes to `completeQuranData.json` or Tanzil datasets | ✅ ENFORCED |
| **Financial Constraint** | 100% Firebase Spark compatible, zero paid APIs | ✅ ENFORCED |
| **Test Integrity** | All 76 existing unit and integration tests remain passing | ✅ VERIFIED |
| **Build Stability** | `npm run build` exits 0 with zero TypeScript errors | ✅ VERIFIED |

**Lead Architect Verdict:** The WIRD Phase 2 Blueprint is approved for immediate implementation. Transition to Phase 3 execution is authorized.
