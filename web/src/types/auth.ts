export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  providerData: {
    photoURL?: string | null;
  }[];
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
} 