import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type { ProjectData } from '@/types/project';
import { TaskResponse } from '@/types/task';

interface ProjectResponse {
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  metadata: Record<string, unknown> | null;
  visibility: string;
  tags: string[];
  progress: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  member_count: number;
  tasks: TaskResponse[];
}

export function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId] as const,
    queryFn: async () => {
      console.log('📤 [API] Fetching project details for ID:', projectId);
      
      try {
        const response = await fetchApi<ProjectResponse>(`/api/projects/${projectId}`);
        
        if (!response) {
          throw new Error('Project not found');
        }

        console.log('📥 [API] Received project data:', response);

        // Transform API response to match ProjectData interface
        return {
          id: response.projectId,
          name: response.name || 'Untitled Project',
          description: response.description || '',
          status: response.status?.toLowerCase() === 'completed' ? 'completed' :
                 response.status?.toLowerCase() === 'on_hold' ? 'on-hold' :
                 'active',
          priority: response.priority || 'MEDIUM',
          category: response.category || '',
          metadata: response.metadata || {},
          visibility: response.visibility || 'PUBLIC',
          tags: response.tags || [],
          progress: response.progress || 0,
          dueDate: response.due_date || undefined,
          created_at: response.created_at,
          updated_at: response.updated_at,
          created_by: response.created_by,
          members: response.member_count || 0,
          tasks: (response.tasks || []).map(task => ({
            id: task.id,
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
            assignee: task.assignee || undefined,
            deadline: task.deadline || undefined,
            startDate: task.startDate || undefined,
            effortHours: task.effortHours || 0,
            created_at: task.createdAt,
            updated_at: task.updatedAt
          }))
        };
      } catch (error) {
        console.error('❌ [API Error] Failed to fetch project:', error);
        throw error;
      }
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep inactive data in cache for 5 minutes
  });
}