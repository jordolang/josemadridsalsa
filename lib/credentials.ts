import crypto from 'crypto'

import { prisma } from '@/lib/prisma'
import { Prisma, UserRole } from '@prisma/client'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { hasPermission } from '@/lib/rbac'

const SUPER_ADMIN_EMAIL = 'jordolang@gmail.com'

/**
 * Detect Prisma P2021 "missing table" errors.
 * Also handles Prisma Accelerate-wrapped errors which may not expose the code
 * directly but still reference P2021 in the message.
 */
export function isMissingTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
    return true
  }
  // Accelerate wraps errors — check message string as fallback
  if (error instanceof Error) {
    return (
      error.message.includes('P2021') ||
      error.message.includes('does not exist in the current database') ||
      error.message.toLowerCase().includes('missing table') ||
      error.message.toLowerCase().includes('relation') && error.message.toLowerCase().includes('does not exist')
    )
  }
  return false
}

export interface CredentialGrantPermissions {
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
  canUpload: boolean
}

/**
 * Check if a user has credential access via CredentialAccessGrant table
 * AND the RBAC permission system.
 *
 * Returns the grant permissions or null if no access.
 */
export async function checkCredentialAccess(
  email: string,
  role: UserRole
): Promise<'read' | 'write' | null> {
  try {
    const grant = await prisma.credentialAccessGrant.findUnique({
      where: { email },
    })

    if (!grant || grant.revokedAt !== null) {
      return null
    }

    const user = { role }

    if (await hasPermission(user, 'credentials:write')) {
      return 'write'
    }

    if (await hasPermission(user, 'credentials:read')) {
      return 'read'
    }

    return null
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[Credentials] credential_access_grants table missing. Run prisma migrate deploy.')
      return null
    }
    // Unexpected error — fail closed (no access) to avoid leaking data
    console.error('[Credentials] checkCredentialAccess error:', error)
    return null
  }
}

/**
 * Get the granular permissions for a user's credential access grant.
 */
export async function getGrantPermissions(
  email: string
): Promise<CredentialGrantPermissions | null> {
  try {
    const grant = await prisma.credentialAccessGrant.findUnique({
      where: { email },
    })

    if (!grant || grant.revokedAt !== null) {
      return null
    }

    return {
      canView: grant.canView,
      canAdd: grant.canAdd,
      canEdit: grant.canEdit,
      canDelete: grant.canDelete,
      canUpload: grant.canUpload,
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[Credentials] credential_access_grants table missing. Run prisma migrate deploy.')
      return null
    }
    console.error('[Credentials] getGrantPermissions error:', error)
    return null
  }
}

/**
 * Check if an email belongs to the super admin.
 */
export function isSuperAdmin(email: string): boolean {
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL
}

/**
 * Encrypt a credential password using AES-256-GCM via the master key.
 */
export function encryptCredentialPassword(plaintext: string): {
  encValue: string
  encIv: string
  encTag: string
} {
  const { encryptedValue, iv } = encryptSecret(plaintext)
  return {
    encValue: encryptedValue,
    encIv: iv,
    encTag: '',
  }
}

/**
 * Decrypt a credential password using AES-256-GCM via the master key.
 */
export function decryptCredentialPassword(encValue: string, encIv: string): string {
  return decryptSecret(encValue, encIv)
}

/**
 * Generate a random alphanumeric password of specified length (12-15 characters).
 */
export function generatePassword(length: number = 14): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const clampedLength = Math.max(12, Math.min(15, length))
  const bytes = crypto.randomBytes(clampedLength)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

/**
 * Check a password against the HaveIBeenPwned Passwords API using k-anonymity.
 * Returns the number of times the password has been seen in breaches (0 = safe).
 */
export async function checkPasswordBreach(plaintext: string): Promise<number> {
  const sha1 = crypto.createHash('sha1').update(plaintext).digest('hex').toUpperCase()
  const prefix = sha1.substring(0, 5)
  const suffix = sha1.substring(5)

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'User-Agent': 'JoseMadridSalsa-CredentialVault' },
  })

  if (!response.ok) {
    throw new Error(`HIBP API returned ${response.status}`)
  }

  const text = await response.text()
  const lines = text.split('\n')

  for (const line of lines) {
    const [hashSuffix, count] = line.trim().split(':')
    if (hashSuffix === suffix) {
      return parseInt(count, 10)
    }
  }

  return 0
}
