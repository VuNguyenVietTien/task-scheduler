'use client';

import { ApolloProvider } from "@apollo/client";
import { client } from "@/lib/apollo-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { SyncProvider } from "@/providers/SyncProvider";
import ApolloClientProvider from '@/hooks/ApolloClient';
import { ReduxProvider } from "@/redux/provider";
import { ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ApolloClientProvider>
      <AuthProvider>
        <QueryProvider>
          <ApolloProvider client={client}>
            <ReduxProvider>
              <SyncProvider>
                {children}
              </SyncProvider>
            </ReduxProvider>
          </ApolloProvider>
        </QueryProvider>
      </AuthProvider>
    </ApolloClientProvider>
  );
} 