'use client';

import React, { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
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
  const { project, loading: projectLoading } = useAppSelector(state => state.project);
  const { members, loading: membersLoading } = useAppSelector(state => state.members);
  
  useEffect(() => {
    if (projectId) {
      // Kiểm tra xem có đang ở trang chi tiết task không
      const isTaskDetailPage = pathname && pathname.includes(`/projects/${projectId}/tasks/`);
      
      // Chỉ gọi fetchProject khi KHÔNG ở trang task detail
      if (!isTaskDetailPage) {
        console.log('Layout: Tải dữ liệu project', projectId);
        dispatch(fetchProject(projectId));
      } else {
        console.log('Layout: Bỏ qua tải dữ liệu project vì đang ở trang task detail');
      }
      
      // Chỉ tải danh sách members khi chưa có trong Redux store
      if (!members || members.length === 0) {
        console.log('Layout: Tải danh sách thành viên');
        dispatch(fetchProjectMembers(projectId));
      } else {
        console.log('Layout: Bỏ qua tải danh sách thành viên vì đã có trong store');
      }
    }
  }, [projectId, pathname, dispatch, members]);

  return (
    <div className="project-layout">
      {children}
    </div>
  );
} 