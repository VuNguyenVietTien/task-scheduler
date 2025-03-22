'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

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

// Import component mà không sử dụng SSR để tránh lỗi Apollo Client
// Sử dụng NoSSR trước để tránh lỗi hydration
const DynamicProjectContent = dynamic(
  () => import('@/components/projects/ProjectPage'),
  { 
    ssr: false, 
    loading: () => <LoadingFallback />
  }
);

// Tạo một wrapper component để truyền props một cách an toàn với type
type ProjectPageProps = {
  id: string;
};

// Wrapper component giúp xử lý truyền props id vào dynamic import
function ProjectPageWrapper({ id }: ProjectPageProps) {
  // Sử dụng cách truyền props an toàn với TypeScript
  return <DynamicProjectContent {...({id} as any)} />;
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
