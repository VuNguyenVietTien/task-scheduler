'use client';

import { ApolloProvider } from "@apollo/client";
import { client } from "@/lib/apollo-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { SyncProvider } from "@/providers/SyncProvider";
import { ReduxProvider } from "@/redux/provider";
import { ReactNode, useState, useEffect } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
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
  );
} 