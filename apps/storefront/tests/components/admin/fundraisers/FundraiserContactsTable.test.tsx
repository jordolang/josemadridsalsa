import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  FundraiserContactsTable,
  type FundraiserContactRow,
} from '@/components/admin/fundraisers/FundraiserContactsTable'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/admin/fundraisers/contacts',
  useSearchParams: () => new URLSearchParams(),
}))

function row(overrides: Partial<FundraiserContactRow> = {}): FundraiserContactRow {
  return {
    id: 'c1',
    organizationName: 'Anderson HS Band',
    contactName: 'Pat Rivera',
    email: 'pat@anderson.org',
    phone: '7405214304',
    totalJars: 1240,
    totalOrders: 0,
    campaignCount: 2,
    years: [2022, 2023],
    lastCampaignAt: null,
    lastSolicitedAt: null,
    solicitationCount: 0,
    isActive: true,
    status: 'NEW',
    source: 'ARCHIVE_ORDER_FORM',
    notes: null,
    ...overrides,
  }
}

const threeRows = [
  row({ id: 'c1', organizationName: 'Anderson HS Band' }),
  row({ id: 'c2', organizationName: 'Avon HS Crew', email: 'coach@avon.org' }),
  row({ id: 'c3', organizationName: 'Cub Scout Pack 163', email: 'pack@163.org' }),
]

function renderTable(props: Partial<React.ComponentProps<typeof FundraiserContactsTable>> = {}) {
  return render(
    <FundraiserContactsTable
      contacts={threeRows}
      sortBy="jars"
      sortDir="desc"
      totalMatching={3}
      canWrite
      canSend
      {...props}
    />,
  )
}

/** The header checkbox is the one labelled for the whole page. */
function selectAllCheckbox() {
  return screen.getByRole('checkbox', { name: /select all contacts on this page/i })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }),
  )
})

/** The one bulk call, ignoring any id-resolution request that preceded it. */
function bulkCallBody() {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => String(url) === '/api/admin/fundraiser-contacts/bulk')
  return JSON.parse(call![1]!.body as string)
}

describe('FundraiserContactsTable selection', () => {
  it('selects every row on the page from the header checkbox', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(selectAllCheckbox())

    expect(screen.getByTestId('selection-count')).toHaveTextContent('3')
  })

  it('deselects every row when the header checkbox is clicked again', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(selectAllCheckbox())
    await user.click(selectAllCheckbox())

    expect(screen.queryByTestId('selection-count')).not.toBeInTheDocument()
    expect(screen.getByText(/showing 3 of 3 matching contacts/i)).toBeInTheDocument()
  })

  it('reflects selection in the header checkbox state', async () => {
    const user = userEvent.setup()
    renderTable()

    expect(selectAllCheckbox()).not.toBeChecked()
    await user.click(selectAllCheckbox())
    expect(selectAllCheckbox()).toBeChecked()
  })
})

describe('FundraiserContactsTable bulk active/inactive', () => {
  it('offers the bulk controls only once something is selected', async () => {
    const user = userEvent.setup()
    renderTable()

    expect(screen.queryByRole('button', { name: /set 3 active/i })).not.toBeInTheDocument()

    await user.click(selectAllCheckbox())

    expect(screen.getByRole('button', { name: /set 3 active/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /set 3 inactive/i })).toBeInTheDocument()
  })

  it('sends every selected id when deactivating in bulk', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(selectAllCheckbox())
    await user.click(screen.getByRole('button', { name: /set 3 inactive/i }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/fundraiser-contacts/bulk',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = bulkCallBody()
    expect(body.action).toBe('deactivate')
    expect(body.ids.sort()).toEqual(['c1', 'c2', 'c3'])
  })

  it('sends every selected id when activating in bulk', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(selectAllCheckbox())
    await user.click(screen.getByRole('button', { name: /set 3 active/i }))

    const body = bulkCallBody()
    expect(body.action).toBe('activate')
    expect(body.ids).toHaveLength(3)
  })

  it('hides the bulk controls entirely without write permission', async () => {
    const user = userEvent.setup()
    renderTable({ canWrite: false })

    await user.click(selectAllCheckbox())

    expect(screen.queryByRole('button', { name: /set 3 active/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /set 3 inactive/i })).not.toBeInTheDocument()
  })
})


