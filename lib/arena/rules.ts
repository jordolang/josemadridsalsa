/**
 * Pure game rules for the fundraiser battle arena.
 *
 * Every export is a pure function operating on plain data — no Prisma types,
 * no I/O. All DB writes happen in the API route layer, which consumes these
 * results inside a transaction.
 */

export const SHIELD_DURATION_MS = 30 * 60 * 1000
export const SHIELD_MAX_HP = 30
export const MAX_CONSECUTIVE_SHARES = 2
export const CRIT_DAMAGE_THRESHOLD = 50
export const BIG_PURCHASE_THRESHOLD = 100

export type ShareCheckInput = {
  lastShareUserId: string | null
  consecutiveShares: number
  incomingUserId: string
}

export type ShareCheckResult =
  | { allowed: true; newConsecutive: number }
  | { allowed: false; reason: 'consecutive_limit' }

/**
 * Same user activating back-to-back shields is capped at MAX_CONSECUTIVE_SHARES.
 * A different user sharing resets the counter to 1.
 */
export function checkShareAllowed(input: ShareCheckInput): ShareCheckResult {
  const next =
    input.lastShareUserId === input.incomingUserId
      ? input.consecutiveShares + 1
      : 1
  if (next > MAX_CONSECUTIVE_SHARES) {
    return { allowed: false, reason: 'consecutive_limit' }
  }
  return { allowed: true, newConsecutive: next }
}

/**
 * Deterministic shield activation payload.
 */
export function newShield(now: Date = new Date()): {
  activatedAt: Date
  expiresAt: Date
  remainingHP: number
} {
  return {
    activatedAt: now,
    expiresAt: new Date(now.getTime() + SHIELD_DURATION_MS),
    remainingHP: SHIELD_MAX_HP,
  }
}

export type ShieldState = {
  expiresAt: Date
  remainingHP: number
}

export type DamageInput = {
  saleAmount: number
  targetShield: ShieldState | null
  now?: Date
}

export type DamageResult = {
  damageToHP: number
  shieldAbsorbed: number
  shieldRemaining: number | null
}

/**
 * A sale against an opposing team deals `saleAmount` damage.
 * If the opponent has an active shield, it absorbs up to its remaining HP;
 * any overflow hits team HP.
 *
 *   - shield expired / null    → full damage hits HP
 *   - shield with N remaining  → min(N, saleAmount) absorbed, rest overflows
 */
export function computeDamage(input: DamageInput): DamageResult {
  const now = input.now ?? new Date()
  const amount = Math.max(0, Math.floor(input.saleAmount))
  const shieldActive =
    input.targetShield &&
    input.targetShield.expiresAt.getTime() > now.getTime() &&
    input.targetShield.remainingHP > 0

  if (!shieldActive || !input.targetShield) {
    return {
      damageToHP: amount,
      shieldAbsorbed: 0,
      shieldRemaining: input.targetShield?.remainingHP ?? null,
    }
  }

  const shieldAbsorbed = Math.min(input.targetShield.remainingHP, amount)
  return {
    damageToHP: amount - shieldAbsorbed,
    shieldAbsorbed,
    shieldRemaining: input.targetShield.remainingHP - shieldAbsorbed,
  }
}

/**
 * HP floors at zero — a team can't go negative even on massive purchases.
 */
export function applyDamage(currentHP: number, damage: number): number {
  return Math.max(0, currentHP - Math.max(0, damage))
}

export type EmoteClass = 'crit' | 'big_purchase' | 'normal' | 'blocked'

/**
 * Picks the emote tier for an emitted event.
 *   - blocked      → shield absorbed the full hit
 *   - big_purchase → $100+ sale
 *   - crit         → $50+ landed on HP
 *   - normal       → everything else
 */
export function classifyEmote(args: {
  saleAmount: number
  damageToHP: number
  shieldAbsorbed: number
}): EmoteClass {
  if (args.shieldAbsorbed > 0 && args.damageToHP === 0) return 'blocked'
  if (args.saleAmount >= BIG_PURCHASE_THRESHOLD) return 'big_purchase'
  if (args.damageToHP >= CRIT_DAMAGE_THRESHOLD) return 'crit'
  return 'normal'
}
