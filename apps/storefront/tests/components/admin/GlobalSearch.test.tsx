import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// cmdk measures its list; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { GlobalSearch } from '@/components/admin/GlobalSearch'

const results = [
  {
    entity: 'fundraiser',
    id: 'f1',
    title: 'Maysville Key Club',
    subtitle: 'Maysville Key Club · active',
    href: '/admin/fundraisers/f1',
    score: 50,
  },
  {
    entity: 'document',
    id: 'd1',
    title: 'scan-0421.pdf',
    subtitle: '03 Fundraisers · 2022',
    href: '/admin/archive/documents?search=scan-0421.pdf',
    score: 15,
    excerpt: '…jars for Maysville Key Club…',
  },
]

// Restored rather than deleted on teardown: the shared MSW setup owns the real `fetch`
// and its own teardown fails if the global is left undefined.
const realFetch = globalThis.fetch

beforeEach(() => {
  push.mockReset()
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue({ json: async () => ({ results, shape: 'text' }) }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

async function openAndType(query: string) {
  const user = userEvent.setup()
  render(<GlobalSearch />)
  await user.click(screen.getByRole('button', { name: /search/i }))
  await user.type(screen.getByPlaceholderText(/order, customer/i), query)
  return user
}

describe('GlobalSearch palette', () => {
  it('shows server-ranked results whose text does not match the query', async () => {
    // The server has already decided these are matches — the archive document is a body-text
    // hit whose filename contains nothing like "Maysville". If cmdk's client-side filter is
    // left on, it re-filters by item value and throws the whole result set away.
    await openAndType('Maysville')

    await waitFor(() => {
      expect(screen.getByText('Maysville Key Club')).toBeInTheDocument()
    })
    expect(screen.getByText('scan-0421.pdf')).toBeInTheDocument()
    expect(screen.getByText('…jars for Maysville Key Club…')).toBeInTheDocument()
  })

  it('keeps the see-all-results action reachable for an ordinary query', async () => {
    const user = await openAndType('Maysville')

    const seeAll = await screen.findByText(/see all results/i)
    await user.click(seeAll)

    expect(push).toHaveBeenCalledWith('/admin/search?q=Maysville')
  })
})
