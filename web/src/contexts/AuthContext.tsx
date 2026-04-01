'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signInWithEmailPassword, setFirebasePassword, signOutUser } from '@/lib/firebase';
import { loginUser, registerUser } from '@/lib/authApi';
import { createBrowserClient } from '@/lib/supabase/client';

interface ProviderData {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
  providerData: ProviderData[];
}

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('[Auth] Checking current authentication status...');
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        console.log('[Auth] Current user:', data.user);
        setUser(data.user);
        
        // Redirect to dashboard if on auth page
        if (window.location.pathname === '/auth') {
          router.replace('/dashboard');
        }
      } else {
        console.log('[Auth] No authenticated user found');
      }
    } catch (error) {
      console.error('[Auth] Authentication check failed:', error);
      setError('Authentication check failed');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      console.log('[Auth] Starting Google login process...');
      
      // Call Firebase for Google authentication
      console.log('[Auth] Calling Firebase signInWithGoogle...');
      const { token, user: firebaseUser } = await signInWithGoogle();
      console.log('[Auth] Firebase auth successful:', {
        email: firebaseUser.email,
        uid: firebaseUser.uid
      });
      
      // Call our API endpoint
      console.log('[Auth] Calling backend sync API...');
      const apiUrl = '/api/auth/firebase/login';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firebase_token: token,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'Unnamed User',
          firebase_uid: firebaseUser.uid
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Auth] Backend sync failed:', data.error);
        // Sign out from Firebase if backend sync fails
        await signOutUser();
        throw new Error(data.error || 'Google login failed');
      }

      console.log('[Auth] Backend sync successful. User data:', data.user);

      // Establish a Supabase session so middleware can validate the user
      if (data.session?.properties?.email_otp) {
        const supabase = createBrowserClient();
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: firebaseUser.email!,
          token: data.session.properties.email_otp,
          type: 'email',
        });
        if (otpError) {
          console.error('[Auth] Supabase OTP verification failed:', otpError.message);
          throw new Error('Session establishment failed');
        }
      }

      // Update local state
      setUser(data.user);
      console.log('[Auth] Local state updated, redirecting to dashboard');
      window.location.href = '/dashboard';

    } catch (error) {
      console.error('[Auth] Google login error:', error);
      setError('Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      // Authenticate via Firebase email/password
      const { token, user: firebaseUser } = await signInWithEmailPassword(email, password);

      // Sync with backend (same flow as Google login)
      const response = await fetch('/api/auth/firebase/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_token: token,
          email: firebaseUser.email,
          name: firebaseUser.displayName || email.split('@')[0],
          firebase_uid: firebaseUser.uid,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        await signOutUser();
        throw new Error(data.error || 'Login failed');
      }

      // Establish Supabase session
      if (data.session?.properties?.email_otp) {
        const supabase = createBrowserClient();
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: firebaseUser.email!,
          token: data.session.properties.email_otp,
          type: 'email',
        });
        if (otpError) throw new Error('Session establishment failed');
      }

      setUser(data.user);
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('[Auth] Login error:', error);
      setError(error instanceof Error ? error.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      setLoading(true);
      const response = await registerUser({ email, password, name });
      setUser(response.user as User);
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await signOutUser(); // Sign out from Firebase
      const response = await fetch('/api/auth/logout', {
        credentials: 'include',
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      setUser(null);
      window.location.href = '/auth';
    } catch (error) {
      setError('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const setPassword = async (newPassword: string) => {
    try {
      setLoading(true);
      await setFirebasePassword(newPassword);
    } catch (error) {
      console.error('[Auth] Set password error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to set password';
      // Firebase requires-recent-login error
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
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send verification email');
      }
    } catch (error) {
      setError('Failed to send verification email. Please try again.');
      throw error;
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
    sendVerificationEmail
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
