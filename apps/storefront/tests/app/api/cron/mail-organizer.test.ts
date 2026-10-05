// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const notifyOperators = vi.fn()
vi.mock('@/lib/cron/auth', () => ({ isAuthorizedCronRequest: () => true }))
vi.mock('@/lib/notifications/dispatch', () => ({ notifyOperators }))
vi.mock('@/lib/inbox/gmail', () => ({
  getGmailConnection: vi.fn().mockResolvedValue({ id: 'c1', mailbox: 'mike@josemadridsalsa.com' }),
}))
vi.mock('@/lib/inbox/organizer', () => ({
  isOrganizeHour: () => true,
  organizeInbox: vi.fn().mockResolvedValue({
    scanned: 3, filed: {}, keptInInbox: 0, leftForTriage: 0, unmatched: 0, errors: ['t1: quota', 't2: quota'],
  }),
}))

const { GET } = await import('@/app/api/cron/mail-organizer/route')

describe('GET /api/cron/mail-organizer', () => {
  it('warns operators when some conversations could not be filed', async () => {
    const response = await GET(new Request('https://x/api/cron/mail-organizer'))
    expect(response.status).toBe(207)
    expect(notifyOperators).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inbox organizing partly failed' }))
  })
})
