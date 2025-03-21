'use client';

import { Inter } from "next/font/google";
import { usePathname } from "next/navigation";
import { ApolloProvider } from "@apollo/client";
import { client } from "@/lib/apollo-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { SyncProvider } from "@/providers/SyncProvider";
import Layout from "@/components/ui/navigation/Layout";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
        <AuthProvider>
          <QueryProvider>
            <ApolloProvider client={client}>
              <SyncProvider>
                {isAuthRoute ? (
                  children
                ) : (
                  <Layout>
                    {children}
                  </Layout>
                )}
                <Toaster richColors position="top-right" />
              </SyncProvider>
            </ApolloProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
