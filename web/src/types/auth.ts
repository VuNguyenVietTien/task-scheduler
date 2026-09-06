/**
 * W1 auth types — Firebase ID token carrier + Rust backend app user.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  providerData: {
    providerId: string;
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }[];
}

/** App user row returned by the Rust backend (`/api/v1/auth/*`). */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
}

/** Body of `POST /api/auth/firebase/login` (contract of the Rust backend). */
export interface FirebaseLoginInput {
  firebase_token: string;
  email: string;
  name: string;
  firebase_uid: string;
}

/** Response of the login proxy (Rust user + signed pm_session cookie). */
export interface FirebaseLoginResponse {
  success: boolean;
  user: AppUser;
}
