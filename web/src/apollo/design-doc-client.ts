import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getAuthToken } from './get-auth-token';

const DESIGN_DOC_API_URL =
  process.env.NEXT_PUBLIC_DESIGN_DOC_API_URL || 'http://localhost:8081';

const httpLink = createHttpLink({
  uri: `${DESIGN_DOC_API_URL}/graphql`,
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
