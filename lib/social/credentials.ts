import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

/**
 * App-level OAuth credentials per social provider.
 *
 * Resolution order:
 *   1. Credentials entered in the admin panel (stored encrypted in the DB).
 *   2. Server environment variables (back-compat / power users).
 *
 * This lets a non-developer fully configure publishing from the admin UI
 * without ever touching env files, while existing env-based setups keep working.
 *
 * Providers: 'facebook' covers both Facebook and Instagram (one Meta app),
 * 'twitter' (X), 'tiktok', and 'google' (Google Business).
 */

export type SocialProvider = 'facebook' | 'twitter' | 'tiktok' | 'google'

export const SOCIAL_PROVIDERS: SocialProvider[] = ['facebook', 'twitter', 'tiktok', 'google']

export type ProviderCredentials = {
  clientId: string
  clientSecret: string
  /** Where the values came from, for honest UI messaging. */
  source: 'admin' | 'env'
}

function envCredentials(provider: SocialProvider): ProviderCredentials | null {
  switch (provider) {
    case 'facebook': {
      const clientId = process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_CLIENT_ID
      const clientSecret = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET
      return clientId && clientSecret ? { clientId, clientSecret, source: 'env' } : null
    }
    case 'twitter': {
      const clientId = process.env.TWITTER_CLIENT_ID
      const clientSecret = process.env.TWITTER_CLIENT_SECRET
      return clientId && clientSecret ? { clientId, clientSecret, source: 'env' } : null
    }
    case 'tiktok': {
      const clientId = process.env.TIKTOK_CLIENT_KEY
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET
      return clientId && clientSecret ? { clientId, clientSecret, source: 'env' } : null
    }
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET
      return clientId && clientSecret ? { clientId, clientSecret, source: 'env' } : null
    }
  }
}

/**
 * Resolve usable credentials for a provider, preferring admin-entered values.
 * Returns null when the provider isn't configured anywhere.
 */
export async function getProviderCredentials(
  provider: SocialProvider,
): Promise<ProviderCredentials | null> {
  try {
    const row = await prisma.socialPlatformCredential.findUnique({ where: { provider } })
    if (row?.clientId && row.clientSecret && row.clientSecretIv) {
      try {
        const clientSecret = decryptSecret(row.clientSecret, row.clientSecretIv)
        return { clientId: row.clientId, clientSecret, source: 'admin' }
      } catch {
        // Stored secret can't be decrypted (e.g. ENCRYPTION_KEY changed) —
        // fall through to env so the app still has a chance to work.
      }
    }
  } catch {
    // Table may not exist yet (migration pending) — fall back to env.
  }

  return envCredentials(provider)
}

/** True when this provider has usable credentials from either source. */
export async function isProviderConfigured(provider: SocialProvider): Promise<boolean> {
  return (await getProviderCredentials(provider)) !== null
}

/** Save/replace admin-entered credentials for a provider (secret encrypted). */
export async function saveProviderCredentials(params: {
  provider: SocialProvider
  clientId: string
  clientSecret: string
  updatedById?: string
}) {
  const { encryptedValue, iv } = encryptSecret(params.clientSecret)
  return prisma.socialPlatformCredential.upsert({
    where: { provider: params.provider },
    create: {
      provider: params.provider,
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

/** Remove admin-entered credentials for a provider (env fallback still applies). */
export async function deleteProviderCredentials(provider: SocialProvider) {
  return prisma.socialPlatformCredential.deleteMany({ where: { provider } })
}
