'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApolloProvider } from '@apollo/client';
import { createDesignDocClient } from '@/apollo/design-doc-client';

/**
 * Layout wrapper for all /designs/* routes.
 * Provides a dedicated ApolloProvider pointing to /api/design-doc.
 */
export default function DesignsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const designClient = useMemo(() => createDesignDocClient(), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  return <ApolloProvider client={designClient}>{children}</ApolloProvider>;
}
