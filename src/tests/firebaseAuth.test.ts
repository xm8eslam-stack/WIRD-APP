import { AuthService } from '../services/authService';
import { validateFirebaseConfigMap } from '../lib/firebase';
import { StorageService } from '../services/storageService';
import { 
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

  console.log('🧪 Executing Firebase Authentication Foundation & Integrity Tests (Phase 1.1.4.1)...');

  // 1. Storage Restoration Logic Verification
  await test('Storage restoration: restores in-memory fallback state correctly after modification', () => {
    // Modify in-memory state (assuming we are in node/test env where memory fallback is active)
    setAuthStorageItem('test_key', 'modified_val');
    assert(getAuthStorageItem('test_key') === 'modified_val', 'Pre-restoration modification must stick');
    
    // The 'test' wrapper's finally block will handle restoration.
    // We will verify restoration in a separate test to ensure it actually happened.
  });

  await test('Storage restoration verification: previous test state must be cleared', () => {
    assert(getAuthStorageItem('test_key') === null, 'Storage must be restored to null between tests');
  });

  // 2. Verification State Behavioral Transitions
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

  // 3. Test Runner Aggregation Reliability
  await test('Runner aggregation: aggregates passed and failed counts correctly', async () => {
    const mockSuites = [
      { name: 'Suite 1', runner: () => ({ passed: 5, failed: 0 }) },
      { name: 'Suite 2', runner: () => ({ passed: 3, failed: 2 }) }
    ];
    const result = await executeSuiteAggregation(mockSuites);
    assert(result.passed === 8, `Expected 8 passed, got ${result.passed}`);
    assert(result.failed === 2, `Expected 2 failed, got ${result.failed}`);
  });

  await test('Runner aggregation: handles rejected suites as failures', async () => {
    const mockSuites = [
      { name: 'Passing Suite', runner: () => ({ passed: 1, failed: 0 }) },
      { name: 'Rejecting Suite', runner: () => Promise.reject(new Error('Async failure')) }
    ];
    // Silence error log for this specific test
    const originalError = console.error;
    console.error = () => {};
    
    const result = await executeSuiteAggregation(mockSuites);
    
    console.error = originalError;
    
    assert(result.passed === 1, 'Passed count should be 1');
    assert(result.failed === 1, 'Failed count should be 1 due to rejection');
  });

  await test('Runner aggregation: evaluateTestResults maps exit codes', () => {
    const originalLog = console.log;
    console.log = () => {};
    assert(evaluateTestResults(10, 0) === 0, '0 failures -> 0');
    assert(evaluateTestResults(5, 1) === 1, '1+ failures -> 1');
    console.log = originalLog;
  });

  // 4. Preserved Behavioral Tests (AuthService & Transitions)
  await test('AuthService signUpWithEmail: account creation succeeds and verification succeeds', async () => {
    AuthService.setCreateUserStub(async (e) => ({ email: e, uid: 'uid-123', emailVerified: false } as any));
    AuthService.setSendVerificationStub(async () => {});

    const result = await AuthService.signUpWithEmail('test@wird.app', 'password123');
    assert(result.verificationSent === true, 'verificationSent must be true');
    assert(!result.verificationError, 'No error expected');
  });

  await test('AuthService signUpWithEmail: handles verification failure but preserves user object', async () => {
    AuthService.setCreateUserStub(async (e) => ({ email: e, uid: 'uid-456', emailVerified: false } as any));
    AuthService.setSendVerificationStub(async () => { throw { code: 'auth/too-many-requests' }; });

    const result = await AuthService.signUpWithEmail('fail@wird.app', 'password123');
    assert(result.verificationSent === false, 'verificationSent must be false');
    assert(Boolean(result.verificationError), 'Error must be reported');
  });

  await test('AuthContext handleContinueAsGuest: succeeds, logs out and clears state', async () => {
    const state = { 
      user: { email: 'user@wird.app' } as any, 
      isGuest: false, 
      authError: null as string | null,
      logoutCalled: false 
    };
    AuthService.setLogoutStub(async () => { state.logoutCalled = true; });

    const success = await handleContinueAsGuest(
      state.user,
      (u) => { state.user = u; },
      (g) => { state.isGuest = g; },
      (e) => { state.authError = e; }
    );

    assert(success === true, 'Success must be true');
    assert(state.logoutCalled === true, 'Logout must be called');
    assert(state.user === null, 'User must be cleared');
    assert(state.isGuest === true, 'Guest mode must be active');
  });


  await test('AuthContext handleContinueAsGuest: fails on logout and preserves user', async () => {
    const state = { user: { email: 'keep@wird.app' } as any, isGuest: false, authError: null as string | null };
    AuthService.setLogoutStub(async () => { throw { code: 'auth/network-request-failed' }; });

    const success = await handleContinueAsGuest(
      state.user,
      (u) => { state.user = u; },
      (g) => { state.isGuest = g; },
      (e) => { state.authError = e; }
    );

    assert(success === false, 'Success must be false');
    assert(state.user !== null, 'User must NOT be cleared');
    assert(state.isGuest === false, 'Guest mode must NOT be active');
    assert(state.authError !== null && state.authError!.includes('الشبكة'), 'Error must be surfaced');
  });


  // 5. Configuration Validation
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
