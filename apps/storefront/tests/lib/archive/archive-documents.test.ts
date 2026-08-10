import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  findPublicArchiveDocuments,
  publicArchiveWhere,
} from '@/lib/archive/archive-documents'

describe('publicArchiveWhere', () => {
  it('AND-composes the non-sensitive guard onto an empty where', () => {
    expect(publicArchiveWhere()).toEqual({
      AND: [{}, { sensitivity: { not: 'SENSITIVE' } }],
    })
  })

  it('keeps the caller filter and always adds the guard', () => {
    expect(publicArchiveWhere({ category: '06 Products' })).toEqual({
      AND: [{ category: '06 Products' }, { sensitivity: { not: 'SENSITIVE' } }],
    })
  })

  it('cannot be overridden by a caller asking for SENSITIVE', () => {
    // Both conditions must hold, so `sensitivity = SENSITIVE AND != SENSITIVE`
    // is unsatisfiable — the query returns nothing rather than leaking.
    const where = publicArchiveWhere({ sensitivity: 'SENSITIVE' })
    expect(where.AND).toEqual([
      { sensitivity: 'SENSITIVE' },
      { sensitivity: { not: 'SENSITIVE' } },
    ])
  })
})

describe('findPublicArchiveDocuments', () => {
  it('forces the guard onto the findMany where, preserving other args', () => {
    const findMany = vi.fn().mockResolvedValue([])
    const prisma = { archiveDocument: { findMany } } as unknown as PrismaClient

    findPublicArchiveDocuments(prisma, {
      where: { category: '04 Shows & Events' },
      take: 10,
      orderBy: { year: 'desc' },
    })

    expect(findMany).toHaveBeenCalledWith({
      take: 10,
      orderBy: { year: 'desc' },
      where: {
        AND: [
          { category: '04 Shows & Events' },
          { sensitivity: { not: 'SENSITIVE' } },
        ],
      },
    })
  })

  it('applies the guard even when the caller passes no where', () => {
    const findMany = vi.fn().mockResolvedValue([])
    const prisma = { archiveDocument: { findMany } } as unknown as PrismaClient

    findPublicArchiveDocuments(prisma)

    expect(findMany).toHaveBeenCalledWith({
      where: { AND: [{}, { sensitivity: { not: 'SENSITIVE' } }] },
    })
  })
})
