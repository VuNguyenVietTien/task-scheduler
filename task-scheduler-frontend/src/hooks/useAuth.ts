import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.push('/auth');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  // Add loading state to context
  return {
    ...context,
    isLoading,
  };
}

// Re-export AuthContextType for convenience
export type { AuthContextType };
