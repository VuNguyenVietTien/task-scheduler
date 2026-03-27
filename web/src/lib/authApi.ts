import { createBrowserClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const registerUser = async (input: RegisterInput): Promise<AuthResponse> => {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name },
    },
  });

  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Registration failed');

  return {
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: input.name,
    },
  };
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Login failed');

  return {
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata?.name || data.user.email!,
    },
  };
};

export const logoutUser = async (): Promise<void> => {
  const supabase = createBrowserClient();
  await supabase.auth.signOut();
};

export const getCurrentUser = async (): Promise<User | null> => {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata?.name || user.email!,
  };
};
