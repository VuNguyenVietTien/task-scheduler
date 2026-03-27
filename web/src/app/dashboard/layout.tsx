'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// Import FCM handler dynamically to avoid SSR issues
const FcmNotificationHandler = dynamic(
  () => import('@/components/common/FcmNotificationHandler'),
  { ssr: false }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('\n[DashboardLayout] ========= Auth Status =========');
    console.log('[DashboardLayout] Loading:', loading);
    console.log('[DashboardLayout] User:', user ? {
      id: user.id,
      email: user.email,
      name: user.name
    } : 'Not authenticated');

    if (!loading && !user) {
      console.log('[DashboardLayout] Not authenticated, redirecting to auth...');
      router.push('/auth');
      return;
    }

    console.log('[DashboardLayout] ========= End Status =========\n');
  }, [user, loading, router]);

  // Show loading indicator
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Wait for redirect if not authenticated
  if (!user) {
    console.log('[DashboardLayout] User not authenticated, waiting for redirect...');
    return null;
  }

  // Render dashboard when authenticated
  console.log('[DashboardLayout] Rendering dashboard for:', user.email);
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {user.name} ({user.email})
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      
      {/* FCM Notification handler will initialize notifications */}
      {user && <FcmNotificationHandler userId={user.id} />}
    </div>
  );
}