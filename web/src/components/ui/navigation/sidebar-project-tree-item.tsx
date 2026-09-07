'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';

interface Project {
  project_id: string;
  name: string;
  icon_url?: string;
  status?: string;
}

interface SidebarProjectTreeItemProps {
  project: Project;
  isExpanded: boolean;
  onToggle: (projectId: string) => void;
}

const SUB_TAB_ICONS = {
  list: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  kanban: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  gantt: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  members: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  report: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  documents: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  settings: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 00-1.88-.34 1.7 1.7 0 00-1.03 1.56V20h-3v-.08a1.7 1.7 0 00-1.03-1.56 1.7 1.7 0 00-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 007 14.7a1.7 1.7 0 00-1.56-1.03H5v-3h.08A1.7 1.7 0 006.64 9.6a1.7 1.7 0 00-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 001.88.34A1.7 1.7 0 0011.33 4.4V4h3v.08a1.7 1.7 0 001.03 1.56 1.7 1.7 0 001.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0019 9.3a1.7 1.7 0 001.56 1.03H21v3h-.08A1.7 1.7 0 0019.4 15z',
};

export function SidebarProjectTreeItem({ project, isExpanded, onToggle }: SidebarProjectTreeItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const isActiveProject = pathname === `/projects/${project.project_id}`;
  const activeTab = isActiveProject ? (searchParams?.get('tab') || 'list') : null;

  const subTabs = [
    { id: 'list', label: t('projects.viewList') },
    { id: 'kanban', label: t('projects.viewKanban') },
    { id: 'gantt', label: t('projects.viewGantt') },
    { id: 'members', label: t('projects.viewMembers') },
    { id: 'report', label: t('projects.viewReport') },
    { id: 'documents', label: t('projects.viewDocuments') },
    { id: 'settings', label: t('settings.title') },
    // Requirement 8: per-user timesheet (logwork) screen.
    { id: 'timesheet', label: 'Timesheet' },
  ];

  return (
    <div className={isExpanded ? 'bg-slate-800/50 rounded-md' : ''}>
      {/* Project header */}
      <button
        onClick={() => onToggle(project.project_id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-200 hover:bg-slate-800 ${
          isActiveProject && !isExpanded ? 'text-blue-400' : 'text-slate-300'
        }`}
        aria-expanded={isExpanded}
        title={project.name}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="truncate">{project.name}</span>
      </button>

      {/* Sub-tabs (expanded) */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-8 pb-1">
          {subTabs.map(tab => {
            const isActive = isActiveProject && activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/projects/${project.project_id}?tab=${tab.id}`}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SUB_TAB_ICONS[tab.id as keyof typeof SUB_TAB_ICONS]} />
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
