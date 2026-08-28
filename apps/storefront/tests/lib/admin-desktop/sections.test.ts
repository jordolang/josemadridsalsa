import { describe, it, expect } from 'vitest'
import {
  DESKTOP_SECTIONS,
  DESKTOP_SECTION_GROUPS,
  findSection,
  isDesktopSectionId,
} from '@/lib/admin-desktop/sections'

describe('desktop section registry', () => {
  it('is the flattened view of the sidebar groups', () => {
    const fromGroups = DESKTOP_SECTION_GROUPS.flatMap((group) => group.items)
    expect(DESKTOP_SECTIONS).toEqual(fromGroups)
    expect(DESKTOP_SECTIONS.length).toBeGreaterThan(0)
  })

  it('gives every section a unique id', () => {
    const ids = DESKTOP_SECTIONS.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never assigns the same ⌘ digit twice', () => {
    // A duplicate would make one of the two shortcuts silently unreachable.
    const digits = DESKTOP_SECTIONS.map((section) => section.digit).filter(Boolean)
    expect(new Set(digits).size).toBe(digits.length)
  })

  it('only uses digits the shortcut handler listens for', () => {
    for (const section of DESKTOP_SECTIONS) {
      if (section.digit) expect(section.digit).toMatch(/^[1-9]$/)
    }
  })

  it('points every section at a real admin path', () => {
    for (const section of DESKTOP_SECTIONS) {
      expect(section.path.startsWith('/admin')).toBe(true)
    }
  })

  it('gives every link section somewhere to hand off to', () => {
    // A link section that lists no views would render an empty card and a
    // dead end, which is worse than not having the section at all.
    for (const section of DESKTOP_SECTIONS) {
      if (section.kind === 'link') {
        expect(section.views?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it('keeps every sub-view under /admin too', () => {
    for (const section of DESKTOP_SECTIONS) {
      for (const view of section.views ?? []) {
        expect(view.path.startsWith('/admin')).toBe(true)
      }
    }
  })

  it('resolves a known id and refuses an unknown one', () => {
    expect(findSection('orders')?.label).toBe('Orders')
    expect(findSection('not-a-section')).toBeUndefined()
  })

  it('guards the API route against arbitrary section names', () => {
    expect(isDesktopSectionId('inventory')).toBe(true)
    expect(isDesktopSectionId('../../etc/passwd')).toBe(false)
    expect(isDesktopSectionId('')).toBe(false)
  })
})
