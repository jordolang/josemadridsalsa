import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Denying a fundraiser sign-up from the web admin. The rules live in
 * `lib/fundraising/account-review.ts` and are tested there; this pins the
 * route's side: permission, validation, audit and the status it answers with.
 */

const requirePermission = vi.fn(async () => ({ id: 'admin-1', email: 'mike@josemadridsalsa.com' }))
vi.mock('@/lib/rbac', () => ({ requirePermission }))

const logAuditWithRequest = vi.fn(async () => undefined)
vi.mock('@/lib/audit', () => ({ logAuditWithRequest, createChangeSnapshot: vi.fn() }))

const denyFundraiserAccount = vi.fn()
vi.mock('@/lib/fundraising/account-review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fundraising/account-review')>()),
  denyFundraiserAccount,
}))

const { DELETE } = await import('@/app/api/admin/fundraiser-accounts/route')
const { AccountReviewError } = await import('@/lib/fundraising/account-review')

const deny = (body: unknown) =>
  DELETE(
    new Request('https://store.example.com/api/admin/fundraiser-accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

beforeEach(() => vi.clearAllMocks())

describe('DELETE /api/admin/fundraiser-accounts', () => {
  it('denies the sign-up and records who did it', async () => {
    denyFundraiserAccount.mockResolvedValue({ name: 'Free Crypto', email: 'bot@spam.test' })

    const res = await deny({ accountId: 'a1' })

    expect(res.status).toBe(200)
    expect(requirePermission).toHaveBeenCalledWith('orders:write')
    expect(denyFundraiserAccount).toHaveBeenCalledWith('a1', 'mike@josemadridsalsa.com')
    expect(logAuditWithRequest.mock.calls[0][0]).toMatchObject({
      userId: 'admin-1',
      action: 'delete',
      entityType: 'fundraiser_account',
      entityId: 'a1',
    })
  })

  it('rejects a request with no account', async () => {
    const res = await deny({})
    expect(res.status).toBe(400)
    expect(denyFundraiserAccount).not.toHaveBeenCalled()
  })

  it('answers with the refusal the rules gave', async () => {
    denyFundraiserAccount.mockRejectedValue(new AccountReviewError('Eagles Band has orders, so suspend it instead.', 409))

    const res = await deny({ accountId: 'a1' })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Eagles Band has orders, so suspend it instead.' })
    expect(logAuditWithRequest).not.toHaveBeenCalled()
  })
})
