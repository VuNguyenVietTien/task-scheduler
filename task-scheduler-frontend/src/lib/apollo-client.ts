import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';

// Kiểm tra xem có đang chạy ở phía client không
const isBrowser = typeof window !== 'undefined';

// Tạo httpLink chỉ khi biết chắc chắn URI
const httpLink = createHttpLink({
  uri: isBrowser ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql` : '',
  credentials: 'include'
});

// Debug helper to safely stringify objects
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return `[Failed to stringify: ${e}]`;
  }
}

// Helper function to get token from server
async function getTokenFromServer(): Promise<string | null> {
  try {
    if (!isBrowser) return null;
    
    const response = await fetch('/api/auth/get-token');
    if (!response.ok) {
      console.log('[Token Helper] Failed to get token, status:', response.status);
      return null;
    }
    const data = await response.json();
    console.log('[Token Helper] Got token from server:', data.token ? 'Yes' : 'No');
    return data.token;
  } catch (error) {
    console.error('[Token Helper] Failed to get token:', error);
    return null;
  }
}

// Logger middleware with enhanced logging
const loggerMiddleware = new ApolloLink((operation, forward) => {
  const startTime = Date.now();

  if (isBrowser) {
    console.log('\n=== GraphQL Request Details ===');
    console.log('URL:', `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql`);
    console.log('Operation:', operation.operationName);
    console.log('Query:', operation.query.loc?.source.body);
    console.log('Variables:', safeStringify(operation.variables));
    console.log('Headers:', operation.getContext().headers);
    console.log('==========================\n');
  }

  return forward(operation).map((response) => {
    if (isBrowser) {
      const duration = Date.now() - startTime;
      
      console.log('\n=== GraphQL Response Details ===');
      console.log('Operation:', operation.operationName);
      console.log('Duration:', duration + 'ms');
      console.log('Response Data:', safeStringify(response.data));
      if (response.errors) {
        console.log('Response Errors:', safeStringify(response.errors));
      }
      console.log('============================\n');
    }

    return response;
  });
});

// Auth middleware
const authMiddleware = new ApolloLink((operation, forward) => {
  return new Observable(observer => {
    getTokenFromServer()
      .then(token => {
        if (isBrowser) {
          console.log('[Auth Middleware] Found token:', token ? 'Yes' : 'No');
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        // Set headers
        operation.setContext({
          headers
        });

        if (isBrowser) {
          console.log('[Auth Middleware] Request headers:', headers);
        }

        // Subscribe to the forward operation
        forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      })
      .catch(error => {
        console.error('[Auth Middleware] Error getting token:', error);
        observer.error(error);
      });
  });
});

// Error handling middleware 
const errorMiddleware = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    if (isBrowser && response.errors?.some(error => 
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('unauthenticated')
    )) {
      console.log('[Error Middleware] Authentication error:', response.errors);
    }
    return response;
  });
});

// Tạo Client chỉ khi ở browser
let client: ApolloClient<any>;

if (isBrowser) {
  // Initialize Apollo Client
  client = new ApolloClient({
    link: ApolloLink.from([
      loggerMiddleware,
      errorMiddleware, 
      authMiddleware,
      httpLink
    ]),
    cache: new InMemoryCache(),
    connectToDevTools: process.env.NODE_ENV !== 'production',
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  });
} else {
  // Fallback client cho SSR/SSG
  client = new ApolloClient({
    cache: new InMemoryCache(),
    ssrMode: true, // Kích hoạt chế độ SSR
    link: createHttpLink({
      uri: '', // URI trống không thực hiện request trong SSG/SSR
    }),
  });
}

export { client };