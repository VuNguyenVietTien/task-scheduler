import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getAuthToken } from './get-auth-token';

// Use the Next.js proxy route to avoid CORS and NEXT_PUBLIC URL issues.
// The proxy forwards server-side to DESIGN_DOC_API_URL (see /api/design-doc/route.ts).
const httpLink = createHttpLink({
  uri: '/api/design-doc',
});

const authLink = setContext(async (_, { headers }) => {
  const token = await getAuthToken();
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

/** Factory: creates a dedicated Apollo client for design-doc-service (port 8081). */
export function createDesignDocClient() {
  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'network-only' },
    },
  });
}
