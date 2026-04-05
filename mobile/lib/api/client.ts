/**
 * Core API client for the Jose Madrid Salsa backend.
 *
 * Handles:
 * - Base URL resolution (dev vs production)
 * - NextAuth cookie-based session management
 * - CSRF token handling for NextAuth mutations
 * - Typed error responses matching backend Zod validation
 * - Exponential backoff retry for transient failures
 * - 429 rate-limit handling
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ApiErrorResponse } from './types';

// ─── Configuration ───────────────────────────────────────────────────────────

export const API_BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000'
  : 'https://josemadridsalsa.com';

const CSRF_STORE_KEY = 'nextauth_csrf_token';
const SESSION_STORE_KEY = 'nextauth_session_token';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

// ─── Error Types ─────────────────────────────────────────────────────────────

/**
 * Error thrown when the backend returns a non-OK HTTP response.
 *
 * Provides structured access to Zod validation errors from the backend
 * via {@link fieldErrors} and {@link formErrors}.
 *
 * @example
 * ```ts
 * try {
 *   await api.auth.login({ email, password });
 * } catch (error) {
 *   if (error instanceof ApiError && error.status === 422) {
 *     console.log(error.fieldErrors); // { email: ['Invalid email format'] }
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  /**
   * @param message - Human-readable error description
   * @param status - HTTP status code from the response
   * @param body - Parsed JSON error body, or null if unparsable
   */
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: ApiErrorResponse | null
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Zod field-level validation errors from the backend.
   * @returns A map of field names to arrays of error messages, or undefined.
   */
  get fieldErrors(): Record<string, string[]> | undefined {
    return this.body?.details?.fieldErrors;
  }

  /**
   * Zod form-level validation errors from the backend.
   * @returns An array of form-level error messages, or undefined.
   */
  get formErrors(): string[] | undefined {
    return this.body?.details?.formErrors;
  }
}

/**
 * Error thrown when a request fails due to network issues (offline,
 * DNS failure, timeout) rather than an HTTP error response.
 */
export class NetworkError extends Error {
  /**
   * @param message - Human-readable error description
   * @param cause - The underlying error that triggered this failure
   */
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

// ─── Session Management ──────────────────────────────────────────────────────

let cachedSessionToken: string | null = null;
let cachedCsrfToken: string | null = null;

/**
 * Store the session token securely after login.
 * Called automatically by the auth endpoints.
 *
 * @param token - The NextAuth session JWT to persist, or `null` to clear it.
 * @throws {Error} If SecureStore write fails (e.g., device keychain unavailable).
 */
export async function setSessionToken(token: string | null): Promise<void> {
  cachedSessionToken = token;
  if (token) {
    await SecureStore.setItemAsync(SESSION_STORE_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(SESSION_STORE_KEY);
  }
}

/**
 * Retrieve the stored session token for API requests.
 *
 * Returns a cached in-memory value if available, otherwise reads from
 * Expo SecureStore (encrypted device storage).
 *
 * @returns The stored JWT session token, or `null` if not authenticated.
 */
export async function getSessionToken(): Promise<string | null> {
  if (cachedSessionToken) return cachedSessionToken;
  const stored = await SecureStore.getItemAsync(SESSION_STORE_KEY);
  cachedSessionToken = stored;
  return stored;
}

/**
 * Clear all stored auth state on logout.
 *
 * Removes both the session token and CSRF token from memory and SecureStore.
 */
export async function clearSession(): Promise<void> {
  cachedSessionToken = null;
  cachedCsrfToken = null;
  await SecureStore.deleteItemAsync(SESSION_STORE_KEY);
  await SecureStore.deleteItemAsync(CSRF_STORE_KEY);
}

/**
 * Fetch a CSRF token from the NextAuth API.
 * Required for POST requests to NextAuth endpoints (login, register, etc.).
 */
async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError('Failed to fetch CSRF token', response.status, null);
  }

  const data = await response.json();
  cachedCsrfToken = data.csrfToken;

  if (cachedCsrfToken) {
    await SecureStore.setItemAsync(CSRF_STORE_KEY, cachedCsrfToken);
  }

  return cachedCsrfToken!;
}

// ─── Request Helpers ─────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  /** Include session cookie in the request */
  auth?: boolean;
  /** Include CSRF token (needed for NextAuth mutation endpoints) */
  csrf?: boolean;
  /** Override default timeout */
  timeoutMs?: number;
  /** Disable automatic retry */
  noRetry?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Build URL with query parameters, filtering out undefined values.
 */
