import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const create = vi.fn()
const update = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { customer: { findUnique, create, update } }
  return { prisma: client, default: client }
})

const { ensureCustomerAccount, splitName } = await import('@/lib/customers/ensure-account')

describe('ensureCustomerAccount', () => {
  beforeEach(() => {
    findUnique.mockReset()
    create.mockReset()
    update.mockReset()
  })

  it('creates an account keyed on the lowercased email', async () => {
    findUnique.mockResolvedValue(null)
    create.mockResolvedValue({ id: 'c1' })

    const id = await ensureCustomerAccount({
      email: '  Coach@School.org ',
      firstName: 'Pat',
      userId: 'u1',
      source: 'REGISTERED',
      accountType: 'FUNDRAISING',
    })

    expect(id).toBe('c1')
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'coach@school.org',
        firstName: 'Pat',
        userId: 'u1',
        source: 'REGISTERED',
        accountType: 'FUNDRAISING',
      }),
      select: { id: true },
    })
  })

  it('only fills gaps on an existing account and never lowers its type', async () => {
    findUnique.mockImplementation(({ where }: { where: { userId?: string; email?: string } }) =>
      where.userId
        ? null
        : {
            id: 'c1',
            firstName: 'Patricia',
            lastName: null,
            phone: null,
            userId: null,
            accountType: 'WHOLESALE',
          },
    )

    await ensureCustomerAccount({
      email: 'coach@school.org',
      firstName: 'Pat',
      lastName: 'Lee',
      userId: 'u1',
      source: 'GUEST_ORDER',
      accountType: 'FUNDRAISING',
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastName: 'Lee', userId: 'u1' },
    })
  })

  it('raises a standard account to fundraising', async () => {
    findUnique.mockImplementation(({ where }: { where: { userId?: string } }) =>
      where.userId ? null : { id: 'c1', firstName: 'Pat', lastName: 'Lee', phone: '1', userId: null, accountType: 'STANDARD' },
    )

    await ensureCustomerAccount({ email: 'coach@school.org', source: 'MANUAL', accountType: 'FUNDRAISING' })

    expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { accountType: 'FUNDRAISING' } })
  })

  it('does not attach a login that already belongs to another account', async () => {
    findUnique.mockImplementation(({ where }: { where: { userId?: string } }) =>
      where.userId ? { id: 'other' } : null,
    )
    create.mockResolvedValue({ id: 'c2' })

    await ensureCustomerAccount({ email: 'new@example.com', userId: 'u1', source: 'REGISTERED' })

    expect(create.mock.calls[0][0].data.userId).toBeNull()
  })

  it('writes nothing when the account already has everything', async () => {
    findUnique.mockResolvedValue({ id: 'c1', firstName: 'A', lastName: 'B', phone: '1', userId: 'u1', accountType: 'STANDARD' })

    await ensureCustomerAccount({ email: 'a@b.com', firstName: 'X', source: 'MANUAL' })

    expect(update).not.toHaveBeenCalled()
  })

  it('returns the winner when a concurrent request created the same email first', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'raced' })
    create.mockRejectedValue(new Error('Unique constraint failed'))

    expect(await ensureCustomerAccount({ email: 'a@b.com', source: 'GUEST_ORDER' })).toBe('raced')
  })
})

describe('splitName', () => {
  it('keeps everything after the first word as the last name', () => {
    expect(splitName('Maria de la Cruz')).toEqual({ firstName: 'Maria', lastName: 'de la Cruz' })
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: null })
    expect(splitName(null)).toEqual({ firstName: null, lastName: null })
  })
})
