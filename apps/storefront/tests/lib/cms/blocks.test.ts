import { describe, expect, it } from 'vitest'
import {
  BLOCK_DEFINITIONS,
  composableBlocks,
  getBlockDefinition,
  parseBlockData,
} from '@/lib/cms/blocks'
import { SYSTEM_PAGES } from '@/lib/cms/system-pages'

describe('block registry', () => {
  it('has a unique type for every block', () => {
    const types = BLOCK_DEFINITIONS.map((block) => block.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('excludes system-only blocks from the composable list', () => {
    expect(composableBlocks().every((block) => !block.systemOnly)).toBe(true)
    expect(composableBlocks().some((block) => block.type === 'locations')).toBe(false)
  })

  it('declares a field for every key in the block defaults', () => {
    for (const block of BLOCK_DEFINITIONS) {
      const fieldNames = new Set(block.fields.map((field) => field.name))
      // `testimonials.items` is edited as a list rather than a flat field.
      const skip = new Set(['items'])
      for (const key of Object.keys(block.defaults)) {
        if (skip.has(key)) continue
        expect(fieldNames.has(key), `${block.type} is missing a field for "${key}"`).toBe(true)
      }
    }
  })
})

describe('parseBlockData', () => {
  it('returns an empty object for an unknown block type', () => {
    expect(parseBlockData('does-not-exist', { a: 1 })).toEqual({})
  })

  it('keeps valid stored values', () => {
    const data = parseBlockData('hero', { headline: 'Hello', alignment: 'left' })
    expect(data.headline).toBe('Hello')
    expect(data.alignment).toBe('left')
  })

  it('fills missing fields with defaults', () => {
    const data = parseBlockData('hero', { headline: 'Hello' })
    expect(data.subheadline).toBe('')
    expect(data.alignment).toBe('center')
  })

  it('falls back to defaults rather than throwing on malformed data', () => {
    const data = parseBlockData('hero', { alignment: 'sideways' })
    expect(data).toEqual(getBlockDefinition('hero')!.defaults)
  })

  it('tolerates null and undefined', () => {
    expect(parseBlockData('cta', null).variant).toBe('primary')
    expect(parseBlockData('cta', undefined).variant).toBe('primary')
  })
})

describe('system page registry', () => {
  it('has a unique slug for every page', () => {
    const slugs = SYSTEM_PAGES.map((page) => page.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('references a registered block from every section', () => {
    for (const page of SYSTEM_PAGES) {
      for (const section of page.sections) {
        expect(
          getBlockDefinition(section.block),
          `${page.slug}/${section.key} references unknown block "${section.block}"`
        ).toBeDefined()
      }
    }
  })

  it('has unique section keys within each page', () => {
    for (const page of SYSTEM_PAGES) {
      const keys = page.sections.map((section) => section.key)
      expect(new Set(keys).size, `${page.slug} has duplicate section keys`).toBe(keys.length)
    }
  })
})
