'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, FolderPlus, Loader2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects || []);
      } else {
        setError(data.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={fetchProjects}
          className="text-blue-500 hover:text-blue-600"
        >
          Try again
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <FolderPlus className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No Projects Yet
        </h3>
        <p className="text-gray-500 mb-6 max-w-md">
          Get started by creating your first project to track tasks and collaborate with your team.
        </p>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Create Project
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <Link
        href="/projects/new"
        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors group min-h-[200px]"
      >
        <PlusCircle className="w-12 h-12 text-gray-400 group-hover:text-blue-500 mb-4" />
        <span className="text-gray-500 group-hover:text-blue-500">Create New Project</span>
      </Link>

      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="block p-6 bg-white shadow-sm border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-gray-500 text-sm mb-4 line-clamp-2">
              {project.description}
            </p>
          )}
          <div className="text-xs text-gray-400">
            Created {new Date(project.created_at).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
