'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { QueryClientProvider } from '@/components/providers/QueryClientProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Header from '@/components/ui/navigation/Header';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SideNav } from '@/components/ui/navigation/SideNav';
import { SyncProvider } from '@/providers/SyncProvider';

const inter = Inter({ subsets: ['latin'] });

const publicRoutes = ['/auth'];

function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-xl w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600">
            We&apos;ve encountered an unexpected error. Our team has been notified.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.includes(pathname);

  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary fallback={<ErrorFallback />}>
          <QueryClientProvider>
            <AuthProvider>
              <SyncProvider>
                <div className="min-h-screen bg-gray-50">
                  {!isPublicRoute && <Header />}
                  <div className="flex">
                    {!isPublicRoute && <SideNav />}
                    <main className={`flex-1 ${!isPublicRoute ? 'ml-64 pt-16' : ''}`}>
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                    </main>
                  </div>
                </div>
              </SyncProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
