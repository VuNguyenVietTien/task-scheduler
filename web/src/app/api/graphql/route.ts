export const maxDuration = 10;

import { createYoga } from 'graphql-yoga';
import { schema } from '@/lib/graphql/schema';
import { createContext } from '@/lib/graphql/context';

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  context: ({ request }) => createContext(request),
  fetchAPI: { Response },
});

export const GET = yoga;
export const POST = yoga;
export const OPTIONS = yoga;
