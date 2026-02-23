import { prisma } from '@/lib/prisma'
import { fallbackPermissionsFor } from '@/lib/permissions-data'
import { Prisma, UserRole } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type { UserRole }

/**
 * Determine if we should fall back to the default permission map.
 * Prisma throws P2021 when a backing table has not been created yet.
 */
function shouldFallbackToDefaultPermissions(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function fallbackHasPermission(role: UserRole, permissionName: string): boolean {
  return fallbackPermissionsFor(role).includes(permissionName)
}

/**
 * Get the current user's session with role information
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return null
  }

  return {
    id: (session.user as any).id as string,
    email: session.user.email as string,
    name: session.user.name as string | null,
    role: (session.user as any).role as UserRole,
  }
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(
  user: { role: UserRole } | null,
  allowedRoles: UserRole[]
): boolean {
  if (!user) return false
  return allowedRoles.includes(user.role)
}

/**
 * Check if user is the OWNER (super admin)
 */
export function isOwner(user: { role: UserRole } | null): boolean {
  return hasRole(user, [UserRole.OWNER])
}

/**
 * Check if user is an admin (includes OWNER)
 */
export function isAdmin(user: { role: UserRole } | null): boolean {
  return hasRole(user, [UserRole.OWNER, UserRole.ADMIN])
}

/**
 * Check if user is staff or higher (OWNER, ADMIN, DEVELOPER, STAFF)
 */
export function isStaff(user: { role: UserRole } | null): boolean {
  return hasRole(user, [UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, UserRole.STAFF])
}

/**
 * Check if user has a specific permission
 * OWNER role bypasses all permission checks (super admin).
 * @param user - User with role
 * @param permissionName - Permission name (e.g., "orders:read", "products:write")
 */
export async function hasPermission(
  user: { role: UserRole } | null,
  permissionName: string
): Promise<boolean> {
  if (!user) return false

  // OWNER bypasses all permission checks
  if (user.role === UserRole.OWNER) return true

  try {
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: user.role,
        permission: {
          name: permissionName,
        },
      },
    })

    if (rolePermission) {
      return true
    }

    // If no DB record exists for a staff role, fall back to defaults so admins don't lose access
    if (fallbackHasPermission(user.role, permissionName)) {
      console.warn(
        `[RBAC] No persisted permission "${permissionName}" for role ${user.role}. Falling back to default map.`
      )
      return true
    }

    return false
  } catch (error) {
    if (shouldFallbackToDefaultPermissions(error)) {
      console.warn(
        `[RBAC] Permission tables are missing in the database. Using fallback permissions for role ${user.role}.`
      )
      return fallbackHasPermission(user.role, permissionName)
    }

    console.error('[RBAC] Error checking permission:', error)
    return false
  }
}

/**
 * Check if user has all specified permissions
 */
export async function hasAllPermissions(
  user: { role: UserRole } | null,
  permissionNames: string[]
): Promise<boolean> {
  if (!user) return false

  // OWNER bypasses all permission checks
  if (user.role === UserRole.OWNER) return true

  const checks = await Promise.all(
    permissionNames.map((name) => hasPermission(user, name))
  )

  return checks.every((check) => check)
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  user: { role: UserRole } | null,
  permissionNames: string[]
): Promise<boolean> {
  if (!user) return false

  // OWNER bypasses all permission checks
  if (user.role === UserRole.OWNER) return true

  const checks = await Promise.all(
    permissionNames.map((name) => hasPermission(user, name))
  )

  return checks.some((check) => check)
}

/**
 * Get all permissions for a user's role
 */
export async function getUserPermissions(
  user: { role: UserRole } | null
): Promise<string[]> {
  if (!user) return []

  // OWNER gets all permissions
  if (user.role === UserRole.OWNER) {
    return fallbackPermissionsFor(UserRole.OWNER)
  }

  try {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
      include: { permission: true },
    })

    if (rolePermissions.length === 0) {
      const fallback = fallbackPermissionsFor(user.role)
      if (fallback.length > 0) {
        console.warn(
          `[RBAC] No stored permissions found for role ${user.role}. Using fallback defaults.`
        )
      }
      return fallback
    }

    return rolePermissions.map((rp) => rp.permission.name)
  } catch (error) {
    console.error('[RBAC] Error fetching user permissions:', error)
    const fallback = fallbackPermissionsFor(user.role)
    if (fallback.length > 0) {
      console.warn(
        `[RBAC] Returning fallback permissions for role ${user.role} due to database error.`
      )
    }
    return fallback
  }
}

/**
 * Require specific roles - throws if user doesn't have role
 * Use in API routes and server actions
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized - not authenticated')
  }

  if (!hasRole(user, allowedRoles)) {
    throw new Error(
      `Forbidden - requires one of: ${allowedRoles.join(', ')}`
    )
  }

  return user
}

/**
 * Require specific permission - throws if user doesn't have it
 */
export async function requirePermission(permissionName: string) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized - not authenticated')
  }

  const hasPerm = await hasPermission(user, permissionName)

  if (!hasPerm) {
    throw new Error(`Forbidden - requires permission: ${permissionName}`)
  }

  return user
}

/**
 * Require any of the specified permissions
 */
export async function requireAnyPermission(permissionNames: string[]) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized - not authenticated')
  }

  const hasPerm = await hasAnyPermission(user, permissionNames)

  if (!hasPerm) {
    throw new Error(
      `Forbidden - requires one of: ${permissionNames.join(', ')}`
    )
  }

  return user
}

/**
 * Require OWNER role specifically (for super admin actions)
 */
export async function requireOwner() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized - not authenticated')
  }

  if (!isOwner(user)) {
    throw new Error('Forbidden - OWNER access required')
  }

  return user
}

/**
 * Check if user can access admin panel
 */
export async function canAccessAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return isStaff(user)
}

/**
 * Require admin panel access
 */
export async function requireAdminAccess() {
  const user = await getCurrentUser()

  if (!isStaff(user)) {
    throw new Error('Forbidden - admin access required')
  }

  return user
}
