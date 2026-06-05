import type { SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

/**
 * "Easy mode" — post through Ayrshare instead of registering a developer app
 * with every platform. Ayrshare has done the Facebook/TikTok/X/Google app work
 * already; the owner signs up free, click-connects their accounts on Ayrshare's
 * hosted page (no developer consoles), and pastes ONE API key into the admin
 * panel. After that, connecting and posting are genuinely one-click and free
 * for a single business profile.
 *
 * The key is stored in the same encrypted credential table under the reserved
 * provider name 'ayrshare' (a plain string column, so it doesn't need to be
 * part of the per-platform SocialProvider union).
 */

const AYRSHARE_PROVIDER = 'ayrshare'
const BASE_URL = 'https://api.ayrshare.com/api'

/** Map our internal platform enum to Ayrshare's platform identifiers. */
export function toAyrsharePlatform(platform: SocialMediaPlatform): string {
  switch (platform) {
    case 'FACEBOOK':
      return 'facebook'
    case 'INSTAGRAM':
      return 'instagram'
    case 'TWITTER':
      return 'twitter'
    case 'TIKTOK':
      return 'tiktok'
    case 'GOOGLE_MY_BUSINESS':
      return 'gmb'
  }
}

export async function getAyrshareApiKey(): Promise<string | null> {
  try {
    const row = await prisma.socialPlatformCredential.findUnique({
      where: { provider: AYRSHARE_PROVIDER },
    })
    if (row?.clientSecret && row.clientSecretIv) {
      try {
        return decryptSecret(row.clientSecret, row.clientSecretIv)
      } catch {
        // Can't decrypt (e.g. ENCRYPTION_KEY changed) — fall through to env.
      }
    }
  } catch {
    // Table may not exist yet — fall back to env.
  }
  return process.env.AYRSHARE_API_KEY || null
}

export async function isAyrshareConfigured(): Promise<boolean> {
  return (await getAyrshareApiKey()) !== null
}

export async function saveAyrshareApiKey(apiKey: string, updatedById?: string) {
  const { encryptedValue, iv } = encryptSecret(apiKey)
  return prisma.socialPlatformCredential.upsert({
    where: { provider: AYRSHARE_PROVIDER },
    create: {
      provider: AYRSHARE_PROVIDER,
      clientId: 'ayrshare',
      clientSecret: encryptedValue,
      clientSecretIv: iv,
      updatedById: updatedById ?? null,
    },
    update: {
      clientId: 'ayrshare',
      clientSecret: encryptedValue,
      clientSecretIv: iv,
      updatedById: updatedById ?? null,
    },
  })
}

export async function deleteAyrshareApiKey() {
  return prisma.socialPlatformCredential.deleteMany({ where: { provider: AYRSHARE_PROVIDER } })
}

export type AyrshareStatus = {
  configured: boolean
  /** Ayrshare platform ids the owner has linked, e.g. ['facebook','instagram']. */
  linkedAccounts: string[]
  /** Set when the key is present but Ayrshare rejected it. */
  error?: string
}

/** Read which accounts the owner has linked on Ayrshare (shown in the panel). */
export async function getAyrshareStatus(): Promise<AyrshareStatus> {
  const key = await getAyrshareApiKey()
  if (!key) return { configured: false, linkedAccounts: [] }

  try {
    const res = await fetch(`${BASE_URL}/user`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      return { configured: true, linkedAccounts: [], error: data?.message || 'Could not reach Ayrshare with this key.' }
    }
    return { configured: true, linkedAccounts: data.activeSocialAccounts ?? [] }
  } catch {
    return { configured: true, linkedAccounts: [], error: 'Could not reach Ayrshare.' }
  }
}

export type AyrsharePostResult = {
  success: boolean
  id?: string
  postUrls?: Array<{ platform: string; postUrl?: string }>
  error?: string
}

/** Publish (or schedule) a post through Ayrshare to the given platforms. */
export async function postViaAyrshare(params: {
  post: string
  platforms: SocialMediaPlatform[]
  mediaUrls?: string[]
  scheduleDate?: Date
}): Promise<AyrsharePostResult> {
  const key = await getAyrshareApiKey()
  if (!key) return { success: false, error: 'Ayrshare is not configured.' }

  const platforms = params.platforms.map(toAyrsharePlatform)

  const body: Record<string, unknown> = { post: params.post, platforms }
  if (params.mediaUrls?.length) body.mediaUrls = params.mediaUrls
  if (params.scheduleDate) body.scheduleDate = params.scheduleDate.toISOString()

  try {
    const res = await fetch(`${BASE_URL}/post`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data || data.status === 'error') {
      const msg =
        data?.errors?.[0]?.message || data?.message || `Ayrshare post failed (HTTP ${res.status}).`
      return { success: false, error: msg }
    }
    return { success: true, id: data.id, postUrls: data.postIds }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ayrshare request failed.' }
  }
}
