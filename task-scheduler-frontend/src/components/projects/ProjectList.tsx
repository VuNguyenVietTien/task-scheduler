'use client';

import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { PlusCircle, FolderPlus, Loader2, Users, Calendar } from 'lucide-react';
import { GET_PROJECTS } from '@/graphql/queries/projects';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  priority: string;
  visibility: string;
  tags: string[];
  memberCount: number;
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
  const { data, loading, error, refetch } = useQuery(GET_PROJECTS);
  const projects = data?.projects || [];

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
        <div className="text-red-500 mb-4">{error.message}</div>
        <button 
          onClick={() => refetch()}
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
        <div className="relative">
          <FolderPlus className="w-20 h-20 text-blue-500 mb-6 transform transition-transform hover:scale-110" />
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-100 rounded-full animate-pulse" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3">
          Start Your First Project
        </h3>
        <p className="text-gray-600 mb-8 max-w-md leading-relaxed">
          Create a project to organize tasks, collaborate with your team, and track progress all in one place.
        </p>
        <Link
          href="/projects/new"
          className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-blue-200 transition-all duration-300 hover:-translate-y-0.5"
        >
          <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          Create Project
          <span className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <Link
        href="/projects/new"
        className="relative flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-white border border-blue-100 rounded-xl hover:shadow-xl transition-all duration-300 group min-h-[200px] overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 transform -skew-y-12 group-hover:animate-shine" />
        <PlusCircle className="w-12 h-12 text-blue-500 group-hover:scale-110 transition-transform duration-300 mb-4" />
        <span className="font-medium text-blue-600 group-hover:text-blue-700">Create New Project</span>
      </Link>

      {projects.map((project: Project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="group block p-6 bg-white rounded-xl border border-gray-200 hover:shadow-xl hover:border-blue-100 transition-all duration-300 transform hover:-translate-y-1"
        >
          {/* Project Header */}
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            <div className="flex gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority)} transition-transform group-hover:scale-105`}>
                {project.priority}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)} transition-transform group-hover:scale-105`}>
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
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
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
                <span>{project.memberCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${project.visibility === 'PRIVATE' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>
              {project.visibility}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
