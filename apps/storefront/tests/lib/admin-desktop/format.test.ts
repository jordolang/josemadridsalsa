import { describe, it, expect } from 'vitest'
import {
  centsToMoney,
  channelLabel,
  channelTone,
  count,
  heatTone,
  humanise,
  money,
  moneyShort,
  orderStatusTone,
  percent,
  personName,
  place,
  shortDate,
  stamp,
  toNumber,
} from '@/lib/admin-desktop/format'

describe('money formatting', () => {
  it('always shows two decimal places', () => {
    expect(money(12)).toBe('$12.00')
    expect(money(1234.5)).toBe('$1,234.50')
  })

  it('treats a missing amount as zero rather than throwing', () => {
    expect(money(null)).toBe('$0.00')
    expect(money(undefined)).toBe('$0.00')
  })

  it('reads a Prisma Decimal through its string form', () => {
    // Decimal is not a plain number; toNumber is what every caller goes through.
    const decimalLike = { toString: () => '48.75', valueOf: () => 48.75 } as unknown as number
    expect(toNumber(decimalLike)).toBe(48.75)
  })

  it('drops the cents for stat tiles', () => {
    expect(moneyShort(24180.4)).toBe('$24,180')
  })

  it('converts ledger cents without floating-point drift', () => {
    expect(centsToMoney(112800)).toBe('$1,128.00')
    expect(centsToMoney(1)).toBe('$0.01')
  })
})

describe('count and percent', () => {
  it('groups thousands', () => {
    expect(count(12084)).toBe('12,084')
  })

  it('formats a percentage to one place by default', () => {
    expect(percent(61.44)).toBe('61.4%')
    expect(percent(61.44, 0)).toBe('61%')
  })
})

describe('humanise', () => {
  it('turns an enum member into a sentence-cased label', () => {
    expect(humanise('EXTRA_HOT')).toBe('Extra hot')
    expect(humanise('PAID')).toBe('Paid')
  })
})

describe('tones', () => {
  it('scales heat from good to bad', () => {
    expect(heatTone('MILD')).toBe('good')
    expect(heatTone('MEDIUM')).toBe('warn')
    expect(heatTone('EXTRA_HOT')).toBe('bad')
  })

  it('falls back to muted for a heat level it does not know', () => {
    expect(heatTone('SMOKY')).toBe('muted')
  })

  it('marks a refund as bad and a delivery as good', () => {
    expect(orderStatusTone('REFUNDED')).toBe('bad')
    expect(orderStatusTone('DELIVERED')).toBe('good')
    expect(orderStatusTone('PROCESSING')).toBe('warn')
  })

  it('only tints the channels that are not the default', () => {
    expect(channelTone('WHOLESALE')).toBe('warn')
    expect(channelTone('WEBSITE')).toBe('muted')
  })
})

describe('channelLabel', () => {
  it('uses the words the shop uses, not the enum', () => {
    expect(channelLabel('WEBSITE')).toBe('Online')
    expect(channelLabel('EVENT')).toBe('Show')
  })

  it('humanises a channel with no mapping rather than showing the raw enum', () => {
    expect(channelLabel('SOMETHING_NEW')).toBe('Something new')
  })
})

describe('personName', () => {
  it('prefers an account name', () => {
    expect(personName({ name: 'Karen Wolfe', email: 'k@example.com' })).toBe('Karen Wolfe')
  })

  it('falls back to the shipping name, then the email', () => {
    expect(personName({ firstName: 'Tom', lastName: 'Girard' })).toBe('Tom Girard')
    expect(personName({ email: 'guest@example.com' })).toBe('guest@example.com')
  })

  it('says Guest when the order carries no identity at all', () => {
    expect(personName({})).toBe('Guest')
    expect(personName({ name: '   ' })).toBe('Guest')
  })
})

describe('place', () => {
  it('joins city and state', () => {
    expect(place({ city: 'Zanesville', state: 'OH' })).toBe('Zanesville, OH')
  })

  it('returns a dash rather than a stray comma when nothing is known', () => {
    expect(place({})).toBe('—')
    expect(place({ city: 'Toledo' })).toBe('Toledo')
  })
})

describe('dates', () => {
  // 2026-09-14T12:12:00Z is 8:12 AM in Zanesville — the store's time zone, not UTC.
  const noonUtc = new Date('2026-09-14T12:12:00Z')

  it('formats a short date in store time', () => {
    expect(shortDate(noonUtc)).toBe('Sep 14')
  })

  it('formats a timestamp with a middot separator', () => {
    expect(stamp(noonUtc)).toBe('Sep 14 · 8:12 AM')
  })

  it('buckets a late-evening UTC time into the previous store day', () => {
    // 03:30 UTC on the 15th is 11:30 PM on the 14th in Zanesville.
    expect(shortDate(new Date('2026-09-15T03:30:00Z'))).toBe('Sep 14')
  })

  it('shows a dash for a missing date', () => {
    expect(shortDate(null)).toBe('—')
    expect(stamp(undefined)).toBe('—')
  })
})
