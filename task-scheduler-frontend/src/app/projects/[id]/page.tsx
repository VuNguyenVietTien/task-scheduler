'use client';

import { Suspense, useEffect, useState } from 'react';
import type { ProjectData } from '@/types/project';
import { fetchApi } from '@/lib/api';
import { ProjectDetailView } from '@/components/projects/ProjectDetailView';
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
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const response = await fetchApi(`/api/projects/${id}`);
        
        // Transform API response to match ProjectData interface
        const projectData: ProjectData = {
          id: response.id,
          name: response.name,
          description: response.description || '',
          // Using created_at as dueDate for now since API doesn't have dueDate
          dueDate: response.created_at,
          members: response.member_count || 0,
          // Map API status to UI status
          status: response.status.toLowerCase() === 'completed' ? 'completed' :
                 response.status.toLowerCase() === 'on_hold' ? 'on-hold' :
                 'active'
        };

        setProject(projectData);
        setError(null);
      } catch (err) {
        setError('Failed to load project details');
        console.error('Error loading project:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [id]);

  if (loading) {
    return <LoadingFallback />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="card">
          <h1 className="text-xl text-red-600">Error</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
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

  return <ProjectDetailView project={project} />;
}
