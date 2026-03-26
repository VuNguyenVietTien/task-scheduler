import { useQuery } from '@tanstack/react-query';
import { ProjectMember } from '@/types/project';
import { useCommonApi } from './useCommonApi';

export function useProjectMembers(projectId: string) {
  const { fetchData } = useCommonApi<ProjectMember[]>();

  return useQuery<ProjectMember[]>({
    queryKey: ['projectMembers', projectId],
    queryFn: async () => {
      const { success, data, error } = await fetchData(`/projects/${projectId}/members`);
      if (!success || !data) {
        throw error;
      }
      return data;
    },
    staleTime: 30000, // Data is fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
    refetchOnWindowFocus: false // Disable refetch on window focus
  });
}