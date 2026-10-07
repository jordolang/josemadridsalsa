import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  ensurePlayer: vi.fn(),
  createGameSession: vi.fn(),
  requirePlayer: vi.fn(),
  describeSelf: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {}, default: {} }))
vi.mock('@/lib/arena-game/players', () => ({
  ensurePlayer: mocks.ensurePlayer,
  createGameSession: mocks.createGameSession,
  requirePlayer: mocks.requirePlayer,
  describeSelf: mocks.describeSelf,
  updateSelf: vi.fn(),
}))

const authorize = await import('@/app/api/arena/auth/authorize/route')
const me = await import('@/app/api/arena/me/route')
const { ArenaGameError } = await import('@/lib/arena-game/http')

const SITE = 'https://www.josemadridsalsa.com'
const GAME = 'https://battle-arena-3d-mauve.vercel.app'

function connect(fields: Record<string, string>, origin = SITE) {
  return new Request(`${SITE}/api/arena/auth/authorize`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/arena/auth/authorize', () => {
  it('sends the signed-in player back to the game with a token in the fragment', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'u_1', name: 'Maria' } })
    mocks.ensurePlayer.mockResolvedValue({ id: 'p_1' })
    mocks.createGameSession.mockResolvedValue('tok_abc')
    const res = await authorize.POST(connect({ return_to: `${GAME}/?room=AB12`, state: 'abcdefgh12' }))
    // Not a redirect: form-action 'self' would block a form's redirect to the game's origin.
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('cache-control')).toBe('no-store')
    const html = await res.text()
    const href = /<meta http-equiv="refresh" content="0;url=([^"]+)">/.exec(html)![1].replace(/&amp;/g, '&')
    expect(html).toContain(`<a href="${href.replace(/&/g, '&amp;')}">`)
    const to = new URL(href)
    expect(to.origin).toBe(GAME)
    expect(to.search).toBe('?room=AB12')
    expect(to.hash).toBe('#arena_token=tok_abc&state=abcdefgh12')
  })

  it('never sends a token to another site', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'u_1' } })
    const res = await authorize.POST(connect({ return_to: 'https://evil.example/', state: 'abcdefgh12' }))
    expect(res.headers.get('location')).toContain('/battle-arena/connect?error=invalid')
    expect(mocks.createGameSession).not.toHaveBeenCalled()
  })

  it('refuses a form posted from another site', async () => {
    const res = await authorize.POST(connect({ return_to: GAME, state: 'abcdefgh12' }, 'https://evil.example'))
    expect(res.status).toBe(403)
  })

  it('sends a signed-out visitor to sign in first, then back to connect', async () => {
    mocks.getServerSession.mockResolvedValue(null)
    const res = await authorize.POST(connect({ return_to: `${GAME}/`, state: 'abcdefgh12' }))
    const to = new URL(res.headers.get('location')!)
    expect(to.pathname).toBe('/auth/signin')
    expect(to.searchParams.get('callbackUrl')).toMatch(/^\/battle-arena\/connect\?return_to=/)
  })
})

describe('/api/arena/me', () => {
  it('answers the game cross-origin', async () => {
    mocks.requirePlayer.mockResolvedValue({ id: 'p_1' })
    mocks.describeSelf.mockResolvedValue({ player: { handle: 'Maria 1234' } })
    const res = await me.GET(new Request(`${SITE}/api/arena/me`, { headers: { origin: GAME, authorization: 'Bearer x' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(GAME)
    expect(await res.json()).toEqual({ player: { handle: 'Maria 1234' } })
  })

  it('tells the game when it is signed out, without CORS for strangers', async () => {
    mocks.requirePlayer.mockRejectedValue(new ArenaGameError('Sign in', 401, 'signed_out'))
    const res = await me.GET(new Request(`${SITE}/api/arena/me`, { headers: { origin: 'https://evil.example' } }))
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect((await res.json()).code).toBe('signed_out')
  })

  it('answers preflight requests', async () => {
    const res = me.OPTIONS(new Request(`${SITE}/api/arena/me`, { method: 'OPTIONS', headers: { origin: GAME } }))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization')
  })
})
