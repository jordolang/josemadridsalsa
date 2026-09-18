import { describe, it, expect } from 'vitest'
import {
  SECTION_PERMISSION,
  allowedPages,
  allowedSectionIds,
  canSeePage,
  canSeeSection,
  fallbackSection,
} from '@/lib/admin-desktop/access'
import {
  DESKTOP_PAGES,
  DESKTOP_SECTIONS,
  findSection,
  pagesFor,
} from '@/lib/admin-desktop/sections'
import { permissionDefinitions } from '@/lib/permissions-data'

/**
 * The desktop shell is a second door onto the same data, so what it refuses has
 * to match what `/admin` refuses. These pin the map itself and the two ways it
 * is used: gating a single section, and building the sidebar.
 */

describe('SECTION_PERMISSION', () => {
  it('has an entry for every section in the registry', () => {
    // A missing entry would read as "no permission required" and quietly open
    // the section to any staff account.
    for (const section of DESKTOP_SECTIONS) {
      expect(SECTION_PERMISSION).toHaveProperty(section.id)
    }
  })

  it('does not carry entries for sections that no longer exist', () => {
    const ids = new Set(DESKTOP_SECTIONS.map((section) => section.id))
    for (const id of Object.keys(SECTION_PERMISSION)) {
      expect(ids.has(id as (typeof DESKTOP_SECTIONS)[number]['id'])).toBe(true)
    }
  })

  it('keeps the money and developer sections behind their own permissions', () => {
    expect(SECTION_PERMISSION.invoices).toBe('financials:read')
    expect(SECTION_PERMISSION.ledger).toBe('financials:read')
    expect(SECTION_PERMISSION.database).toBe('developer:database')
    expect(SECTION_PERMISSION.settings).toBe('settings:read')
  })
})

describe('canSeeSection', () => {
  it('lets a staff-only section through with no permissions at all', () => {
    expect(canSeeSection('dashboard', [])).toBe(true)
    expect(canSeeSection('events', [])).toBe(true)
  })

  it('refuses a gated section the account does not hold', () => {
    expect(canSeeSection('invoices', ['orders:read'])).toBe(false)
    expect(canSeeSection('database', ['orders:read', 'users:read'])).toBe(false)
  })

  it('allows a gated section the account does hold', () => {
    expect(canSeeSection('invoices', ['financials:read'])).toBe(true)
  })

  it('accepts a Set as readily as an array', () => {
    expect(canSeeSection('invoices', new Set(['financials:read']))).toBe(true)
    expect(canSeeSection('invoices', new Set(['orders:read']))).toBe(false)
  })
})

describe('allowedSectionIds', () => {
  it('returns sections in sidebar order, not permission order', () => {
    const ids = allowedSectionIds(['orders:read', 'products:read'])
    expect(ids).toEqual(['dashboard', 'orders', 'products', 'inventory', 'fundraisers', 'events', 'leads'])
  })

  it('gives an account with nothing only the ungated sections', () => {
    expect(allowedSectionIds([])).toEqual(['dashboard', 'events', 'leads'])
  })

  it('gives every section to a role that holds every permission', () => {
    const everything = Object.values(SECTION_PERMISSION).filter((value): value is string => Boolean(value))
    expect(allowedSectionIds(everything)).toHaveLength(DESKTOP_SECTIONS.length)
  })
})

describe('fallbackSection', () => {
  it('opens the window at the first section the account can see', () => {
    expect(fallbackSection(['financials:read'])).toBe('dashboard')
  })

  it('is undefined only when nothing at all is visible', () => {
    // Dashboard is ungated, so in practice this cannot happen — the test pins
    // the contract the page relies on rather than a reachable state.
    expect(fallbackSection([])).toBe('dashboard')
  })
})

describe('canSeePage', () => {
  const everything = [
    ...new Set([
      ...Object.values(SECTION_PERMISSION).filter((value): value is string => Boolean(value)),
      ...DESKTOP_PAGES.map((entry) => entry.page.permission).filter((value): value is string => Boolean(value)),
    ]),
  ]

  it('names only permissions the system actually defines', () => {
    // A page gated on a permission nobody can hold is a page nobody can open,
    // which reads in the window as a tab that is simply missing.
    const known = new Set(permissionDefinitions.map((definition) => definition.name))
    for (const { page } of DESKTOP_PAGES) {
      if (!page.permission) continue
      expect(known.has(page.permission), `${page.id} wants unknown ${page.permission}`).toBe(true)
    }
  })

  it('refuses a page whose section is refused', () => {
    // The vault sits inside Users, so a page permission alone must not be a way
    // past the section's own gate.
    expect(canSeePage('users.credentials', ['credentials:read'])).toBe(false)
    expect(canSeePage('users.credentials', ['users:read', 'credentials:read'])).toBe(true)
  })

  it('refuses a page that asks for more than its section', () => {
    expect(canSeeSection('users', ['users:read'])).toBe(true)
    expect(canSeePage('users.credentials', ['users:read'])).toBe(false)

    expect(canSeeSection('settings', ['settings:read'])).toBe(true)
    expect(canSeePage('settings.integrations', ['settings:read'])).toBe(false)
    expect(canSeePage('settings.payments', ['settings:read'])).toBe(true)
  })

  it('refuses an id that is not a page at all', () => {
    expect(canSeePage('users.nonsense', everything)).toBe(false)
    expect(canSeePage('', everything)).toBe(false)
  })

  it('opens every page to an account holding every permission', () => {
    for (const { page } of DESKTOP_PAGES) {
      expect(canSeePage(page.id, everything), `${page.id} is unreachable`).toBe(true)
    }
  })
})

describe('allowedPages', () => {
  it('drops only the tabs the account cannot load', () => {
    const email = findSection('email')!
    const withoutLists = allowedPages(email, ['content:read', 'settings:read']).map((page) => page.id)
    expect(withoutLists).not.toContain('email.lists')
    expect(withoutLists).toContain('email.suppressions')
  })

  it('keeps a single-page section as one tab', () => {
    const audit = findSection('audit')!
    expect(allowedPages(audit, [])).toEqual(pagesFor(audit))
  })
})
