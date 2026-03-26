import { useState, useCallback } from 'react';
import { createApiRequest, handleApiError, ApiResponse } from '@/lib/apiUtils';
import { API_BASE_URL } from '@/lib/api';

export function useCommonApi<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (
    endpoint: string,
    method: string = 'GET',
    body?: any,
    additionalHeaders: HeadersInit = {}
  ): Promise<ApiResponse<T>> => {
    console.log('[API] Sending request:', {
      url: `${API_BASE_URL}${endpoint}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...additionalHeaders
      },
      credentials: 'include' as RequestCredentials,
      ...body && { body }
    });

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}${endpoint}`, 
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...additionalHeaders
          },
          credentials: 'include',
          body: body ? JSON.stringify(body) : undefined,
        }
      );

      if (!response.ok) {
        throw await response.json();
      }

      const data = await response.json();
      console.log('[API] Received data:', data);

      return {
        success: true,
        data
      };
    } catch (err) {
      const error = handleApiError(err);
      setError(error);
      return {
        success: false,
        error
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    fetchData,
    loading,
    error
  };
}