/**
 * Vitest Test Setup
 * José Madrid Salsa E-commerce Platform
 *
 * Sets up global test matchers and cleanup for React Testing Library
 */

import '@testing-library/jest-dom/vitest' // Note: /vitest sub-export, not main export
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test to prevent test pollution
afterEach(() => {
  cleanup()
})
