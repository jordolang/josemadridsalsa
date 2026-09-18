/**
 * Vitest Test Setup
 * José Madrid Salsa E-commerce Platform
 *
 * Sets up global test matchers, cleanup for React Testing Library,
 * and Mock Service Worker (MSW) for API mocking
 */

// Set test environment variables BEFORE any imports
process.env.RESEND_API_KEY = 'test_resend_api_key_12345'
process.env.FROM_EMAIL = 'Jose Madrid Salsa <mike@josemadridsalsa.com>'
process.env.NEXT_PUBLIC_BASE_URL = 'https://josemadrid.net'
// Required in production (NextAuth, and the guest order access tokens derived from it).
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test_nextauth_secret_12345'
// Required by lib/encryption.ts (SMTP password encryption). Any string works — the
// key is stretched via scrypt. Generate a random per-run key so no secret-like value
// is committed; encrypt/decrypt round-trip within the same process.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(48))).toString('base64')

import '@testing-library/jest-dom/vitest' // Note: /vitest sub-export, not main export
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { server } from './tests/mocks/server'

vi.mock('next/cache', async () => {
  const actual = await vi.importActual<typeof import('next/cache')>('next/cache')

  return {
    ...actual,
    unstable_cache: (fn: (...args: never[]) => unknown) => fn,
  }
})

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})

// Cleanup and reset after each test to prevent test pollution
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Close MSW server after all tests
afterAll(() => {
  server.close()
})
