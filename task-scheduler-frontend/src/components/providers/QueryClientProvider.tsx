'use client';

import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return <Provider client={queryClient}>{children}</Provider>;
}