describe('selecting every contact matching the filters', () => {
  it('offers to widen the selection only once the whole page is ticked', async () => {
    const user = userEvent.setup()
    renderTable({ totalMatching: 2082 })

    expect(screen.queryByRole('button', { name: /select all 2,082/i })).not.toBeInTheDocument()

    await user.click(selectAllCheckbox())

    expect(screen.getByRole('button', { name: /select all 2,082/i })).toBeInTheDocument()
  })

  it('does not offer it when the page already holds every match', async () => {
    const user = userEvent.setup()
    renderTable({ totalMatching: 3 })

    await user.click(selectAllCheckbox())

    expect(screen.queryByRole('button', { name: /select all/i })).not.toBeInTheDocument()
  })

  it('selects ids from beyond the visible page and bulk-updates all of them', async () => {
    const user = userEvent.setup()
    const beyondPage = ['c1', 'c2', 'c3', ...Array.from({ length: 497 }, (_, i) => `x${i}`)]
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          String(url).startsWith('/api/admin/fundraiser-contacts/ids')
            ? { data: { ids: beyondPage, total: 500, truncated: false } }
            : { data: {} },
      }) as unknown as Promise<Response>,
    )

    renderTable({ totalMatching: 500 })
    await user.click(selectAllCheckbox())
    await user.click(screen.getByRole('button', { name: /select all 500/i }))

    expect(screen.getByTestId('selection-banner')).toHaveTextContent(
      /all\s*500\s*contacts matching these filters are selected/i,
    )

    await user.click(screen.getByRole('button', { name: /set 500 inactive/i }))

    const body = bulkCallBody()
    expect(body.action).toBe('deactivate')
    expect(body.ids).toHaveLength(500)
  })

  it('splits an oversized selection into chunks the bulk route will accept', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 2082 }, (_, i) => `x${i}`)
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          String(url).startsWith('/api/admin/fundraiser-contacts/ids')
            ? { data: { ids: many, total: 2082, truncated: false } }
            : { data: {} },
      }) as unknown as Promise<Response>,
    )

    renderTable({ totalMatching: 2082 })
    await user.click(selectAllCheckbox())
    await user.click(screen.getByRole('button', { name: /select all 2,082/i }))
    await user.click(screen.getByRole('button', { name: /set 2,082 active/i }))

    const bulkCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url) === '/api/admin/fundraiser-contacts/bulk')
    // 2,082 ids at 1,000 per request.
    expect(bulkCalls).toHaveLength(3)
    const sizes = bulkCalls.map(([, init]) => JSON.parse(init!.body as string).ids.length)
    expect(sizes).toEqual([1000, 1000, 82])
  })

  it('warns instead of silently truncating when the match set is capped', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          String(url).startsWith('/api/admin/fundraiser-contacts/ids')
            ? { data: { ids: ['a', 'b'], total: 99999, truncated: true } }
            : { data: {} },
      }) as unknown as Promise<Response>,
    )

    renderTable({ totalMatching: 99999 })
    await user.click(selectAllCheckbox())
    await user.click(screen.getByRole('button', { name: /select all 99,999/i }))

    expect(screen.getByText(/selection capped at 2 contacts/i)).toBeInTheDocument()
  })

  it('drops the widened selection when a row is individually unticked', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          String(url).startsWith('/api/admin/fundraiser-contacts/ids')
            ? { data: { ids: ['c1', 'c2', 'c3', 'x1'], total: 4, truncated: false } }
            : { data: {} },
      }) as unknown as Promise<Response>,
    )

    renderTable({ totalMatching: 4 })
    await user.click(selectAllCheckbox())
    await user.click(screen.getByRole('button', { name: /select all 4/i }))
    expect(screen.getByTestId('selection-banner')).toHaveTextContent(
      /all\s*4\s*contacts matching these filters are selected/i,
    )

    await user.click(screen.getByRole('checkbox', { name: /select anderson hs band/i }))

    expect(screen.queryByTestId('selection-banner')).not.toBeInTheDocument()
  })
})
