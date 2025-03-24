'use client';

import { Inter } from "next/font/google";
import { usePathname } from "next/navigation";
import Layout from "@/components/ui/navigation/Layout";
import "./globals.css";
import dynamic from "next/dynamic";
import React from 'react';

const inter = Inter({ subsets: ["latin"] });

// Sử dụng dynamic import cho các providers để tránh SSR
const ClientProviders = dynamic(
  () => import('@/providers/ClientProviders').then(mod => mod.ClientProviders),
  { ssr: false }
);

// Import Toaster qua dynamic import để tránh lỗi sonner
const ClientToaster = dynamic(
  () => import('@/components/common/ClientToaster').then(mod => mod.ClientToaster),
  { ssr: false }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');

  return (
    <html lang="en">
      <head>
        {/* Thêm noscript để tránh flash khi hydration */}
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: `
            .hydration-loading { display: none; }
          `}} />
        </noscript>
      </head>
      <body className={inter.className}>
        <ClientProviders>
          {isAuthRoute ? (
            children
          ) : (
            <Layout>
              {children}
            </Layout>
          )}
          {/* Sử dụng ClientToaster thay vì Toaster trực tiếp */}
          <ClientToaster />
        </ClientProviders>
      </body>
    </html>
  );
} 