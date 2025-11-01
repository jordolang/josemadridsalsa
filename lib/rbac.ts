import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type { UserRole }

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
 * Check if user is an admin
 */
export function isAdmin(user: { role: UserRole } | null): boolean {
  return hasRole(user, [UserRole.ADMIN])
}

/**
 * Check if user is staff or higher (ADMIN, DEVELOPER, STAFF)
 */
export function isStaff(user: { role: UserRole } | null): boolean {
  return hasRole(user, [UserRole.ADMIN, UserRole.DEVELOPER, UserRole.STAFF])
}

/**
 * Check if user has a specific permission
 * @param user - User with role
 * @param permissionName - Permission name (e.g., "orders:read", "products:write")
 */
export async function hasPermission(
  user: { role: UserRole } | null,
  permissionName: string
): Promise<boolean> {
  if (!user) return false

  // Check if permission exists for this role
  const rolePermission = await prisma.rolePermission.findFirst({
    where: {
      role: user.role,
      permission: {
        name: permissionName,
      },
    },
  })

  return !!rolePermission
}

/**
 * Check if user has all specified permissions
 */
export async function hasAllPermissions(
  user: { role: UserRole } | null,
  permissionNames: string[]
): Promise<boolean> {
  if (!user) return false

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

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: user.role },
    include: { permission: true },
  })

  return rolePermissions.map((rp) => rp.permission.name)
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
