'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { ClientProviders } from "@/providers/ClientProviders";
import { Toaster } from "sonner";
import Layout from "@/components/ui/navigation/Layout";
import { usePathname } from "next/navigation";
import { I18nProvider } from "@/i18n/I18nProvider";

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <I18nProvider>
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
        </I18nProvider>
      </body>
    </html>
  );
}
