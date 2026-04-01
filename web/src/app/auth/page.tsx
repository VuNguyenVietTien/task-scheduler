'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/i18n-config';
import { useAuth } from '@/hooks/useAuth';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ja', label: '日本語' },
];

export default function AuthPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const searchParams = useSearchParams();
  const verifyEmail = searchParams?.get('verifyEmail');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.authFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.googleAuthFailed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
  };

  if (verifyEmail === 'true') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">{t('auth.checkYourEmail')}</h2>
          <p className="text-sm text-gray-600">{t('auth.verificationEmailSent')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Language switcher — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        {LANGUAGES.map((lang, i) => (
          <span key={lang.code} className="flex items-center">
            <button
              onClick={() => handleLanguageChange(lang.code)}
              className={`text-sm px-1 py-0.5 rounded transition-colors ${
                i18n.language === lang.code
                  ? 'font-semibold text-indigo-600'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {lang.label}
            </button>
            {i < LANGUAGES.length - 1 && (
              <span className="text-gray-300 text-xs select-none">|</span>
            )}
          </span>
        ))}
      </div>

      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.signIn')}
          </h2>
        </div>

        {/* Google sign-in */}
        <div>
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-60"
          >
            {googleLoading ? (
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                  <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
                  <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
                  <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                </svg>
                {t('auth.continueWithGoogle')}
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center">
          <div className="flex-grow border-t border-gray-300" />
          <div className="px-4 text-sm text-gray-500">{t('auth.orContinueWithEmail')}</div>
          <div className="flex-grow border-t border-gray-300" />
        </div>

        {/* Email/password form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">{t('auth.emailAddress')}</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder={t('auth.emailAddress')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">{t('auth.password')}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : t('auth.signInButton')}
            </button>
          </div>
        </form>

        {/* No-account hint */}
        <p className="text-center text-sm text-gray-500">
          {t('auth.noAccountHint')}{' '}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
          >
            {t('auth.noAccountGoogle')}
          </button>{' '}
          {t('auth.noAccountSuffix')}
        </p>
      </div>
    </div>
  );
}
