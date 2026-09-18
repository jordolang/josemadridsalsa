import { describe, it, expect } from 'vitest'
import {
  DESKTOP_PAGES,
  DESKTOP_SECTIONS,
  DESKTOP_SECTION_GROUPS,
  defaultPageId,
  findPage,
  findSection,
  isDesktopPageId,
  isDesktopSectionId,
  pageKind,
  pagesFor,
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

  it('opens every section at a page named after it', () => {
    // The strip, the URL and every `section` command all resolve through this:
    // a section whose first page were named something else would open at a tab
    // that does not match the sidebar item that was clicked.
    for (const section of DESKTOP_SECTIONS) {
      expect(defaultPageId(section), `${section.id} does not open at itself`).toBe(section.id)
    }
  })

  it('gives every page a unique id namespaced by its section', () => {
    const ids = DESKTOP_PAGES.map((entry) => entry.page.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const { section, page } of DESKTOP_PAGES) {
      if (page.id === section.id) continue
      expect(page.id.startsWith(`${section.id}.`), `${page.id} is not under ${section.id}`).toBe(true)
    }
  })

  it('keeps every page under /admin too', () => {
    for (const { page } of DESKTOP_PAGES) {
      expect(page.path.startsWith('/admin'), `${page.id} points outside /admin`).toBe(true)
    }
  })

  it('falls back to the section kind when a page does not state one', () => {
    for (const { section, page } of DESKTOP_PAGES) {
      expect(pageKind(section, page)).toBe(page.kind ?? section.kind)
    }
  })

  it('treats a section with no pages as one page — itself', () => {
    const single = DESKTOP_SECTIONS.find((section) => !section.pages)
    expect(single).toBeDefined()
    expect(pagesFor(single!)).toEqual([
      { id: single!.id, label: single!.label, path: single!.path, kind: single!.kind },
    ])
  })

  it('resolves a page id back to its section', () => {
    const entry = findPage('email.suppressions')
    expect(entry?.section.id).toBe('email')
    expect(entry?.page.label).toBe('Suppressions')
    expect(findPage('email.nonsense')).toBeUndefined()
  })

  it('guards the API route against arbitrary page names', () => {
    expect(isDesktopPageId('orders')).toBe(true)
    expect(isDesktopPageId('orders.returns')).toBe(true)
    expect(isDesktopPageId('orders.../../secrets')).toBe(false)
    expect(isDesktopPageId('')).toBe(false)
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
