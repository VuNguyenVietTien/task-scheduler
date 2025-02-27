import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { Task } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';

/**
 * Fetches tasks for a specific project
 */
const fetchProjectTasks = async (projectId: string): Promise<Task[]> => {
  // For testing, return mock data with minimal delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Filter mock tasks by project ID and deep clone them
  const tasks = mockTasks
    .filter(task => task.projectId === projectId)
    .map(task => ({...task}));
  return tasks;
};

type QueryOptions = UseQueryOptions<Task[], Error, Task[], [string, string]>;

export function useProjectTasks(projectId: string) {
  const queryOptions: QueryOptions = {
    queryFn: () => fetchProjectTasks(projectId),
    queryKey: ['projectTasks', projectId],
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    cacheTime: 10 * 60 * 1000,   // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    initialData: () => mockTasks
      .filter(task => task.projectId === projectId)
      .map(task => ({...task}))
  };

  return useQuery(queryOptions);
}
