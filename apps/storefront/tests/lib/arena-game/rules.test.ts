import { describe, expect, it } from 'vitest'
import {
  FinishMatchSchema,
  HandleSchema,
  allowedGameOrigins,
  bearerToken,
  handleKey,
  hashSessionToken,
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
    expect(origins).toEqual([GAME, 'https://play.example.com'])
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
    expect(modesFor('versus')).toEqual(['ONLINE', 'TOURNAMENT'])
    expect(modesFor('all')).toEqual(['CPU', 'ONLINE', 'TOURNAMENT'])
    expect(modesFor('cpu')).toEqual(['CPU'])
  })
})
