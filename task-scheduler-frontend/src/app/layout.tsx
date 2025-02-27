'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { QueryClientProvider } from '@/components/providers/QueryClientProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import Header from '@/components/ui/navigation/Header';
import { SideNav } from '@/components/ui/navigation/SideNav';

const inter = Inter({ subsets: ['latin'] });

const publicRoutes = ['/auth'];

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
        <QueryClientProvider>
          <AuthProvider>
            <div className="min-h-screen bg-gray-50">
              {!isPublicRoute && <Header />}
              <div className="flex">
                {!isPublicRoute && <SideNav />}
                <main className={`flex-1 ${!isPublicRoute ? 'ml-64 pt-16' : ''}`}>
                  {children}
                </main>
              </div>
            </div>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
