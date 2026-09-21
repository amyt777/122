/**
 * Real Firebase Realtime Database Service Account Authenticated Client
 * Uses Google OAuth2 Service Account RS256 JWT exchange to acquire official
 * Bearer tokens, providing secure, authenticated database access with zero native dependencies.
 */

import crypto from 'crypto';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

/**
 * Creates a signed JWT assertion using the configured Google Service Account
 */
function createServiceAccountJwt(clientEmail: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: [
      'https://www.googleapis.com/auth/firebase.database',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const b64Url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedPayload = `${b64Url(header)}.${b64Url(claimSet)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedPayload);
  const signature = signer.sign(privateKeyPem, 'base64url');

  return `${unsignedPayload}.${signature}`;
}

/**
 * Exchanges signed assertion with Google OAuth2 for a Bearer access token
 */
export async function getFirebaseAccessToken(): Promise<string | null> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Handle escaped newlines in environment variables
  privateKey = privateKey.replace(/\\n/g, '\n');

  // Return cached token if valid for at least 5 more minutes
  if (tokenCache && tokenCache.expiresAt > Date.now() + 300000) {
    return tokenCache.accessToken;
  }

  try {
    const jwtAssertion = createServiceAccountJwt(clientEmail, privateKey);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwtAssertion,
      }).toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Firebase OAuth2 token exchange error (${res.status}):`, errorText);
      return null;
    }

    const data = (await res.json()) as any;
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return tokenCache.accessToken;
  } catch (err: any) {
    console.error('Firebase Service Account authentication exception:', err);
    return null;
  }
}

export class FirebaseDatabase {
  private dbUrl: string | null;

  constructor() {
    this.dbUrl = process.env.FIREBASE_DB_URL ? process.env.FIREBASE_DB_URL.replace(/\/$/, '') : null;

    if (process.env.NODE_ENV === 'production' && (!this.dbUrl || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY)) {
      console.error(
        '[FATAL CONFIGURATION ERROR] In production, FIREBASE_DB_URL, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be provided. Memory fallback is strictly disabled.'
      );
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.dbUrl && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getFirebaseAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async get<T = any>(path: string): Promise<T | null> {
    if (!this.dbUrl) return null;
    const headers = await this.getAuthHeaders();
    const url = `${this.dbUrl}/${path}.json`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(`Firebase GET ${path} error: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  }

  public async put<T = any>(path: string, data: T): Promise<T | null> {
    if (!this.dbUrl) return null;
    const headers = await this.getAuthHeaders();
    const url = `${this.dbUrl}/${path}.json`;
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error(`Firebase PUT ${path} error: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  }

  public async patch<T = any>(path: string, partial: Partial<T>): Promise<T | null> {
    if (!this.dbUrl) return null;
    const headers = await this.getAuthHeaders();
    const url = `${this.dbUrl}/${path}.json`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(partial),
    });
    if (!res.ok) {
      console.error(`Firebase PATCH ${path} error: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  }

  public async delete(path: string): Promise<boolean> {
    if (!this.dbUrl) return false;
    const headers = await this.getAuthHeaders();
    const url = `${this.dbUrl}/${path}.json`;
    const res = await fetch(url, { method: 'DELETE', headers });
    return res.ok;
  }
}

export const firebaseDb = new FirebaseDatabase();
