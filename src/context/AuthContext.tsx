import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { AuthService, mapAuthError } from '../services/authService';

const GUEST_PREFERENCE_KEY = 'wird_guest_mode_preference';
const memoryGuestStore = new Map<string, string>();

export function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore
  }
  return memoryGuestStore.get(key) || null;
}

export function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Ignore
  }
  memoryGuestStore.set(key, value);
}

export function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
  memoryGuestStore.delete(key);
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  isEmailVerified: boolean;
  authError: string | null;
  isFirebaseReady: boolean;
  loginWithGoogle: () => Promise<void>;
  signUpWithEmail: (e: string, p: string) => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkVerificationStatus: () => Promise<boolean>;
  sendPasswordReset: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Initialize guest state from storage preference or default to true if unauthenticated
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return getStorageItem(GUEST_PREFERENCE_KEY) === 'true';
  });

  const isFirebaseReady = isFirebaseConfigured();

  // Listen to Firebase Auth state changes
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (isFirebaseReady) {
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        
        // If an authenticated user is detected, they are no longer in guest mode
        if (currentUser) {
          setIsGuest(false);
          removeStorageItem(GUEST_PREFERENCE_KEY);
        }
        
        setLoading(false);
      }, (error) => {
        console.warn('[WIRD Auth] Auth state listener error:', error);
        setAuthError(mapAuthError(error));
        setLoading(false);
      });
    } else {
      // Firebase config missing: automatically allow guest mode without flickering
      setLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, [isFirebaseReady]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await AuthService.loginWithGoogle();
      setIsGuest(false);
      removeStorageItem(GUEST_PREFERENCE_KEY);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (e: string, p: string) => {
    setAuthError(null);
    try {
      await AuthService.signUpWithEmail(e, p);
      setIsGuest(false);
      removeStorageItem(GUEST_PREFERENCE_KEY);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const loginWithEmail = async (e: string, p: string) => {
    setAuthError(null);
    try {
      await AuthService.loginWithEmail(e, p);
      setIsGuest(false);
      removeStorageItem(GUEST_PREFERENCE_KEY);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resendVerificationEmail = async () => {
    if (!user) return;
    setAuthError(null);
    try {
      await AuthService.resendVerificationEmail(user);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const checkVerificationStatus = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const updatedUser = await AuthService.reloadUserStatus(user);
      setUser(updatedUser);
      return Boolean(updatedUser.emailVerified);
    } catch (err) {
      console.warn('[WIRD Auth] Error reloading user:', err);
      return Boolean(user.emailVerified);
    }
  };

  const sendPasswordReset = async (e: string) => {
    setAuthError(null);
    try {
      await AuthService.sendPasswordReset(e);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await AuthService.logout();
      setUser(null);
      // Reset guest mode choice on sign out so auth gate prompts user again
      setIsGuest(false);
      removeStorageItem(GUEST_PREFERENCE_KEY);
    } catch (err) {
      const msg = mapAuthError(err);
      setAuthError(msg);
    }
  };

  const continueAsGuest = () => {
    setIsGuest(true);
    setStorageItem(GUEST_PREFERENCE_KEY, 'true');
    setAuthError(null);
  };

  const clearError = () => setAuthError(null);

  const isEmailVerified = Boolean(
    user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com'))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        isEmailVerified,
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
