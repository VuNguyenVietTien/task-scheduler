'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signOutUser } from '@/lib/firebase';
import { loginUser, registerUser } from '@/lib/authApi';

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
        
        // Get auth token from cookies and store in localStorage
        const cookies = document.cookie.split(';');
        const authTokenCookie = cookies.find(cookie => cookie.trim().startsWith('auth-token='));
        if (authTokenCookie) {
          const token = authTokenCookie.split('=')[1];
          console.log('[Auth] Storing token in localStorage');
          localStorage.setItem('token', token);
        }
        // Redirect to dashboard if on auth page
        if (window.location.pathname === '/auth') {
          window.location.href = '/dashboard';
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
        uid: firebaseUser.uid,
        token: `${token.substring(0, 10)}...`
      });
      
      // Call our API endpoint
      console.log('[Auth] Calling backend sync API...');
      const apiUrl = '/api/auth/firebase/login';
      console.log(`[Auth] API URL: ${apiUrl}`);
      
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

      console.log(`[Auth] API Response Status: ${response.status}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Auth] Backend sync failed:', data.error);
        // Sign out from Firebase if backend sync fails
        await signOutUser();
        throw new Error(data.error || 'Google login failed');
      }

      console.log('[Auth] Backend sync successful. User data:', data.user);

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
      const response = await loginUser({ email, password });
      setUser(response.user as User);
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('[Auth] Login error:', error);
      setError('Invalid email or password');
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
      localStorage.removeItem('token');
      document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      window.location.href = '/auth';
    } catch (error) {
      setError('Logout failed');
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
