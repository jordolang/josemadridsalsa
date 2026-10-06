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

/**
 * Resolved per-season rule values. Callers pass one of these into the pure
 * damage / shield / emote functions instead of reading the module-level
 * constants directly. A null/undefined `ResolvedRules` always means
 * "use the built-in defaults", which matches pre-Season behavior exactly.
 */
export type ResolvedRules = {
  shieldDurationMs: number
  shieldMaxHp: number
  maxConsecutiveShares: number
  critDamageThreshold: number
  bigPurchaseThreshold: number
}

export const DEFAULT_RULES: ResolvedRules = {
  shieldDurationMs: SHIELD_DURATION_MS,
  shieldMaxHp: SHIELD_MAX_HP,
  maxConsecutiveShares: MAX_CONSECUTIVE_SHARES,
  critDamageThreshold: CRIT_DAMAGE_THRESHOLD,
  bigPurchaseThreshold: BIG_PURCHASE_THRESHOLD,
}

/**
 * Merge a FundraiserSeason.rulesJson blob (unknown, possibly stale) onto the
 * defaults. Unrecognized keys are ignored; non-finite or non-positive numbers
 * fall back to the default. Safe to call with `null` / `undefined` / any
 * shape — used on the hot path so we don't throw on bad admin input.
 */
export function resolveRules(rulesJson: unknown): ResolvedRules {
  if (!rulesJson || typeof rulesJson !== 'object') return DEFAULT_RULES
  const src = rulesJson as Record<string, unknown>
  const pick = (key: string, fallback: number): number => {
    const v = src[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  return {
    shieldDurationMs: pick('shieldDurationMs', DEFAULT_RULES.shieldDurationMs),
    shieldMaxHp: pick('shieldMaxHp', DEFAULT_RULES.shieldMaxHp),
    maxConsecutiveShares: pick(
      'maxConsecutiveShares',
      DEFAULT_RULES.maxConsecutiveShares,
    ),
    critDamageThreshold: pick(
      'critDamageThreshold',
      DEFAULT_RULES.critDamageThreshold,
    ),
    bigPurchaseThreshold: pick(
      'bigPurchaseThreshold',
      DEFAULT_RULES.bigPurchaseThreshold,
    ),
  }
}

export type ShareCheckInput = {
  lastShareUserId: string | null
  consecutiveShares: number
  incomingUserId: string
  /** Optional per-season rule overrides; defaults to built-in constants. */
  rules?: ResolvedRules
}

export type ShareCheckResult =
  | { allowed: true; newConsecutive: number }
  | { allowed: false; reason: 'consecutive_limit' }

/**
 * Same user activating back-to-back shields is capped at
 * `rules.maxConsecutiveShares` (default MAX_CONSECUTIVE_SHARES). A different
 * user sharing resets the counter to 1.
 */
export function checkShareAllowed(input: ShareCheckInput): ShareCheckResult {
  const cap = (input.rules ?? DEFAULT_RULES).maxConsecutiveShares
  const next =
    input.lastShareUserId === input.incomingUserId
      ? input.consecutiveShares + 1
      : 1
  if (next > cap) {
    return { allowed: false, reason: 'consecutive_limit' }
  }
  return { allowed: true, newConsecutive: next }
}

/**
 * Deterministic shield activation payload.
 */
export function newShield(
  now: Date = new Date(),
  rules: ResolvedRules = DEFAULT_RULES,
): {
  activatedAt: Date
  expiresAt: Date
  remainingHP: number
} {
  return {
    activatedAt: now,
    expiresAt: new Date(now.getTime() + rules.shieldDurationMs),
    remainingHP: rules.shieldMaxHp,
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
 *   - big_purchase → sale ≥ `rules.bigPurchaseThreshold` (default $100)
 *   - crit         → damage landed ≥ `rules.critDamageThreshold` (default $50)
 *   - normal       → everything else
 */
export function classifyEmote(args: {
  saleAmount: number
  damageToHP: number
  shieldAbsorbed: number
  rules?: ResolvedRules
}): EmoteClass {
  const r = args.rules ?? DEFAULT_RULES
  if (args.shieldAbsorbed > 0 && args.damageToHP === 0) return 'blocked'
  if (args.saleAmount >= r.bigPurchaseThreshold) return 'big_purchase'
  if (args.damageToHP >= r.critDamageThreshold) return 'crit'
  return 'normal'
}
