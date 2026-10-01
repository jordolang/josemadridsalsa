import { describe, it, expect } from 'vitest'
import { attentionCount, badgeAlerts } from '@/lib/admin-desktop/alerts'

const all = () => true

describe('badgeAlerts', () => {
  it('announces work that arrived, and where to find it', () => {
    expect(badgeAlerts({ orders: 2, messages: 1 }, { orders: 3, messages: 3 }, all)).toEqual([
      { title: 'New order to fulfil', body: '3 waiting to ship', path: '/admin-desktop?section=orders' },
      { title: '2 new customer messages', body: '3 open in Messages', path: '/admin-desktop?section=messages' },
    ])
  })

  it('treats a missing count as zero, so the first order is news', () => {
    expect(badgeAlerts({}, { orders: 1 }, all)).toHaveLength(1)
  })

  it('stays quiet when work is being done or nothing moved', () => {
    expect(badgeAlerts({ orders: 3, messages: 2 }, { orders: 1, messages: 2 }, all)).toEqual([])
  })

  it('says nothing about a section the account cannot open', () => {
    const alerts = badgeAlerts({}, { orders: 4, messages: 4 }, (section) => section === 'messages')
    expect(alerts.map((alert) => alert.path)).toEqual(['/admin-desktop?section=messages'])
  })
})

describe('attentionCount', () => {
  it('adds up what is waiting, for the sections the account can open', () => {
    expect(attentionCount({ orders: 3, messages: 2, inventory: 9 }, all)).toBe(5)
    expect(attentionCount({ orders: 3, messages: 2 }, (section) => section === 'orders')).toBe(3)
    expect(attentionCount({}, all)).toBe(0)
  })
})
