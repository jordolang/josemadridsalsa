import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    credentialAccessGrant: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: vi.fn(),
}))

vi.mock('@/lib/crypto', () => ({
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import {
  checkCredentialAccess,
  getGrantPermissions,
  isSuperAdmin,
} from '@/lib/credentials'

const mockedPrisma = vi.mocked(prisma)
const mockedHasPermission = vi.mocked(hasPermission)

const SUPER_ADMIN = 'jordolang@gmail.com'

function makeGrant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grant-1',
    email: 'mike@josemadridsalsa.com',
    grantedByEmail: SUPER_ADMIN,
    createdAt: new Date(),
    revokedAt: null,
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canUpload: true,
    ...overrides,
  }
}

describe('Credential access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedPrisma.credentialAccessGrant.findUnique.mockResolvedValue(null)
    mockedHasPermission.mockResolvedValue(false)
  })

  describe('isSuperAdmin', () => {
    it('matches the super admin email case-insensitively', () => {
      expect(isSuperAdmin(SUPER_ADMIN)).toBe(true)
      expect(isSuperAdmin('JordoLang@Gmail.com ')).toBe(true)
      expect(isSuperAdmin('mike@josemadridsalsa.com')).toBe(false)
    })
  })

  describe('checkCredentialAccess', () => {
    it('always grants write access to the super admin without a grant row', async () => {
      const level = await checkCredentialAccess(SUPER_ADMIN, UserRole.DEVELOPER)
      expect(level).toBe('write')
      expect(mockedPrisma.credentialAccessGrant.findUnique).not.toHaveBeenCalled()
    })

    it('returns null when no grant exists', async () => {
      const level = await checkCredentialAccess('mike@josemadridsalsa.com', UserRole.ADMIN)
      expect(level).toBeNull()
    })

    it('returns null when the grant is revoked', async () => {
      mockedPrisma.credentialAccessGrant.findUnique.mockResolvedValue(
        makeGrant({ revokedAt: new Date() })
      )
      const level = await checkCredentialAccess('mike@josemadridsalsa.com', UserRole.ADMIN)
      expect(level).toBeNull()
    })

    it('returns write for a granted user whose role has credentials:write', async () => {
      mockedPrisma.credentialAccessGrant.findUnique.mockResolvedValue(makeGrant())
      mockedHasPermission.mockImplementation(async (_user, perm) => perm === 'credentials:write')
      const level = await checkCredentialAccess('mike@josemadridsalsa.com', UserRole.ADMIN)
      expect(level).toBe('write')
    })
  })

  describe('getGrantPermissions', () => {
    it('returns full permissions for the super admin without a grant row', async () => {
      const perms = await getGrantPermissions(SUPER_ADMIN)
      expect(perms).toEqual({
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canUpload: true,
      })
      expect(mockedPrisma.credentialAccessGrant.findUnique).not.toHaveBeenCalled()
    })

    it('returns the stored grant flags for other users', async () => {
      mockedPrisma.credentialAccessGrant.findUnique.mockResolvedValue(
        makeGrant({ canDelete: false, canUpload: false })
      )
      const perms = await getGrantPermissions('mike@josemadridsalsa.com')
      expect(perms).toEqual({
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: false,
        canUpload: false,
      })
    })
  })
})