function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(path, API_BASE_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

/**
 * Determine if an HTTP status code is retryable.
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the Retry-After header value into milliseconds.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * Core request function with retry, timeout, and error handling.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    params,
    auth = false,
    csrf = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noRetry = false,
    headers: customHeaders,
  } = options;

  const url = buildUrl(path, params);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...customHeaders,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach session token as cookie header
  if (auth) {
    const token = await getSessionToken();
    if (token) {
      headers['Cookie'] = `next-auth.session-token=${token}`;
    }
  }

  // Attach CSRF token for NextAuth mutations (immutable — spread into new object)
  let finalBody = body;
  if (csrf) {
    const csrfToken = await fetchCsrfToken();
    if (body && typeof body === 'object') {
      finalBody = { ...(body as Record<string, unknown>), csrfToken };
    }
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: finalBody !== undefined ? JSON.stringify(finalBody) : undefined,
  };

  const maxAttempts = noRetry ? 1 : MAX_RETRIES;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract session token from Set-Cookie if present (login response)
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/next-auth\.session-token=([^;]+)/);
        if (match?.[1]) {
          await setSessionToken(match[1]);
        }
      }

      // Handle non-OK responses
      if (!response.ok) {
        // Retry on transient errors
        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
          const delay = retryAfter ?? RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(delay);
          continue;
        }

        // Parse error body
        let errorBody: ApiErrorResponse | null = null;
        try {
          errorBody = await response.json();
        } catch {
          // Response body may not be JSON
        }

        const message = errorBody?.error ?? errorBody?.message ?? `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, errorBody);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Already an ApiError — re-throw
      if (error instanceof ApiError) {
        throw error;
      }

      // Abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < maxAttempts) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }
        throw new NetworkError(`Request timed out after ${timeoutMs}ms`);
      }

      // Network failures — retry
      if (attempt < maxAttempts) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }

      throw new NetworkError(
        'Network request failed. Check your connection and try again.',
        error
      );
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new NetworkError('Request failed after all retries');
}

// ─── Public API Methods ──────────────────────────────────────────────────────

/**
 * Send a public GET request (no auth).
 *
 * @typeParam T - Expected response body type
 * @param path - API route path (e.g., `/api/products`)
 * @param params - Optional query parameters (undefined values are filtered out)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
  return request<T>(path, { method: 'GET', params });
}

/**
 * Send an authenticated GET request (session cookie attached).
 *
 * @typeParam T - Expected response body type
 * @param path - API route path
 * @param params - Optional query parameters
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses (401 if session expired)
 * @throws {NetworkError} On network failures or timeout
 */
export function authGet<T>(path: string, params?: RequestOptions['params']): Promise<T> {
  return request<T>(path, { method: 'GET', params, auth: true });
}

/**
 * Send a public POST request (no auth).
 *
 * @typeParam T - Expected response body type
 * @param path - API route path
 * @param body - Request body (serialized as JSON)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

/**
 * Send an authenticated POST request.
 *
 * @typeParam T - Expected response body type
 * @param path - API route path
 * @param body - Request body (serialized as JSON)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function authPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body, auth: true });
}

/**
 * Send an authenticated PUT request.
 *
 * @typeParam T - Expected response body type
 * @param path - API route path
 * @param body - Request body (serialized as JSON)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function authPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body, auth: true });
}

/**
 * Send an authenticated PATCH request.
 *
 * @typeParam T - Expected response body type
 * @param path - API route path
 * @param body - Request body (serialized as JSON)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function authPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body, auth: true });
}

/**
 * Send an authenticated DELETE request.
 *
 * @typeParam T - Expected response body type
 * @param path - API route path
 * @param body - Optional request body (serialized as JSON)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function authDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', body, auth: true });
}

/**
 * Send a POST request with a CSRF token (required for NextAuth mutation endpoints).
 *
 * The CSRF token is fetched from `/api/auth/csrf` and injected into the request body.
 *
 * @typeParam T - Expected response body type
 * @param path - API route path (e.g., `/api/auth/callback/credentials`)
 * @param body - Request body (CSRF token will be merged in)
 * @returns Parsed JSON response body
 * @throws {ApiError} On non-OK HTTP responses
 * @throws {NetworkError} On network failures or timeout
 */
export function csrfPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body, csrf: true });
}

/** Full custom request with all options available. */
export { request };
