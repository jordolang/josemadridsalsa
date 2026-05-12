/**
 * Vitest Test Setup
 * José Madrid Salsa E-commerce Platform
 *
 * Sets up global test matchers, cleanup for React Testing Library,
 * and Mock Service Worker (MSW) for API mocking
 */

// Set test environment variables BEFORE any imports
process.env.RESEND_API_KEY = 'test_resend_api_key_12345'
process.env.FROM_EMAIL = 'Jose Madrid Salsa <mike@josemadrid.net>'
process.env.NEXT_PUBLIC_BASE_URL = 'https://josemadrid.net'

import '@testing-library/jest-dom/vitest' // Note: /vitest sub-export, not main export
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { server } from './tests/mocks/server'

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
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
