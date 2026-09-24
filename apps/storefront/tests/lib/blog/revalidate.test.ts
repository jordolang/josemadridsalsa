import { describe, beforeEach, expect, it, vi } from 'vitest'

const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }))

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

import { revalidateBlogPost } from '@/lib/blog/revalidate'

beforeEach(() => {
  revalidatePathMock.mockClear()
})

describe('revalidateBlogPost', () => {
  it('purges the article page so a crawler renders the current cover image', () => {
    revalidateBlogPost('big-e-2026')
    expect(revalidatePathMock).toHaveBeenCalledWith('/heat-index/big-e-2026')
  })

  it('purges the listing and the sitemap, which both gain the new article', () => {
    revalidateBlogPost('big-e-2026')
    expect(revalidatePathMock).toHaveBeenCalledWith('/heat-index')
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml')
  })
})
