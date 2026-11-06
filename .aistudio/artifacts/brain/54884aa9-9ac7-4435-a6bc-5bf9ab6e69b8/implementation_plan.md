# Firebase Unauthorized Domain Resolution Plan

## Title & Summary
# WIRD App Firebase Unauthorized Domain Error Resolution
This implementation plan provides a complete, developer-friendly resolution for the `auth/unauthorized-domain` error in Firebase Authentication. When a user attempts cloud sign-in from an unapproved domain, WIRD will display a dedicated, interactive Arabic alert displaying the current domain (`window.location.hostname`), a one-click copy button, step-by-step instructions for adding the domain in Firebase Console (Authentication → Settings → Authorized Domains), and an instant 1-click Guest Mode fallback button.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following preferences:
> 1. **Primary Issue**: `Firebase: Error (auth/unauthorized-domain)`.
> 2. **Desired Handling**: Display the current domain (`window.location.hostname`) with a one-click copy button, clear Arabic instructions for authorizing it in Firebase Console, and an instant Guest Mode button to continue locally without blockage.

- **Confirmed Decision 1**: Handle `auth/unauthorized-domain` explicitly in `mapAuthError` with clear Arabic guidance.
- **Confirmed Decision 2**: Render a dedicated interactive helper card in `AuthScreen.tsx` whenever `auth/unauthorized-domain` occurs, complete with domain copying and immediate Guest Mode fallback.

## 1. Overview & Core Concept
- **What It Does**: Enhances `AuthService` and `AuthScreen` to handle `auth/unauthorized-domain` errors seamlessly. Displays an interactive alert box containing the exact active domain (`window.location.hostname`), a copy button, guidance on how to authorize the domain in Firebase Console, and a quick-action button to proceed in Guest Mode.
- **Target Audience / Persona**: Developers, testers, and end users accessing WIRD from preview URLs, Vercel deployments, or custom domains.
- **Key Value**: Eliminates cryptic Firebase error messages, guides administrators on authorizing domains in Firebase Console in 30 seconds, and ensures end users are never blocked from accessing WIRD in Guest Mode.

## 2. User Experience & Visual Design
- **Key User Flows**:
  1. User attempts to sign in via Google or Email/Password on an unlisted domain.
  2. Firebase returns `auth/unauthorized-domain`.
  3. `AuthScreen` captures the error and displays a high-visibility amber/emerald helper box:
     - Title: *"عفواً، هذا النطاق غير مصرح به في Firebase"*
     - Active Domain Box: `ais-dev-hmf6x7enk7svd65t7ier2e-240287315640.europe-west2.run.app`
     - One-click "نسخ النطاق" (Copy Domain) button with feedback toast ("تم نسخ النطاق بنجاح").
     - Step-by-step guidance: *"أضف هذا النطاق إلى: Firebase Console ← Authentication ← Settings ← Authorized Domains"*
     - Instant Fallback Button: *"المتابعة فوراً كزائر (Guest Mode)"*
- **Visual Identity & Theme**:
  - *Color Palette*: Amber alert container (`bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800`), monospace domain tag (`bg-white dark:bg-stone-900`), emerald action button (`bg-emerald-800 hover:bg-emerald-900`).
  - *Typography*: Monospace for domain names, Cairo/quran display face for titles.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Explicit Domain Copy Tool
  - *Chosen Approach*: Extract `window.location.hostname` dynamically and present it inside a code block with `navigator.clipboard.writeText`.
  - *Why*: Allows admins to copy the exact origin instantly and paste it directly into Firebase Console without typing errors.

- **Decision 2**: Unblocked Local Access
  - *Chosen Approach*: Provide a prominent "Continue as Guest" CTA inside the error card.
  - *Why*: Ensures users are never locked out of WIRD even if domain authorization in Firebase Console is delayed.

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────┐
│                      AuthScreen                         │
└──────────────────────────┬──────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
  [Standard Error Box]     [auth/unauthorized-domain]
             │                           │
  ┌──────────┴──────────┐       ┌────────┴────────────────┐
  │ Generic Error Text  │       │ Dedicated Domain Card   │
  └─────────────────────┘       │ - Domain Copy Button    │
                                │ - Firebase Console Steps│
                                │ - Guest Mode Shortcut  │
                                └─────────────────────────┘
```

- **Entities & Services**:
  - `src/services/authService.ts`: Maps `auth/unauthorized-domain` to a friendly Arabic message and domain guidance.
  - `src/components/auth/AuthScreen.tsx`: Detects `auth/unauthorized-domain` code and renders the interactive domain copy box and Guest Mode shortcut.
