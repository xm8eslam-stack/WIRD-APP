import React from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthScreen } from './AuthScreen';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isGuest, isEmailVerified } = useAuth();

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

  // 2. Allow guest mode access
  if (isGuest) {
    return <>{children}</>;
  }

  // 3. Allow verified user access
  if (user && isEmailVerified) {
    return <>{children}</>;
  }

  // 4. Otherwise, show AuthScreen (handles login, signup, and pending email verification)
  return <AuthScreen />;
};
