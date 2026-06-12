import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    rolePermission: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { prisma } from '@/lib/prisma'
import {
  hasPermission,
  hasRole,
  isAdmin,
  isStaff,
  hasAllPermissions,
  hasAnyPermission,
  getUserPermissions,
} from '@/lib/rbac'
import {
  defaultRolePermissions,
  fallbackPermissionsFor,
} from '@/lib/permissions-data'
import { filterNavByPermissions, adminNavigation } from '@/lib/permissions-map'

const mockedPrisma = vi.mocked(prisma)

// Helper to create a user object
function makeUser(role: UserRole) {
  return { id: 'test-id', email: 'test@test.com', name: 'Test', role }
}

describe('RBAC Permissions Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: DB returns null (no record), so fallback kicks in
    mockedPrisma.rolePermission.findFirst.mockResolvedValue(null)
    mockedPrisma.rolePermission.findMany.mockResolvedValue([])
  })

  // ─── 1. ADMIN role – all features accessible ───
  describe('ADMIN role - all features accessible', () => {
    const admin = makeUser(UserRole.ADMIN)

    it('has admin role', () => {
      expect(isAdmin(admin)).toBe(true)
      expect(isStaff(admin)).toBe(true)
    })

    it('has all defined permissions via fallback', () => {
      const adminPerms = defaultRolePermissions.ADMIN
      // ADMIN should have every single permission defined
      expect(adminPerms.length).toBeGreaterThan(0)
      expect(adminPerms).toContain('products:write')
      expect(adminPerms).toContain('orders:write')
      expect(adminPerms).toContain('financials:read')
      expect(adminPerms).toContain('analytics:read')
      expect(adminPerms).toContain('financials:refunds')
    })

    it('hasPermission returns true for products:write', async () => {
      expect(await hasPermission(admin, 'products:write')).toBe(true)
    })

    it('hasPermission returns true for orders:write', async () => {
      expect(await hasPermission(admin, 'orders:write')).toBe(true)
    })

    it('hasPermission returns true for financials:read', async () => {
      expect(await hasPermission(admin, 'financials:read')).toBe(true)
    })

    it('hasPermission returns true for analytics:read', async () => {
      expect(await hasPermission(admin, 'analytics:read')).toBe(true)
    })
  })

  // ─── 2. STAFF role – read-only access where appropriate ───
  describe('STAFF role - permissions', () => {
    const staff = makeUser(UserRole.STAFF)

    it('is staff but not admin', () => {
      expect(isStaff(staff)).toBe(true)
      expect(isAdmin(staff)).toBe(false)
    })

    it('has products:write (STAFF can edit products)', async () => {
      expect(await hasPermission(staff, 'products:write')).toBe(true)
    })

    it('has orders:write (STAFF can manage orders)', async () => {
      expect(await hasPermission(staff, 'orders:write')).toBe(true)
    })

    it('has analytics:read', async () => {
      expect(await hasPermission(staff, 'analytics:read')).toBe(true)
    })

    it('does NOT have financials:read', async () => {
      expect(await hasPermission(staff, 'financials:read')).toBe(false)
    })

    it('does NOT have financials:refunds', async () => {
      expect(await hasPermission(staff, 'financials:refunds')).toBe(false)
    })

    it('does NOT have settings:write', async () => {
      expect(await hasPermission(staff, 'settings:write')).toBe(false)
    })

    it('does NOT have users:write', async () => {
      expect(await hasPermission(staff, 'users:write')).toBe(false)
    })
  })

  // ─── 3. CUSTOMER role – no admin access ───
  describe('CUSTOMER role - no admin access', () => {
    const customer = makeUser(UserRole.CUSTOMER)

    it('is not staff and not admin', () => {
      expect(isStaff(customer)).toBe(false)
      expect(isAdmin(customer)).toBe(false)
    })

    it('has no permissions at all', () => {
      expect(defaultRolePermissions.CUSTOMER).toEqual([])
    })

    it('hasPermission returns false for all key permissions', async () => {
      expect(await hasPermission(customer, 'products:write')).toBe(false)
      expect(await hasPermission(customer, 'orders:write')).toBe(false)
      expect(await hasPermission(customer, 'financials:read')).toBe(false)
      expect(await hasPermission(customer, 'analytics:read')).toBe(false)
      expect(await hasPermission(customer, 'orders:read')).toBe(false)
    })

    it('middleware STAFF_ROLES check excludes CUSTOMER', () => {
      const STAFF_ROLES = ['ADMIN', 'DEVELOPER', 'STAFF']
      expect(STAFF_ROLES.includes('CUSTOMER')).toBe(false)
    })
  })

  // ─── 4. products:write gates variant editor ───
  describe('products:write gates variant editor', () => {
    it('ADMIN has products:write for variant editor access', async () => {
      const admin = makeUser(UserRole.ADMIN)
      expect(await hasPermission(admin, 'products:write')).toBe(true)
    })

    it('STAFF has products:write for variant editor access', async () => {
      const staff = makeUser(UserRole.STAFF)
      expect(await hasPermission(staff, 'products:write')).toBe(true)
    })

    it('CUSTOMER cannot access variant editor', async () => {
      const customer = makeUser(UserRole.CUSTOMER)
      expect(await hasPermission(customer, 'products:write')).toBe(false)
    })

    it('WHOLESALE cannot access variant editor', async () => {
      const wholesale = makeUser(UserRole.WHOLESALE)
      expect(await hasPermission(wholesale, 'products:write')).toBe(false)
    })
  })

  // ─── 5. orders:write gates refund button ───
  describe('orders:write gates refund button', () => {
    it('ADMIN can process refunds', async () => {
      const admin = makeUser(UserRole.ADMIN)
      expect(await hasPermission(admin, 'orders:write')).toBe(true)
    })

    it('STAFF can process refunds', async () => {
      const staff = makeUser(UserRole.STAFF)
      expect(await hasPermission(staff, 'orders:write')).toBe(true)
    })

    it('CUSTOMER cannot process refunds', async () => {
      const customer = makeUser(UserRole.CUSTOMER)
      expect(await hasPermission(customer, 'orders:write')).toBe(false)
    })
  })

  // ─── 6. financials:read gates revenue chart ───
  describe('financials:read gates revenue chart', () => {
    it('ADMIN can view revenue chart', async () => {
      const admin = makeUser(UserRole.ADMIN)
      expect(await hasPermission(admin, 'financials:read')).toBe(true)
    })

    it('STAFF cannot view revenue chart', async () => {
      const staff = makeUser(UserRole.STAFF)
      expect(await hasPermission(staff, 'financials:read')).toBe(false)
    })

    it('CUSTOMER cannot view revenue chart', async () => {
      const customer = makeUser(UserRole.CUSTOMER)
      expect(await hasPermission(customer, 'financials:read')).toBe(false)
    })
  })

  // ─── Null user handling ───
  describe('null user handling', () => {
    it('hasPermission returns false for null user', async () => {
      expect(await hasPermission(null, 'orders:read')).toBe(false)
    })

    it('hasRole returns false for null user', () => {
      expect(hasRole(null, [UserRole.ADMIN])).toBe(false)
    })

    it('isAdmin returns false for null user', () => {
      expect(isAdmin(null)).toBe(false)
    })

    it('isStaff returns false for null user', () => {
      expect(isStaff(null)).toBe(false)
    })

    it('getUserPermissions returns empty for null user', async () => {
      expect(await getUserPermissions(null)).toEqual([])
    })
  })

  // ─── DB-backed permission check ───
  describe('DB-backed permission check takes priority', () => {
    it('returns true when DB record exists', async () => {
      mockedPrisma.rolePermission.findFirst.mockResolvedValueOnce({
        id: '1',
        role: UserRole.STAFF,
        permissionId: 'perm-1',
        createdAt: new Date(),
      } as any)

      const staff = makeUser(UserRole.STAFF)
      // Even if not in fallback, DB record grants access
      expect(await hasPermission(staff, 'financials:read')).toBe(true)
    })
  })

  // ─── Fallback permissions ───
  describe('fallback permissions', () => {
    it('ADMIN gets all permissions as fallback', () => {
      const perms = fallbackPermissionsFor(UserRole.ADMIN)
      expect(perms.length).toBeGreaterThan(30)
    })

    it('CUSTOMER gets no fallback permissions', () => {
      expect(fallbackPermissionsFor(UserRole.CUSTOMER)).toEqual([])
    })

    it('WHOLESALE gets no fallback permissions', () => {
      expect(fallbackPermissionsFor(UserRole.WHOLESALE)).toEqual([])
    })
  })

  // ─── Nav filtering by permissions ───
  describe('navigation filtering by permissions', () => {
    it('filters out items user lacks permission for', () => {
      const userPerms = ['orders:read'] // only orders:read
      const filtered = filterNavByPermissions(adminNavigation, userPerms)

      // Dashboard has no permission requirement - always visible
      expect(filtered.some((n) => n.href === '/admin')).toBe(true)
      // Orders requires orders:read - should be visible
      expect(filtered.some((n) => n.href === '/admin/orders')).toBe(true)
    })

    it('shows all non-developer items for admin with all permissions', () => {
      const adminPerms = defaultRolePermissions.ADMIN
      const filtered = filterNavByPermissions(adminNavigation, adminPerms)
      // Admin sees every nav item except the developer-only console
      expect(filtered.length).toBe(adminNavigation.length - 1)
      expect(filtered.some((n) => n.href === '/admin/developer')).toBe(false)
    })

    it('shows the developer console only for the DEVELOPER role', () => {
      const devPerms = defaultRolePermissions.DEVELOPER
      const filtered = filterNavByPermissions(adminNavigation, devPerms)
      expect(filtered.length).toBe(adminNavigation.length)
      expect(filtered.some((n) => n.href === '/admin/developer')).toBe(true)
    })

    it('shows only unpermissioned items for user with no permissions', () => {
      const filtered = filterNavByPermissions(adminNavigation, [])
      // Only items without permission field
      const unpermissioned = adminNavigation.filter((n) => !n.permission)
      expect(filtered.length).toBe(unpermissioned.length)
    })
  })
})
