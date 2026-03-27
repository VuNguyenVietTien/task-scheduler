/** Shared auth-token fetcher with 10-minute cache and request deduplication. */

let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;

const TOKEN_EXPIRY_MS = 10 * 60 * 1000;

export async function getAuthToken(): Promise<string | null> {
  const now = Date.now();

  if (cachedToken && tokenExpiryTime && now < tokenExpiryTime) {
    return cachedToken;
  }

  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  tokenFetchPromise = (async () => {
    try {
      const response = await fetch('/api/auth/get-token');
      tokenFetchPromise = null;

      if (!response.ok) {
        console.error('Failed to get token:', response.statusText);
        return null;
      }

      const data = await response.json();
      if (!data.token) {
        console.error('No token in response');
        return null;
      }

      cachedToken = data.token;
      tokenExpiryTime = now + TOKEN_EXPIRY_MS;
      return data.token;
    } catch (error) {
      console.error('Error fetching token:', error);
      tokenFetchPromise = null;
      return null;
    }
  })();

  return tokenFetchPromise;
}
