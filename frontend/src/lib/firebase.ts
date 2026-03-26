import { initializeApp, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';

let app: FirebaseApp;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

console.log('[Firebase] Initializing with config:', 
  Object.keys(firebaseConfig).reduce((acc: Record<string, string>, key) => {
    const value = firebaseConfig[key as keyof typeof firebaseConfig];
    if (key === 'apiKey' && typeof value === 'string') {
      acc[key] = value.substring(0, 8) + '...';
    } else {
      acc[key] = value as string;
    }
    return acc;
  }, {})
);

try {
  app = getApp();
  console.log('[Firebase] Using existing Firebase app');
} catch {
  app = initializeApp(firebaseConfig);
  console.log('[Firebase] Firebase app initialized');
}

export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    console.log('[Firebase] Initiating Google sign in popup...');
    const result = await signInWithPopup(auth, googleProvider);
    
    console.log('[Firebase] Google sign in successful:', {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName
    });
    
    const idToken = await result.user.getIdToken();
    console.log('[Firebase] Retrieved ID token');

    return {
      token: idToken,
      user: result.user,
    };
  } catch (error) {
    console.error('[Firebase] Error signing in with Google:', error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    console.log('[Firebase] Signing out user...');
    await signOut(auth);
    console.log('[Firebase] User signed out successfully');
  } catch (error) {
    console.error('[Firebase] Error signing out:', error);
    throw error;
  }
}

export function onAuthStateChange(
  onChange: (user: FirebaseUser | null) => void
) {
  return onAuthStateChanged(auth, onChange);
}

export async function getCurrentUser() {
  return new Promise<FirebaseUser | null>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
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
  if (!user) {
    return null;
  }
  return user.getIdToken();
}

export type { FirebaseUser, Auth };
