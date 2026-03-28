import { cookies } from 'next/headers';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export interface GraphQLContext {
  user: { id: string; email: string; name?: string } | null;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
}

type AppUser = { user_id: string; email: string; name: string } | null;

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

  // Fallback: check custom Firebase auth cookies
  if (!user) {
    try {
      const cookieStore = await cookies();
      const userSessionCookie = cookieStore.get('user-session');
      const authTokenCookie = cookieStore.get('auth-token');
      if (userSessionCookie && authTokenCookie) {
        const session = JSON.parse(userSessionCookie.value);
        if (session.userId) {
          // Look up the app user_id using email to resolve FK references
          const lookupResult = await supabaseAdmin
            .from('users')
            .select('user_id, email, name')
            .eq('email', session.email)
            .single();
          let appUser: AppUser = lookupResult.data as AppUser;

          if (!appUser) {
            const displayName = session.name || session.email.split('@')[0];
            const baseUsername = session.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
            // Try insert; on username conflict, append timestamp
            for (const suffix of ['', `_${Date.now()}`]) {
              const insertResult = await supabaseAdmin
                .from('users')
                .insert({
                  email: session.email,
                  full_name: displayName,
                  name: displayName,
                  username: baseUsername + suffix,
                } as never)
                .select('user_id, email, name')
                .single();
              const created = insertResult.data as AppUser;
              const insertError = insertResult.error;
              if (!insertError && created) { appUser = created; break; }
              if (insertError?.code === '23505') {
                // Email or username conflict — select existing row
                const existingResult = await supabaseAdmin
                  .from('users')
                  .select('user_id, email, name')
                  .eq('email', session.email)
                  .single();
                const existing = existingResult.data as AppUser;
                if (existing) { appUser = existing; break; }
              } else {
                break; // Non-conflict error, stop trying
              }
            }
          }

          user = {
            id: appUser?.user_id ?? session.userId,
            email: appUser?.email ?? session.email,
            name: appUser?.name ?? session.name,
          };
        }
      }
    } catch {
      // Ignore cookie parse errors
    }
  }

  return { user, supabase, supabaseAdmin };
}
