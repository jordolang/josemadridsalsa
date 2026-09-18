/**
 * Vitest Test Setup
 * José Madrid Salsa E-commerce Platform
 *
 * Sets up global test matchers, cleanup for React Testing Library,
 * and Mock Service Worker (MSW) for API mocking
 */

process.env.RESEND_API_KEY = 'test_resend_api_key_12345'
process.env.FROM_EMAIL = 'Jose Madrid Salsa <mike@josemadridsalsa.com>'
process.env.NEXT_PUBLIC_BASE_URL = 'https://josemadrid.net'
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test_nextauth_secret_12345'
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(48))).toString('base64')

import '@testing-library/jest-dom/vitest'
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

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
