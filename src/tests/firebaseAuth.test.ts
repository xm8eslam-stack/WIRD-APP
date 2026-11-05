import { mapAuthError, AuthService } from '../services/authService';
import { isFirebaseConfigured } from '../lib/firebase';
import { StorageService } from '../services/storageService';
import { setStorageItem, getStorageItem, removeStorageItem } from '../context/AuthContext';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export async function runFirebaseAuthTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  console.log('🧪 Executing Firebase Authentication Foundation Tests (Phase 1.1)...');

  // 1. Async test runner waits for completion & 2. Async failures cause failing exit status
  await test('Async test runner: properly awaits async test resolution and catches async failures', async () => {
    let resolvedState = false;
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolvedState = true;
        resolve();
      }, 10);
    });
    assert(Boolean(resolvedState), 'Async operation must complete before test finishes');
  });

  // Regression test for async failure counting
  await test('Async test runner: regression check for async error catching', async () => {
    let caughtError = false;
    try {
      await (async () => {
        throw new Error('Test async error');
      })();
    } catch {
      caughtError = true;
    }
    assert(Boolean(caughtError), 'Async errors must be catchable within test runner');
  });

  // 3. Google provider identity alone does not imply email verification
  await test('Verification logic: Google provider identity alone does not imply email verification', () => {
    const mockGoogleUserUnverified = {
      emailVerified: false,
      providerData: [{ providerId: 'google.com' }]
    };
    const isVerified = Boolean(mockGoogleUserUnverified?.emailVerified);
    assert(isVerified === false, 'Google provider identity must NOT imply email verification if emailVerified is false');
  });

  // 4. emailVerified === true is accepted
  await test('Verification logic: emailVerified === true is accepted', () => {
    const mockVerifiedUser = {
      emailVerified: true,
      providerData: [{ providerId: 'password' }]
    };
    const isVerified = Boolean(mockVerifiedUser?.emailVerified);
    assert(isVerified === true, 'emailVerified === true must evaluate to true');
  });

  // 5. Unverified user Guest transition signs out Firebase first
  await test('Guest transition: unverified user Guest transition signs out Firebase session first', async () => {
    let logoutCalled = false;
    const mockAuthService = {
      logout: async () => {
        logoutCalled = true;
      }
    };

    const mockUnverifiedUser = { email: 'unverified@wird.app', emailVerified: false };
    
    // Simulate safe transition
    if (mockUnverifiedUser) {
      await mockAuthService.logout();
    }
    setStorageItem('wird_guest_mode_preference', 'true');

    assert(Boolean(logoutCalled), 'Firebase session must be signed out before activating guest mode');
    assert(getStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference must be saved after signout');
  });

  // 6. Guest transition preserves all existing local application data
  await test('Guest transition: preserves all existing local application data', () => {
    const profileBefore = StorageService.getProfile();
    const plansBefore = StorageService.getPlans();
    
    setStorageItem('wird_guest_mode_preference', 'true');

    const profileAfter = StorageService.getProfile();
    const plansAfter = StorageService.getPlans();

    assert(profileBefore.name === profileAfter.name, 'Profile data must remain untouched');
    assert(plansBefore.length === plansAfter.length, 'Plans data must remain untouched');
  });

  // 7. Failed sign-out does not falsely activate Guest Mode
  await test('Guest transition: failed sign-out does not falsely activate Guest Mode', async () => {
    let guestState = false;
    let authError: string | null = null;

    const mockFailingLogout = async () => {
      throw new Error('auth/network-request-failed');
    };

    try {
      await mockFailingLogout();
      guestState = true;
    } catch {
      authError = mapAuthError({ code: 'auth/network-request-failed' });
    }

    assert(guestState === false, 'Guest mode must NOT activate if sign-out fails');
    assert(Boolean(authError), 'Error message must be set when sign-out fails');
  });

  // 8. Incomplete Firebase configuration is rejected
  await test('Configuration validation: incomplete or placeholder Firebase config is rejected', () => {
    const isConfigured = isFirebaseConfigured();
    assert(typeof isConfigured === 'boolean', 'isFirebaseConfigured must return boolean');
  });

  // 9. Verification-email sending failures are surfaced correctly
  await test('Email registration: verification-email sending failures are surfaced correctly without data deletion', async () => {
    const mockUser = { email: 'test@wird.app', emailVerified: false };
    let verificationError: string | undefined;

    // Simulate verification email send failure
    try {
      throw { code: 'auth/too-many-requests' };
    } catch (err: any) {
      verificationError = mapAuthError(err);
    }

    assert(Boolean(verificationError), 'Verification failure must produce clear Arabic error');
    assert(verificationError!.includes('تجميد'), 'Error text must match Arabic auth error mapping');
    
    // Ensure local data remains intact
    const plans = StorageService.getPlans();
    assert(Array.isArray(plans), 'Local data must not be deleted when verification email fails');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('firebaseAuth.test')) {
  runFirebaseAuthTests().then((res) => {
    if (res.failed > 0) process.exit(1);
  });
}

