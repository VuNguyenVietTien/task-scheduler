import { useQuery } from '@tanstack/react-query';
import { Task } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';

const fetchProjectTasks = async (projectId: string): Promise<Task[]> => {
  // For testing, return mock data with minimal delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Deep clone mock tasks to avoid reference issues
  const tasks = mockTasks.map(task => ({...task}));
  return tasks;

  // Real implementation would be:
  /*
  const response = await fetch(`/api/projects/${projectId}/tasks`);
  if (!response.ok) {
    throw new Error('Failed to fetch tasks');
  }
  return response.json();
  */
};

export function useProjectTasks(projectId: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => fetchProjectTasks(projectId),
    staleTime: Infinity, // Keep data fresh until explicitly invalidated
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    select: (tasks) => {
      // Ensure we return a new array to avoid reference issues
      return tasks.map(task => ({...task}));
    },
    initialData: () => {
      // Initialize with mock data for faster initial load
      return mockTasks.map(task => ({...task}));
    }
  });
}
