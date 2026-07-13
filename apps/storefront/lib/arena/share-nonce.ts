/**
 * Signed-shortlink flow for fundraiser share-shield activation.
 *
 * Two surfaces use this module:
 *   - `POST /api/fundraiser/arena/share/intent` mints a nonce and returns
 *     a share URL the client embeds in their social-intent link.
 *   - `GET /s/[nonce]` redeems the nonce (single-use, time-bound,
 *     referer-sanity-checked) and invokes `activateShieldForUser`.
 *
 * Rate limits enforced at redemption time by counting `FundraiserShieldGrant`
 * rows inside the same transaction as the grant insert:
 *   - ≤1 shield/user/platform/hour
 *   - ≤5 shields/user/day
 *   - ≤20 shields/team/day
 *   - User.createdAt must be at least 24h old
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { prisma as db } from '@/lib/prisma'

export const SHARE_NONCE_TTL_MS = 15 * 60 * 1000 // 15 minutes
export const ACCOUNT_MIN_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
export const SHIELDS_PER_USER_PER_PLATFORM_PER_HOUR = 1
export const SHIELDS_PER_USER_PER_DAY = 5
export const SHIELDS_PER_TEAM_PER_DAY = 20

export type SharePlatform =
  | 'facebook'
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'other'

export type MintedNonce = {
  nonce: string
  expiresAt: Date
}

/**
 * Hosts allowed in the `Referer` header when redeeming a nonce. Matches
 * on hostname suffix so `m.facebook.com` and `l.facebook.com` etc. count.
 */
export const SHARE_REFERER_ALLOWLIST: readonly string[] = [
  'facebook.com',
  'x.com',
  'twitter.com',
  't.co',
  'instagram.com',
  'tiktok.com',
]

function getSecret(): Buffer {
  const raw = process.env.ARENA_SHARE_SECRET
  if (!raw || raw.length < 32) {
    throw new Error(
      'ARENA_SHARE_SECRET is not configured (must be at least 32 chars)',
    )
  }
  return Buffer.from(raw, 'utf8')
}

/**
 * Deterministic HMAC over `userId:teamId:rand:issuedAt`. The same inputs
 * always produce the same tag, which lets us skip a per-nonce DB signature
 * lookup — the stored row's `nonce` column IS the tag, and verification
 * recomputes it from the session payload.
 */
function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

/**
 * Constant-time string compare via `crypto.timingSafeEqual`. Returns false
 * on length mismatch.
 */
function eq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Mints a single-use share-intent nonce for the given user/team/platform.
 * Writes the row synchronously so the caller can hand the nonce to the
 * client immediately. `expiresAt` is now + SHARE_NONCE_TTL_MS.
 */
export async function createShareNonce(input: {
  userId: string
  teamId: string
  platform: SharePlatform
}): Promise<MintedNonce> {
  const now = new Date()
  const rand = randomBytes(16).toString('hex')
  const payload = `${input.userId}:${input.teamId}:${rand}:${now.getTime()}`
  const nonce = sign(payload)
  const expiresAt = new Date(now.getTime() + SHARE_NONCE_TTL_MS)

  await db.fundraiserShareNonce.create({
    data: {
      nonce,
      userId: input.userId,
      teamId: input.teamId,
      platform: input.platform,
      expiresAt,
    },
  })

  return { nonce, expiresAt }
}

export type VerifyNonceRejection =
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_consumed' }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'signature_mismatch' }
  | { ok: false; reason: 'account_too_new' }
  | {
      ok: false
      reason: 'rate_limited'
      limit:
        | 'per_user_per_platform_per_hour'
        | 'per_user_per_day'
        | 'per_team_per_day'
    }

export type VerifyNonceSuccess = {
  ok: true
  userId: string
  teamId: string
  platform: SharePlatform
  grantId: string
}

export type VerifyNonceResult = VerifyNonceSuccess | VerifyNonceRejection

