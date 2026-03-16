/**
 * Vitest Test Setup
 * José Madrid Salsa E-commerce Platform
 *
 * Sets up global test matchers, cleanup for React Testing Library,
 * and Mock Service Worker (MSW) for API mocking
 */

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
