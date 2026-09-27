import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { activateTheme, matchVariation, withCheckoutStyle } from '@/lib/bigcommerce/themes'

const themeConfig = {
  name: 'Cornerstone',
  settings: { 'color-textBase': '#333', 'optimizedCheckout-header-backgroundColor': '#fff' },
  variations: [
    { id: 'light', settings: { 'color-textBase': '#111' } },
    { id: 'warm', settings: { 'color-textBase': '#4f3f2f', 'optimizedCheckout-header-backgroundColor': '#f2eee9' } },
  ],
}

describe('matchVariation', () => {
  it('finds the style whose defaults reproduce the live settings', () => {
    expect(
      matchVariation(themeConfig, { 'color-textBase': '#4f3f2f', 'optimizedCheckout-header-backgroundColor': '#f2eee9' }),
    ).toBe('warm')
    expect(matchVariation(themeConfig, { 'color-textBase': '#111' })).toBe('light')
  })
})

describe('withCheckoutStyle', () => {
  it('changes only the chosen style\'s checkout settings and renames the theme', () => {
    const restyled = withCheckoutStyle(
      themeConfig,
      'warm',
      { 'optimizedCheckout-header-backgroundColor': '#ffffff' },
      'Cornerstone — Jose Madrid checkout',
    )

    expect(restyled.name).toBe('Cornerstone — Jose Madrid checkout')
    expect(restyled.settings).toEqual(themeConfig.settings)
    expect(restyled.variations[0]).toEqual(themeConfig.variations[0])
    expect(restyled.variations[1].settings).toEqual({
      'color-textBase': '#4f3f2f',
      'optimizedCheckout-header-backgroundColor': '#ffffff',
    })
  })

  it('refuses any setting outside checkout, so the storefront cannot change', () => {
    expect(() =>
      withCheckoutStyle(themeConfig, 'warm', { 'color-textBase': '#000' }, 'x'),
    ).toThrow(/Only checkout settings/)
  })

  it('refuses a style the theme does not have', () => {
    expect(() => withCheckoutStyle(themeConfig, 'bold', {}, 'x')).toThrow(/no "bold" variation/)
  })
})

describe('activateTheme', () => {
  let body: unknown = null

  beforeEach(() => {
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
    server.use(
      http.post('https://api.bigcommerce.com/stores/testhash/v3/themes/actions/activate', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
  })
  afterEach(() => vi.unstubAllEnvs())

  it('restores an exact saved configuration', async () => {
    await activateTheme('var-warm', 'config-original')
    expect(body).toEqual({ variation_id: 'var-warm', which: 'CLIENT_SUPPLIED', configuration_id: 'config-original' })
  })

  it('puts a freshly uploaded theme live on its own settings', async () => {
    await activateTheme('var-warm')
    expect(body).toEqual({ variation_id: 'var-warm', which: 'ORIGINAL' })
  })
})
