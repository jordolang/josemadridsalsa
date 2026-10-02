import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MailView, draftFrom } from '@/components/admin-desktop/mail-view'

const labels = [
  { id: 'INBOX', name: 'INBOX', type: 'system', unread: 2, total: 9, color: null },
  { id: 'SENT', name: 'SENT', type: 'system', unread: 0, total: 4, color: null },
  { id: 'Label_1', name: 'Orders', type: 'user', unread: 1, total: 3, color: '#16a766' },
  { id: 'Label_2', name: 'Receipts', type: 'user', unread: 0, total: 1, color: null },
]

const threads = [
  {
    id: 't1',
    subject: 'Wholesale order for 40 jars',
    from: 'Ann Buyer <ann@shop.com>',
    snippet: 'Can you ship by Friday?',
    date: '2026-09-30T14:00:00.000Z',
    unread: true,
    starred: false,
    labelIds: ['INBOX'],
    messageCount: 1,
  },
]

const detail = {
  id: 't1',
  subject: 'Wholesale order for 40 jars',
  labelIds: ['INBOX'],
  messages: [
    {
      id: 'm1',
      from: 'Ann Buyer <ann@shop.com>',
      to: 'orders@josemadrid.net',
      cc: 'boss@shop.com',
      date: 'Wed, 30 Sep 2026 10:00:00 -0400',
      subject: 'Wholesale order for 40 jars',
      labelIds: ['INBOX'],
      html: '<p>Hello<script>alert(1)</script></p>',
      text: 'Hello\nCan you ship by Friday?',
      attachments: [],
      rfcMessageId: '<abc@mail.shop.com>',
      references: '<root@mail.shop.com>',
    },
  ],
}

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
}

function setup(overrides: Record<string, () => ReturnType<typeof json>> = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`
    if (overrides[key]) return overrides[key]()
    switch (key) {
      case 'GET /api/admin/mailbox':
        return json({ mailbox: 'orders@josemadrid.net', labels })
      case 'GET /api/admin/mailbox/threads':
        return json({ threads, nextPageToken: null })
      case 'GET /api/admin/mailbox/threads/t1':
        return json(detail)
      default:
        return json({ ok: true })
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  const onOpenPath = vi.fn()
  render(<MailView onOpenPath={onOpenPath} />)
  return { fetchMock, onOpenPath }
}

function posts(fetchMock: ReturnType<typeof setup>['fetchMock'], url: string) {
  return fetchMock.mock.calls
    .filter(([called, init]) => called === url && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)
}

afterEach(() => vi.unstubAllGlobals())

describe('MailView', () => {
  it('lists system folders, organizer folders and other labels, then the inbox', async () => {
    setup()
    const folders = await screen.findByRole('complementary', { name: 'Folders' })
    expect(within(folders).getByText('Inbox')).toBeInTheDocument()
    expect(within(folders).getByText('Sent')).toBeInTheDocument()
    expect(within(folders).getByText('Orders')).toBeInTheDocument()
    expect(within(folders).getByText('Receipts')).toBeInTheDocument()
    expect(within(folders).getByText('LABELS')).toBeInTheDocument()
    expect(within(folders).getByText('orders@josemadrid.net')).toBeInTheDocument()
    expect(await screen.findByText('Wholesale order for 40 jars')).toBeInTheDocument()
    expect(screen.getByText('Ann Buyer')).toBeInTheDocument()
  })

  it('renders an HTML body in a sandbox without scripts and marks the thread read', async () => {
    const { fetchMock } = setup()
    fireEvent.click(await screen.findByText('Wholesale order for 40 jars'))

    const frame = await screen.findByTitle('Message from Ann Buyer')
    const sandbox = frame.getAttribute('sandbox') ?? ''
    expect(sandbox).not.toContain('allow-scripts')
    expect(sandbox).not.toContain('allow-same-origin')
    expect(frame.getAttribute('srcdoc')).toContain('<base target="_blank">')

    await waitFor(() => expect(posts(fetchMock, '/api/admin/mailbox/threads/t1')).toEqual([{ action: 'read' }]))
  })

  it('replies on the thread with In-Reply-To, References and a single Re:', async () => {
    const { fetchMock } = setup()
    fireEvent.click(await screen.findByText('Wholesale order for 40 jars'))
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(posts(fetchMock, '/api/admin/mailbox/send')).toHaveLength(1))
    const [payload] = posts(fetchMock, '/api/admin/mailbox/send')
    expect(payload).toMatchObject({
      mode: 'send',
      to: ['ann@shop.com'],
      cc: [],
      subject: 'Re: Wholesale order for 40 jars',
      threadId: 't1',
      inReplyTo: '<abc@mail.shop.com>',
      references: '<root@mail.shop.com> <abc@mail.shop.com>',
    })
    expect(payload.body).toContain('> Can you ship by Friday?')
  })

  it('reply all copies the other recipients but not the mailbox, and Re: is not doubled', () => {
    const draft = draftFrom(
      { ...detail.messages[0], subject: 'RE: jars' },
      'replyAll',
      'orders@josemadrid.net',
    )
    expect(draft.to).toBe('ann@shop.com')
    expect(draft.cc).toBe('boss@shop.com')
    expect(draft.subject).toBe('RE: jars')
  })

  it('shows the organizer summary', async () => {
    setup({
      'POST /api/admin/mailbox/organize': () =>
        json({ scanned: 12, filed: { Orders: 3, Finance: 1 }, keptInInbox: 5, leftForTriage: 2, unmatched: 1, errors: [] }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Organize now' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Scanned 12 · filed 4 (Orders 3, Finance 1) · 5 kept in Inbox · 2 left for triage · 1 unmatched',
    )
  })

  it('points at the settings page when no mailbox is connected', async () => {
    const { onOpenPath } = setup({
      'GET /api/admin/mailbox': () =>
        json({ error: 'Not found - no Gmail mailbox is connected. Connect one at /admin/inbox/settings.' }, 404),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Connect a mailbox' }))
    expect(onOpenPath).toHaveBeenCalledWith('/admin/inbox/settings')
  })
})
