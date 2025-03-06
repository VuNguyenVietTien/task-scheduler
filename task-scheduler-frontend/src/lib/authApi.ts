import { graphqlRequest, RegisterInput, LoginInput } from './graphqlClient';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
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
        accessToken
        refreshToken
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

  // Store the token
  localStorage.setItem('token', response.register.accessToken);
  document.cookie = `auth-token=${response.register.accessToken}; path=/; SameSite=Strict`;

  return response.register;
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  const response = await graphqlRequest<LoginResponse>(`
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        accessToken
        refreshToken
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

  // Store the token
  localStorage.setItem('token', response.login.accessToken);
  document.cookie = `auth-token=${response.login.accessToken}; path=/; SameSite=Strict`;

  return response.login;
};