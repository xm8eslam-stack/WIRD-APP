import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StorageService } from '../../services/storageService';
import { AuthScreen } from './AuthScreen';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isGuest, isEmailVerified } = useAuth();
  const storageScope = isGuest ? 'guest' : user && isEmailVerified ? `user:${user.uid}` : null;
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!storageScope) {
      setReadyScope(null);
      setScopeError(false);
      return;
    }

    setReadyScope(null);
    setScopeError(false);
    try {
      const success = StorageService.setStorageScope(storageScope);
      if (success) setReadyScope(storageScope);
      else setScopeError(true);
    } catch {
      setScopeError(true);
    }
  }, [storageScope, retryToken]);

  // 1. Loading state during auth initialization
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex flex-col items-center justify-center p-4 dir-rtl font-cairo">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-16 h-16 bg-emerald-800 text-amber-300 rounded-2xl flex items-center justify-center shadow-lg border border-emerald-700 animate-pulse">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 text-sm font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
            <span>جاري تهيئة منصة وِرد...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Ensure local data is isolated/migrated before mounting the application.
  if (storageScope && scopeError) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex items-center justify-center p-4 dir-rtl font-cairo">
        <div className="max-w-md rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-stone-900 p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">تعذر تجهيز مساحة بيانات الحساب</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-300">
            لم نتمكن من نقل بيانات هذا الجهاز بأمان. لم نعرض بيانات حساب آخر ولم نحذف النسخة القديمة. حاول مرة أخرى.
          </p>
          <button
            type="button"
            onClick={() => setRetryToken(value => value + 1)}
            className="mt-4 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (storageScope && readyScope !== storageScope) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex flex-col items-center justify-center p-4 dir-rtl font-cairo">
        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 text-sm font-bold">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
          <span>جاري تجهيز بيانات حسابك بأمان...</span>
        </div>
      </div>
    );
  }

  // 3. Allow guest mode access
  if (isGuest) {
    return <>{children}</>;
  }

  // 4. Allow verified user access
  if (user && isEmailVerified) {
    return <>{children}</>;
  }

  // 5. Otherwise, show AuthScreen (handles login, signup, and pending email verification)
  return <AuthScreen />;
};
