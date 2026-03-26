import { useEffect } from 'react';
import { storage } from '@/utils/storage';
import { useQueryClient } from '@tanstack/react-query';

export function useStorageSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (!event.key) return;

      // Only handle our app's storage keys
      if (!event.key.startsWith('taskScheduler_')) return;

      // Invalidate queries based on the changed key
      if (event.key === 'taskScheduler_projects') {
        queryClient.invalidateQueries(['projects']);
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [queryClient]);
}

export function broadcastStorageUpdate(key: string) {
  // Create a storage event by modifying localStorage
  const currentValue = localStorage.getItem(key);
  localStorage.setItem(key, currentValue || '');
}

// Custom hook for project status management
export function useProjectStatus(projectId: string) {
  const queryClient = useQueryClient();

  const updateStatus = async (newStatus: 'active' | 'completed' | 'on-hold') => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update project status');
      }

      // Update cache and broadcast change
      queryClient.invalidateQueries(['projects']);
      queryClient.invalidateQueries(['project', projectId]);
      
      // Broadcast to other tabs
      broadcastStorageUpdate('taskScheduler_projects');

      return true;
    } catch (error) {
      console.error('Error updating project status:', error);
      return false;
    }
  };

  return { updateStatus };
}
