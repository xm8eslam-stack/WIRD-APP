import React, { useState } from 'react';
import { 
  BookOpen, 
  Mail, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  UserCheck, 
  KeyRound, 
  LogOut, 
  Sparkles,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const { 
    user, 
    isEmailVerified, 
    lastVerificationSent,
    authError, 
    isFirebaseReady,
    loginWithGoogle, 
    signUpWithEmail, 
    loginWithEmail, 
    resendVerificationEmail, 
    checkVerificationStatus, 
    sendPasswordReset, 
    logout, 
    continueAsGuest,
    clearError
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // If user is logged in via email/password but not yet verified
  const needsEmailVerification = Boolean(user && !isEmailVerified);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMessage(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        return;
      }
      if (password.length < 6) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        await signUpWithEmail(email, password);
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.');
      }
    } catch (err) {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      // Error handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsSubmitting(true);
    try {
      await resendVerificationEmail();
      setSuccessMessage('تم إرسال رابط التفعيل مجدداً إلى بريدك الإلكتروني.');
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      // Error handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecheckStatus = async () => {
    setIsCheckingStatus(true);
    setSuccessMessage(null);
    try {
      const verified = await checkVerificationStatus();
      if (verified) {
        setSuccessMessage('تم التحقق من تفعيل البريد الإلكتروني بنجاح! يمكنك الآن الاستفادة من كافة الميزات.');
      } else {
        setSuccessMessage('لم يتم تفعيل البريد الإلكتروني بعد. يرجى الضغط على الرابط المرسل إلى صندوق الوارد.');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // If logged in but email verification is pending
  if (needsEmailVerification) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex flex-col items-center justify-center p-4 dir-rtl font-cairo">
        <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-xl border border-stone-200/80 dark:border-stone-800 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
              <Mail className="w-8 h-8 animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-quran">
              تأكيد البريد الإلكتروني مطلوب
            </h2>
            {lastVerificationSent === false ? (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold leading-relaxed bg-rose-50 dark:bg-rose-950/60 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                تعذر إرسال بريد التفعيل تلقائياً عند التسجيل. يرجى الضغط على "إعادة إرسال رسالة التفعيل" أدناه.
              </p>
            ) : lastVerificationSent === true ? (
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                تم إرسال رسالة تأكيد إلى البريد الإلكتروني:
              </p>
            ) : (
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                حسابك بانتظار التفعيل. يمكنك إرسال رسالة التأكيد بالضغط على الزر أدناه:
              </p>
            )}
            <div className="font-mono text-sm font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 py-2 px-3 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 dir-ltr text-center">
              {user?.email}
            </div>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {authError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleRecheckStatus}
              disabled={isCheckingStatus}
              className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCheckingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>تحديث وحالة التفعيل</span>
            </button>

            <button
              onClick={handleResendEmail}
              disabled={isSubmitting || resendCooldown > 0}
              className="w-full py-3 bg-[#faf8f5] dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {resendCooldown > 0 ? `إعادة الإرسال خلال (${resendCooldown}ث)` : 'إعادة إرسال رسالة التفعيل'}
            </button>
          </div>

          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
            <button
              onClick={continueAsGuest}
              className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>المتابعة كزائر مؤقتاً</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>

            <button
              onClick={() => logout()}
              className="text-stone-500 hover:text-rose-600 dark:text-stone-400 flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex flex-col items-center justify-center p-4 dir-rtl font-cairo">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-xl border border-stone-200/80 dark:border-stone-800 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-800 text-amber-300 rounded-2xl flex items-center justify-center mx-auto shadow-md border border-emerald-700">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 font-quran">
            منصة وِرد | WIRD
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            حفظ وتثبيت القرآن الكريم وفق منهجيات المراجعة المتباعدة
          </p>
        </div>

        {/* Tab Switchers */}
        {mode !== 'forgot' && (
          <div className="flex bg-[#faf8f5] dark:bg-stone-800/80 p-1 rounded-2xl border border-stone-200/80 dark:border-stone-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setMode('login'); clearError(); setSuccessMessage(null); }}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                mode === 'login' 
                  ? 'bg-white dark:bg-stone-900 text-emerald-900 dark:text-emerald-300 shadow-xs' 
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); clearError(); setSuccessMessage(null); }}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                mode === 'register' 
                  ? 'bg-white dark:bg-stone-900 text-emerald-900 dark:text-emerald-300 shadow-xs' 
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              حساب جديد
            </button>
          </div>
        )}

        {/* Error Feedback */}
        {authError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{authError}</div>
          </div>
        )}

        {/* Success Feedback */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs rounded-xl flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* Google Provider Button */}
        {mode !== 'forgot' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 border border-stone-300 dark:border-stone-700 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>المتابعة عبر حساب Google</span>
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
              <span className="text-[11px] text-stone-400">أو بالبريد الإلكتروني</span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full pr-10 pl-4 py-2.5 bg-[#faf8f5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600 transition-colors dir-ltr text-right"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                  كلمة المرور
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); clearError(); setSuccessMessage(null); }}
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-2.5 bg-[#faf8f5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600 transition-colors dir-ltr text-right"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-2.5 bg-[#faf8f5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600 transition-colors dir-ltr text-right"
                />
              </div>
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-rose-600 mt-1">كلمتا المرور غير متطابقتين.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (mode === 'register' && password !== confirmPassword)}
            className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <span>تسجيل الدخول</span>
            ) : mode === 'register' ? (
              <span>إنشاء الحساب والتفعيل</span>
            ) : (
              <span>إرسال رابط استعادة كلمة المرور</span>
            )}
          </button>
        </form>

        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => { setMode('login'); clearError(); setSuccessMessage(null); }}
            className="w-full text-center text-xs text-stone-500 hover:text-emerald-800 dark:text-stone-400 font-medium"
          >
            العودة إلى تسجيل الدخول
          </button>
        )}

        {/* Continue as Guest CTA - Critical Protected Flow */}
        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full py-3 bg-[#faf8f5] dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300/80 dark:border-stone-700 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 group"
          >
            <Sparkles className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
            <span>المتابعة كزائر دون تسجيل حساب</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180 text-stone-400" />
          </button>
          <p className="text-[10px] text-center text-stone-400 leading-normal">
            تتيح لك تجربة الزائر الوصول التام لكافة سور المصحف الشريف والخطط وجلسات الحفظ والتكرار المتباعد محلياً دون الحاجة لتسجيل حساب.
          </p>
        </div>

      </div>
    </div>
  );
};
