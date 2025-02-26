'use client';

import { useState } from 'react';
import { Timeline } from '@/components/timeline/Timeline';
import { TaskListView } from '@/components/tasks/TaskListView';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { mockTasks, mockUsers } from '@/data/mockTasks';
import type { ProjectData } from '@/types/project';
import { DragDropContext } from 'react-beautiful-dnd';

type ViewType = 'list' | 'kanban' | 'gantt';

// Different contexts to prevent interference between drag & drop zones
const DragContexts = {
  TASKLIST: 'taskList',
  GANTT: 'gantt'
} as const;

export function ProjectDetailView({ project }: { project: ProjectData }) {
  const [activeView, setActiveView] = useState<ViewType>('list');

  const tabs = [
    {
      id: 'list',
      label: 'Task List',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      )
    },
    {
      id: 'gantt',
      label: 'Gantt Chart',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="p-6">
      {/* Project Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <a 
            href={`/projects/${project.id}/add-task`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-block"
          >
            Add Task
          </a>
        </div>
        <div className="flex gap-4 mt-2 text-slate-600">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Due {new Date(project.dueDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{project.members} members</span>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as ViewType)}
              className={`flex items-center pb-4 px-1 -mb-px text-sm font-medium transition-colors relative
                ${activeView === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

  {/* View Content */}
  <div className="h-[calc(100vh-240px)]">
    {activeView === 'list' && <TaskListView tasks={mockTasks} />}
    {activeView === 'kanban' && (
      <div className="h-full overflow-x-auto">
        <KanbanBoard tasks={mockTasks} />
      </div>
    )}
    {activeView === 'gantt' && (
      <div className="card h-full overflow-auto">
        <Timeline tasks={mockTasks} users={mockUsers} />
      </div>
    )}
  </div>
    </div>
  );
}
