import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { getAuthHeaders } from './api';

const httpLink = createHttpLink({
  uri: `${process.env.NEXT_PUBLIC_BACKEND_URL}/graphql`,
  credentials: 'include'
});

// Logger middleware
const loggerMiddleware = new ApolloLink((operation, forward) => {
  const startTime = Date.now();

  console.log('\n=== GraphQL Request ===');
  console.log('Operation:', operation.operationName);
  console.log('Query:', operation.query.loc?.source.body);
  console.log('Variables:', operation.variables);
  console.log('Headers:', operation.getContext().headers);
  console.log('=====================\n');

  return forward(operation).map((response) => {
    const duration = Date.now() - startTime;
    
    console.log('\n=== GraphQL Response ===');
    console.log('Operation:', operation.operationName);
    console.log('Duration:', duration + 'ms');
    console.log('Data:', response.data);
    console.log('======================\n');

    return response;
  });
});

// Auth middleware
const authMiddleware = new ApolloLink((operation, forward) => {
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      Authorization: `Bearer ${localStorage.getItem('token')}`, // Add token
      'Content-Type': 'application/json'
    }
  }));
  return forward(operation);
});

export const client = new ApolloClient({
  link: ApolloLink.from([
    loggerMiddleware,
    authMiddleware,
    httpLink
  ]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});