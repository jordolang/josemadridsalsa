import { describe, expect, it } from 'vitest'
import { validateShopExportConfiguration } from '@/lib/social/shops'

describe('validateShopExportConfiguration', () => {
  it('requires a selected connected account', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'FACEBOOK_MARKETPLACE',
        socialAccountId: null,
      }),
    ).toEqual({
      valid: false,
      error: 'Choose the connected account that should own this export.',
    })
  })

  it('rejects mismatched account platforms', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'FACEBOOK_SHOP',
        socialAccountId: 'acct_1',
        socialAccountPlatform: 'TIKTOK',
        catalogId: 'cat_123',
      }),
    ).toEqual({
      valid: false,
      error: 'Selected account must be a Facebook Page.',
    })
  })

  it('requires a catalog id for facebook shop exports', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'FACEBOOK_SHOP',
        socialAccountId: 'acct_1',
        socialAccountPlatform: 'FACEBOOK',
        catalogId: '',
      }),
    ).toEqual({
      valid: false,
      error: 'Facebook Shop exports require a catalog ID.',
    })
  })

  it('requires a catalog id for marketplace exports, which sync through the catalog', () => {
    const result = validateShopExportConfiguration({
      shopPlatform: 'FACEBOOK_MARKETPLACE',
      socialAccountId: 'acct_1',
      socialAccountPlatform: 'FACEBOOK',
    })
    expect(result.valid).toBe(false)
  })

  it('accepts tiktok shop exports without a connected account, since they use Partner API credentials', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'TIKTOK_SHOP',
        socialAccountId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('accepts amazon exports without a connected account or catalog id', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'AMAZON',
        socialAccountId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('accepts google shopping exports without a connected account or catalog id', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'GOOGLE_SHOPPING',
        socialAccountId: null,
      }),
    ).toEqual({ valid: true })
  })
})
