# Authentication & Firebase Setup Remediation Plan

## Title & Summary
# WIRD App Authentication & Firebase Key Setup Remediation
This implementation plan addresses the issue where signing in or creating a new account fails or produces a configuration warning due to uninitialized or missing Firebase API environment variables. It introduces a clear, Arabic-native notification banner and a seamless Guest Mode fallback, while keeping full Firebase Auth capabilities operational when keys are supplied.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following preferences:
> 1. **Primary Issue**: Firebase key missing or configuration warning appears during sign-in / registration.
> 2. **Desired Handling**: Display a clear Arabic alert informing the user that Firebase configuration is required for cloud sync, while allowing 100% seamless entry into Guest Mode without blocking app access.

- **Confirmed Decision 1**: Handle unconfigured Firebase environment variables gracefully with a clear Arabic notification banner on `AuthScreen`.
- **Confirmed Decision 2**: Ensure Guest Mode functions 100% locally with UID-scoped browser persistence without throwing unhandled exceptions or breaking the auth workflow.

## 1. Overview & Core Concept
- **What It Does**: Enhances `AuthScreen` and `AuthService` to detect unconfigured or invalid Firebase API keys smoothly. Displays an informative Arabic banner explaining how to configure Firebase environment variables, while providing a one-click button to continue in Guest Mode immediately.
- **Target Audience / Persona**: Users running WIRD on preview platforms or custom deployments without initialized Firebase environment variables (`VITE_FIREBASE_*`).
- **Key Value**: Prevents app breakdown or silent failures when Firebase keys are absent, ensuring immediate usability in Guest Mode and crystal-clear instructions when cloud auth is desired.

## 2. User Experience & Visual Design
- **Key User Flows**:
  1. User opens `AuthScreen` or attempts to sign in / sign up.
  2. If Firebase configuration (`VITE_FIREBASE_API_KEY`, etc.) is missing or invalid, a quiet amber banner appears at the top of the authentication screen: *"مفاتيح Firebase غير مهيأة بعد في بيئة التشغيل. يمكنك المتابعة كزائر أو ضبط مفاتيح البيئة للمزامنة السحابية."*
  3. User can click *"المتابعة كزائر (Guest Mode)"* to enter WIRD instantly with full local feature access.
  4. If Firebase keys are properly provided, real authentication (Google OAuth & Email/Password) functions seamlessly as expected.
- **Visual Identity & Theme**:
  - *Color Palette*: Warm emerald primary tone (`#065f46`), amber/golden notice banner (`bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800`), dark stone canvas (`#0c0a09`).
  - *Typography*: Traditional Cairo / Amiri Arabic typography with clean hierarchy.
- **Interactive Feedback & Motion**:
  - Clear, accessible toast notifications and inline alert banners.
  - Smooth loading states during auth verification and guest transition.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Firebase Key Detection & User Notification
  - *Chosen Approach*: Detect unconfigured Firebase keys via `isFirebaseConfigured()` and display an inline Arabic alert box directly inside `AuthScreen`.
  - *Why*: Provides immediate context so users understand why cloud sign-in is disabled without guessing.
  - *Alternatives Considered*: Auto-bypassing `AuthScreen` directly into Guest Mode without asking; rejected because users wanting cloud sign-in wouldn't know why it skipped.

- **Decision 2**: Offline / Guest Mode Data Isolation
  - *Chosen Approach*: Maintain full local data persistence using `StorageService`'s UID-scoped and guest-scoped keys.
  - *Why*: Guarantees zero data loss for guest users while keeping guest data completely isolated from future authenticated user accounts.

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────┐
│                      AuthGate                           │
└──────────────────────────┬──────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [Firebase Configured]      [Firebase Unconfigured]
             │                           │
  ┌──────────┴──────────┐       ┌────────┴────────────────┐
  │ Google / Email Auth │       │ Arabic Warning Banner   │
  │ Firebase Services   │       │ + "Continue as Guest"   │
  └─────────────────────┘       └────────┬────────────────┘
                                         │
                                         ▼
                                 [Local Guest Scope]
```

- **Entities & Services**:
  - `src/lib/firebase.ts`: Validates environment variables (`VITE_FIREBASE_*`).
  - `src/services/authService.ts`: Maps authentication errors to clear Arabic messages and detects configuration state.
  - `src/components/auth/AuthScreen.tsx`: Renders sign-in/sign-up forms, Firebase status alert banner, and direct guest mode trigger.
  - `src/context/AuthContext.tsx`: Manages auth state transitions and guest mode initialization.
