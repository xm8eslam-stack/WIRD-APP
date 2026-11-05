import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  signOut, 
  User, 
  AuthError 
} from 'firebase/auth';
import { auth, googleAuthProvider, isFirebaseConfigured } from '../lib/firebase';

export function mapAuthError(error: unknown): string {
  if (!error) return 'حدث خطأ غير معروف.';
  
  const errObj = error as AuthError;
  const code = errObj.code || '';

  switch (code) {
    case 'auth/user-not-found':
      return 'لم يتم العثور على حساب مرتبط بهذا البريد الإلكتروني.';
    case 'auth/wrong-password':
      return 'كلمة المرور غير صحيحة، يرجى التأكد وإعادة المحاولة.';
    case 'auth/invalid-credential':
      return 'بيانات الاعتماد غير صحيحة، يرجى التحقق من البريد الإلكتروني وكلمة المرور.';
    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مستخدم بالفعل لحساب آخر. يمكنك تسجيل الدخول مباشرة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً، يرجى استخدام 6 أحرف أو أكثر.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة التسجيل بـ Google قبل اكتمال العملية.';
    case 'auth/popup-blocked':
      return 'متصفحك حظر النافذة المنبثقة، يرجى السماح بالنوافذ المنبثقة وإعادة المحاولة.';
    case 'auth/too-many-requests':
      return 'تم تجميد المحاولات مؤقتاً بسبب محاولات متكررة. يرجى الانتظار القليل ثم المحاولة.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالشبكة، يرجى التأكد من اتصالك بالإنترنت.';
    case 'auth/requires-recent-login':
      return 'يتطلب هذا الإجراء تسجيل الدخول الحديث للأمان.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'مفتاح Firebase غير مهيأ بعد في بيئة التشغيل. يمكنك المتابعة كزائر دون عائق.';
    default:
      if (errObj.message && errObj.message.includes('API key')) {
        return 'يرجى ضبط مفاتيح Firebase في ملف البيئة VITE_FIREBASE_API_KEY. يمكنك الاستمرار كزائر.';
      }
      return errObj.message || 'حدث خطأ في عملية المصادقة، يرجى المحاولة لاحقاً.';
  }
}

let sendVerificationStub: ((user: User) => Promise<void>) | null = null;
let logoutStub: (() => Promise<void>) | null = null;
let createUserStub: ((email: string, password: string) => Promise<User>) | null = null;

export const AuthService = {
  isConfigured(): boolean {
    return isFirebaseConfigured();
  },

  setSendVerificationStub(fn: ((user: User) => Promise<void>) | null) {
    sendVerificationStub = fn;
  },

  setLogoutStub(fn: (() => Promise<void>) | null) {
    logoutStub = fn;
  },

  setCreateUserStub(fn: ((email: string, password: string) => Promise<User>) | null) {
    createUserStub = fn;
  },

  async loginWithGoogle(): Promise<User> {
    if (!isFirebaseConfigured() || !auth || !googleAuthProvider) {
      throw new Error('auth/api-key-not-valid');
    }
    const result = await signInWithPopup(auth, googleAuthProvider);
    return result.user;
  },

  async signUpWithEmail(email: string, password: string): Promise<{ user: User; verificationSent: boolean; verificationError?: string }> {
    if (!isFirebaseConfigured() || !auth) {
      if (!createUserStub) {
        throw new Error('auth/api-key-not-valid');
      }
    }
    let user: User;
    if (createUserStub) {
      user = await createUserStub(email, password);
    } else {
      const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      user = userCredential.user;
    }
    
    let verificationSent = false;
    let verificationError: string | undefined;
    
    try {
      if (sendVerificationStub) {
        await sendVerificationStub(user);
      } else {
        await sendEmailVerification(user);
      }
      verificationSent = true;
    } catch (err: any) {
      console.warn('[WIRD Auth] Could not send initial verification email:', err);
      verificationError = mapAuthError(err);
    }
    
    return { user, verificationSent, verificationError };
  },

  async loginWithEmail(email: string, password: string): Promise<User> {
    if (!isFirebaseConfigured() || !auth) {
      throw new Error('auth/api-key-not-valid');
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  async resendVerificationEmail(user: User): Promise<void> {
    if (!user) throw new Error('لا يوجد کاربر مسجل حالياً.');
    if (sendVerificationStub) {
      await sendVerificationStub(user);
    } else {
      await sendEmailVerification(user);
    }
  },

  async reloadUserStatus(user: User): Promise<User> {
    if (!user) throw new Error('لا يوجد کاربر مسجل.');
    await user.reload();
    return (auth && auth.currentUser) || user;
  },

  async sendPasswordReset(email: string): Promise<void> {
    if (!isFirebaseConfigured() || !auth) {
      throw new Error('auth/api-key-not-valid');
    }
    await sendPasswordResetEmail(auth, email);
  },

  async logout(): Promise<void> {
    if (logoutStub) {
      await logoutStub();
      return;
    }
    if (auth && auth.currentUser) {
      await signOut(auth);
    }
  }
};
