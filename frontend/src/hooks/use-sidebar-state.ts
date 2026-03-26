'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'sidebar-expanded-projects';

function loadFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

/**
 * Hook to manage sidebar expanded/collapsed state for projects.
 * Persists state in localStorage across page refreshes.
 */
export function useSidebarState() {
  // Lazy initializer reads localStorage once on mount - avoids overwrite race
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(loadFromStorage);

  // Persist to localStorage whenever expandedProjects changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedProjects]));
    } catch {
      // Ignore storage errors
    }
  }, [expandedProjects]);

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (projectId: string) => expandedProjects.has(projectId),
    [expandedProjects]
  );

  return { expandedProjects, toggleProject, isExpanded };
}
