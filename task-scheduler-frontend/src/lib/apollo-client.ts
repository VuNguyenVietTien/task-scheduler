import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import { setupGraphQLLogging } from './logging-apollo-client';

// Kiểm tra xem có đang chạy ở phía client không
const isBrowser = typeof window !== 'undefined';

// Tạo httpLink chỉ khi biết chắc chắn URI
const httpLink = createHttpLink({
  uri: isBrowser ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql` : '',
  credentials: 'include',
  headers: {
    'Apollo-Require-Preflight': 'true'
  }
});

// Debug helper to safely stringify objects
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return `[Failed to stringify: ${e}]`;
  }
}

// Caching system for token
let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;
let tokenRequestInProgress: Promise<string | null> | null = null;
let tokenFetchCount = 0;
const TOKEN_EXPIRY_TIME = 5 * 60 * 1000; // 5 phút

// Helper function to get token from server with improved caching
async function getTokenFromServer(): Promise<string | null> {
  try {
    if (!isBrowser) return null;
    
    const now = Date.now();
    
    // Kiểm tra xem token có còn hiệu lực không
    if (cachedToken && tokenExpiryTime && now < tokenExpiryTime) {
      return cachedToken;
    }

    // Nếu đang có request đang lấy token, sử dụng promise hiện tại
    if (tokenRequestInProgress) {
      return tokenRequestInProgress;
    }
    
    // Tăng biến đếm
    tokenFetchCount++;
    
    // Log số lần gọi token trong session
    if (tokenFetchCount > 1) {
      console.log(`[Token Helper] Token request count: ${tokenFetchCount}`);
    }
    
    // Nếu có quá nhiều requests trong thời gian ngắn, có thể có vấn đề
    if (tokenFetchCount > 20 && (tokenExpiryTime && (now - tokenExpiryTime) < 10000)) {
      console.warn('[Token Helper] Too many token requests in short time. Possible infinite loop detected.');
      // Delay request để tránh làm quá tải server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Tạo promise mới
    tokenRequestInProgress = (async () => {
      try {
        const response = await fetch('/api/auth/get-token');
        if (!response.ok) {
          console.log('[Token Helper] Failed to get token, status:', response.status);
          return null;
        }
        const data = await response.json();
        
        // Cập nhật cache
        cachedToken = data.token;
        tokenExpiryTime = Date.now() + TOKEN_EXPIRY_TIME;
        
        return data.token;
      } catch (error) {
        console.error('[Token Helper] Failed to get token:', error);
        return null;
      } finally {
        // Xóa promise sau khi hoàn thành
        tokenRequestInProgress = null;
      }
    })();
    
    return tokenRequestInProgress;
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
      // Xóa token cache khi có lỗi xác thực
      cachedToken = null;
      tokenExpiryTime = null;
    }
    return response;
  });
});

// Tạo client với logger
export const client = setupGraphQLLogging(new ApolloClient({
  connectToDevTools: isBrowser,
  ssrMode: !isBrowser,
  link: ApolloLink.from([
    loggerMiddleware,
    errorMiddleware, 
    authMiddleware,
    httpLink
  ]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
    },
    query: {
      fetchPolicy: 'no-cache',
    },
  },
}));