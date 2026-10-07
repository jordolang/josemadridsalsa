/**
 * Pure rules for the 3D Battle Arena game's player accounts: handles, sign-in tokens, which
 * sites may receive a token, how results are checked, and the leaderboard periods.
 *
 * The game is a static page built from the battle-arena-3d repository. Players reach it on the
 * fundraising site (/battle-arena) or on the game's own deployment. It signs players in by
 * sending them here; this site hands the game back a long random token in the URL fragment,
 * which the game then sends as a bearer token.
 */
import { createHash, randomBytes, randomInt } from 'crypto'
import { z } from 'zod'
import { getFundraisingSiteUrl } from '@/lib/fundraising-site/host'
import { BATTLE_ARENA_URL } from './links'

/** The game's own deployment, on its subdomain and its Vercel URL. More origins (a preview) come from `ARENA_GAME_ORIGINS`. */
export const DEFAULT_GAME_ORIGINS = [BATTLE_ARENA_URL, 'https://battle-arena-3d-mauve.vercel.app']

/** How long the game stays signed in before the player is sent to sign in again. */
export const SESSION_DAYS = 90
/** `lastUsedAt` is only rewritten this often, so every request is not a database write. */
export const SESSION_TOUCH_MINUTES = 60

/** A player may pick their own group again this long after the last time. */
export const TEAM_CHANGE_DAYS = 7

/** Matches a player may start per hour. Far above real play; it stops a script, not a player. */
export const MATCH_STARTS_PER_HOUR = 40
/** A result is accepted this long after its match started, and no later. */
export const MATCH_MAX_HOURS = 3
/** The fastest believable round: a fight intro plus a few seconds of brawling. */
export const MIN_SECONDS_PER_ROUND = 6
/** The game's own limits: up to 8 fighters, first to 5 rounds. */
export const MAX_OPPONENTS = 7
export const MAX_ROUNDS_TO_WIN = 5
/** Longest possible match: everyone but the winner takes 4 rounds, the winner takes 5. */
export const MAX_ROUNDS = MAX_ROUNDS_TO_WIN + (MAX_OPPONENTS + 1 - 1) * (MAX_ROUNDS_TO_WIN - 1)
/**
 * Generous ceilings on what one player can do per round; anything above is not a real result.
 * Tournament fighters can be revived and knocked out again, hence two knockouts per opponent.
 */
export const KNOCKOUTS_PER_OPPONENT = 2
export const MAX_KNOCKOUTS_PER_ROUND = MAX_OPPONENTS * KNOCKOUTS_PER_OPPONENT
export const MAX_DAMAGE_PER_ROUND = 4000

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** The bearer token on a request, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(header.trim())
  return match ? match[1] : null
}

export function sessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * 86_400_000)
}

export function needsTouch(lastUsedAt: Date, now = new Date()): boolean {
  return now.getTime() - lastUsedAt.getTime() > SESSION_TOUCH_MINUTES * 60_000
}

/** Letters (any language), digits, spaces and . _ - ; 3 to 20 characters once trimmed. */
export const HandleSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(3, 'Names are at least 3 characters')
      .max(20, 'Names are at most 20 characters')
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u, 'Use letters, numbers, spaces, dots, dashes or underscores')
  )

/** What makes two handles "the same name": case and repeated spaces don't count. */
export function handleKey(handle: string): string {
  return handle.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * A first handle for a new player: their first name (or "Fighter") and a number, e.g. "Maria 4821".
 * The number keeps it unique without asking; the player can rename themselves in the game.
 */
export function suggestHandle(name: string | null | undefined): string {
  const first = (name || '').trim().split(/\s+/)[0] || ''
  const clean = first.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 14)
  return `${clean.length >= 2 ? clean : 'Fighter'} ${randomInt(1000, 10000)}`
}

