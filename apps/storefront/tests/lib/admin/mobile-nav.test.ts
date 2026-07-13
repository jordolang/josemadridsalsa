import { describe, it, expect } from 'vitest'
import { splitNavForMobile } from '@/lib/admin/mobile-nav'
import { adminNavigation } from '@/lib/permissions-map'

describe('splitNavForMobile', () => {
  it('puts Dashboard, Orders, Products, Messages in primary tabs (in that order)', () => {
    const { primary } = splitNavForMobile(adminNavigation, [
      'orders:read',
      'products:read',
      'messaging:read',
    ])
    expect(primary.map((i) => i.href)).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/products',
      '/admin/messages',
    ])
  })

  it('keeps primary tabs out of `more`', () => {
    const { more } = splitNavForMobile(adminNavigation, [
      'orders:read',
      'products:read',
      'messaging:read',
    ])
    const hrefs = more.map((i) => i.href)
    expect(hrefs).not.toContain('/admin')
    expect(hrefs).not.toContain('/admin/orders')
    expect(hrefs).not.toContain('/admin/products')
  })

  it('drops a primary tab when the user lacks its permission', () => {
    const { primary } = splitNavForMobile(adminNavigation, [
      'products:read',
      'messaging:read',
    ])
    expect(primary.map((i) => i.href)).toEqual([
      '/admin',
      '/admin/products',
      '/admin/messages',
    ])
  })

  it('moves the long tail into `more`', () => {
    const { more } = splitNavForMobile(adminNavigation, [
      'orders:read',
      'products:read',
      'messaging:read',
      'analytics:read',
      'financials:read',
      'settings:read',
    ])
    const moreHrefs = more.map((i) => i.href)
    expect(moreHrefs).toContain('/admin/analytics')
    expect(moreHrefs).toContain('/admin/financials')
    expect(moreHrefs).toContain('/admin/settings')
  })

  it('returns empty primary and more when the user has no permissions beyond dashboard', () => {
    const { primary, more } = splitNavForMobile(adminNavigation, [])
    expect(primary.map((i) => i.href)).toEqual(['/admin'])
    expect(more).toEqual([])
  })
})
