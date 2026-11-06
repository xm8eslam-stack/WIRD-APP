import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StorageService } from '../../services/storageService';
import { replayJournalProjection } from '../../services/journalProjectionReplayer';
import { migrateLegacyPortionsJournaled } from '../../services/backupPersistence';
import { AuthScreen } from './AuthScreen';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isGuest, isEmailVerified } = useAuth();
  const storageScope = isGuest ? 'guest' : user && isEmailVerified ? `user:${user.uid}` : null;
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState(false);
  const [scopeErrorMessage, setScopeErrorMessage] = useState('');
  const [legacyDecisionScope, setLegacyDecisionScope] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!storageScope) {
      setReadyScope(null);
      setScopeError(false);
      setScopeErrorMessage('');
      setLegacyDecisionScope(null);
      return;
    }

    setReadyScope(null);
    setScopeError(false);
    setScopeErrorMessage('');
    setLegacyDecisionScope(null);

    const initializeScopedStorage = async () => {
      try {
        if (StorageService.needsLegacyDataDecision(storageScope)) {
          if (!cancelled) setLegacyDecisionScope(storageScope);
          return;
        }
        const success = StorageService.setStorageScope(storageScope);
        if (!success) throw new Error('تعذر تثبيت نطاق التخزين الخاص بالحساب.');
        if (storageScope.startsWith('user:')) {
          await replayJournalProjection();
        }
        const migration = await migrateLegacyPortionsJournaled();
        if (!migration.success) throw new Error(migration.message);
        if (!cancelled && StorageService.getStorageScope() === storageScope) {
          setReadyScope(storageScope);
        }
      } catch (error) {
        if (!cancelled) {
          setScopeErrorMessage(error instanceof Error ? error.message : 'خطأ غير معروف أثناء استعادة سجل الحساب.');
          setScopeError(true);
        }
      }
    };

    void initializeScopedStorage();
    return () => { cancelled = true; };
  }, [storageScope, retryToken]);

  const handleLegacyDataChoice = async (choice: 'import' | 'keep-guest') => {
    if (!legacyDecisionScope) return;
    const targetScope = legacyDecisionScope;
    const success = StorageService.setStorageScope(targetScope, choice);
    if (!success) {
      setLegacyDecisionScope(null);
      setScopeErrorMessage('تعذر نقل البيانات القديمة بأمان؛ لم يتم حذف المصدر.');
      setScopeError(true);
      return;
    }
    setLegacyDecisionScope(null);
    setScopeError(false);
    setScopeErrorMessage('');
    try {
      if (targetScope.startsWith('user:')) await replayJournalProjection();
      const migration = await migrateLegacyPortionsJournaled();
      if (!migration.success) throw new Error(migration.message);
      if (StorageService.getStorageScope() === targetScope) setReadyScope(targetScope);
    } catch (error) {
      setScopeErrorMessage(error instanceof Error ? error.message : 'تعذر استعادة سجل المزامنة المحلي.');
      setScopeError(true);
    }
  };

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
  // Existing unscoped data must be explicitly assigned to this account or kept in guest mode.
  if (storageScope && legacyDecisionScope === storageScope) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex items-center justify-center p-4 dir-rtl font-cairo">
        <div className="max-w-lg rounded-2xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-900 p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">بيانات محفوظة على هذا الجهاز</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
            وجدنا تقدماً سابقاً محفوظاً قبل فصل بيانات الحسابات. هل تريد نقله إلى حسابك الحالي، أم بدء حساب فارغ مع الاحتفاظ بالبيانات السابقة في وضع الزائر؟ لن نحذف بياناتك دون اختيارك.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleLegacyDataChoice('import')}
              className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              نقل البيانات إلى حسابي
            </button>
            <button
              type="button"
              onClick={() => handleLegacyDataChoice('keep-guest')}
              className="rounded-xl border border-stone-300 dark:border-stone-700 px-5 py-3 text-sm font-bold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              بدء حساب فارغ والاحتفاظ بها كضيف
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (storageScope && scopeError) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-stone-950 flex items-center justify-center p-4 dir-rtl font-cairo">
        <div className="max-w-md rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-stone-900 p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">تعذر تجهيز مساحة بيانات الحساب</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-300">
            لم نتمكن من تجهيز أو استعادة بيانات هذا الحساب بأمان. لم نعرض بيانات حساب آخر ولم نحذف السجل الأصلي، ولم نتجاوز أي حدث غير مستعاد. {scopeErrorMessage || 'حاول مرة أخرى بعد التأكد من توفر مساحة التخزين.'}
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