/** The game origins tokens may be sent to: the fundraising site, the game's own deployment and the environment's. */
export function allowedGameOrigins(env: string | undefined = process.env.ARENA_GAME_ORIGINS): string[] {
  const extra = (env || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return [...new Set([new URL(getFundraisingSiteUrl()).origin, ...DEFAULT_GAME_ORIGINS, ...extra])]
}

/**
 * Whether the game may receive a sign-in token at `url`. Only exact, listed origins: a token
 * sent anywhere else would let that site play (and post results) as the player.
 * Plain http is accepted for localhost only, while developing the game.
 */
export function isAllowedReturnUrl(url: string, origins = allowedGameOrigins(), dev = process.env.NODE_ENV !== 'production'): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.username || parsed.password) return false
  if (origins.includes(parsed.origin)) return true
  return dev && parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
}

/** Where the game goes back to, with the token and the game's own `state` in the fragment. */
export function returnUrlWithToken(returnTo: string, token: string, state: string): string {
  const url = new URL(returnTo)
  url.hash = new URLSearchParams({ arena_token: token, state }).toString()
  return url.toString()
}

export const StateSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)

export const MATCH_MODES = ['CPU', 'ONLINE', 'TOURNAMENT'] as const

export const StartMatchSchema = z.object({
  mode: z.enum(MATCH_MODES),
  fighter: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .optional(),
  opponents: z.number().int().min(1).max(MAX_OPPONENTS),
  room: z
    .string()
    .regex(/^[A-Z0-9-]{1,24}$/)
    .optional(),
})

export type StartMatchInput = z.infer<typeof StartMatchSchema>

export const FinishMatchSchema = z.object({
  won: z.boolean(),
  roundsWon: z.number().int().min(0).max(MAX_ROUNDS_TO_WIN),
  rounds: z.number().int().min(1).max(MAX_ROUNDS),
  knockouts: z.number().int().min(0).max(MAX_ROUNDS * MAX_KNOCKOUTS_PER_ROUND),
  damage: z.number().min(0).max(MAX_ROUNDS * MAX_DAMAGE_PER_ROUND),
})

export type FinishMatchInput = z.infer<typeof FinishMatchSchema>

/**
 * Why a reported result cannot be real, or null when it can. The game is peer to peer, so
 * there is no server watching the fight: these checks bound what a result can claim rather
 * than prove it. They are what the match itself makes impossible.
 */
export function implausibleResult(
  input: FinishMatchInput,
  match: { opponents: number; startedAt: Date },
  now = new Date()
): string | null {
  const elapsed = (now.getTime() - match.startedAt.getTime()) / 1000
  if (elapsed > MATCH_MAX_HOURS * 3600) return 'That match is too old to record.'
  if (input.roundsWon > input.rounds) return 'More rounds won than played.'
  if (input.won && input.roundsWon < 1) return 'A win needs at least one round.'
  if (elapsed < input.rounds * MIN_SECONDS_PER_ROUND) return 'That match was too short to record.'
  if (input.knockouts > input.rounds * match.opponents * KNOCKOUTS_PER_OPPONENT) return 'More knockouts than fighters.'
  if (input.damage > input.rounds * MAX_DAMAGE_PER_ROUND) return 'More damage than a match allows.'
  return null
}

export type LeaderboardPeriod = 'week' | 'month' | 'all'

/** Weeks start Monday 00:00 UTC; months on the 1st, UTC, like the fundraiser battle months. */
export function periodStart(period: LeaderboardPeriod, now = new Date()): Date | null {
  if (period === 'all') return null
  if (period === 'month') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const day = (now.getUTCDay() + 6) % 7 // Monday = 0
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day))
}

export const LeaderboardQuerySchema = z.object({
  board: z.enum(['players', 'teams']).default('players'),
  period: z.enum(['week', 'month', 'all']).default('week'),
  mode: z.enum(['all', 'cpu', 'online', 'tournament', 'versus']).default('all'),
  teamId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>

/** The match modes a board filter covers. `versus` is every match against other people. */
export function modesFor(mode: LeaderboardQuery['mode']): (typeof MATCH_MODES)[number][] {
  switch (mode) {
    case 'cpu':
      return ['CPU']
    case 'online':
      return ['ONLINE']
    case 'tournament':
      return ['TOURNAMENT']
    case 'versus':
      return ['ONLINE', 'TOURNAMENT']
    default:
      return [...MATCH_MODES]
  }
}
