import { initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
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

// Lazy initialization — only init when actually used (avoids build-time crash)
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  try {
    _app = getApp();
  } catch {
    _app = initializeApp(firebaseConfig);
  }
  return _app;
}

function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  return _auth;
}

// Named export — lazy getter
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : ({} as Auth);

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
  const idToken = await result.user.getIdToken();
  return { token: idToken, user: result.user };
}

export async function signOutUser() {
  await signOut(getFirebaseAuth());
}

export function onAuthStateChange(
  onChange: (user: FirebaseUser | null) => void
) {
  return onAuthStateChanged(getFirebaseAuth(), onChange);
}

export async function getCurrentUser() {
  return new Promise<FirebaseUser | null>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      getFirebaseAuth(),
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
