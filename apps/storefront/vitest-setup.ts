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

/**
 * The shipping E2E files drive a real storefront at `E2E_BASE_URL` (see `tests/helpers/e2e.ts`),
 * and those requests are the thing under test rather than a mock somebody forgot to write.
 * Everything else unhandled still fails the run, which is the point of the `error` strategy —
 * but the strategy has to be a callback to say so: passing the string `'error'` refuses to let
 * any request through at all, with "Cannot bypass a request when using the error strategy".
 */
const e2eBaseUrl = process.env.E2E_BASE_URL

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request, print) {
      if (e2eBaseUrl && request.url.startsWith(e2eBaseUrl)) return
      print.error()
    },
  })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
