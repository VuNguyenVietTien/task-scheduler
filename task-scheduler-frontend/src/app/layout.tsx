'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { ClientProviders } from "@/providers/ClientProviders";
import { Toaster } from "sonner";
import Layout from "@/components/ui/navigation/Layout";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');

  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProviders>
          {isAuthRoute ? (
            children
          ) : (
            <Layout>
              {children}
            </Layout>
          )}
          <Toaster richColors position="top-right" />
        </ClientProviders>
      </body>
    </html>
  );
}
