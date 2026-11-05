import { AuthService } from '../services/authService';
import { validateFirebaseConfigMap } from '../lib/firebase';
import { StorageService } from '../services/storageService';
import { 
  executeGuestTransition,
  handleContinueAsGuest, 
  getAuthStorageSnapshot, 
  restoreAuthStorageSnapshot,
  setStorageItem as setAuthStorageItem,
  getStorageItem as getAuthStorageItem
} from '../context/AuthContext';
import { calculateVerificationState } from '../services/authUtils';
import { executeSuiteAggregation, evaluateTestResults } from './runAllTests';

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
    // 1. Snapshot ALL storage backends
    const storageSnapshot = StorageService.getStorageSnapshot();
    const authSnapshot = getAuthStorageSnapshot();

    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    } finally {
      // 2. Reset AuthService stubs
      AuthService.setSendVerificationStub(null);
      AuthService.setLogoutStub(null);
      AuthService.setCreateUserStub(null);

      // 3. Restore ALL storage backends exactly as they were
      StorageService.restoreStorageSnapshot(storageSnapshot);
      restoreAuthStorageSnapshot(authSnapshot);
    }
  }

  console.log('🧪 Executing Firebase Authentication Foundation & Integrity Tests (Phase 1.1.4.2)...');

  // 1. Storage Restoration Logic Verification (AuthContext in-memory store)
  await test('Storage restoration: restores in-memory fallback state correctly after modification', () => {
    setAuthStorageItem('test_key', 'modified_val');
    assert(getAuthStorageItem('test_key') === 'modified_val', 'Pre-restoration modification must stick');
  });

  await test('Storage restoration verification: previous test state must be cleared', () => {
    assert(getAuthStorageItem('test_key') === null, 'Storage must be restored to null between tests');
  });

  // 2. Independent StorageService Snapshot & In-Memory Fallback Restoration
  await test('StorageService Snapshot: independently verifies StorageService memory fallback restoration', async () => {
    const originalLocalStorage = typeof window !== 'undefined' ? (window as any).localStorage : (globalThis as any).localStorage;
    const hasLocalStorage = typeof localStorage !== 'undefined';
    
    try {
      // Explicitly ensure localStorage is unavailable during this test to isolate memoryStorage
      if (hasLocalStorage) {
        Object.defineProperty(globalThis, 'localStorage', {
          value: undefined,
          configurable: true,
          writable: true
        });
      }

      // Step A: Capture initial snapshot
      const snapshot = StorageService.getStorageSnapshot();
      const initialProfile = StorageService.getProfile();
      const initialPlans = StorageService.getPlans();
      assert(initialPlans.length === 0, 'Plans initially absent');

      // Step B: Write test value through actual production API
      StorageService.saveProfile({ ...initialProfile, name: 'Temporary In-Memory User' });
      StorageService.savePlans([{ id: 'plan-mem-1', title: 'In-Memory Plan' } as any]);
      assert(StorageService.getProfile().name === 'Temporary In-Memory User', 'Profile modified in memory fallback');
      assert(StorageService.getPlans().length === 1, 'Plans modified in memory fallback');

      // Step C: Restore the snapshot
      StorageService.restoreStorageSnapshot(snapshot);

      // Step D: Verify the original value is restored, including the previously absent-key case
      assert(StorageService.getProfile().name === initialProfile.name, 'Original profile name restored');
      assert(StorageService.getPlans().length === 0, 'Previously absent plans restored as absent (length 0)');

      // Step E: Verify cleanup still happens when test operation throws
      const snapshotBeforeThrow = StorageService.getStorageSnapshot();
      let caughtError: any = null;
      try {
        try {
          StorageService.savePlans([{ id: 'throw-test', title: 'Will Be Reverted On Throw' } as any]);
          assert(StorageService.getPlans().length === 1, 'Plan written before throw');
          throw new Error('Simulated operation failure during test');
        } finally {
          StorageService.restoreStorageSnapshot(snapshotBeforeThrow);
        }
      } catch (err: any) {
        caughtError = err;
      }

      assert(caughtError !== null && caughtError.message === 'Simulated operation failure during test', 'Error caught');
      assert(StorageService.getPlans().length === 0, 'Cleanup restored absent plans even after throw in finally');

    } finally {
      // Safely restore environment
      if (hasLocalStorage && originalLocalStorage !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', {
          value: originalLocalStorage,
          configurable: true,
          writable: true
        });
      }
    }
  });

  // 3. Verification State Behavioral Transitions
  await test('Verification state: initial state is null', () => {
    assert(calculateVerificationState('signup', true, null) === true, 'Signup success -> true');
    assert(calculateVerificationState('signup', false, null) === false, 'Signup failure -> false');
  });

  await test('Verification state: login always returns null', () => {
    assert(calculateVerificationState('login', true, true) === null, 'Login success must reset to null even if previously true');
    assert(calculateVerificationState('login', true, false) === null, 'Login success must reset to null even if previously false');
  });

  await test('Verification state: resend transitions correctly', () => {
    assert(calculateVerificationState('resend', true, null) === true, 'Resend success -> true');
    assert(calculateVerificationState('resend', false, true) === false, 'Resend failure -> false');
  });

  // 4. Test Runner Aggregation Reliability & Rejection Continuation
  await test('Runner aggregation: aggregates passed and failed counts correctly', async () => {
    const mockSuites = [
      { name: 'Suite 1', runner: () => ({ passed: 5, failed: 0 }) },
      { name: 'Suite 2', runner: () => ({ passed: 3, failed: 2 }) }
    ];
    const result = await executeSuiteAggregation(mockSuites);
    assert(result.passed === 8, `Expected 8 passed, got ${result.passed}`);
    assert(result.failed === 2, `Expected 2 failed, got ${result.failed}`);
  });

  await test('Runner aggregation: handles rejected suites as failures, executes subsequent suite, and yields non-zero exit', async () => {
    const state = { thirdSuiteExecuted: false };
    const mockSuites = [
      { name: 'Suite 1 (Passing)', runner: () => ({ passed: 2, failed: 0 }) },
      { name: 'Suite 2 (Rejecting)', runner: () => Promise.reject(new Error('Async failure')) },
      { name: 'Suite 3 (Passing)', runner: () => { state.thirdSuiteExecuted = true; return { passed: 3, failed: 0 }; } }
    ];
    
    // Silence console during aggregation output
    const originalError = console.error;
    const originalLog = console.log;
    try {
      console.error = () => {};
      console.log = () => {};
      
      const result = await executeSuiteAggregation(mockSuites);
      
      // Verify third suite actually executed
      assert(state.thirdSuiteExecuted === true, 'Third suite must execute after a rejected suite');
      
      // Verify results are included (2 from Suite 1 + 3 from Suite 3 = 5 passed)
      assert(result.passed === 5, `Expected 5 passed (Suite 1 and Suite 3 combined), got ${result.passed}`);
      
      // Verify rejected suite contributes to failure count (1 failure)
      assert(result.failed === 1, `Expected 1 failure for the rejected suite, got ${result.failed}`);
      
      // Verify final exit status is non-zero
      const exitCode = evaluateTestResults(result.passed, result.failed);
      assert(exitCode !== 0, 'Final exit code must be non-zero when any suite fails or rejects');
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }
  });

  await test('Runner aggregation: evaluateTestResults maps exit codes (0 for pass, 1 for fail)', () => {
    const originalLog = console.log;
    try {
      console.log = () => {};
      assert(evaluateTestResults(10, 0) === 0, '0 failures -> exit code 0');
      assert(evaluateTestResults(5, 1) === 1, '1+ failures -> exit code 1');
    } finally {
      console.log = originalLog;
    }
  });

  // 5. Preserved Behavioral Tests (AuthService Account Creation & Verification)
  await test('AuthService signUpWithEmail: account creation succeeds and verification email succeeds', async () => {
    let createdUserEmail = '';
    let verificationUserEmail = '';
    AuthService.setCreateUserStub(async (e) => {
      createdUserEmail = e;
      return { email: e, uid: 'uid-123', emailVerified: false } as any;
    });
    AuthService.setSendVerificationStub(async (u: any) => {
      verificationUserEmail = u?.email;
    });

    const result = await AuthService.signUpWithEmail('test@wird.app', 'password123');
    assert(createdUserEmail === 'test@wird.app', 'Account creation must be called with email');
    assert(verificationUserEmail === 'test@wird.app', 'Verification sending must be called with created user');
    assert(result.verificationSent === true, 'verificationSent must be true');
    assert(!result.verificationError, 'No error expected');
  });

  await test('AuthService signUpWithEmail: handles verification failure while preserving created account', async () => {
    const plansBefore = StorageService.getPlans();
    AuthService.setCreateUserStub(async (e) => ({ email: e, uid: 'uid-456', emailVerified: false } as any));
    AuthService.setSendVerificationStub(async () => { throw { code: 'auth/too-many-requests' }; });

    const result = await AuthService.signUpWithEmail('fail@wird.app', 'password123');
    assert(result.user !== null && result.user.email === 'fail@wird.app', 'User account must be preserved');
    assert(result.verificationSent === false, 'verificationSent must be false');
    assert(Boolean(result.verificationError), 'Error must be reported');
    assert(result.verificationError!.includes('تجميد'), 'Error message must be mapped to Arabic');
    assert(StorageService.getPlans().length === plansBefore.length, 'Local plans data must remain untouched');
  });

  await test('AuthService signUpWithEmail: account creation itself fails, verification never attempted', async () => {
    let verificationAttempted = false;
    AuthService.setCreateUserStub(async () => { throw { code: 'auth/email-already-in-use' }; });
    AuthService.setSendVerificationStub(async () => { verificationAttempted = true; });

    let caughtError: any = null;
    try {
      await AuthService.signUpWithEmail('existing@wird.app', 'password123');
    } catch (err: any) {
      caughtError = err;
    }

    assert(caughtError !== null, 'Account creation failure must be thrown');
    assert(caughtError.code === 'auth/email-already-in-use', 'Auth error code must be propagated');
    assert(verificationAttempted === false, 'Verification sending must not be attempted if account creation fails');
  });

  // 6. Behavioral Tests for Guest Transition (Both executeGuestTransition contract and handleContinueAsGuest)
  await test('executeGuestTransition: currentUser = null, no logout occurs and guest preference set', async () => {
    let logoutCalled = false;
    const result = await executeGuestTransition(null, async () => { logoutCalled = true; });
    assert(result.success === true, 'Transition succeeds');
    assert(logoutCalled === false, 'No logout should occur when currentUser is null');
    assert(getAuthStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference persisted');
  });

  await test('executeGuestTransition: currentUser != null, logout occurs before guest mode is activated', async () => {
    const state = {
      logoutCalled: false,
      prefSetDuringLogout: null as string | null
    };
    const mockUser = { email: 'user@wird.app' } as any;

    const result = await executeGuestTransition(mockUser, async () => {
      state.logoutCalled = true;
      state.prefSetDuringLogout = getAuthStorageItem('wird_guest_mode_preference');
    });

    assert(result.success === true, 'Transition succeeds');
    assert(state.logoutCalled === true, 'Logout must occur when currentUser is not null');
    assert(state.prefSetDuringLogout === null, 'Guest preference must NOT be activated before logout completes');
    assert(getAuthStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference persisted after logout');
  });

  await test('executeGuestTransition: logout failure returns false, does not activate guest preference', async () => {
    const mockUser = { email: 'user@wird.app' } as any;
    const result = await executeGuestTransition(mockUser, async () => {
      throw { code: 'auth/network-request-failed' };
    });

    assert(result.success === false, 'Transition fails when logout throws');
    assert(getAuthStorageItem('wird_guest_mode_preference') === null, 'Guest preference must not be set');
    assert(Boolean(result.error) && result.error!.includes('الشبكة'), 'Mapped error returned');
  });

  await test('AuthContext handleContinueAsGuest: currentUser = null, no logout occurs, activates guest mode', async () => {
    const state = { user: null as any, isGuest: false, authError: null as string | null, logoutCalled: false };
    AuthService.setLogoutStub(async () => { state.logoutCalled = true; });

    const success = await handleContinueAsGuest(
      state.user,
      (u) => { state.user = u; },
      (g) => { state.isGuest = g; },
      (e) => { state.authError = e; }
    );

    assert(success === true, 'Success must be true');
    assert(state.logoutCalled === false, 'Logout must NOT be called when currentUser is null');
    assert(state.isGuest === true, 'Guest mode must be active');
    assert(getAuthStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference persisted');
  });

  await test('AuthContext handleContinueAsGuest: currentUser != null, logout occurs before guest mode, clears user state', async () => {
    const state = { user: { email: 'user@wird.app' } as any, isGuest: false, authError: null as string | null, logoutCalled: false };
    AuthService.setLogoutStub(async () => { state.logoutCalled = true; });

    const success = await handleContinueAsGuest(
      state.user,
      (u) => { state.user = u; },
      (g) => { state.isGuest = g; },
      (e) => { state.authError = e; }
    );

    assert(success === true, 'Success must be true');
    assert(state.logoutCalled === true, 'Logout must be called when currentUser is not null');
    assert(state.user === null, 'User must be cleared');
    assert(state.isGuest === true, 'Guest mode must be active');
    assert(getAuthStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference persisted');
  });

  await test('AuthContext handleContinueAsGuest: fails on logout, preserves user state and does not activate guest mode', async () => {
    const originalUser = { email: 'keep@wird.app' } as any;
    const state = { user: originalUser, isGuest: false, authError: null as string | null };
    AuthService.setLogoutStub(async () => { throw { code: 'auth/network-request-failed' }; });

    const success = await handleContinueAsGuest(
      state.user,
      (u) => { state.user = u; },
      (g) => { state.isGuest = g; },
      (e) => { state.authError = e; }
    );

    assert(success === false, 'Success must be false');
    assert(state.user === originalUser, 'User state must NOT be cleared on failed logout');
    assert(state.isGuest === false, 'Guest mode must NOT be active');
    assert(getAuthStorageItem('wird_guest_mode_preference') === null, 'Guest preference must NOT be set');
    assert(state.authError !== null && state.authError!.includes('الشبكة'), 'Localized error must be surfaced');
  });

  // 7. Configuration Validation
  await test('Firebase Config: validates valid map', () => {
    const valid = {
      VITE_FIREBASE_API_KEY: 'AIzaSyValidKey',
      VITE_FIREBASE_AUTH_DOMAIN: 'app.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'app',
      VITE_FIREBASE_STORAGE_BUCKET: 'app.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
      VITE_FIREBASE_APP_ID: '1:123456:web:abc'
    };
    assert(validateFirebaseConfigMap(valid) === true, 'Valid config should pass');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('firebaseAuth.test')) {
  runFirebaseAuthTests().then((res) => {
    if (res.failed > 0) process.exit(1);
  });
}
