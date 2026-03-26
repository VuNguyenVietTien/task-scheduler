'use client';

import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          {children}
        </div>
      </AuthProvider>
    </QueryProvider>
  );
}