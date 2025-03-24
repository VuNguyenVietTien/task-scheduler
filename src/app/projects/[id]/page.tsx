'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Ngăn chặn static generation cho route này
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0; // Thêm cấu hình này để tránh cache

// Tạo component loading fallback
function LoadingFallback() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-6"></div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded"></div>
          <div className="h-4 bg-slate-200 rounded"></div>
          <div className="h-4 bg-slate-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

// Import component với {ssr: false} để tránh xung đột Apollo Client ở server
const DynamicProjectContent = dynamic(
  () => import('@/components/projects/ProjectPage'),
  { 
    ssr: false, // Đảm bảo component chỉ render ở client side
    loading: () => <LoadingFallback />
  }
);

// Tạo một wrapper component để truyền props một cách an toàn với type
type ProjectPageProps = {
  id: string;
};

// Wrapper component giúp xử lý truyền props id vào dynamic import
function ProjectPageWrapper({ id }: ProjectPageProps) {
  return <DynamicProjectContent id={id} />;
}

// Component ProjectDetail được export mặc định
export default function ProjectDetail({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingFallback />}>
        <ProjectPageWrapper id={params.id} />
      </Suspense>
    </ProtectedRoute>
  );
} 