import { initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  updatePassword,
  sendEmailVerification,
  EmailAuthProvider,
  linkWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Guard: skip Firebase init entirely if required env vars are absent
const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (_app) return _app;
  try {
    _app = getApp();
  } catch {
    _app = initializeApp(firebaseConfig);
  }
  return _app;
}

function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  if (_auth) return _auth;
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    _auth = getAuth(app);
  } catch (e) {
    console.warn('[Firebase] Auth initialization failed — Firebase env vars may be missing:', e);
    return null;
  }
  return _auth;
}

// Safe lazy getter — returns null when Firebase is not configured
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : ({} as Auth);

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) throw new Error('Google login is not configured on this deployment.');
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { token: idToken, user: result.user };
}

export async function signInWithEmailPassword(email: string, password: string) {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) throw new Error('Firebase is not configured on this deployment.');
  const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await result.user.getIdToken();
  return { token: idToken, user: result.user };
}

/**
 * Set or update password for the current Firebase user.
 * - Google-only users: links email/password credential to their account.
 * - Users who already have a password: updates it (may require recent login).
 */
export async function setFirebasePassword(newPassword: string) {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) throw new Error('Firebase is not configured on this deployment.');
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) throw new Error('No authenticated Firebase user.');

  const hasPasswordProvider = currentUser.providerData.some(p => p.providerId === 'password');
  if (hasPasswordProvider) {
    await updatePassword(currentUser, newPassword);
  } else {
    // Google-only user — link email/password as a new provider
    const credential = EmailAuthProvider.credential(currentUser.email!, newPassword);
    await linkWithCredential(currentUser, credential);
  }
}

export async function signOutUser() {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return; // No-op when Firebase is not configured
  await signOut(firebaseAuth);
}

export function onAuthStateChange(
  onChange: (user: FirebaseUser | null) => void
) {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, onChange);
}

export async function getCurrentUser() {
  return new Promise<FirebaseUser | null>((resolve, reject) => {
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) return resolve(null);
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject
    );
  });
}

export async function getIdToken() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user.getIdToken();
}

export type { FirebaseUser, Auth };

/**
 * W1: send the Firebase verification email from the client SDK. Verification
 * state is authoritative on the Rust backend (`/api/auth/me` returns
 * `emailVerified` from the app users row).
 */
export async function sendFirebaseVerificationEmail(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('No signed-in Firebase user');
  await sendEmailVerification(user);
}

/**
 * W1: create an email/password identity with a display name and return the
 * fresh ID token (the caller exchanges it for the app user on the Rust
 * backend via /api/auth/firebase/login).
 */
export async function createUserWithName(
  email: string,
  password: string,
  name: string,
): Promise<{ token: string; user: FirebaseUser }> {
  const {
    createUserWithEmailAndPassword,
    updateProfile,
  } = await import('firebase/auth');
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) throw new Error('Firebase is not configured');
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password,
  );
  await updateProfile(credential.user, { displayName: name });
  const token = await credential.user.getIdToken();
  return { token, user: credential.user };
}
