import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Operation, FetchResult } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
// W2 transport switch (2026-08-31): auth is the Firebase ID token via the
// cached getAuthToken helper. The active path must NOT read the Supabase
// session (architecture review §5.1 — bearer-first, no app auth cookie).
import { getAuthToken } from '../apollo/get-auth-token';

const isBrowser = typeof window !== 'undefined';

/**
 * GraphQL endpoint of the Rust backend (W2 transport switch, 2026-08-31).
 *
 * - Base origin: NEXT_PUBLIC_BACKEND_URL, defaulting to the production
 *   Cloudflare-proxied Rust API (https://pm-api.khampha.dpdns.org).
 * - Path: /graphql.
 * - Trailing slashes on the env value are trimmed so we never emit
 *   "https://host//graphql".
 *
 * Exported so tests (and tooling) can assert the active endpoint.
 */
export const BACKEND_GRAPHQL_URL = `${(
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pm-api.khampha.dpdns.org'
).replace(/\/+$/, '')}/graphql`;

// Cross-origin endpoint on the Rust backend. The Bearer header (Firebase ID
// token) is the credential; cookies are NOT needed, so we explicitly omit them
// (avoids CSRF and third-party-cookie problems on cross-origin API calls).
const httpLink = createHttpLink({
  uri: BACKEND_GRAPHQL_URL,
  credentials: 'omit',
});

// Auth middleware — injects the Firebase ID token (cached + deduped by
// getAuthToken, 10-min cache) as a Bearer header. Replaces the former
// Supabase createBrowserClient().auth.getSession() lookup.
const authMiddleware = new ApolloLink((operation, forward) => {
  if (!isBrowser) {
    return forward(operation);
  }

  return new Observable(observer => {
    getAuthToken()
      .then(token => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        operation.setContext({ headers });

        forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      })
      .catch(error => {
        console.error('[Apollo Auth] Error getting Firebase ID token:', error);
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

// Error handling — warn on auth errors
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
