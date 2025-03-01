type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
};

export async function fetchApi(url: string, options: FetchOptions = {}) {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Credentials: 'include' ensures cookies are sent with the request
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include', // This is crucial for sending cookies
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  console.log(`[API] ${url} Response:`, {
    status: response.status,
    statusText: response.statusText,
  });

  const data = await response.json();
  console.log(`[API] ${url} Data:`, data);

  // Handle error responses
  if (!response.ok) {
    const error = new Error(data.error || `API request failed: ${response.statusText}`);
    if (response.status === 401) {
      console.error('[API] Authentication error:', error);
      error.name = 'AuthenticationError';
    }
    throw error;
  }

  return data;
}
