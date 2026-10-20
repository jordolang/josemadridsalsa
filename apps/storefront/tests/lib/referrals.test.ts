import { beforeEach, describe, expect, it, vi } from 'vitest'

const userFindUnique = vi.fn()
const userUpdateMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { user: { findUnique: userFindUnique, updateMany: userUpdateMany } }
  return { prisma: client, default: client }
})

const cookieJar = { get: vi.fn(), delete: vi.fn() }
vi.mock('next/headers', () => ({ cookies: async () => cookieJar }))

const { attachReferrer, attachReferrerFromCookie, generateReferralCode, getOrCreateReferralCode, parseReferralCode, referralLink } =
  await import('@/lib/referrals')

beforeEach(() => {
  userFindUnique.mockReset()
  userUpdateMany.mockReset()
  cookieJar.get.mockReset()
  cookieJar.delete.mockReset()
})

describe('parseReferralCode', () => {
  it('normalises case and whitespace', () => {
    expect(parseReferralCode('  abcd2345 ')).toBe('ABCD2345')
  })

  it('rejects anything that is not a plain code', () => {
    expect(parseReferralCode('abc')).toBeNull()
    expect(parseReferralCode('ABCD-2345')).toBeNull()
    expect(parseReferralCode(undefined)).toBeNull()
    expect(parseReferralCode('A'.repeat(40))).toBeNull()
  })
})

describe('generateReferralCode', () => {
  it('makes 8-character codes without look-alike characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
      expect(parseReferralCode(code)).toBe(code)
    }
  })
})

describe('referralLink', () => {
  it('points at the refer route on the site', () => {
    expect(referralLink('ABCD2345')).toMatch(/\/refer\/ABCD2345$/)
  })
})

describe('getOrCreateReferralCode', () => {
  it('returns the existing code without writing', async () => {
    userFindUnique.mockResolvedValue({ referralCode: 'EXISTING' })

    expect(await getOrCreateReferralCode('user-1')).toBe('EXISTING')
    expect(userUpdateMany).not.toHaveBeenCalled()
  })

  it('issues a code only into an empty column', async () => {
    userFindUnique.mockResolvedValueOnce({ referralCode: null }).mockResolvedValueOnce({ referralCode: 'NEWCODE9' })
    userUpdateMany.mockResolvedValue({ count: 1 })

    expect(await getOrCreateReferralCode('user-1')).toBe('NEWCODE9')
    expect(userUpdateMany.mock.calls[0][0].where).toEqual({ id: 'user-1', referralCode: null })
  })
})

describe('attachReferrer', () => {
  it('records the referrer once, on an account with none yet', async () => {
    userFindUnique.mockResolvedValue({ id: 'referrer-1' })
    userUpdateMany.mockResolvedValue({ count: 1 })

    expect(await attachReferrer('new-user', 'abcd2345')).toBe(true)
    expect(userFindUnique.mock.calls[0][0].where).toEqual({ referralCode: 'ABCD2345' })
    expect(userUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: 'new-user', referredById: null },
      data: { referredById: 'referrer-1' },
    })
  })

  it('ignores a customer’s own code', async () => {
    userFindUnique.mockResolvedValue({ id: 'user-1' })

    expect(await attachReferrer('user-1', 'ABCD2345')).toBe(false)
    expect(userUpdateMany).not.toHaveBeenCalled()
  })

  it('ignores a code no customer holds, and a malformed one without a lookup', async () => {
    userFindUnique.mockResolvedValue(null)
    expect(await attachReferrer('user-1', 'ABCD2345')).toBe(false)

    userFindUnique.mockClear()
    expect(await attachReferrer('user-1', '<script>')).toBe(false)
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(userUpdateMany).not.toHaveBeenCalled()
  })
})

describe('attachReferrerFromCookie', () => {
  it('attaches the referrer from the cookie and spends the cookie', async () => {
    cookieJar.get.mockReturnValue({ value: 'ABCD2345' })
    userFindUnique.mockResolvedValue({ id: 'referrer-1' })
    userUpdateMany.mockResolvedValue({ count: 1 })

    expect(await attachReferrerFromCookie('new-user')).toBe(true)
    expect(cookieJar.delete).toHaveBeenCalledWith('jms_ref')
  })

  it('does nothing without a cookie', async () => {
    cookieJar.get.mockReturnValue(undefined)

    expect(await attachReferrerFromCookie('new-user')).toBe(false)
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(cookieJar.delete).not.toHaveBeenCalled()
  })

  it('keeps the referral when the cookie cannot be cleared', async () => {
    cookieJar.get.mockReturnValue({ value: 'ABCD2345' })
    cookieJar.delete.mockImplementation(() => {
      throw new Error('read-only')
    })
    userFindUnique.mockResolvedValue({ id: 'referrer-1' })
    userUpdateMany.mockResolvedValue({ count: 1 })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await attachReferrerFromCookie('new-user')).toBe(true)
  })
})
