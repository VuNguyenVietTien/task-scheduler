/**
 * @deprecated RETIRED 2026-08-31 (W2 transport migration).
 *
 * The former implementation POSTed to the same-origin Next Yoga route
 * `/api/graphql` with a Supabase session token. That transport is retired:
 * the active Apollo client (`@/lib/apollo-client`) now calls the Rust backend
 * (NEXT_PUBLIC_BACKEND_URL/graphql) with a Firebase ID-token Bearer header.
 *
 * This stub exists only because two dead files still import it
 * (`src/lib/projectApi.ts`, `src/lib/taskApi.ts` — both have no importers of
 * their own and are slated for deletion with their owning group). Calling
 * `graphqlRequest` now fails loudly instead of silently hitting a retired
 * endpoint. It re-exports nothing misleading beyond the input types.
 */

export type {
  RegisterInput,
  LoginInput,
  CreateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
} from './graphqlClient.types';

export async function graphqlRequest<T = unknown>(
  _query: string,
  _variables?: Record<string, unknown>,
): Promise<T> {
  throw new Error(
    'graphqlRequest is retired (W2 transport migration, 2026-08-31): the ' +
      'Supabase-session same-origin GraphQL bridge no longer exists. Use the ' +
      'Apollo client from @/lib/apollo-client instead.'
  );
}
