import { describe, expect, it } from 'vitest'
import {
  FinishMatchSchema,
  HandleSchema,
  HostedMatchSchema,
  HostedReportSchema,
  StartMatchSchema,
  allowedGameOrigins,
  bearerToken,
  eloDeltas,
  handleKey,
  hashSessionToken,
  implausibleReport,
  implausibleResult,
  isAllowedReturnUrl,
  modesFor,
  newSessionToken,
  periodStart,
  returnUrlWithToken,
  suggestHandle,
} from '@/lib/arena-game/rules'

const GAME = 'https://battle-arena-3d-mauve.vercel.app'

describe('arena game sign-in', () => {
  it('only sends tokens to listed game origins', () => {
    const origins = allowedGameOrigins('https://play.example.com/, ')
    expect(origins).toEqual(['https://fundraising.josemadridsalsa.com', 'https://battle.josemadridsalsa.com', GAME, 'https://play.example.com'])
    expect(isAllowedReturnUrl('https://fundraising.josemadridsalsa.com/battle-arena?room=AB12', origins, false)).toBe(true)
    expect(isAllowedReturnUrl('https://battle.josemadridsalsa.com/?room=AB12', origins, false)).toBe(true)
    expect(isAllowedReturnUrl(`${GAME}/?room=AB12`, origins, false)).toBe(true)
    expect(isAllowedReturnUrl('https://play.example.com/x', origins, false)).toBe(true)
    expect(isAllowedReturnUrl('https://battle-arena-3d-evil.vercel.app/', origins, false)).toBe(false)
    expect(isAllowedReturnUrl(`${GAME}.evil.com/`, origins, false)).toBe(false)
    expect(isAllowedReturnUrl(`https://user:pw@battle-arena-3d-mauve.vercel.app/`, origins, false)).toBe(false)
    expect(isAllowedReturnUrl('javascript:alert(1)', origins, false)).toBe(false)
    expect(isAllowedReturnUrl('not a url', origins, false)).toBe(false)
  })

  it('accepts localhost over http only while developing', () => {
    expect(isAllowedReturnUrl('http://localhost:8000/', [GAME], true)).toBe(true)
    expect(isAllowedReturnUrl('http://localhost:8000/', [GAME], false)).toBe(false)
    expect(isAllowedReturnUrl('http://example.com/', [GAME], true)).toBe(false)
  })

  it('puts the token in the fragment, keeping the query', () => {
    const url = new URL(returnUrlWithToken(`${GAME}/?room=AB12#old`, 'tok_123', 'state1234'))
    expect(url.search).toBe('?room=AB12')
    expect(new URLSearchParams(url.hash.slice(1)).get('arena_token')).toBe('tok_123')
    expect(new URLSearchParams(url.hash.slice(1)).get('state')).toBe('state1234')
  })

  it('reads bearer tokens and hashes them', () => {
    const token = newSessionToken()
    const request = new Request('https://x.test', { headers: { authorization: `Bearer ${token}` } })
    expect(bearerToken(request)).toBe(token)
    expect(bearerToken(new Request('https://x.test', { headers: { authorization: 'Basic abc' } }))).toBeNull()
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSessionToken(token)).not.toBe(token)
  })
})

describe('arena game handles', () => {
  it('cleans and validates names', () => {
    expect(HandleSchema.parse('  Salsa   King ')).toBe('Salsa King')
    expect(HandleSchema.safeParse('ab').success).toBe(false)
    expect(HandleSchema.safeParse('a'.repeat(21)).success).toBe(false)
    expect(HandleSchema.safeParse('<script>').success).toBe(false)
    expect(HandleSchema.safeParse('José_99').success).toBe(true)
  })

  it('treats case and spacing as the same name', () => {
    expect(handleKey(' Salsa  KING ')).toBe(handleKey('salsa king'))
  })

  it('suggests a handle from the first name', () => {
    expect(suggestHandle('Maria Lopez')).toMatch(/^Maria \d{4}$/)
    expect(suggestHandle(null)).toMatch(/^Fighter \d{4}$/)
    expect(HandleSchema.safeParse(suggestHandle('Ñandú <b>')).success).toBe(true)
  })
})

