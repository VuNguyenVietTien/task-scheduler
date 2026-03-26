import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVerification?: boolean;
}

export function ProtectedRoute({ children, requireVerification = true }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // No user is signed in
        router.push('/auth');
      } else if (requireVerification && !user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        // User needs to verify email (only for email/password auth)
        router.push('/auth');
      }
    }
  }, [user, loading, requireVerification, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireVerification && !user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
    return null;
  }

  return <>{children}</>;
}
