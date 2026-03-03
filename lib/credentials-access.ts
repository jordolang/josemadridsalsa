import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'

const SUPER_ADMIN_EMAIL = 'jordolang@gmail.com'

export function isSuperAdmin(email: string): boolean {
  return email.toLowerCase() === SUPER_ADMIN_EMAIL
}

/**
 * Check if the current user has access to the credentials vault.
 * Access is granted to:
 *  1. The super admin (jordolang@gmail.com) — always
 *  2. Any user with an active CredentialAccessGrant row
 */
export async function hasCredentialAccess(email: string): Promise<boolean> {
  if (isSuperAdmin(email)) return true

  try {
    const grant = await prisma.credentialAccessGrant.findUnique({
      where: { email: email.toLowerCase() },
    })
    return !!grant && !grant.revokedAt
  } catch {
    return false
  }
}

/**
 * Require credential access — returns the user or null.
 */
export async function requireCredentialAccess() {
  const user = await getCurrentUser()
  if (!user) return null

  const allowed = await hasCredentialAccess(user.email)
  if (!allowed) return null

  return user
}

/**
 * Only jordolang@gmail.com can manage access grants.
 */
export async function requireGrantAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  if (!isSuperAdmin(user.email)) return null
  return user
}
