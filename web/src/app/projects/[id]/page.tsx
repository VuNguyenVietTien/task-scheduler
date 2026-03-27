'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

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

const DynamicProjectContent = dynamic(
  () => import('@/components/projects/ProjectPage'),
  {
    ssr: false,
    loading: () => <LoadingFallback />
  }
);

function ProjectPageWrapper({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab') || 'list';
  return <DynamicProjectContent id={id} initialTab={tab} />;
}

export default function ProjectDetail({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingFallback />}>
        <ProjectPageWrapper id={params.id} />
      </Suspense>
    </ProtectedRoute>
  );
}
