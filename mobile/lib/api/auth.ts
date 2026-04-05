/**
 * Authentication endpoints for NextAuth.js integration.
 *
 * NextAuth uses cookie-based JWT sessions. The mobile client:
 * 1. POSTs credentials to /api/auth/callback/credentials
 * 2. Extracts the session token from Set-Cookie header
 * 3. Stores it in SecureStore for subsequent requests
 */

import {
  csrfPost,
  post,
  authGet,
  clearSession,
  setSessionToken,
  getSessionToken,
  API_BASE_URL,
} from './client';
import type {
  Session,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  LoginCredentials,
} from './types';

/**
 * Sign in with email and password via NextAuth CredentialsProvider.
 *
 * On success, the session token is automatically extracted from the
 * `Set-Cookie` response header and persisted to SecureStore by the
 * underlying API client.
 *
 * @param credentials - Email and password for authentication
 * @returns The authenticated session with user profile data
 * @throws {Error} If login fails (invalid credentials or server error)
 * @throws {ApiError} On HTTP error responses from the backend
 *
 * @example
 * ```ts
 * const session = await login({ email: 'user@example.com', password: 's3cret' });
 * console.log(session.user.name); // "John Doe"
 * ```
 */
export async function login(credentials: LoginCredentials): Promise<Session> {
  // NextAuth credentials login requires CSRF token
  await csrfPost<unknown>('/api/auth/callback/credentials', {
    email: credentials.email,
    password: credentials.password,
    redirect: false,
  });

  // Fetch the session to confirm login succeeded and get user data
  const session = await getSession();

  if (!session?.user) {
    throw new Error('Login failed. Please check your email and password.');
  }

  return session;
}

/**
 * Register a new customer account.
 *
 * @param data - Registration fields (email, password, name)
 * @returns `{ success: true }` on successful registration
 * @throws {ApiError} On validation errors (e.g., email already taken) with status 422
 */
export async function register(data: RegisterRequest): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/api/auth/register', data);
}

/**
 * Get the current session from the backend.
 *
 * @returns The current session with user data, or `null` if not authenticated
 *   or the session has expired.
 */
export async function getSession(): Promise<Session | null> {
  const token = await getSessionToken();

  if (!token) return null;

  try {
    const session = await authGet<Session>('/api/auth/session');
    // NextAuth returns an empty object when not authenticated
    if (!session?.user?.id) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Sign out and clear stored session data.
 */
export async function logout(): Promise<void> {
  try {
    await csrfPost('/api/auth/signout', { redirect: false });
  } catch {
    // Even if the server request fails, clear local state
  }
  await clearSession();
}

/**
 * Request a password reset email.
 *
 * @param data - Object containing the user's email address
 * @returns `{ success: true }` regardless of whether the email exists (prevents enumeration)
 */
export async function forgotPassword(data: ForgotPasswordRequest): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/api/auth/forgot-password', data);
}

/**
 * Verify a password reset token is still valid.
 *
 * @param token - The reset token from the password reset email link
 * @returns `{ valid: true }` if the token is valid and unexpired
 */
export async function verifyResetToken(token: string): Promise<{ valid: boolean }> {
  return post<{ valid: boolean }>('/api/auth/verify-reset-token', { token });
}

/**
 * Reset password using a valid reset token.
 *
 * @param data - The reset token and new password
 * @returns `{ success: true }` on successful password change
 * @throws {ApiError} If the token is invalid or expired
 */
export async function resetPassword(data: ResetPasswordRequest): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/api/auth/reset-password', data);
}

/**
 * Build the Google OAuth URL for native browser-based sign-in.
 *
 * Use with `ASWebAuthenticationSession` (iOS) or Chrome Custom Tabs (Android).
 *
 * @returns The full URL to the NextAuth Google sign-in endpoint
 */
export function getGoogleOAuthUrl(): string {
  return `${API_BASE_URL}/api/auth/signin/google`;
}

/**
 * Check if the user is currently authenticated (quick local check).
 *
 * Only checks for the presence of a stored token -- does not validate
 * with the server. Use {@link getSession} for a verified check.
 *
 * @returns `true` if a session token exists in SecureStore
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken();
  return token !== null;
}
