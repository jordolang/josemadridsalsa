import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Row, SectionPayload } from '@/lib/admin-desktop/types'

const rbac = {
  getCurrentUser: vi.fn(),
  getUserPermissions: vi.fn(),
  isStaff: vi.fn(),
}
const data = { loadSection: vi.fn(), loadBadges: vi.fn() }
const audit = { logAuditWithRequest: vi.fn() }

vi.mock('@/lib/rbac', () => rbac)
vi.mock('@/lib/admin-desktop/data', () => data)
vi.mock('@/lib/audit', () => audit)

const { GET } = await import('@/app/api/admin/desktop/[section]/route')

function row(id: string, name: string, bucket: number): Row {
  return {
    id,
    search: `${id} ${name}`,
    buckets: [0, bucket],
    cells: [{ text: id }, { text: name }],
    inspector: { title: id, groups: [] },
  }
}

function payload(list: SectionPayload['list']): SectionPayload {
  return {
    id: 'customers',
    page: 'customers',
    pages: [],
    kind: 'table',
    eyebrow: '',
    heading: 'Customers',
    path: '/admin/customers',
    filters: ['All', 'Retail', 'Wholesale'],
    actions: [],
    body: {
      view: 'table',
      columns: [
        { label: 'Id', width: '1fr' },
        { label: 'Name', width: '1fr' },
      ],
      rows: [row('c1', 'Vera "V" Smith', 1), row('c2', 'Karen Wolfe', 2)],
      totals: [],
    },
    loadedAt: '2026-10-01T12:00:00.000Z',
    list,
  }
}

const call = (query: string) =>
  GET(new Request(`http://localhost/api/admin/desktop/customers?${query}`), {
    params: Promise.resolve({ section: 'customers' }),
  })

beforeEach(() => {
  vi.clearAllMocks()
  rbac.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'mike@example.com', role: 'ADMIN' })
  rbac.isStaff.mockReturnValue(true)
  rbac.getUserPermissions.mockResolvedValue(['users:read'])
})

describe('GET /api/admin/desktop/[section]?format=csv', () => {
  it('streams the filtered rows as an attachment and logs the export', async () => {
    data.loadSection.mockResolvedValue(payload({ q: '', limit: 25000, more: false, searchable: false }))

    const response = await call('format=csv&filter=1')

    expect(data.loadSection).toHaveBeenCalledWith('customers', ['users:read'], { q: '', limit: 25000 })
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="customers-\d{4}-\d{2}-\d{2}\.csv"$/)
    // The chip narrowed it to c1, and the embedded quote is escaped.
    expect(await response.text()).toBe('"Id","Name"\r\n"c1","Vera ""V"" Smith"\r\n')
    expect(audit.logAuditWithRequest).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'export', entityId: 'customers' }),
      expect.any(Request),
    )
  })

  it('leaves the text match to the database when it searched', async () => {
    // The server matched "karen@" on an email the row text does not carry.
    data.loadSection.mockResolvedValue(payload({ q: 'karen@', limit: 25000, more: false, searchable: true }))

    const text = await (await call('format=csv&q=karen%40')).text()
    expect(text.trim().split('\r\n')).toHaveLength(3)
  })

  it('refuses a section the account may not see', async () => {
    rbac.getUserPermissions.mockResolvedValue([])
    const response = await call('format=csv')
    expect(response.status).toBe(403)
    expect(data.loadSection).not.toHaveBeenCalled()
  })

  it('returns JSON with live badges when no format is asked for', async () => {
    data.loadSection.mockResolvedValue(payload(undefined))
    data.loadBadges.mockResolvedValue({ orders: 3 })

    const body = await (await call('q=vera&limit=500')).json()
    expect(data.loadSection).toHaveBeenCalledWith('customers', ['users:read'], { q: 'vera', limit: 500 })
    expect(body.badges).toEqual({ orders: 3 })
  })
})
