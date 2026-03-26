'use client';

import { useMemo } from 'react';
import { ApolloProvider } from '@apollo/client';
import { createDesignDocClient } from '@/apollo/design-doc-client';

/**
 * Layout wrapper for all /designs/* routes.
 * Provides a dedicated ApolloProvider pointing to design-doc-service (port 8081)
 * so all design queries/mutations hit the correct backend.
 */
export default function DesignsLayout({ children }: { children: React.ReactNode }) {
  const designClient = useMemo(() => createDesignDocClient(), []);

  return <ApolloProvider client={designClient}>{children}</ApolloProvider>;
}
