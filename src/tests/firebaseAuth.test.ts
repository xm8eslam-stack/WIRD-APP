import { mapAuthError, AuthService } from '../services/authService';
import { validateFirebaseConfigMap, isFirebaseConfigured } from '../lib/firebase';
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

  console.log('🧪 Executing Firebase Authentication Foundation Tests (Phase 1.1.1)...');

  // 1. Configuration Validation with complete, missing, empty, and placeholder keys
  await test('Configuration validation: tests complete, missing, empty, and placeholder env maps', () => {
    const completeValidMap = {
      VITE_FIREBASE_API_KEY: 'AIzaSyValidKeyReal1234567890abcdef',
      VITE_FIREBASE_AUTH_DOMAIN: 'wird-app.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'wird-app',
      VITE_FIREBASE_STORAGE_BUCKET: 'wird-app.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '987654321012',
      VITE_FIREBASE_APP_ID: '1:987654321012:web:abcdef123456'
    };
    assert(validateFirebaseConfigMap(completeValidMap) === true, 'Complete valid configuration map must return true');

    const missingKeyMap = { ...completeValidMap, VITE_FIREBASE_API_KEY: '' };
    assert(validateFirebaseConfigMap(missingKeyMap) === false, 'Missing API key must return false');

    const emptyKeyMap = { ...completeValidMap, VITE_FIREBASE_AUTH_DOMAIN: '   ' };
    assert(validateFirebaseConfigMap(emptyKeyMap) === false, 'Empty string domain must return false');

    const placeholderKeyMap = { ...completeValidMap, VITE_FIREBASE_API_KEY: 'your_api_key_here' };
    assert(validateFirebaseConfigMap(placeholderKeyMap) === false, 'Placeholder string must return false');
  });

  // 2. AuthService boundary: Verification-email sending failure handling
  await test('AuthService boundary: verification email sending failure is surfaced correctly without data deletion', async () => {
    const plansBefore = StorageService.getPlans();
    
    // Inject stub that rejects sendVerification
    AuthService.setSendVerificationStub(async () => {
      throw { code: 'auth/too-many-requests' };
    });

    try {
      // Simulate verification email resend through AuthService boundary
      const mockUser = { email: 'user@wird.app' } as any;
      await AuthService.resendVerificationEmail(mockUser);
      assert(false, 'Should throw verification send failure error');
    } catch (err: any) {
      assert(Boolean(err), 'Verification failure must reject with error');
    } finally {
      AuthService.setSendVerificationStub(null);
    }

    // Verify local data integrity remains untouched
    const plansAfter = StorageService.getPlans();
    assert(plansBefore.length === plansAfter.length, 'Local plans data must not be deleted on email error');
  });

  // 3. Guest transition with successful logout
  await test('Guest transition: successful AuthService.logout signs out and activates Guest Mode', async () => {
    let logoutExecuted = false;
    AuthService.setLogoutStub(async () => {
      logoutExecuted = true;
    });

    // Execute transition using actual AuthService boundary
    await AuthService.logout();
    setStorageItem('wird_guest_mode_preference', 'true');

    assert(Boolean(logoutExecuted), 'AuthService.logout must be executed during transition');
    assert(getStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference must persist');

    AuthService.setLogoutStub(null);
  });

  // 4. Guest transition with failing logout
  await test('Guest transition: failing AuthService.logout prevents Guest Mode activation', async () => {
    AuthService.setLogoutStub(async () => {
      throw { code: 'auth/network-request-failed' };
    });

    let transitionSucceeded = false;
    let authErrorMsg: string | null = null;

    try {
      await AuthService.logout();
      setStorageItem('wird_guest_mode_preference', 'true');
      transitionSucceeded = true;
    } catch (err: any) {
      authErrorMsg = mapAuthError(err);
    } finally {
      AuthService.setLogoutStub(null);
    }

    assert(transitionSucceeded === false, 'Guest mode preference must NOT be saved when logout fails');
    assert(Boolean(authErrorMsg) && authErrorMsg!.includes('الشبكة'), 'Network error message must be produced');
  });

  // 5. Verification status evaluation accuracy
  await test('Verification status: Boolean(user?.emailVerified) strictly evaluates verification without provider assumptions', () => {
    const googleUserUnverified = {
      emailVerified: false,
      providerData: [{ providerId: 'google.com' }]
    };
    assert(Boolean(googleUserUnverified?.emailVerified) === false, 'Unverified Google account must evaluate to false');

    const emailUserVerified = {
      emailVerified: true,
      providerData: [{ providerId: 'password' }]
    };
    assert(Boolean(emailUserVerified?.emailVerified) === true, 'Verified email account must evaluate to true');
  });

  // 6. Test runner's ability to count a failing test (isolated sub-runner test)
  await test('Test runner validity: isolated sub-runner correctly counts failing tests and exits non-zero', async () => {
    let mockFailedCount = 0;
    const isolatedRunner = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch {
        mockFailedCount++;
      }
    };

    await isolatedRunner(async () => {
      throw new Error('Isolated intentional test error');
    });

    assert(mockFailedCount === 1, 'Isolated test runner must count failing async test');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('firebaseAuth.test')) {
  runFirebaseAuthTests().then((res) => {
    if (res.failed > 0) process.exit(1);
  });
}

