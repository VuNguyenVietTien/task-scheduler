type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

// Helper function to get token from cookie
function getTokenFromCookie(name: string): string | null {
  const cookies = document.cookie.split(';');
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));
  if (!cookie) return null;
  return cookie.split('=')[1];
}

// Function to get auth headers for requests
export function getAuthHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  const token = getTokenFromCookie('auth-token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Function to handle token refresh
async function handleTokenRefresh() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    window.location.href = '/auth';
    throw error;
  }
}

// Function to handle API errors
async function handleApiError(error: any, retryFn: () => Promise<any>) {
  if (error.name === 'AuthenticationError') {
    try {
      // Try to refresh the token
      await handleTokenRefresh();
      // Retry the original request
      return await retryFn();
    } catch (refreshError) {
      // If refresh fails, redirect to login
      window.location.href = '/auth';
      throw refreshError;
    }
  }
  throw error;
}

async function sendLogToBackend(type: string, details: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/logging`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Log-Type': type
      },
      credentials: 'include',
      body: JSON.stringify({
        type,
        timestamp: new Date().toISOString(),
        details
      })
    });
  } catch (error) {
    console.error('Failed to send log to backend:', error);
  }
}

export async function fetchApi(url: string, options: FetchOptions = {}) {
  const defaultHeaders: Record<string, string> = {
    ...getAuthHeaders(),
  };

  const requestStartTime = performance.now();
  const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`;

  console.log('[API Request]', {
    url: apiUrl,
    headers: defaultHeaders,
  });

  // Send request log to backend
  await sendLogToBackend('Request', {
    method: options.method || 'GET',
    url,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    body: options.body
  });

  const makeRequest = async () => {
    const response = await fetch(apiUrl, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const requestEndTime = performance.now();
    const responseTime = Math.round(requestEndTime - requestStartTime);

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Send response log to backend
    await sendLogToBackend('Response', {
      method: options.method || 'GET',
      url,
      status: response.status,
      statusText: response.statusText,
      duration: `${responseTime}ms`,
      headers: Object.fromEntries(response.headers.entries()),
      data
    });

    // Handle error responses
    if (!response.ok) {
      const error = new Error(data.error || `API request failed: ${response.statusText}`);
      if (response.status === 401) {
        await sendLogToBackend('Error', {
          type: 'AuthenticationError',
          method: options.method || 'GET',
          url,
          status: response.status,
          error: error.message,
          requestBody: options.body,
          responseData: data
        });
        error.name = 'AuthenticationError';
      } else {
        await sendLogToBackend('Error', {
          method: options.method || 'GET',
          url,
          status: response.status,
          error: error.message,
          requestBody: options.body,
          responseData: data
        });
      }
      throw error;
    }

    return data;
  };

  try {
    return await makeRequest();
  } catch (error) {
    return handleApiError(error, makeRequest);
  }
}
