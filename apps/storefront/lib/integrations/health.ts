import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { getPlatformConfigStatus } from '@/lib/social/config'

/**
 * Live integration health.
 *
 * The point of this module is HONESTY: instead of showing "Active" for any
 * service that merely has a key saved, each probe actually talks to the
 * service (where a safe check exists) and reports whether it is genuinely
 * working right now. Services with no safe automated probe are reported as
 * "configured but not health-checked" — never a fake green.
 */

export type HealthStatus =
  | 'healthy' // configured AND a live check confirms it works
  | 'failing' // configured but the live check failed
  | 'unchecked' // configured, but no automated probe / nothing to verify yet
  | 'unconfigured' // no credentials present

export type ServiceHealth = {
  key: string
  label: string
  category: string
  configured: boolean
  status: HealthStatus
  detail: string
  checkedAt: string
}

const TIMEOUT_MS = 8000

/** Resolve a promise, or reject after a fixed timeout so a probe can't hang the panel. */
function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms)),
  ])
}

const now = () => new Date().toISOString()
const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

async function checkDatabase(): Promise<ServiceHealth> {
  const base = { key: 'database', label: 'Database', category: 'Core', configured: true, checkedAt: now() }
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`)
    return { ...base, status: 'healthy', detail: 'Connected and responding.' }
  } catch (e) {
    return { ...base, status: 'failing', detail: msg(e, 'Database query failed.') }
  }
}

async function checkStripe(): Promise<ServiceHealth> {
  const base = { key: 'stripe', label: 'Stripe (payments)', category: 'Payments', checkedAt: now() }
  const configured = Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET)
  if (!configured) {
    return { ...base, configured: false, status: 'unconfigured', detail: 'No STRIPE_SECRET_KEY set.' }
  }
  try {
    const balance = await withTimeout(getStripe().balance.retrieve())
    return {
      ...base,
      configured: true,
      status: 'healthy',
      detail: `Key valid — Stripe reachable (${balance.livemode ? 'live' : 'test'} mode).`,
    }
  } catch (e) {
    return { ...base, configured: true, status: 'failing', detail: msg(e, 'Stripe rejected the key.') }
  }
}

async function checkEmail(): Promise<ServiceHealth> {
  const base = { key: 'email', label: 'Email (Resend)', category: 'Email', checkedAt: now() }
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { ...base, configured: false, status: 'unconfigured', detail: 'No RESEND_API_KEY set.' }
  }
  try {
    const res = await withTimeout(
      fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } }),
    )
    if (res.ok) {
      return { ...base, configured: true, status: 'healthy', detail: 'Key valid — Resend reachable.' }
    }
    return { ...base, configured: true, status: 'failing', detail: `Resend rejected the key (HTTP ${res.status}).` }
  } catch (e) {
    return { ...base, configured: true, status: 'failing', detail: msg(e, 'Could not reach Resend.') }
  }
}

async function checkSocialAccounts(): Promise<ServiceHealth> {
  const base = { key: 'social_oauth', label: 'Social accounts (direct OAuth)', category: 'Social', checkedAt: now() }
  try {
    const [accounts, platformConfig] = await Promise.all([
      prisma.socialAccount.findMany({
        where: { isActive: true },
        select: { accountName: true, tokenExpiresAt: true, connectionError: true },
      }),
      getPlatformConfigStatus(),
    ])
    const configuredCount = platformConfig.filter((p) => p.configured).length

    if (accounts.length === 0) {
      if (configuredCount === 0) {
        return { ...base, configured: false, status: 'unconfigured', detail: 'No platform keys set and no accounts connected.' }
      }
      return {
        ...base,
        configured: true,
        status: 'unchecked',
        detail: `${configuredCount} platform${configuredCount === 1 ? ' has' : 's have'} keys, but no account is connected yet.`,
      }
    }

    const broken = accounts.filter(
      (a) => a.connectionError || (a.tokenExpiresAt && a.tokenExpiresAt < new Date()),
    )
    if (broken.length > 0) {
      return {
        ...base,
        configured: true,
        status: 'failing',
        detail: `${broken.length} of ${accounts.length} connected account${accounts.length === 1 ? '' : 's'} need attention: ${broken.map((b) => b.accountName).join(', ')}.`,
      }
    }
    return {
      ...base,
      configured: true,
      status: 'healthy',
      detail: `${accounts.length} account${accounts.length === 1 ? '' : 's'} connected with valid tokens.`,
    }
  } catch (e) {
    return { ...base, configured: false, status: 'failing', detail: msg(e, 'Could not read social accounts.') }
  }
}

// Any admin-entered ServiceKey rows we don't have a dedicated probe for are
// surfaced honestly as "configured, not health-checked" rather than implied OK.
async function checkOtherServiceKeys(): Promise<ServiceHealth[]> {
  const covered = new Set(['stripe', 'resend', 'email'])
  try {
    const rows = await prisma.serviceKey.findMany({
      orderBy: [{ serviceName: 'asc' }, { keyName: 'asc' }],
    })
    return rows
      .filter((r) => !covered.has(r.serviceName))
      .map((r) => ({
        key: `servicekey:${r.serviceName}:${r.keyName}`,
        label: `${r.serviceName} · ${r.keyName}`,
        category: 'Other',
        configured: r.isActive && Boolean(r.encryptedValue),
        status: (r.isActive ? 'unchecked' : 'unconfigured') as HealthStatus,
        detail: r.isActive
          ? `Stored and enabled${r.lastUsed ? `, last used ${r.lastUsed.toLocaleString()}` : ' (never used yet)'} — no automated health probe for this service.`
          : 'Disabled.',
        checkedAt: now(),
      }))
  } catch {
    return []
  }
}

/** Run every probe in parallel and return the combined, ordered list. */
export async function getIntegrationHealth(): Promise<ServiceHealth[]> {
  const [core, stripe, email, social, others] = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkEmail(),
    checkSocialAccounts(),
    checkOtherServiceKeys(),
  ])
  return [core, stripe, email, social, ...others]
}
