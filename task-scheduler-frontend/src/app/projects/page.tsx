'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: 'active' | 'completed' | 'on-hold';
  teamMembers: number;
  tasksCount: {
    total: number;
    completed: number;
  };
}

export default function Projects() {
  const [projects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign',
      description: 'Modernizing the company website with new design system',
      progress: 65,
      status: 'active',
      teamMembers: 5,
      tasksCount: {
        total: 24,
        completed: 16
      }
    },
    {
      id: '2',
      name: 'Mobile App Development',
      description: 'Creating a new mobile app for customer engagement',
      progress: 30,
      status: 'active',
      teamMembers: 8,
      tasksCount: {
        total: 45,
        completed: 12
      }
    },
    {
      id: '3',
      name: 'Data Migration',
      description: 'Migrating data to new cloud infrastructure',
      progress: 90,
      status: 'on-hold',
      teamMembers: 4,
      tasksCount: {
        total: 18,
        completed: 15
      }
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success';
      case 'completed':
        return 'bg-primary/10 text-primary';
      case 'on-hold':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1>Projects</h1>
        <button className="btn-primary">
          New Project
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(project => (
          <Link href={`/projects/${project.id}`} key={project.id} className="block">
            <div className="card hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg">{project.name}</h3>
                <span className={`badge ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
              
              <p className="text-text-secondary mb-4">{project.description}</p>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary rounded-full h-2 transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm text-text-secondary">
                <div>
                  <span className="mr-2">🎯</span>
                  {project.tasksCount.completed}/{project.tasksCount.total} tasks
                </div>
                <div>
                  <span className="mr-2">👥</span>
                  {project.teamMembers} members
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
