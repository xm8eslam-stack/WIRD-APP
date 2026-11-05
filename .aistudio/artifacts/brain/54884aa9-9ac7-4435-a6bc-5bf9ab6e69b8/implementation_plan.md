# Production Authentication Test Integrity & State Semantics

Refine WIRD's Phase 1 Firebase Authentication layer to correct email verification state semantics, execute genuine production logic in tests, extract a testable guest-transition boundary, and ensure rigorous test isolation and robust test runner accounting.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All core security rules, protected Quran data files, and retention/planning engines remain strictly untouched. This patch focuses exclusively on authentication test integrity and UI state semantics.

- **Confirmed Decision 1**: `lastVerificationSent` is strictly `true` (success), `false` (failure), or `null` (unconfirmed). Login/Google auth never falsely trigger email verification flags.
- **Confirmed Decision 2**: Guest transition logic is extracted into a testable production helper function (`executeGuestTransition`) invoked directly by both `AuthContext.continueAsGuest()` and automated unit tests.
- **Confirmed Decision 3**: Test suite execution includes thorough cleanup (`finally` blocks, localStorage restoration, stub resetting) to prevent test contamination.

---

## 1. Overview & Core Concept

- **What It Does**: Corrects verification email UI state semantics, tests actual `AuthService.signUpWithEmail()` and `executeGuestTransition()` production functions without mock duplication, and guarantees 100% test isolation.
- **Target Audience / Persona**: WIRD users in authenticated or guest mode, and QA test auditors.
- **Key Value**: Absolute alignment between production code and automated test coverage, eliminating unverified mock tests and incorrect verification UI states.

---

## 2. User Experience & Visual Design

- **Verification Pending UI**: In `AuthScreen.tsx`, cleanly distinguishes between unconfirmed (`null`), failed (`false`), and successful (`true`) verification email sending states.
- **Design System**: Arabic RTL interface adhering to WIRD's Cairo typography and Tailwind design system.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Extracted Guest Transition Helper**:
  - *Chosen Approach*: Extract `executeGuestTransition` into `AuthContext.tsx` (or service module) so unit tests can invoke the exact same code path as the UI.
  - *Why*: Eliminates false-positive tests that merely simulated guest transitions manually.
- **Decision 2: Strict Null Semantics for `lastVerificationSent`**:
  - *Chosen Approach*: Default `lastVerificationSent` to `null`. Only update to `true` or `false` upon actual `signUpWithEmail` or `resendVerificationEmail` calls.
  - *Why*: Prevents misleading UI copy claiming an email was sent during login or Google sign-in.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      AuthContext                       │
│  - executeGuestTransition() (Shared Production Helper) │
│  - lastVerificationSent: true | false | null           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                       AuthService                      │
│  - signUpWithEmail()                                   │
│  - resendVerificationEmail()                           │
│  - logout()                                            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                      Firebase Auth                     │
│  - createUserWithEmailAndPassword()                    │
│  - sendEmailVerification()                             │
│  - signOut()                                           │
└────────────────────────────────────────────────────────┘
```

- **State & Data Integrity**: Local storage keys (`wird_guest_mode_preference`, user plans, profiles, revision logs) are fully preserved across auth cycles and test suites.
