/**
 * Visual styling for user roles. Used by NavUser, the users list,
 * the user detail page, and anywhere else a role badge appears.
 *
 * Privileged roles (ADMIN, DEVELOPER) get higher-contrast variants;
 * external/customer roles get subdued outlines.
 */

import type { UserRole } from '@prisma/client'

export type RoleBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'

const ROLE_VARIANT: Record<UserRole, RoleBadgeVariant> = {
  ADMIN: 'destructive',
  DEVELOPER: 'default',
  STAFF: 'secondary',
  WHOLESALE: 'secondary',
  FUNDRAISER: 'secondary',
  CUSTOMER: 'outline',
}

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  STAFF: 'Staff',
  WHOLESALE: 'Wholesale',
  FUNDRAISER: 'Fundraiser',
  CUSTOMER: 'Customer',
}

export function getRoleBadgeVariant(role: string): RoleBadgeVariant {
  return ROLE_VARIANT[role as UserRole] ?? 'outline'
}

export function formatUserRole(role: string): string {
  return ROLE_LABEL[role as UserRole] ?? role
}
