import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh until explicitly invalidated
      staleTime: Infinity,
      
      // Cache for 5 minutes
      cacheTime: 5 * 60 * 1000,
      
      // Disable automatic background refetching
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      
      // Only retry once on failure
      retry: 1,
      
      // Enable optimistic updates
      enabled: true,
    },
    mutations: {
      // Only retry once on failure
      retry: 1,

      // Prevent multiple mutations from running at the same time
      mutationKey: ['tasks'],
    },
  },
});
