'use client';

import { ApolloProvider } from "@apollo/client";
import { client } from "@/lib/apollo-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { SyncProvider } from "@/providers/SyncProvider";
import ApolloClientProvider from '@/hooks/ApolloClient';
import { ReduxProvider } from "@/redux/provider";
import { ReactNode, useEffect, useState } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  // Tạo state để đảm bảo chỉ render sau khi component được mount ở client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Nếu chưa mount (ở server), return null hoặc loading placeholder
  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Chỉ render providers khi đã ở client side
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