'use client';

import { ApolloProvider } from '@apollo/client';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { SyncProvider } from '@/providers/SyncProvider';
import { client } from '@/lib/apollo-client';

export default function Providers({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <SyncProvider>
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
