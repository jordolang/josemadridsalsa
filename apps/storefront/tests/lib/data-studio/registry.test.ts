import { describe, it, expect } from 'vitest'

import { DATASETS, DATASET_IDS, datasetsFor, getDataset, grainsFor } from '@/lib/data-studio/registry'
import { permissionDefinitions, defaultRolePermissions } from '@/lib/permissions-data'

/**
 * Structural checks over every dataset definition.
 *
 * A semantic layer's characteristic failure is not a crash — it is a typo that yields a plausible
 * wrong number. A measure pointing at a field it never selects reads as zero; a permission string
 * that does not exist locks everyone out or, worse, is silently never granted. These are cheap to
 * assert and expensive to notice by eye.
 */
const permissionNames = new Set(permissionDefinitions.map((p) => p.name))

describe('data-studio registry', () => {
  it('registers at least one dataset per exposed domain', () => {
    expect(DATASETS.length).toBeGreaterThan(0)
  })

  it('has unique dataset ids', () => {
    expect(new Set(DATASET_IDS).size).toBe(DATASET_IDS.length)
  })

  it('resolves every id through getDataset', () => {
    for (const id of DATASET_IDS) expect(getDataset(id)?.id).toBe(id)
  })

  it('returns undefined for an unknown id rather than throwing', () => {
    expect(getDataset('no-such-dataset')).toBeUndefined()
  })

  describe.each(DATASETS.map((dataset) => [dataset.id, dataset] as const))('%s', (_id, dataset) => {
    it('names permissions that actually exist', () => {
      expect(permissionNames.has(dataset.readPermission)).toBe(true)
      expect(permissionNames.has(dataset.exportPermission)).toBe(true)
    })

    it('is not gated on a DEVELOPER-only permission, which would hide it from admins', () => {
      const definition = permissionDefinitions.find((p) => p.name === dataset.readPermission)
      expect(definition?.category).not.toBe('DEVELOPER')
    })

    it('is readable by ADMIN', () => {
      expect(defaultRolePermissions.ADMIN).toContain(dataset.readPermission)
    })

    it('declares at least one measure and gives each a unique id', () => {
      expect(dataset.measures.length).toBeGreaterThan(0)
      const ids = dataset.measures.map((m) => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('gives every non-count measure at least one source field', () => {
      for (const measure of dataset.measures) {
        if (measure.aggregation === 'count') continue
        expect(measure.fields.length, `${measure.id} selects no field`).toBeGreaterThan(0)
      }
    })

    it('gives every measure a readable label and a unit', () => {
      for (const measure of dataset.measures) {
        expect(measure.label.trim().length).toBeGreaterThan(0)
        expect(measure.unit).toBeTruthy()
      }
    })

    it('gives each dimension a unique id and a non-empty field', () => {
      const ids = dataset.dimensions.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const dimension of dataset.dimensions) {
        expect(dimension.field.trim().length).toBeGreaterThan(0)
      }
    })

    it('only labels dimension values it also declares', () => {
      for (const dimension of dataset.dimensions) {
        if (!dimension.labels || !dimension.values) continue
        for (const key of Object.keys(dimension.labels)) {
          expect(dimension.values, `${dimension.id} labels unknown value ${key}`).toContain(key)
        }
      }
    })

    it('gives every filter at least one operator', () => {
      for (const filter of dataset.filters) {
        expect(filter.ops.length, `${filter.id} permits no operator`).toBeGreaterThan(0)
        expect(filter.field.trim().length).toBeGreaterThan(0)
      }
    })

    it('offers only the year grain when the axis is a bare year column', () => {
      if (dataset.timeAxis.kind !== 'year') return
      expect(grainsFor(dataset)).toEqual(['year'])
    })

    it('offers at least one grain when the axis is a timestamp', () => {
      if (dataset.timeAxis.kind !== 'timestamp') return
      expect(dataset.timeAxis.grains.length).toBeGreaterThan(0)
    })

    it('caps rows at a positive number', () => {
      expect(dataset.rowCap).toBeGreaterThan(0)
    })

    it('names a write permission that exists, when it offers write-back', () => {
      if (!dataset.writeBack) return
      expect(permissionNames.has(dataset.writeBack.permission)).toBe(true)
    })

    it('supplies rows for a constant-backed dataset', () => {
      if (dataset.source?.kind !== 'constant') return
      expect(dataset.source.rows().length).toBeGreaterThan(0)
    })
  })

  describe('datasetsFor', () => {
    it('returns nothing for a caller with no permissions', () => {
      expect(datasetsFor([])).toEqual([])
    })

    it('withholds the ledger from a caller who lacks financials:read', () => {
      // The escalation this design exists to prevent: STAFF holds analytics:read but not
      // financials:read, and must not reach the ledger through a generic query layer.
      const staffVisible = datasetsFor(defaultRolePermissions.STAFF)
      expect(staffVisible.some((d) => d.id === 'ledger')).toBe(false)
      expect(staffVisible.some((d) => d.id === 'revenue-anchors')).toBe(false)
    })

    it('gives an ADMIN every dataset', () => {
      expect(datasetsFor(defaultRolePermissions.ADMIN).length).toBe(DATASETS.length)
    })
  })
})
