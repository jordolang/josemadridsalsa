import { describe, expect, it } from 'vitest'
import { initialBrandColors } from '@/lib/fundraising/brand-colors'

const columns = { brandColor: '#111111', secondaryColor: '#222222', accentColor: '#333333' }

describe('initialBrandColors', () => {
  it('keeps a palette an admin saved over the sign-up colors', () => {
    const saved = { primaryColor: '#AA0000', secondaryColor: '#00AA00', accentColor: '#0000AA' }
    expect(initialBrandColors({ ...columns, pageConfig: saved })).toEqual(saved)
  })

  it('uses the sign-up colors when nothing was saved in Branding', () => {
    expect(initialBrandColors({ ...columns, pageConfig: null })).toEqual({
      primaryColor: '#111111',
      secondaryColor: '#222222',
      accentColor: '#333333',
    })
  })

  it('falls back to the defaults when neither exists', () => {
    expect(
      initialBrandColors({ brandColor: null, secondaryColor: null, accentColor: null, pageConfig: {} }),
    ).toEqual({ primaryColor: '#B91C1C', secondaryColor: '#F59E0B', accentColor: '#16A34A' })
  })
})
