import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getAuthToken } from './get-auth-token';

/**
 * Design-doc GraphQL endpoint (W2 transport switch, 2026-08-31).
 *
 * IMPORTANT — explicit routed endpoint, no silent fallback:
 * The Rust backend (NEXT_PUBLIC_BACKEND_URL) has NO design-doc GraphQL roots
 * today, so this client must NEVER default to the Rust /graphql endpoint.
 * Pointing it there would make every design-doc operation fail with
 * "unknown field" GraphQL errors that look like data bugs instead of a
 * configuration problem.
 *
 * The endpoint comes from an explicit env var that must contain the FULL URL
 * (origin + path) of the routed design-doc GraphQL service, e.g.
 *   NEXT_PUBLIC_DESIGN_DOC_API_URL=https://design.example.com/graphql
 *
 * Failure behavior when the variable is missing/empty at call time:
 *   - the first failing operation logs ONE console.error naming the missing
 *     variable (see missingEndpointLogged guard);
 *   - every operation surfaces an Apollo network error whose message names
 *     NEXT_PUBLIC_DESIGN_DOC_API_URL (thrown from the uri resolver below);
 *   - no request is ever sent to a guessed endpoint.
 *
 * Note: the previous same-origin '/api/design-doc' Next Yoga route and the
 * unused DESIGN_DOC_API_URL (non-public) env key are retired with this switch.
 */
const DESIGN_DOC_GRAPHQL_URL = (process.env.NEXT_PUBLIC_DESIGN_DOC_API_URL || '').trim();

let missingEndpointLogged = false;

function requireDesignDocEndpoint(): string {
  if (DESIGN_DOC_GRAPHQL_URL) {
    return DESIGN_DOC_GRAPHQL_URL;
  }

  if (!missingEndpointLogged) {
    // Log once, not on every operation.
    console.error(
      '[design-doc-client] NEXT_PUBLIC_DESIGN_DOC_API_URL is not set or empty — ' +
        'design-doc GraphQL operations are disabled. The Rust backend has no ' +
        'design-doc roots, so there is no safe default. Set ' +
        'NEXT_PUBLIC_DESIGN_DOC_API_URL to the full URL (including the GraphQL ' +
        'path) of the routed design-doc service to enable design documents.'
    );
    missingEndpointLogged = true;
  }

  throw new Error(
    'Design-doc API endpoint is not configured: set NEXT_PUBLIC_DESIGN_DOC_API_URL ' +
      '(full URL of the design-doc GraphQL service) to enable design documents.'
  );
}

// Cross-origin by design; the Bearer header (Firebase ID token) is the
// credential, cookies are explicitly omitted.
const httpLink = createHttpLink({
  // Resolved per operation so misconfiguration surfaces as a clear network
  // error at call time instead of a silently wrong-endpoint request.
  uri: () => requireDesignDocEndpoint(),
  credentials: 'omit',
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

/** Factory: creates a dedicated Apollo client for the design-doc service. */
export function createDesignDocClient() {
  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'network-only' },
    },
  });
}
