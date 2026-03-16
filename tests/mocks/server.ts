import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * MSW Server Configuration for Node.js Tests
 *
 * This server instance is used in Vitest tests to intercept HTTP requests
 * and return mocked responses from the handlers.
 *
 * Usage in vitest-setup.ts:
 *   import { server } from './tests/mocks/server'
 *   beforeAll(() => server.listen())
 *   afterEach(() => server.resetHandlers())
 *   afterAll(() => server.close())
 */
export const server = setupServer(...handlers)
