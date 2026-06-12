import { describe, it, expect } from 'vitest'

import {
  DEFAULT_DEVELOPER_PAGE_CONTENT,
  mergeDeveloperPageContent,
} from '@/lib/developer/page-content'

describe('mergeDeveloperPageContent', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(mergeDeveloperPageContent(null)).toEqual(DEFAULT_DEVELOPER_PAGE_CONTENT)
    expect(mergeDeveloperPageContent(undefined)).toEqual(DEFAULT_DEVELOPER_PAGE_CONTENT)
    expect(mergeDeveloperPageContent('bogus')).toEqual(DEFAULT_DEVELOPER_PAGE_CONTENT)
  })

  it('overlays stored values onto the defaults', () => {
    const merged = mergeDeveloperPageContent({
      hero: { heading: 'Custom Heading', showPhoto: false },
      sections: { changelog: false },
    })
    expect(merged.hero.heading).toBe('Custom Heading')
    expect(merged.hero.showPhoto).toBe(false)
    expect(merged.hero.badge).toBe(DEFAULT_DEVELOPER_PAGE_CONTENT.hero.badge)
    expect(merged.sections.changelog).toBe(false)
    expect(merged.sections.stats).toBe(true)
    expect(merged.about).toEqual(DEFAULT_DEVELOPER_PAGE_CONTENT.about)
  })

  it('ignores stored values of the wrong type', () => {
    const merged = mergeDeveloperPageContent({
      hero: { heading: 42, showPhoto: 'yes' },
    })
    expect(merged.hero.heading).toBe(DEFAULT_DEVELOPER_PAGE_CONTENT.hero.heading)
    expect(merged.hero.showPhoto).toBe(DEFAULT_DEVELOPER_PAGE_CONTENT.hero.showPhoto)
  })
})
