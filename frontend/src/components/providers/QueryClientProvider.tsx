'use client';

import { QueryClientProvider as TanstackQueryProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';

export function QueryClientProvider({ children }: { children: ReactNode }) {
  return (
    <TanstackQueryProvider client={queryClient}>
      {children}
    </TanstackQueryProvider>
  );
}
