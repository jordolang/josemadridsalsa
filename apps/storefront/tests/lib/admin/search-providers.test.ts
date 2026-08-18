import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Every model the registry touches is stubbed through one Proxy, so adding a provider does
 * not mean adding a mock — the test stays about gating and coverage rather than about
 * keeping a hand-written prisma double in sync with the schema.
 */
const models = new Map<string, { findMany: ReturnType<typeof vi.fn> }>()
const model = (name: string) => {
  if (!models.has(name)) models.set(name, { findMany: vi.fn().mockResolvedValue([]) })
  return models.get(name)!
}

vi.mock('@/lib/prisma', () => {
  const client = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => model(prop),
  })
  return { prisma: client, default: client }
})

vi.mock('@/lib/rbac', () => ({ hasPermission: vi.fn().mockResolvedValue(true) }))

import { hasPermission } from '@/lib/rbac'
import { searchTargets, type SearchEntity } from '@/lib/admin/global-search'
import { runGlobalSearch, SEARCH_PROVIDER_ENTITIES } from '@/lib/admin/search-providers'

const user = { role: 'ADMIN' } as Parameters<typeof runGlobalSearch>[0]

const allow = (predicate: (permission: string) => boolean) =>
  vi.mocked(hasPermission).mockImplementation(async (_user, permission) => predicate(permission))

beforeEach(() => {
  models.clear()
  vi.mocked(hasPermission).mockReset().mockResolvedValue(true)
})

describe('provider coverage', () => {
  it('backs every entity the free-text fan-out claims to search', () => {
    // A shape declared in searchTargets with no provider behind it is a section that
    // silently never returns anything.
    const missing = searchTargets('text').filter(
      (entity) => !SEARCH_PROVIDER_ENTITIES.includes(entity)
    )
    expect(missing).toEqual([])
  })

  it('registers each entity exactly once', () => {
    const seen = new Set<SearchEntity>()
    const duplicates = SEARCH_PROVIDER_ENTITIES.filter((entity) => {
      if (seen.has(entity)) return true
      seen.add(entity)
      return false
    })
    expect(duplicates).toEqual([])
  })
})

describe('runGlobalSearch', () => {
  it('does not query anything for a query too short to narrow a list', async () => {
    const { results, shape } = await runGlobalSearch(user, 'a')
    expect(results).toEqual([])
    expect(shape).toBeNull()
    expect(models.size).toBe(0)
  })

  it('does not query anything without a signed-in user', async () => {
    const { results } = await runGlobalSearch(null, 'Zanesville')
    expect(results).toEqual([])
    expect(models.size).toBe(0)
  })

  it('queries the document archive for free text', async () => {
    await runGlobalSearch(user, 'Zanesville')
    expect(model('archiveDocument').findMany).toHaveBeenCalled()
    expect(model('fundraiserContact').findMany).toHaveBeenCalled()
  })

  it('never queries a table the operator cannot read', async () => {
    // Gating before the query, not after, is what stops a staff member without archive
    // access from paying for a full-text scan they would never be shown.
    allow((permission) => permission !== 'analytics:read')

    await runGlobalSearch(user, 'Zanesville')

    expect(model('archiveDocument').findMany).not.toHaveBeenCalled()
    expect(model('archivedFundraiser').findMany).not.toHaveBeenCalled()
    expect(model('fundraiser').findMany).toHaveBeenCalled()
  })

  it('resolves each distinct permission once rather than once per table', async () => {
    await runGlobalSearch(user, 'Zanesville')

    const asked = vi.mocked(hasPermission).mock.calls.map(([, permission]) => permission)
    expect(new Set(asked).size).toBe(asked.length)
  })

  it('skips the whole fan-out when the shape targets one table', async () => {
    await runGlobalSearch(user, 'JMS-20260807-1234')

    expect(model('order').findMany).toHaveBeenCalled()
    expect(models.has('archiveDocument')).toBe(false)
    expect(models.has('product')).toBe(false)
  })

  it('drops a failing table instead of failing the search', async () => {
    // A missing table on a partially migrated environment should cost that one section.
    model('archiveDocument').findMany.mockRejectedValue(new Error('relation does not exist'))
    model('fundraiser').findMany.mockResolvedValue([
      {
        id: 'f1',
        name: 'Zanesville High Band',
        organizationName: 'Zanesville High',
        status: 'ACTIVE',
        description: null,
        missionStatement: null,
        goal: 5000,
      },
    ])

    const { results } = await runGlobalSearch(user, 'Zanesville')
    expect(results.map((r) => r.id)).toEqual(['f1'])
  })

  it('caps the number of results returned', async () => {
    model('fundraiserContact').findMany.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({
        id: `c${i}`,
        organizationName: `Zanesville Group ${i}`,
        contactName: null,
        email: null,
        totalJars: 0,
        years: [],
        status: 'NEW',
        notes: null,
      }))
    )

    const { results } = await runGlobalSearch(user, 'Zanesville', { limit: 10 })
    expect(results).toHaveLength(10)
  })
})
