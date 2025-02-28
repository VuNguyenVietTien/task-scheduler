'use client';

import ProjectList from '@/components/projects/ProjectList';

export default function ProjectsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-gray-600">Manage and track your ongoing projects</p>
      </div>
      
      <ProjectList />
    </div>
  );
}
