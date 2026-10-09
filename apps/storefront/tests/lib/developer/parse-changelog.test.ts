import { describe, it, expect } from 'vitest'

import { parseChangelogContent } from '@/lib/developer/parse-changelog'

const SAMPLE = `# Changelog

Intro paragraph.

## [Unreleased]

### Added
- **Customer account page with one communications timeline** (\`/admin/customers/[id]\`). Click a
  customer to see every email and call in one place.
- Single-line entry.

### Fixed
- Several fixes:
  - **Wholesale** buttons record the decision
    and the approver.
  - Product pages no longer say "coming soon".
- After the list.

### Removed
- The old kiosk.

## [2.1a] — 2026-09-01 — Fundraiser Kits

### Changed
- **Kits.** New packs.
`

describe('parseChangelogContent', () => {
  const versions = parseChangelogContent(SAMPLE)

  it('reads versions with their date and subtitle', () => {
    expect(versions.map((v) => v.version)).toEqual(['Unreleased', '2.1a'])
    expect(versions[1].date).toBe('2026-09-01')
    expect(versions[1].subtitle).toBe('Fundraiser Kits')
  })

  it('joins wrapped continuation lines into the full entry', () => {
    const added = versions[0].sections[0]
    expect(added.type).toBe('Added')
    expect(added.items).toEqual([
      {
        text: '**Customer account page with one communications timeline** (`/admin/customers/[id]`). Click a customer to see every email and call in one place.',
        children: [],
      },
      { text: 'Single-line entry.', children: [] },
    ])
  })

  it('keeps nested bullets as children with their own continuations', () => {
    const fixed = versions[0].sections[1]
    expect(fixed.items).toEqual([
      {
        text: 'Several fixes:',
        children: [
          '**Wholesale** buttons record the decision and the approver.',
          'Product pages no longer say "coming soon".',
        ],
      },
      { text: 'After the list.', children: [] },
    ])
  })

  it('includes Removed sections', () => {
    expect(versions[0].sections.map((s) => s.type)).toEqual(['Added', 'Fixed', 'Removed'])
  })
})
