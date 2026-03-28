'use client';

import React, { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { fetchProjectMembers } from '@/redux/features/membersSlice';
import { fetchProject } from '@/redux/features/projectSlice';

interface ProjectLayoutProps {
  children: React.ReactNode;
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params?.id as string;
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (projectId) {
      const isTaskDetailPage = pathname && pathname.includes(`/projects/${projectId}/tasks/`);
      if (!isTaskDetailPage) {
        dispatch(fetchProject(projectId));
      }
      dispatch(fetchProjectMembers(projectId));
    }
  }, [projectId, pathname, dispatch]);

  return (
    <div className="project-layout">
      {children}
    </div>
  );
} 