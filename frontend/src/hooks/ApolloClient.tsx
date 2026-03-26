'use client';

import { ReactNode, useState, useEffect } from 'react';
import { ApolloProvider } from '@apollo/client';
import { client } from '@/lib/apollo-client';

interface ApolloClientProviderProps {
  children: ReactNode;
}

// Component cung cấp ApolloClient chỉ khi đang ở môi trường client
// Điều này đảm bảo Apollo Client không chạy trong quá trình SSR/SSG
export function ApolloClientProvider({ children }: ApolloClientProviderProps) {
  const [mounted, setMounted] = useState(false);

  // Đảm bảo chỉ render sau khi component được mount ở client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Chỉ hiển thị nội dung sau khi đã chắc chắn đang ở client side
  if (!mounted) {
    // Có thể hiển thị fallback hoặc không hiển thị gì khi đang SSR
    return null;
  }

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export default ApolloClientProvider; 