import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db } = vi.hoisted(() => ({ db: { row: null as null | { credentials: unknown }, upsert: vi.fn() } }))

vi.mock('@/lib/prisma', () => ({
  default: {
    paymentProviderConfig: {
      findUnique: vi.fn(async () => db.row),
      upsert: (...a: unknown[]) => db.upsert(...a),
    },
  },
}))
// Real AES-GCM with a throwaway key, so stored tokens are proven encrypted, not just mocked.
vi.stubEnv('MASTER_KEY', '0'.repeat(64))

import {
  createOAuthState,
  getSquareConnectionStatus,
  getSquareReaderToken,
  squareAuthorizeUrl,
  verifyOAuthState,
  completeSquareConnection,
} from '@/lib/square/oauth'

const DAY = 24 * 60 * 60 * 1000
const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
  vi.stubEnv('SQUARE_APPLICATION_ID', 'sq0idp-app')
  vi.stubEnv('SQUARE_APPLICATION_SECRET', 'sq0csp-secret')
  vi.stubEnv('SQUARE_SANDBOX', 'false')
  vi.stubEnv('SQUARE_LOCATION_ID', 'LOC1')
  db.row = null
  db.upsert.mockReset().mockImplementation(async ({ update }: { update: { credentials: unknown } }) => {
    db.row = { credentials: update.credentials }
  })
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

describe('OAuth state', () => {
  it('accepts a state this admin started, and only for 15 minutes', () => {
    const now = Date.now()
    const state = createOAuthState('admin-1', now)
    expect(verifyOAuthState(state, 'admin-1', now + 60_000)).toBe(true)
    expect(verifyOAuthState(state, 'admin-1', now + 16 * 60_000)).toBe(false)
  })

  it('refuses a state started by someone else, or tampered with', () => {
    const state = createOAuthState('admin-1')
    expect(verifyOAuthState(state, 'admin-2')).toBe(false)
    const [payload, signature] = state.split('.')
    const forged = Buffer.from(JSON.stringify({ u: 'admin-2', t: Date.now(), n: 'x' })).toString('base64url')
    expect(verifyOAuthState(`${forged}.${signature}`, 'admin-2')).toBe(false)
    expect(verifyOAuthState(`${payload}.AAAA`, 'admin-1')).toBe(false)
    expect(verifyOAuthState('garbage', 'admin-1')).toBe(false)
  })

  it('asks Square for exactly the card reader scopes, on production', () => {
    const url = new URL(squareAuthorizeUrl('s'))
    expect(url.origin).toBe('https://connect.squareup.com')
    expect(url.searchParams.get('client_id')).toBe('sq0idp-app')
    expect(url.searchParams.get('scope')).toBe('MERCHANT_PROFILE_READ PAYMENTS_WRITE PAYMENTS_WRITE_IN_PERSON PAYMENTS_READ')
    expect(url.searchParams.get('redirect_uri')).toBe('https://www.josemadrid.net/api/admin/square/oauth/callback')
  })
})

describe('connecting and using the token', () => {
  async function connect(expiresAt: string) {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: 'EAAA-access-1', refresh_token: 'EQAA-refresh', expires_at: expiresAt, merchant_id: 'M1' }))
      .mockResolvedValueOnce(ok({ location: { id: 'LOC1' } }))
    await completeSquareConnection('code-1', 'admin-1')
  }

  it('stores the tokens encrypted, never in the clear', async () => {
    await connect(new Date(Date.now() + 30 * DAY).toISOString())
    const stored = JSON.stringify(db.row)
    expect(stored).not.toContain('EAAA-access-1')
    expect(stored).not.toContain('EQAA-refresh')
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ isActive: false }) }))
    await expect(getSquareConnectionStatus()).resolves.toMatchObject({ connected: true, merchantId: 'M1' })
  })

  it('refuses an account that does not own the kiosk location', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: 'a', refresh_token: 'r', expires_at: new Date().toISOString(), merchant_id: 'M2' }))
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    await expect(completeSquareConnection('code', 'admin-1')).rejects.toThrow('does not own the location')
    expect(db.upsert).not.toHaveBeenCalled()
  })

  it('hands out the current token while it has more than a week left', async () => {
    await connect(new Date(Date.now() + 20 * DAY).toISOString())
    fetchMock.mockReset()
    await expect(getSquareReaderToken()).resolves.toMatchObject({ accessToken: 'EAAA-access-1' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes a token close to expiry and keeps the new one', async () => {
    await connect(new Date(Date.now() + 2 * DAY).toISOString())
    const later = new Date(Date.now() + 30 * DAY).toISOString()
    fetchMock.mockReset().mockResolvedValueOnce(ok({ access_token: 'EAAA-access-2', expires_at: later, merchant_id: 'M1' }))

    await expect(getSquareReaderToken()).resolves.toEqual({ accessToken: 'EAAA-access-2', expiresAt: later })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'EQAA-refresh', client_secret: 'sq0csp-secret' })

    fetchMock.mockReset()
    await expect(getSquareReaderToken()).resolves.toMatchObject({ accessToken: 'EAAA-access-2' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says plainly when Square was never connected', async () => {
    await expect(getSquareReaderToken()).rejects.toThrow('Square is not connected')
  })
})
