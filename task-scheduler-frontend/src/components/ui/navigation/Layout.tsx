import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import FcmNotificationHandler from '@/components/common/FcmNotificationHandler';
import { useAuth } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Sidebar />
      {user && <FcmNotificationHandler userId={user.id} />}
      <main className="pl-64 pt-16 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
