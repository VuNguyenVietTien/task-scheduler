import { GraphQLError } from 'graphql';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export function createGraphQLError(
  message: string,
  code: ErrorCode,
  extensions?: Record<string, unknown>
): GraphQLError {
  if (code === 'INTERNAL_ERROR') {
    console.error(`[GraphQL] ${code}:`, message);
  }
  return new GraphQLError(message, {
    extensions: { code, ...extensions },
  });
}

export function requireAuth(
  user: { id: string } | null
): asserts user is { id: string; email: string } {
  if (!user) {
    throw createGraphQLError('Authentication required', 'UNAUTHENTICATED');
  }
}
