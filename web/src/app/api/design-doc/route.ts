export const dynamic = 'force-dynamic';

import { createYoga, createSchema } from 'graphql-yoga';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { designDocSchema } from '@/lib/design-doc/schema';
import { designDocResolvers } from '@/lib/design-doc/resolvers';

const yoga = createYoga({
  schema: createSchema({
    typeDefs: designDocSchema,
    resolvers: designDocResolvers,
  }),
  graphqlEndpoint: '/api/design-doc',
  fetchAPI: { Response },
  maskedErrors: process.env.NODE_ENV === 'production',
  context: async () => {
    const supabase = createAdminClient();
    return { supabase };
  },
});

export async function GET(request: NextRequest) {
  return yoga.fetch(request);
}

export async function POST(request: NextRequest) {
  return yoga.fetch(request);
}

export async function OPTIONS(request: NextRequest) {
  return yoga.fetch(request);
}
