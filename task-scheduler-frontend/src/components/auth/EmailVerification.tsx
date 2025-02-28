import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface EmailVerificationProps {
  onVerified?: () => void;
}

export function EmailVerification({ onVerified }: EmailVerificationProps) {
  const { user, sendVerificationEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user?.emailVerified) {
      onVerified?.();
    }
  }, [user?.emailVerified, onVerified]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendVerification = async () => {
    if (cooldown > 0) return;

    setError(null);
    setLoading(true);

    try {
      await sendVerificationEmail();
      setCooldown(60); // 1 minute cooldown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (user.emailVerified) return null;

  return (
    <div className="rounded-md bg-yellow-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">Email Verification Required</h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>Please verify your email address to access all features.</p>
            <p className="mt-1">
              We&apos;ve sent a verification link to {user.email}. Check your inbox and spam folder.
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading || cooldown > 0}
              className="rounded bg-yellow-100 px-2 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading
                ? 'Sending...'
                : cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend verification email'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
