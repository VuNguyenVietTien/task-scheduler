'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { PlusCircle, FolderPlus, Loader2, Users, Calendar } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  status: string;
  priority: string;
  visibility: string;
  tags: string[];
  member_count: number;
}

const getPriorityColor = (priority: string) => {
  const colors = {
    URGENT: 'bg-red-100 text-red-800',
    HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-green-100 text-green-800'
  };
  return colors[priority as keyof typeof colors] || colors.MEDIUM;
};

const getStatusColor = (status: string) => {
  const colors = {
    NEW: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
    ON_HOLD: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-800'
  };
  return colors[status as keyof typeof colors] || colors.NEW;
};

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await fetchApi('/api/projects');
      setProjects(data || []);
      setError(null);
    } catch (err) {
      console.error('[Projects] Error fetching projects:', err);
      if (err instanceof Error && err.name === 'AuthenticationError') {
        window.location.href = '/auth';
      } else {
        setError('Failed to fetch projects');
        setProjects([]);
      }
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
          className="group block p-6 bg-white shadow-sm border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
        >
          {/* Project Header */}
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            <div className="flex gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(project.priority)}`}>
                {project.priority}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(project.status)}`}>
                {project.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Project Description */}
          {project.description && (
            <p className="text-gray-500 text-sm mb-4 line-clamp-2">
              {project.description}
            </p>
          )}

          {/* Project Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Project Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{project.member_count}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${project.visibility === 'PRIVATE' ? 'bg-gray-100' : 'bg-green-100'}`}>
              {project.visibility}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
