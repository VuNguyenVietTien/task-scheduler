'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithGoogle,
  signInWithEmailPassword,
  setFirebasePassword,
  signOutUser,
  getIdToken,
  createUserWithName,
  sendFirebaseVerificationEmail,
} from '@/lib/firebase';
import type { User, FirebaseLoginResponse } from '@/types/auth';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setPassword: (newPassword: string) => Promise<void>;
  clearError: () => void;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * W1 AuthContext — Firebase ID token + Rust backend session carrier.
 *
 * - Identity is established by the Firebase SDK; the ID token is exchanged for
 *   the app user via `POST /api/auth/firebase/login` (Rust verifies the token,
 *   upserts `users`, proxy sets the signed `pm_session` cookie).
 * - `checkAuth` re-verifies against Rust `GET /api/auth/me` with the Bearer
 *   token on every mount — no unsigned cookie is ever trusted.
 * - No Supabase client, no OTP magic-link step.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getIdToken();
      if (!token) return; // no Firebase session → stay logged out

      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.user) {
          setUser({
            ...data.user,
            providerData: data.user.providerData ?? [],
          });
          if (window.location.pathname === '/auth') {
            router.replace('/dashboard');
          }
        }
      }
    } catch (err) {
      console.error('[Auth] Authentication check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Exchange the Firebase ID token for the app user on the Rust backend. */
  const syncBackend = async (
    token: string,
    email: string,
    name: string,
    uid: string,
  ): Promise<void> => {
    const response = await fetch('/api/auth/firebase/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        firebase_token: token,
        email,
        name,
        firebase_uid: uid,
      }),
    });

    const data: FirebaseLoginResponse & { error?: string } =
      await response.json().catch(() => ({}));

    if (!response.ok || !data?.user) {
      await signOutUser();
      throw new Error(data?.error || 'Login failed');
    }

    setUser({ ...data.user, providerData: [] });
    window.location.href = '/dashboard';
  };

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const { token, user: firebaseUser } = await signInWithGoogle();
      await syncBackend(
        token,
        firebaseUser.email!,
        firebaseUser.displayName || 'Unnamed User',
        firebaseUser.uid,
      );
    } catch (err) {
      console.error('[Auth] Google login error:', err);
      setError('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { token, user: firebaseUser } =
        await signInWithEmailPassword(email, password);
      await syncBackend(
        token,
        firebaseUser.email ?? email,
        firebaseUser.displayName || email.split('@')[0],
        firebaseUser.uid,
      );
    } catch (err) {
      console.error('[Auth] Login error:', err);
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      setLoading(true);
      // 1) Create the identity in Firebase, set the display name.
      const { token, user: firebaseUser } = await createUserWithName(
        email,
        password,
        name,
      );

      // 2) Persist the app user on the Rust backend.
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const registerData = await registerResponse.json().catch(() => ({}));
      if (!registerResponse.ok) {
        await signOutUser();
        throw new Error(registerData?.error || 'Registration failed');
      }

      // 3) Establish the app session (same path as login).
      await syncBackend(token, firebaseUser.email ?? email, name, firebaseUser.uid);
    } catch (err) {
      console.error('[Auth] Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      await signOutUser();
      setUser(null);
      window.location.href = '/auth';
    } catch (err) {
      console.error('[Auth] Logout error:', err);
      setError('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const setPassword = async (newPassword: string) => {
    try {
      setLoading(true);
      await setFirebasePassword(newPassword);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set password';
      if (msg.includes('requires-recent-login') || msg.includes('recent')) {
        throw new Error('Please sign out and sign in again before changing your password.');
      }
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationEmail = async () => {
    try {
      setLoading(true);
      await sendFirebaseVerificationEmail();
    } catch (err) {
      console.error('[Auth] Send verification error:', err);
      setError('Failed to send verification email. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    register,
    loginWithGoogle,
    logout,
    setPassword,
    clearError,
    sendVerificationEmail,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
