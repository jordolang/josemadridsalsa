import { describe, expect, it } from 'vitest'
import type { IndexedContent } from '@/lib/ai-rag/indexer'
import { searchContent } from '@/lib/ai-rag/retriever'

describe('searchContent', () => {
  it('ranks store content above documentation that matches equally well', () => {
    const docs: IndexedContent = {
      id: 'docs-fundraising-0',
      type: 'documentation',
      title: 'Fundraising Program',
      content: 'Fundraising Program: how the admin sets up a fundraiser.',
    }
    const store: IndexedContent = {
      id: 'general-fundraising',
      type: 'general',
      title: 'Fundraising Program',
      content: 'Fundraising Program: how the admin sets up a fundraiser.',
    }

    expect(searchContent('fundraising program', [docs, store], 2).map((item) => item.id)).toEqual([
      'general-fundraising',
      'docs-fundraising-0',
    ])
  })

  it('still returns documentation when nothing else matches', () => {
    const docs: IndexedContent = {
      id: 'docs-discounts-0',
      type: 'documentation',
      title: 'Discount Codes',
      content: 'Create a discount code from the admin panel.',
    }

    expect(searchContent('discount code', [docs])).toEqual([docs])
  })
})