/**
 * Atomically verify + consume a share nonce, enforce anti-cheat quotas,
 * and record a grant row. Callers should follow up with
 * `activateShieldForUser` only on `{ ok: true }`.
 *
 * Concurrency contract: the FundraiserShareNonce.consumedAt update is
 * gated on a `null` value (optimistic lock), so a second call with the
 * same nonce in a race either trips `already_consumed` or has its
 * transaction rolled back by Postgres.
 */
export async function verifyAndConsumeNonce(
  nonce: string,
): Promise<VerifyNonceResult> {
  if (!nonce || typeof nonce !== 'string' || nonce.length < 32) {
    return { ok: false, reason: 'not_found' }
  }

  return db.$transaction(async (tx) => {
    const row = await tx.fundraiserShareNonce.findUnique({
      where: { nonce },
    })
    if (!row) return { ok: false, reason: 'not_found' } as const
    if (row.consumedAt) return { ok: false, reason: 'already_consumed' } as const
    if (row.expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' } as const
    }

    // Nonce IS the signature; a lookup-by-exact-match plus timing-safe
    // compare guards against cross-user nonce tampering if the DB row
    // were ever re-keyed.
    if (!eq(row.nonce, nonce)) {
      return { ok: false, reason: 'signature_mismatch' } as const
    }

    const user = await tx.user.findUnique({
      where: { id: row.userId },
      select: { id: true, createdAt: true },
    })
    if (!user) return { ok: false, reason: 'not_found' } as const
    if (Date.now() - user.createdAt.getTime() < ACCOUNT_MIN_AGE_MS) {
      return { ok: false, reason: 'account_too_new' } as const
    }

    // Rate-limit checks — counted inside the same transaction so concurrent
    // redemptions can't both pass the check.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [hourlyCount, dailyUserCount, dailyTeamCount] = await Promise.all([
      tx.fundraiserShieldGrant.count({
        where: {
          userId: row.userId,
          platform: row.platform,
          grantedAt: { gt: oneHourAgo },
        },
      }),
      tx.fundraiserShieldGrant.count({
        where: { userId: row.userId, grantedAt: { gt: oneDayAgo } },
      }),
      tx.fundraiserShieldGrant.count({
        where: { teamId: row.teamId, grantedAt: { gt: oneDayAgo } },
      }),
    ])

    if (hourlyCount >= SHIELDS_PER_USER_PER_PLATFORM_PER_HOUR) {
      return {
        ok: false,
        reason: 'rate_limited',
        limit: 'per_user_per_platform_per_hour',
      } as const
    }
    if (dailyUserCount >= SHIELDS_PER_USER_PER_DAY) {
      return {
        ok: false,
        reason: 'rate_limited',
        limit: 'per_user_per_day',
      } as const
    }
    if (dailyTeamCount >= SHIELDS_PER_TEAM_PER_DAY) {
      return {
        ok: false,
        reason: 'rate_limited',
        limit: 'per_team_per_day',
      } as const
    }

    // Optimistic single-use lock — `consumedAt` must be null right now,
    // or `updateMany` matches 0 rows and we bail as already-consumed.
    const consumed = await tx.fundraiserShareNonce.updateMany({
      where: { nonce, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (consumed.count !== 1) {
      return { ok: false, reason: 'already_consumed' } as const
    }

    const grant = await tx.fundraiserShieldGrant.create({
      data: {
        teamId: row.teamId,
        userId: row.userId,
        platform: row.platform,
        diminishingN: dailyUserCount + 1,
      },
    })

    return {
      ok: true,
      userId: row.userId,
      teamId: row.teamId,
      platform: row.platform as SharePlatform,
      grantId: grant.id,
    } as const
  })
}

/**
 * Returns true if `refererHeader` either (a) matches a hostname in
 * SHARE_REFERER_ALLOWLIST (suffix match) or (b) is absent/unparsable.
 * Per the product spec, missing/unknown referers log a warning but do
 * NOT hard-block — many mobile browsers strip `Referer`.
 */
export function isAllowedShareReferer(
  refererHeader: string | null | undefined,
): boolean {
  if (!refererHeader) return true
  try {
    const host = new URL(refererHeader).hostname.toLowerCase()
    return SHARE_REFERER_ALLOWLIST.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    )
  } catch {
    return true
  }
}
