import { useEffect, useState } from 'react';
import { type Project } from '@/data/mockProjects';

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/${id}`);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch project');
        }

        const projectData = await response.json();
        setProject(projectData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchProject();
    }
  }, [id]);

  return { project, isLoading, error };
}
