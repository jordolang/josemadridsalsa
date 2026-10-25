import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    seoConfiguration: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}))

import { generateOrganizationSchema } from '@/lib/seo/schema-generator'

describe('generateOrganizationSchema', () => {
  it('publishes the real customer-service number, not a placeholder', async () => {
    const schema = await generateOrganizationSchema()
    expect(schema.contactPoint?.telephone).toBe('+1-740-521-4304')
    expect(schema.contactPoint?.telephone).not.toMatch(/X/)
  })
})
