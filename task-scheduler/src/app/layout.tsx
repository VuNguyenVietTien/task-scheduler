import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

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
      <body className={`${inter.className} bg-sky-50/30 min-h-screen`}>
        <main className="container mx-auto p-4 h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
