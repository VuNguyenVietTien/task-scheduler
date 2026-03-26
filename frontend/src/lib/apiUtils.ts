// Common API configuration
export const API_CONFIG = {
  baseHeaders: {
    'Content-Type': 'application/json',
  },
  defaultOptions: {
    credentials: 'include' as RequestCredentials,
  }
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

// Common error handling
export function handleApiError(error: any): never {
  console.error('❌ [API Error]', error);
  throw {
    message: error.message || 'An error occurred',
    code: error.status || '500',
    details: error.details || null
  };
}

// Standardized request creator
export function createApiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  additionalHeaders: HeadersInit = {}
): RequestInit {
  return {
    method,
    headers: {
      ...API_CONFIG.baseHeaders,
      ...additionalHeaders
    },
    body: body ? JSON.stringify(body) : undefined,
    ...API_CONFIG.defaultOptions
  };
}