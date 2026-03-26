import { graphqlRequest, RegisterInput, LoginInput } from './graphqlClient';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface RegisterResponse {
  register: AuthResponse;
}

interface LoginResponse {
  login: AuthResponse;
}

export const registerUser = async (input: RegisterInput): Promise<AuthResponse> => {
  const response = await graphqlRequest<RegisterResponse>(`
    mutation Register($input: RegisterInput!) {
      register(input: $input) {
        token
        user {
          id
          email
          name
        }
      }
    }
  `, { input });

  if (!response.register) {
    throw new Error('Registration failed');
  }

  // Call API route to set cookies
  await fetch('/api/auth/set-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: response.register.token })
  });
   
  return response.register;
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  const response = await graphqlRequest<LoginResponse>(`
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        token
        user {
          id
          email
          name
        }
      }
    }
  `, { input });

  if (!response.login) {
    throw new Error('Login failed');
  }

  // Call API route to set cookies
  await fetch('/api/auth/set-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: response.login.token })
  });

  return response.login;
};