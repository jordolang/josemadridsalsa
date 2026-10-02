import { beforeEach, describe, expect, it, vi } from 'vitest'

const { access, token } = vi.hoisted(() => ({ access: vi.fn(), token: vi.fn() }))

vi.mock('@/lib/kiosk/auth', async () => {
  class KioskAuthError extends Error {}
  return { KioskAuthError, requireKioskAccess: (...a: unknown[]) => access(...a) }
})
vi.mock('@/lib/square/oauth', () => {
  class SquareOAuthError extends Error {}
  return { SquareOAuthError, getSquareReaderToken: () => token() }
})

const { GET } = await import('@/app/api/kiosk/square/authorization/route')
const { SquareOAuthError } = await import('@/lib/square/oauth')

const call = () => GET(new Request('http://localhost/api/kiosk/square/authorization', { headers: { Authorization: 'Bearer t' } }))

beforeEach(() => {
  vi.stubEnv('SQUARE_LOCATION_ID', 'LOC1')
  access.mockReset()
  token.mockReset().mockResolvedValue({ accessToken: 'EAAA-1', expiresAt: '2026-11-01T00:00:00Z' })
})

describe('GET /api/kiosk/square/authorization', () => {
  it('gives a paired kiosk its Square sign-in', async () => {
    access.mockResolvedValue('device')
    const response = await call()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ accessToken: 'EAAA-1', expiresAt: '2026-11-01T00:00:00Z', locationId: 'LOC1' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('refuses a staff browser, which has no reader and no use for a payments token', async () => {
    access.mockResolvedValue('staff')
    const response = await call()
    expect(response.status).toBe(401)
    expect(token).not.toHaveBeenCalled()
  })

  it('explains when Square has not been connected yet', async () => {
    access.mockResolvedValue('device')
    token.mockRejectedValue(new SquareOAuthError('Square is not connected.'))
    const response = await call()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Square is not connected.' })
  })
})
