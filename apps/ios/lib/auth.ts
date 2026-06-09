/**
 * Mobile authentication helpers that interact directly with the NextAuth
 * credential flow on the web backend.
 *
 * Unlike the typed wrappers in `lib/api/auth`, these functions use raw
 * `fetch` against the NextAuth callback and session endpoints, handling
 * CSRF token retrieval automatically.
 *
 * @module mobile/lib/auth
 */

import { API_BASE_URL } from './api';

/**
 * Authenticate a user via the NextAuth credentials provider.
 *
 * Performs a three-step flow:
 * 1. Fetches a CSRF token from `/api/auth/csrf`.
 * 2. POSTs email + password to `/api/auth/callback/credentials`.
 * 3. Retrieves the newly created session from `/api/auth/session`.
 *
 * @param email - The user's email address
 * @param password - The user's plaintext password
 * @returns The NextAuth session object containing user profile and expiry
 * @throws {Error} If the CSRF token cannot be obtained
 * @throws {Error} If authentication fails (invalid credentials or server error)
 *
 * @example
 * ```ts
 * import { mobileLogin } from '@/lib/auth';
 * const session = await mobileLogin('user@example.com', 's3cret');
 * console.log(session.user.name);
 * ```
 */
export async function mobileLogin(email: string, password: string) {
  // 1. Fetch CSRF token (NextAuth requirement)
  const csrfRes = await fetch(`${API_BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;

  if (!csrfToken) throw new Error('Failed to obtain CSRF token');

  // 2. Post credentials
  const loginRes = await fetch(`${API_BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csrfToken,
      email,
      password,
      json: true,
      redirect: false
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.url || loginData.error) {
    throw new Error(loginData.error || 'Authentication failed');
  }

  // 3. Fetch Session
  const sessionRes = await fetch(`${API_BASE_URL}/api/auth/session`);
  return await sessionRes.json();
}

/**
 * Retrieve the current NextAuth session, if one exists.
 *
 * Calls `/api/auth/session` and returns the session object when
 * the user is authenticated, or `null` when the session cookie is
 * missing or expired.
 *
 * @returns The active session object, or `null` if unauthenticated
 */
export async function getMobileSession() {
  const sessionRes = await fetch(`${API_BASE_URL}/api/auth/session`);
  const data = await sessionRes.json();
  return Object.keys(data).length > 0 ? data : null;
}
