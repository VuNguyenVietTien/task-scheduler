import { Suspense } from 'react';
import type { ProjectData } from '@/types/project';
import { ProjectDetailView } from '@/components/projects/ProjectDetailView';

async function getProject(id: string): Promise<ProjectData> {
  // In a real app, this would be an API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    id,
    name: 'Website Redesign',
    description: 'Modernizing the company website with new design system',
    dueDate: '2025-03-15',
    members: 5,
    status: 'active'
  };
}

export default async function ProjectDetail({ params, searchParams }: { params: { id: string }, searchParams: { [key: string]: string | undefined } }) {
  const project = await getProject(params.id);

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

  return (
    <Suspense fallback={
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
    }>
      <ProjectDetailView project={project} />
    </Suspense>
  );
}
