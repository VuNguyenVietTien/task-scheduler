import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  Auth, 
  UserCredential 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Initialize Firebase only if it hasn't been initialized
let auth: Auth;
if (!getApps().length) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  auth = getAuth();
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  try {
    console.log('[GoogleAuth] Starting Google sign in...');
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    console.log('[GoogleAuth] Google sign in successful for:', result.user.email);
    
    const token = await result.user.getIdToken();
    console.log('[GoogleAuth] Got Firebase ID token');
    
    // Send token to Next.js API
    console.log('[GoogleAuth] Calling Next.js API route /api/auth/google');
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        token,
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.emailVerified
        }
      }),
    });

    if (!response.ok) {
      console.error('[GoogleAuth] Backend authentication failed:', response.status);
      const error = await response.json();
      throw new Error(error.message || 'Failed to authenticate with backend');
    }

    const data = await response.json();
    console.log('[GoogleAuth] Authentication successful');
    return data;

  } catch (error) {
    console.error('[GoogleAuth] Error:', error);
    throw error;
  }
};

export { auth };
