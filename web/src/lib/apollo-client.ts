import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Operation, FetchResult } from '@apollo/client';
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

// Dev file logger — sends operation + response to /api/dev/graphql-log
function sendDevLog(payload: {
  operation: { operationName: string; operationType: string };
  variables: Record<string, unknown>;
  response?: unknown;
  errors?: unknown;
  timestamp: string;
}) {
  // Fire-and-forget; never throws
  fetch('/api/dev/graphql-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

const devLoggerMiddleware = new ApolloLink((operation: Operation, forward) => {
  if (process.env.NODE_ENV !== 'development') {
    return forward(operation);
  }

  const { operationName, query, variables } = operation;
  const operationType = (query.definitions[0] as { operation?: string }).operation ?? 'unknown';
  const timestamp = new Date().toISOString();

  return new Observable<FetchResult>(observer => {
    const sub = forward(operation).subscribe({
      next(result) {
        sendDevLog({
          operation: { operationName: operationName ?? '(anonymous)', operationType },
          variables: (variables as Record<string, unknown>) ?? {},
          response: result.data,
          errors: result.errors,
          timestamp,
        });
        observer.next(result);
      },
      error(err) {
        sendDevLog({
          operation: { operationName: operationName ?? '(anonymous)', operationType },
          variables: (variables as Record<string, unknown>) ?? {},
          errors: err,
          timestamp,
        });
        observer.error(err);
      },
      complete() {
        observer.complete();
      },
    });
    return () => sub.unsubscribe();
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
  link: ApolloLink.from([devLoggerMiddleware, errorMiddleware, authMiddleware, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'no-cache' },
    query: { fetchPolicy: 'no-cache' },
  },
});
