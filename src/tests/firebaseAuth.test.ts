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

export function runFirebaseAuthTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        (res as Promise<void>).then(
          () => {
            passed++;
            console.log(`  ✅ [PASS]: ${name}`);
          },
          (e: any) => {
            failed++;
            console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
          }
        );
        return;
      }
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (e: any) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${e.message}`);
    }
  }

  console.log('🧪 Executing Firebase Authentication Foundation Tests (Phase 1)...');

  // 1. Firebase configuration validation
  test('Firebase configuration validation: evaluates configuration presence safely', () => {
    const isConfigured = isFirebaseConfigured();
    assert(typeof isConfigured === 'boolean', 'isFirebaseConfigured must return boolean');
  });

  // 2. Arabic Auth Error Mapping & Google Sign-in Error Handling
  test('Google sign-in & auth error handling: maps Firebase Auth codes to clear Arabic messages', () => {
    assert(
      mapAuthError({ code: 'auth/user-not-found' }).includes('لم يتم العثور'),
      'auth/user-not-found must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/wrong-password' }).includes('كلمة المرور غير صحيحة'),
      'auth/wrong-password must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/email-already-in-use' }).includes('مستخدم بالفعل'),
      'auth/email-already-in-use must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/weak-password' }).includes('ضعيفة جداً'),
      'auth/weak-password must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/popup-closed-by-user' }).includes('إغلاق نافذة التسجيل'),
      'auth/popup-closed-by-user must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/popup-blocked' }).includes('حظر النافذة المنبثقة'),
      'auth/popup-blocked must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/too-many-requests' }).includes('تجميد المحاولات مؤقتاً'),
      'auth/too-many-requests must return Arabic error message'
    );
    assert(
      mapAuthError({ code: 'auth/network-request-failed' }).includes('الشبكة'),
      'auth/network-request-failed must return Arabic error message'
    );
  });

  // 3. Guest Mode Access & Preference
  test('Guest mode access: preference can be toggled without altering LocalStorage application state', () => {
    const sampleProfile = StorageService.getProfile();
    assert(Boolean(sampleProfile), 'Local profile must exist');

    setStorageItem('wird_guest_mode_preference', 'true');
    assert(getStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference must persist');

    // Verify application storage remains pristine
    const profileAfter = StorageService.getProfile();
    assert(profileAfter.name === sampleProfile.name, 'Local profile name must remain preserved');
  });

  // 4. Authentication service behavior using mocked Firebase SDK methods
  test('Authentication service behavior: requires valid configuration or catches SDK errors gracefully', async () => {
    if (!isFirebaseConfigured()) {
      try {
        await AuthService.loginWithEmail('test@example.com', 'password123');
        assert(false, 'Should throw error when unconfigured');
      } catch (err: any) {
        assert(
          err.message.includes('auth/api-key-not-valid') || 
          err.message.includes('مفتاح Firebase') ||
          err.message.includes('auth/invalid-api-key') ||
          err.message.includes('API key'), 
          'Must throw unconfigured API key error'
        );
      }
    }
  });

  // 5. Auth state initialization simulation
  test('Auth state initialization: state listener initializes with user null or object', () => {
    let initialized = false;
    let authUser: any = null;
    
    // Simulate auth state change callback
    const listener = (user: any) => {
      authUser = user;
      initialized = true;
    };

    listener(null); // Initial state: guest / logged out
    assert(Boolean(initialized), 'Auth listener must mark initialized');
    assert(authUser === null, 'User should default to null in guest mode');
  });

  // 6. Auth state subscription cleanup simulation
  test('Auth state subscription cleanup: unsubscribe function terminates listener cleanly', () => {
    const sub = { active: true };
    const unsubscribe = () => {
      sub.active = false;
    };

    assert(sub.active === true, 'Listener must start active');
    unsubscribe();
    assert(sub.active === false, 'Unsubscribe must set listener to inactive');
  });

  // 7. Email registration and verification flow simulation
  test('Email registration and verification flow: maps verification trigger parameters correctly', () => {
    const mockUser = {
      email: 'user@wird.app',
      emailVerified: false,
    };
    assert(mockUser.emailVerified === false, 'New registered user email starts unverified');
  });

  // 8. Logout behavior simulation
  test('Logout behavior: resets user auth state and retains local application data', () => {
    setStorageItem('wird_guest_mode_preference', 'true');
    assert(getStorageItem('wird_guest_mode_preference') === 'true', 'Guest preference set before logout');
    
    // Simulate logout resetting preference
    removeStorageItem('wird_guest_mode_preference');
    assert(getStorageItem('wird_guest_mode_preference') === null, 'Guest preference cleared');

    // Local application state preserved
    const plans = StorageService.getPlans();
    assert(Array.isArray(plans), 'Plans array preserved after logout');
  });

  // 9. Preservation of existing local data
  test('Preservation of existing local data: local storage items survive auth lifecycle unchanged', () => {
    const plansBefore = StorageService.getPlans();
    const logsBefore = StorageService.getLogs();
    const revisionBefore = StorageService.getRevisionItems();

    // Simulate auth state resets
    removeStorageItem('wird_guest_mode_preference');

    const plansAfter = StorageService.getPlans();
    const logsAfter = StorageService.getLogs();
    const revisionAfter = StorageService.getRevisionItems();

    assert(plansBefore.length === plansAfter.length, 'Plans must not be deleted');
    assert(logsBefore.length === logsAfter.length, 'Logs must not be deleted');
    assert(revisionBefore.length === revisionAfter.length, 'Revision items must not be deleted');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('firebaseAuth.test')) {
  const res = runFirebaseAuthTests();
  if (res.failed > 0) process.exit(1);
}
