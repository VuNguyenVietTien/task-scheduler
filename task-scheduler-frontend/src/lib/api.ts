type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

// Function to send logs to backend
export function getAuthHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
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
    // Log to console if backend logging fails
    console.error('Failed to send log to backend:', error);
  }
}

export async function fetchApi(url: string, options: FetchOptions = {}) {
  const defaultHeaders: Record<string, string> = {
    ...getAuthHeaders(),
  };

  const requestStartTime = performance.now();
  
  const token = localStorage.getItem('token');
  const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`;

  console.log('[API Request]', {
    url: apiUrl,
    hasToken: !!token,
    headers: defaultHeaders,
  });

  // Set auth token as cookie if it exists
  if (token) {
    document.cookie = `auth-token=${token}; path=/; SameSite=Strict`;
  }

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

  // Credentials: 'include' ensures cookies are sent with the request
  const response = await fetch(apiUrl, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // This is crucial for sending cookies
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
}
