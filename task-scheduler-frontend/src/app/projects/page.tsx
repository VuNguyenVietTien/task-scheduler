'use client';

import ProjectList from '@/components/projects/ProjectList';

export default function Projects() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>
      <ProjectList />
    </div>
  );
}
