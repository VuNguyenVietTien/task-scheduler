'use client';

import { Suspense } from 'react';
import type { ProjectData } from '@/types/project';
import { ProjectDetailView } from '@/components/projects/ProjectDetailView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useProject } from '@/hooks/useProject';

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

export default function ProjectDetail({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingFallback />}>
        <ProjectPage id={params.id} />
      </Suspense>
    </ProtectedRoute>
  );
}

function ProjectPage({ id }: { id: string }) {
  const { loading, error, data } = useProject(id);

  // Xử lý trạng thái loading
  if (loading) {
    return <LoadingFallback />;
  }

  // Xử lý trạng thái lỗi
  if (error) {
    return (
      <div className="p-6">
        <div className="card">
          <h1 className="text-xl text-red-600">Error</h1>
          <p className="text-slate-600">{error.message}</p>
        </div>
      </div>
    );
  }

  // Xử lý trường hợp không tìm thấy project
  if (!data || !data.project) {
    return (
      <div className="p-6">
        <div className="card">
          <h1 className="text-xl text-red-600">Project not found</h1>
          <p className="text-slate-600">
            The project you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  // Map dữ liệu từ GraphQL sang ProjectData
  const project: ProjectData = {
    id: data.project.projectId,
    name: data.project.name,
    description: data.project.description || '',
    dueDate: data.project.endDate,
    members: data.project.memberCount,
    status: data.project.status.toLowerCase() === 'completed' ? 'completed' :
           data.project.status.toLowerCase() === 'on_hold' ? 'on-hold' :
           'active'
  };

  return <ProjectDetailView project={project} />;
}
