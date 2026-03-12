import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { hasPermission } from '@/lib/rbac'
import { UserRole } from '@prisma/client'

const SUPER_ADMIN_EMAIL = 'jordolang@gmail.com'

/**
 * Check if a user has credential access via CredentialAccessGrant table
 * AND the RBAC permission system.
 *
 * Returns 'write' if user has credentials:write + active grant,
 * 'read' if user has credentials:read + active grant,
 * or null if no access.
 */
export async function checkCredentialAccess(
  email: string,
  role: UserRole
): Promise<'read' | 'write' | null> {
  // Check for a non-revoked grant
  const grant = await prisma.credentialAccessGrant.findUnique({
    where: { email },
  })

  if (!grant || grant.revokedAt !== null) {
    return null
  }

  // Check RBAC permissions
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
 * Check if an email belongs to the super admin
 */
export function isSuperAdmin(email: string): boolean {
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL
}

/**
 * Encrypt a credential password using AES-256-GCM via the master key.
 * Returns fields matching the ServiceCredential schema.
 * Note: encTag is empty because lib/crypto.ts embeds the auth tag in encValue.
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
 * Verify a user's password against their stored bcrypt hash.
 * Used for secondary authentication (e.g., password reveal).
 */
export async function verifyUserPassword(
  email: string,
  password: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { password: true },
  })

  if (!user?.password) {
    return false
  }

  return bcrypt.compare(password, user.password)
}
