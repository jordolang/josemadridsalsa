import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The account settings form is the only place a birth date enters the system, and the BIRTHDAY
 * automation reads it back at UTC midnight. What matters: a real date is stored as that calendar
 * day, clearing it clears it, and nonsense is rejected rather than saved.
 */

const userUpdate = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { user: { update: userUpdate } }
  return { prisma: client, default: client }
})
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user_1' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { updateProfile } = await import('@/app/(public)/account/settings/actions')

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ name: 'Rosa', email: 'rosa@example.com', phone: '', ...fields })) {
    data.set(key, value)
  }
  return data
}

beforeEach(() => {
  userUpdate.mockReset()
  userUpdate.mockResolvedValue({})
})

describe('updateProfile date of birth', () => {
  it('stores the chosen calendar day at UTC midnight', async () => {
    const result = await updateProfile(null, form({ dateOfBirth: '1990-10-01' }))

    expect(result.ok).toBe(true)
    expect(userUpdate.mock.calls[0][0].data.dateOfBirth).toEqual(new Date('1990-10-01T00:00:00Z'))
  })

  it('clears the date when the field is emptied', async () => {
    await updateProfile(null, form({ dateOfBirth: '' }))

    expect(userUpdate.mock.calls[0][0].data.dateOfBirth).toBeNull()
  })

  it('leaves the date alone when the form does not send the field', async () => {
    await updateProfile(null, form({}))

    expect(userUpdate.mock.calls[0][0].data).not.toHaveProperty('dateOfBirth')
  })

  it.each(['1990-02-30', '3000-01-01', '1850-01-01', 'yesterday'])('rejects %s', async (value) => {
    const result = await updateProfile(null, form({ dateOfBirth: value }))

    expect(result.ok).toBe(false)
    expect(userUpdate).not.toHaveBeenCalled()
  })
})
