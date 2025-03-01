interface Config {
  backendUrl: string;
  appEnv: string;
}

export const config: Config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002',
  appEnv: process.env.NEXT_PUBLIC_APP_ENV || 'development',
};

export const isProduction = config.appEnv === 'production';
export const isDevelopment = config.appEnv === 'development';

export function getApiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${config.backendUrl}/${cleanPath}`;
}

export const apiClient = {
  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = getApiUrl(path);
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  },

  get<T>(path: string, options: Omit<RequestInit, 'method'> = {}) {
    return this.fetch<T>(path, { ...options, method: 'GET' });
  },

  post<T>(path: string, data: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}) {
    return this.fetch<T>(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put<T>(path: string, data: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}) {
    return this.fetch<T>(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete<T>(path: string, options: Omit<RequestInit, 'method'> = {}) {
    return this.fetch<T>(path, { ...options, method: 'DELETE' });
  },
};
