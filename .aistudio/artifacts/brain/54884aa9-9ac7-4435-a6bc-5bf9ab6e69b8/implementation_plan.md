# Implementation Plan - Phase 1.1.4.1: Final Authentication Test Integrity Corrections

Refine authentication test integrity by extracting production state helpers, implementing dual-backend storage restoration, and verifying test runner aggregation reliability.

---

## 1. Core Logic Extraction & Refinement

- **Create `src/services/authUtils.ts`**:
  - Implement `calculateVerificationState`: A pure function that determines the next `lastVerificationSent` state based on the operation type (signup, resend, login) and its result.
  - **Logic**:
    - `login` -> always `null`.
    - `signup` / `resend` -> `true` on success, `false` on failure.
- **Update `src/context/AuthContext.tsx`**:
  - Integrate `calculateVerificationState` into `signUpWithEmail`, `loginWithEmail`, and `resendVerificationEmail`.
  - Implement `getAuthStorageSnapshot` and `restoreAuthStorageSnapshot` to manage the `memoryGuestStore` and `localStorage` for guest preferences.

## 2. Storage Service Enhancements

- **Update `src/services/storageService.ts`**:
  - Implement `getStorageSnapshot` and `restoreStorageSnapshot`.
  - Ensure these functions capture and restore both the `localStorage` state and the internal `memoryStorage` map used for non-browser environments.

## 3. Test Runner Reliability

- **Update `src/tests/runAllTests.ts`**:
  - Extract `executeSuiteAggregation`: A function that executes a list of test suites, aggregates their results, and gracefully handles asynchronous rejections without stopping the entire run.
  - Ensure rejected suites contribute correctly to the failure count and trigger a non-zero exit code.
- **Testing the Runner**:
  - Add unit tests for `executeSuiteAggregation` to verify correct counting of passed/failed tests and handling of `Promise.reject`.

## 4. Enhanced Behavioral Testing (`src/tests/firebaseAuth.test.ts`)

- **Verification State Behavioral Tests**: Use the actual `calculateVerificationState` helper to test transitions (initial null, signup success/fail, resend success/fail, login preservation).
- **Storage Restoration Verification**:
  - Add a dedicated test case that proves restoration works for the in-memory fallback store.
  - Verify that storage is restored even if a test throws an error.
- **Preserve Existing Coverage**: Maintain all behavioral tests for `AuthService.signUpWithEmail` and `handleContinueAsGuest`.

## 5. Verification Steps

1. **Linting**: Run `npm run lint` to ensure type safety and code quality.
2. **Building**: Run `npm run build` to verify no build regressions.
3. **Testing**: Run `npm test` and verify that:
   - All 70+ tests pass.
   - Aggregate failure counts are accurate.
   - Storage isolation is verified.
