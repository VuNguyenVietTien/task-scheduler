import { useState } from 'react';

interface UseVerificationReturn {
  loading: boolean;
  error: string | null;
  success: boolean;
  resendVerification: () => Promise<void>;
  checkVerificationStatus: () => Promise<boolean>;
}

export function useVerification(): UseVerificationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resendVerification = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      console.log('[useVerification] Requesting verification email resend');

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend verification email');
      }

      console.log('[useVerification] Verification email sent successfully');
      setSuccess(true);

    } catch (err) {
      console.error('[useVerification] Error resending verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const checkVerificationStatus = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      console.log('[useVerification] Checking verification status');

      const response = await fetch('/api/auth/resend-verification', {
        method: 'GET',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to check verification status');
      }

      const data = await response.json();
      console.log('[useVerification] Verification status:', data);

      return data.verified;

    } catch (err) {
      console.error('[useVerification] Error checking verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to check verification status');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    success,
    resendVerification,
    checkVerificationStatus,
  };
}