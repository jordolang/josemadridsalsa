import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

/**
 * QuickBooks Online configuration and app-level OAuth credentials.
 *
 * Resolution order for the OAuth client (Client ID / Secret), mirroring the
 * social-provider pattern in `lib/social/credentials.ts`:
 *   1. Credentials entered in the admin panel (stored encrypted in the DB).
 *   2. Server environment variables (back-compat / power users).
 *
 * A non-developer can fully configure the connection from the admin UI without
 * ever touching env files, while existing env-based setups keep working.
 */

export type QuickBooksEnvironment = 'sandbox' | 'production'

export const QUICKBOOKS_ENVIRONMENTS: QuickBooksEnvironment[] = ['sandbox', 'production']

/** The single accounting scope; that's all we need for orders/customers/items. */
export const QUICKBOOKS_SCOPES = ['com.intuit.quickbooks.accounting']

/** OAuth endpoints — identical for sandbox and production. */
export const QUICKBOOKS_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'
export const QUICKBOOKS_TOKEN_URL =
  'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const QUICKBOOKS_REVOKE_URL =
  'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

/** The v3 API base differs by environment. */
export function getQuickBooksApiBaseUrl(environment: QuickBooksEnvironment): string {
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

/** OAuth redirect path — must match the value registered in the Intuit app. */
export const QUICKBOOKS_REDIRECT_PATH = '/api/integrations/quickbooks/callback'

/** Base URL of this app, reused from the same env var the social flow uses. */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return raw.trim().replace(/\/+$/, '')
}

export function getQuickBooksRedirectUri(): string {
  return `${getAppBaseUrl()}${QUICKBOOKS_REDIRECT_PATH}`
}

/**
 * The active environment. Admin-saved connections carry their own environment;
 * this is only the default used when starting a new connect flow.
 */
export function getDefaultEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

export type QuickBooksAppCredentials = {
  clientId: string
  clientSecret: string
  /** Where the values came from, for honest UI messaging. */
  source: 'admin' | 'env'
}

function envCredentials(): QuickBooksAppCredentials | null {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret, source: 'env' } : null
}

/**
 * Resolve usable OAuth client credentials for an environment, preferring
 * admin-entered values. Returns null when nothing is configured.
 */
export async function getQuickBooksAppCredentials(
  environment: QuickBooksEnvironment,
): Promise<QuickBooksAppCredentials | null> {
  try {
    const row = await prisma.quickBooksAppCredential.findUnique({ where: { environment } })
    if (row?.clientId && row.clientSecret && row.clientSecretIv) {
      try {
        const clientSecret = decryptSecret(row.clientSecret, row.clientSecretIv)
        return { clientId: row.clientId, clientSecret, source: 'admin' }
      } catch {
        // Stored secret can't be decrypted (e.g. MASTER_KEY changed) — fall
        // through to env so the app still has a chance to work.
      }
    }
  } catch {
    // Table may not exist yet (migration pending) — fall back to env.
  }

  return envCredentials()
}

export async function isQuickBooksConfigured(
  environment: QuickBooksEnvironment,
): Promise<boolean> {
  return (await getQuickBooksAppCredentials(environment)) !== null
}

/** Save/replace admin-entered OAuth client credentials (secret encrypted). */
export async function saveQuickBooksAppCredentials(params: {
  environment: QuickBooksEnvironment
  clientId: string
  clientSecret: string
  updatedById?: string
}) {
  const { encryptedValue, iv } = encryptSecret(params.clientSecret)
  return prisma.quickBooksAppCredential.upsert({
    where: { environment: params.environment },
    create: {
      environment: params.environment,
      clientId: params.clientId,
      clientSecret: encryptedValue,
      clientSecretIv: iv,
      updatedById: params.updatedById ?? null,
    },
    update: {
      clientId: params.clientId,
      clientSecret: encryptedValue,
      clientSecretIv: iv,
      updatedById: params.updatedById ?? null,
    },
  })
}

/** Remove admin-entered credentials (env fallback still applies). */
export async function deleteQuickBooksAppCredentials(environment: QuickBooksEnvironment) {
  return prisma.quickBooksAppCredential.deleteMany({ where: { environment } })
}