describe('arena game results', () => {
  const started = new Date('2026-10-06T12:00:00Z')
  const at = (seconds: number) => new Date(started.getTime() + seconds * 1000)
  const result = (over: Partial<Parameters<typeof implausibleResult>[0]> = {}) =>
    FinishMatchSchema.parse({ won: true, roundsWon: 2, rounds: 3, knockouts: 4, damage: 600, ...over })

  it('accepts a normal match', () => {
    expect(implausibleResult(result(), { opponents: 3, startedAt: started }, at(120))).toBeNull()
  })

  it('rejects results a match cannot produce', () => {
    const match = { opponents: 3, startedAt: started }
    expect(implausibleResult(result(), match, at(5))).toMatch(/too short/)
    expect(implausibleResult(result(), match, at(4 * 3600))).toMatch(/too old/)
    expect(implausibleResult(result({ roundsWon: 3, rounds: 2 }), match, at(120))).toMatch(/More rounds/)
    expect(implausibleResult(result({ roundsWon: 0 }), match, at(120))).toMatch(/at least one round/)
    expect(implausibleResult(result({ knockouts: 19 }), match, at(120))).toMatch(/knockouts/)
    expect(implausibleResult(result({ damage: 13_000 }), match, at(120))).toMatch(/damage/)
  })

  it('bounds the input itself', () => {
    expect(FinishMatchSchema.safeParse({ won: true, roundsWon: 6, rounds: 6, knockouts: 0, damage: 0 }).success).toBe(false)
    expect(FinishMatchSchema.safeParse({ won: true, roundsWon: 1, rounds: 1, knockouts: -1, damage: 0 }).success).toBe(false)
  })
})

describe('arena game hosted matches', () => {
  const started = new Date('2026-10-06T12:00:00Z')
  const at = (seconds: number) => new Date(started.getTime() + seconds * 1000)
  const line = (seat: number, won: boolean, roundsWon = won ? 2 : 1) => ({ seat, won, roundsWon, rounds: 3, knockouts: won ? 2 : 1, damage: 400 })
  const report = (over: Record<string, unknown> = {}) =>
    HostedReportSchema.parse({ rounds: 3, winnerSeat: 0, winnerTeam: null, results: [line(0, true), line(1, false)], ...over })

  it('lets a browser report its own result only against the CPU', () => {
    expect(StartMatchSchema.safeParse({ mode: 'CPU', opponents: 3 }).success).toBe(true)
    expect(StartMatchSchema.safeParse({ mode: 'ARCADE', opponents: 1 }).success).toBe(true)
    const online = StartMatchSchema.safeParse({ mode: 'ONLINE', opponents: 3 })
    expect(online.success).toBe(false)
    expect(online.error?.issues[0].message).toMatch(/host/)
  })

  it('checks the seats the host opens', () => {
    const ok = { mode: 'ONLINE', fighters: 4, seats: [0, 2], hostSeat: 0 }
    expect(HostedMatchSchema.safeParse(ok).success).toBe(true)
    expect(HostedMatchSchema.parse({ ...ok, mode: 'HILL' }).mode).toBe('ONLINE')
    expect(HostedMatchSchema.safeParse({ ...ok, mode: 'CPU' }).success).toBe(false)
    expect(HostedMatchSchema.safeParse({ ...ok, seats: [0, 0] }).success).toBe(false)
    expect(HostedMatchSchema.safeParse({ ...ok, seats: [0, 4] }).success).toBe(false)
    expect(HostedMatchSchema.safeParse({ ...ok, hostSeat: 1 }).success).toBe(false)
    expect(HostedMatchSchema.safeParse({ ...ok, hostSeat: -1 }).success).toBe(true)
  })

  it('accepts a normal report and rejects impossible ones', () => {
    const match = { fighters: 4, startedAt: started }
    expect(implausibleReport(report(), match, at(120))).toBeNull()
    expect(implausibleReport(report(), match, at(5))).toMatch(/too short/)
    expect(implausibleReport(report({ results: [line(0, true), line(1, true)] }), match, at(120))).toMatch(/Only one fighter/)
    expect(implausibleReport(report({ results: [line(0, true), line(0, false)] }), match, at(120))).toMatch(/twice/)
  })

  it('lets every member of the winning team win, rounds or not', () => {
    const teams = report({ winnerTeam: 1, results: [line(0, true), line(1, true, 0), line(2, false)] })
    expect(implausibleReport(teams, { fighters: 4, startedAt: started }, at(120))).toBeNull()
  })

  it('moves ratings by Elo', () => {
    expect(eloDeltas(1000, 1000)).toEqual([16, -16])
    const [upset] = eloDeltas(1000, 1400)
    const [expected] = eloDeltas(1400, 1000)
    expect(upset).toBeGreaterThan(expected)
    expect(expected).toBeGreaterThanOrEqual(1)
  })
})

describe('arena game leaderboards', () => {
  it('starts weeks on Monday and months on the 1st, in UTC', () => {
    const wednesday = new Date('2026-10-07T15:00:00Z')
    expect(periodStart('week', wednesday)?.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(periodStart('week', new Date('2026-10-11T23:59:00Z'))?.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(periodStart('week', new Date('2026-10-05T00:00:00Z'))?.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(periodStart('month', wednesday)?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(periodStart('all', wednesday)).toBeNull()
  })

  it('maps board filters to match modes', () => {
    expect(modesFor('versus')).toEqual(['ONLINE', 'TOURNAMENT', 'RANKED'])
    expect(modesFor('all')).toEqual(['ONLINE', 'TOURNAMENT', 'RANKED'])
    expect(modesFor('ranked')).toEqual(['RANKED'])
    expect(modesFor('cpu')).toEqual(['CPU'])
  })
})
