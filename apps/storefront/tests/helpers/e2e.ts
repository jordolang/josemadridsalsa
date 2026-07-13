import { describe } from 'vitest'

/**
 * Conditionally run a describe block only when E2E_BASE_URL is set.
 * Use this for tests that require a running Next.js dev/preview server.
 *
 * @example
 * describeIfE2E('E2E: My feature', () => { ... })
 */
export const describeIfE2E = process.env.E2E_BASE_URL ? describe : describe.skip

/**
 * Resolve the base URL for E2E requests.
 * Prefers E2E_BASE_URL, falls back to NEXT_PUBLIC_BASE_URL, then localhost:3000.
 */
export const e2eBaseUrl =
  process.env.E2E_BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  'http://localhost:3000'
