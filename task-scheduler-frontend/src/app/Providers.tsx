'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, ApolloLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { SyncProvider } from '@/providers/SyncProvider';
import { ToastProvider } from '@/components/ui/toast/toast-provider';

// HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql`,
  credentials: 'include'
});

// Logger middleware
const loggerMiddleware = new ApolloLink((operation, forward) => {
  const startTime = Date.now();

  console.group('🚀 GraphQL Request');
  console.log('Operation:', operation.operationName);
  console.log('Query:', operation.query.loc?.source.body);
  console.log('Variables:', operation.variables);
  console.log('Headers:', operation.getContext().headers);
  console.groupEnd();

  return forward(operation).map((response) => {
    const duration = Date.now() - startTime;
    
    console.group('📥 GraphQL Response');
    console.log('Operation:', operation.operationName);
    console.log('Duration:', duration + 'ms');
    console.log('Data:', response.data);
    console.log('Errors:', response.errors);
    console.groupEnd();

    return response;
  });
});

// Get token from cookie
const getToken = () => {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
  if (tokenCookie) {
    console.log('[GraphQL] Found token in cookie');
    return tokenCookie.split('=')[1];
  }
  console.log('[GraphQL] No token found in cookie');
  return null;
};

// Auth middleware
const authMiddleware = new ApolloLink((operation, forward) => {
  const token = getToken();

  // Log request details
  console.group('🔒 GraphQL Auth');
  console.log('Operation:', operation.operationName);
  console.log('Token Status:', token ? 'Present' : 'Missing');
  console.log('URL:', `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql`);
  console.groupEnd();

  // Set auth header if token exists
  if (token) {
    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }));
  }

  return forward(operation);
});

// Error handling middleware
const errorLink = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    if (response.errors) {
      response.errors.forEach(error => {
        console.group('❌ GraphQL Error');
        console.error('Operation:', operation.operationName);
        console.error('Error:', error.message);
        console.error('Token Status:', getToken() ? 'Present' : 'Missing');
        console.groupEnd();

        // Handle authentication errors
        if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
          if (error.message.includes('Invalid token')) {
            // Clear invalid token
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
          // Redirect to auth page if not already there
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
            window.location.href = '/auth';
          }
        }
      });
    }
    return response;
  });
});

function createApolloClient() {
  // Create an HTTP link for queries and mutations
  const httpWithMiddleware = ApolloLink.from([
    loggerMiddleware,
    errorLink,
    authMiddleware,
    httpLink
  ]);
  
  // Create WebSocket link for subscriptions
  // WebSocket URL should match your backend subscription endpoint 
  // (typically the same URL as GraphQL but with ws:// or wss:// protocol)
  const wsLink = typeof window !== 'undefined' 
    ? new GraphQLWsLink(createClient({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8080'}/graphql/subscriptions`,
        connectionParams: () => {
          const token = getToken();
          return token ? {
            Authorization: `Bearer ${token}`
          } : {};
        }
      }))
    : null;
    
  // Use split to route the operations based on their type
  const splitLink = wsLink 
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        httpWithMiddleware
      )
    : httpWithMiddleware;
  
  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'network-only',
      },
    },
  });
}

export default function Providers({
  children
}: {
  children: React.ReactNode;
}) {
  const [client, setClient] = useState<ApolloClient<any> | null>(null);

  useEffect(() => {
    const token = getToken();
    console.group('🔐 Apollo Client Initialization');
    console.log('Token Status:', token ? 'Present' : 'Missing');
    console.groupEnd();

    const apolloClient = createApolloClient();
    setClient(apolloClient);
  }, []);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>
          <SyncProvider>
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          </SyncProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}