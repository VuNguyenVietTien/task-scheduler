import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _messaging: Messaging | null = null;
let _auth: Auth | null = null;

function ensureInitialized() {
  if (getApps().length === 0) {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
    }
    const serviceAccount = JSON.parse(key);
    initializeApp({ credential: cert(serviceAccount) });
  }
}

/**
 * Lazy-initialized Firebase Admin — only initializes on first call,
 * not at import time. Prevents build failures when env vars are absent.
 */
export const firebaseAdmin = {
  get messaging(): Messaging {
    ensureInitialized();
    if (!_messaging) _messaging = getMessaging();
    return _messaging;
  },
  get auth(): Auth {
    ensureInitialized();
    if (!_auth) _auth = getAuth();
    return _auth;
  },
};
