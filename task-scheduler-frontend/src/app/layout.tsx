import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryClientProvider } from '@/components/providers/QueryClientProvider';
import Layout from '@/components/ui/navigation/Layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Task Scheduler',
  description: 'A simple task scheduler application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider>
          <Layout>{children}</Layout>
        </QueryClientProvider>
      </body>
    </html>
  );
}
