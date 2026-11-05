/**
 * Production utility for calculating authentication state transitions.
 * Extracted for behavioral test integrity.
 */

export type AuthOperation = 'signup' | 'resend' | 'login';

export function calculateVerificationState(
  operation: AuthOperation,
  isSuccess: boolean,
  currentState: boolean | null = null
): boolean | null {
  switch (operation) {
    case 'login':
      // Login never indicates an email was sent by this application.
      return null;
    case 'signup':
    case 'resend':
      // Success means it was sent, false means it failed.
      return isSuccess;
    default:
      return currentState;
  }
}
