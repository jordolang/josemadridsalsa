import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LiveChatNotifier } from '@/components/admin/LiveChatNotifier'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')

/** Browsers that deny storage throw on the property access itself, not on getItem. */
function denyLocalStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    },
  })
}

describe('LiveChatNotifier where storage access is denied', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: /max-width:\s*767px/.test(query),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ waiting: [], active: [] }) }),
    )
  })

  afterEach(() => {
    if (realStorage) Object.defineProperty(window, 'localStorage', realStorage)
    vi.unstubAllGlobals()
  })

  it('still renders the tab instead of tearing down the admin tree', async () => {
    denyLocalStorage()
    render(<LiveChatNotifier />)
    const tab = await screen.findByRole('button', { name: 'Open live chat queue' })
    await waitFor(() => expect(tab).toBeInTheDocument())
  })
})
