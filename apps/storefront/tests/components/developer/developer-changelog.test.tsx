import { beforeAll, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DeveloperChangelog } from '@/components/developer/developer-changelog'
import { parseChangelogContent } from '@/lib/developer/parse-changelog'

const versions = parseChangelogContent(`## [Unreleased]

### Added
- **Square-style register in the fundraiser app.** **Sell** opens a photo grid of the group's
  flavors.

## [2.1] — 2026-09-01

### Fixed
- Plain entry with \`code\`.
`)

describe('DeveloperChangelog', () => {
  beforeAll(() => {
    // The cards fade in on scroll (framer-motion whileInView); jsdom has no observer.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  it('starts with Unreleased folded and the latest release open', () => {
    render(<DeveloperChangelog versions={versions} />)
    const unreleased = screen.getByRole('button', { name: /Unreleased/ })
    expect(unreleased).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /v2\.1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('code').tagName).toBe('CODE')
  })

  it('renders bold headlines without literal asterisks and unfolds the full entry', () => {
    render(<DeveloperChangelog versions={versions} />)
    fireEvent.click(screen.getByRole('button', { name: /Unreleased/ }))

    const entry = screen.getByRole('button', { name: 'Square-style register in the fundraiser app.' })
    expect(entry).toHaveAttribute('aria-expanded', 'false')
    expect(document.body.textContent).not.toContain('**')

    fireEvent.click(entry)
    expect(entry).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/opens a photo grid of the group's flavors\./)).toBeInTheDocument()
    expect(screen.getByText('Sell').tagName).toBe('STRONG')
  })
})
