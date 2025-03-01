import { useState, useEffect } from 'react';
import { type Project } from '@/data/mockProjects';
import { apiClient } from '@/lib/config';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Fetching projects...');
        const response = await apiClient.get<{ projects: Project[] }>('/api/projects');
        console.log('Projects response:', response);
        const projectsData = response.projects || [];
        setProjects(projectsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, []);

  return { projects, isLoading, error };
}
