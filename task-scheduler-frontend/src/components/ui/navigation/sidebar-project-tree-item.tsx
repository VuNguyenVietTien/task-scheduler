'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface Project {
  projectId: string;
  name: string;
  iconUrl?: string;
  status?: string;
}

interface SidebarProjectTreeItemProps {
  project: Project;
  isExpanded: boolean;
  onToggle: (projectId: string) => void;
}

const SUB_TABS = [
  { id: 'list', label: 'Danh sach CV', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'kanban', label: 'Kanban', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
  { id: 'gantt', label: 'Gantt Chart', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'members', label: 'Thanh vien', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'report', label: 'Bao cao', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

export function SidebarProjectTreeItem({ project, isExpanded, onToggle }: SidebarProjectTreeItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActiveProject = pathname === `/projects/${project.projectId}`;
  const activeTab = isActiveProject ? (searchParams.get('tab') || 'list') : null;

  return (
    <div className={isExpanded ? 'bg-slate-800/50 rounded-md' : ''}>
      {/* Project header */}
      <button
        onClick={() => onToggle(project.projectId)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-200 hover:bg-slate-800 ${
          isActiveProject && !isExpanded ? 'text-blue-400' : 'text-slate-300'
        }`}
        aria-expanded={isExpanded}
        title={project.name}
      >
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Project name */}
        <span className="truncate">{project.name}</span>
      </button>

      {/* Sub-tabs (expanded) */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-8 pb-1">
          {SUB_TABS.map(tab => {
            const isActive = isActiveProject && activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/projects/${project.projectId}?tab=${tab.id}`}
                className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm transition-colors duration-200 ${
                  isActive
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800/50'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
