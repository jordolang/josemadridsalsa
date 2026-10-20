import { describe, expect, it, vi } from 'vitest'

const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`)
})

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/rbac', () => ({ getCurrentFundraiserAccount: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/components/fundraiser-portal/character-selector', () => ({ CharacterSelector: () => null }))

describe('fundraiser portal page guards', () => {
  // These sent a visitor with no fundraiser to sign-in, where a signed-in one looked stuck.
  // The pending route lets the portal layout explain (or send someone signed out to sign-in).
  it.each(['team', 'analytics', 'advanced-profile', 'character'])(
    'sends a visitor with no fundraiser on the %s page to the pending route',
    async (name) => {
      const { default: Page } = await import(`@/app/(fundraiser-portal)/fundraiser-portal/${name}/page`)
      await expect(Page()).rejects.toThrow('redirect:/fundraiser-portal/pending')
    }
  )
})
