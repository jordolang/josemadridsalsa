/**
 * Setup for the component tests (the `dom` project in vitest.config.ts): jest-dom matchers and
 * React Testing Library cleanup. Kept out of vitest-setup.ts so plain logic tests don't pay for
 * loading React and Testing Library in every file.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
