import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export interface GraphQLContext {
  user: { id: string; email: string; name?: string } | null;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
}

export async function createContext(_request: Request): Promise<GraphQLContext> {
  const supabase = await createServerClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();

  let user: GraphQLContext['user'] = null;
  if (authUser) {
    user = {
      id: authUser.id,
      email: authUser.email!,
      name: authUser.user_metadata?.name,
    };
  }

  return { user, supabase, supabaseAdmin };
}
