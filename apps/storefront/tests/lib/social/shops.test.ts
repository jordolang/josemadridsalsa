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
        shopPlatform: 'TIKTOK_SHOP',
        socialAccountId: 'acct_1',
        socialAccountPlatform: 'FACEBOOK',
        catalogId: 'shop_123',
      }),
    ).toEqual({
      valid: false,
      error: 'Selected account must be a TikTok account.',
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

  it('accepts marketplace exports without a catalog id', () => {
    expect(
      validateShopExportConfiguration({
        shopPlatform: 'FACEBOOK_MARKETPLACE',
        socialAccountId: 'acct_1',
        socialAccountPlatform: 'FACEBOOK',
      }),
    ).toEqual({ valid: true })
  })
})
