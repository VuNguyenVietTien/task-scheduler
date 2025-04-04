'use client';

import { useState, useEffect } from 'react';
import { ProjectDetailView } from '@/components/projects/ProjectDetailView';
import type { ProjectData } from '@/types/project';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchProject, resetProject } from '@/redux/features/projectSlice';

interface ProjectPageProps {
  id: string;
}

function LoadingFallback() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-6"></div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded"></div>
          <div className="h-4 bg-slate-200 rounded"></div>
          <div className="h-4 bg-slate-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

// Export default component thay vì named export
export default function ProjectPage({ id }: ProjectPageProps) {
  // Comment out code cũ
  // const { loading, error, data } = useProject(id);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  
  // Sử dụng Redux hooks 
  const dispatch = useAppDispatch();
  const { project, loading, error } = useAppSelector(state => state.project);

  useEffect(() => {
    // Đảm bảo chỉ dispatch khi đã load ở client side
    if (typeof window !== 'undefined') {
      // Dispatch action để fetch project
      dispatch(fetchProject(id));
      
      // Cleanup function để reset project state khi unmount
      return () => {
        dispatch(resetProject());
      };
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (project) {
      // Map dữ liệu từ Redux store sang ProjectData
      const mapped: ProjectData = {
        id: id,
        name: project.name,
        description: project.description || '',
        dueDate: project.endDate,
        members: project.memberCount,
        status: project.status.toLowerCase() === 'completed' ? 'completed' :
               project.status.toLowerCase() === 'on_hold' ? 'on-hold' :
               'active'
      };
      
      setProjectData(mapped);
    }
  }, [project, id]);

  // Xử lý trạng thái loading
  if (loading) {
    return <LoadingFallback />;
  }

  // Xử lý trạng thái lỗi
  if (error) {
    return (
      <div className="p-6">
        <div className="card">
          <h1 className="text-xl text-red-600">Error</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  // Xử lý trường hợp không tìm thấy project
  if (!projectData) {
    return (
      <div className="p-6">
        <div className="card">
          <h1 className="text-xl text-red-600">Project not found</h1>
          <p className="text-slate-600">
            The project you're looking for doesn't exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return <ProjectDetailView project={projectData} />;
} 