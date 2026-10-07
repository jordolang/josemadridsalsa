import { describe, it, expect } from 'vitest'
import { createMetadata } from '@/lib/metadata'
import { SALSA_BUNDLES } from '@/lib/bundles'

describe('Bundles Page', () => {
  describe('metadata', () => {
    it('should have correct metadata configuration', () => {
      const metadata = createMetadata({
        title: 'Bundle Deals - Create Your Perfect Gift Box',
        description:
          'Mix and match your favorite Jose Madrid salsas! Choose from 3, 5, 6, or 12-pack gift boxes and create the perfect combination.',
        pathname: '/bundles',
      })

      expect(metadata).toBeDefined()
      expect(metadata.title).toContain('Bundle Deals')
      expect(metadata.description).toContain('Mix and match')
    })

    it('should resolve the open graph image from the /bundles pathname', () => {
      const metadata = createMetadata({
        title: 'Bundle Deals - Create Your Perfect Gift Box',
        description:
          'Mix and match your favorite Jose Madrid salsas! Choose from 3, 5, 6, or 12-pack gift boxes and create the perfect combination.',
        pathname: '/bundles',
      })

      const ogImages = metadata.openGraph?.images as Array<{ url: string }>
      expect(ogImages?.[0]?.url).toBe(
        'https://www.josemadridsalsa.com/images/opengraph/josemadridhome.png'
      )
    })
  })

  describe('gift box options', () => {
    // Read from the definitions the page, the cart and checkout all price from, so this
    // cannot pass while the storefront and the server disagree about what a pack costs.
    const giftBoxOptions = SALSA_BUNDLES

    it('should have 4 bundle size options', () => {
      expect(giftBoxOptions).toHaveLength(4)
    })

    it('should have correct pricing structure', () => {
      expect(giftBoxOptions[0].price).toBe(23.0) // 3-pack
      expect(giftBoxOptions[1].price).toBe(28.0) // 5-pack
      expect(giftBoxOptions[2].price).toBe(32.0) // 6-pack
      expect(giftBoxOptions[3].price).toBe(60.0) // 12-pack
    })

    it('should have correct size values', () => {
      expect(giftBoxOptions[0].size).toBe(3)
      expect(giftBoxOptions[1].size).toBe(5)
      expect(giftBoxOptions[2].size).toBe(6)
      expect(giftBoxOptions[3].size).toBe(12)
    })

    it('should have unique IDs', () => {
      const ids = giftBoxOptions.map((option) => option.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(giftBoxOptions.length)
    })
  })

  describe('FAQ content', () => {
    const faqQuestions = [
      'Can I mix different heat levels in one box?',
      'How much do I save with bundle deals?',
      'Are the bundles pre-packaged or can I customize them?',
      'Can I choose the same salsa multiple times?',
      'Do bundles make good gifts?',
      "What's the shelf life of the salsas?",
    ]

    it('should have 6 FAQ questions', () => {
      expect(faqQuestions).toHaveLength(6)
    })

    it('should cover customization questions', () => {
      const hasCustomizationQuestion = faqQuestions.some((q) =>
        q.toLowerCase().includes('customize')
      )
      expect(hasCustomizationQuestion).toBe(true)
    })

    it('should cover pricing/savings questions', () => {
      const hasPricingQuestion = faqQuestions.some((q) =>
        q.toLowerCase().includes('save')
      )
      expect(hasPricingQuestion).toBe(true)
    })
  })

  describe('popular bundle combinations', () => {
    const popularBundles = [
      {
        name: "Heat Lover's Pack",
        badge: 'Best Seller',
        items: ["Jose's Hot Salsa", 'Extra Hot Salsa', 'Habanero Salsa'],
      },
      {
        name: 'Variety Pack',
        badge: 'Family Favorite',
        items: [
          'Mild Salsa',
          'Medium Salsa',
          'Hot Salsa',
          'Raspberry Chipotle',
          'Strawberry Salsa',
          'Pineapple Salsa',
        ],
      },
      {
        name: 'Sweet & Savory',
        badge: 'Fruit Fusion',
        items: ['Raspberry Chipotle', 'Strawberry Salsa', 'Pineapple Salsa'],
      },
    ]

    it('should have 3 popular bundle suggestions', () => {
      expect(popularBundles).toHaveLength(3)
    })

    it('should have unique badges', () => {
      const badges = popularBundles.map((bundle) => bundle.badge)
      const uniqueBadges = new Set(badges)
      expect(uniqueBadges.size).toBe(popularBundles.length)
    })

    it('should have at least one fruit-based bundle', () => {
      const hasFruitBundle = popularBundles.some((bundle) =>
        bundle.badge.toLowerCase().includes('fruit')
      )
      expect(hasFruitBundle).toBe(true)
    })
  })
})
