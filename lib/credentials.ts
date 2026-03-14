import crypto from 'crypto'

import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { hasPermission } from '@/lib/rbac'
import { UserRole } from '@prisma/client'

const SUPER_ADMIN_EMAIL = 'jordolang@gmail.com'

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
}

/**
 * Get the granular permissions for a user's credential access grant.
 */
export async function getGrantPermissions(
  email: string
): Promise<CredentialGrantPermissions | null> {
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
