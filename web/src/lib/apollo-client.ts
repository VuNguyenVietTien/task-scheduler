import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import { createBrowserClient } from '@/lib/supabase/client';

const isBrowser = typeof window !== 'undefined';

// Single unified endpoint — same-origin, no CORS needed
const httpLink = createHttpLink({
  uri: '/api/graphql',
  credentials: 'same-origin',
});

// Auth middleware — injects Supabase session token
const authMiddleware = new ApolloLink((operation, forward) => {
  if (!isBrowser) {
    return forward(operation);
  }

  return new Observable(observer => {
    const supabase = createBrowserClient();
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        operation.setContext({ headers });

        forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      })
      .catch(error => {
        console.error('[Apollo Auth] Error getting session:', error);
        observer.error(error);
      });
  });
});

// Error handling — clear session on auth errors
const errorMiddleware = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    if (isBrowser && response.errors?.some(error =>
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('unauthenticated')
    )) {
      console.warn('[Apollo] Authentication error — session may be expired');
    }
    return response;
  });
});

export const client = new ApolloClient({
  connectToDevTools: isBrowser,
  ssrMode: !isBrowser,
  link: ApolloLink.from([errorMiddleware, authMiddleware, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'no-cache' },
    query: { fetchPolicy: 'no-cache' },
  },
});
