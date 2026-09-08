'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { GET_USER_PROJECTS } from '@/graphql/queries/project';
import { useSidebarState } from '@/hooks/use-sidebar-state';
import { SidebarProjectTreeItem } from './sidebar-project-tree-item';
import CreateProjectModal from '@/components/projects/create-project-modal';
import { useTranslation } from 'react-i18next';

interface ProjectNode {
  project_id: string;
  name: string;
  icon_url?: string;
  status?: string;
  user_role?: string;
}

const Sidebar = () => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const { data, loading } = useQuery(GET_USER_PROJECTS, { fetchPolicy: 'cache-first' });
  const { toggleProject, isExpanded } = useSidebarState();

  const projects: ProjectNode[] = data?.projects || [];
  const isDashboardActive = pathname === '/' || pathname === '/dashboard';

  return (
    <>
      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <aside className="fixed top-16 left-0 h-[calc(100vh-64px)] w-60 bg-slate-900 text-slate-300 flex flex-col overflow-y-auto">
      <nav className="flex-1 px-3 py-4 space-y-1">
        {/* Dashboard link */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-200 ${
            isDashboardActive
              ? 'bg-blue-700 text-white'
              : 'hover:bg-slate-800'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>{t('nav.dashboard')}</span>
        </Link>

        {/* Projects section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('nav.projects')}</span>
            <button
              onClick={() => setModalOpen(true)}
              title={t('nav.createProject')}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 mt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse px-3 py-2">
                  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500 text-center">
              {t('nav.noProjects')}
            </div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {projects.map(project => (
                <SidebarProjectTreeItem
                  key={project.project_id}
                  project={project}
                  isExpanded={isExpanded(project.project_id)}
                  onToggle={toggleProject}
                />
              ))}
            </div>
          )}
        </div>
      </nav>
      </aside>
    </>
  );
};

export default Sidebar;
