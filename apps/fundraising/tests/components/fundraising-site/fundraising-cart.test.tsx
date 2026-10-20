import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FundraisingCart } from '@/components/fundraising-site/fundraising-cart'
import { useFundraisingCart } from '@/lib/fundraising-site/cart-store'

const MANY_GROUPS = [
  '4Star Horsemanship 4-H Spring 2026',
  'Arctic Edge Unity Synchro',
  'Cal U Vulcans Cheer',
  'Careytown Childcare Center 2026',
  'Carrollton Middle School',
  'Central Crossing Yearbook',
  'Hardin Valley MS Band 2026',
  'Indian Creek HS Spanish Club',
  'Kal-Val Saddle Club',
  'Zane Trace Band Boosters',
]

beforeAll(() => {
  // Radix Select calls these, and jsdom doesn't implement them.
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  useFundraisingCart.setState({
    lines: [{ productId: 1, name: 'Garden Fresh Cilantro Mild', price: 10, image: null, slug: 'cilantro-mild', quantity: 1 }],
    group: '',
    seller: '',
  })
})

function openGroupList() {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
  return screen.getByRole('listbox')
}

describe('FundraisingCart group dropdown', () => {
  it('caps the open list height so a long list scrolls instead of running off the page', () => {
    render(<FundraisingCart groups={MANY_GROUPS} />)
    const list = openGroupList()

    expect(list.className).toContain('max-h-[min(20rem,var(--radix-select-content-available-height))]')
    expect(list.className).toContain('overflow-y-auto')
  })

  it('filters the list from the search box', () => {
    render(<FundraisingCart groups={MANY_GROUPS} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search groups' }), { target: { value: 'band' } })
    openGroupList()

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Hardin Valley MS Band 2026',
      'Zane Trace Band Boosters',
    ])
  })

  it('keeps the chosen group in the list while filtering', () => {
    useFundraisingCart.setState({ group: 'Cal U Vulcans Cheer' })
    render(<FundraisingCart groups={MANY_GROUPS} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search groups' }), { target: { value: 'band' } })
    openGroupList()

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toContain('Cal U Vulcans Cheer')
  })

  it('skips the search box for a short list', () => {
    render(<FundraisingCart groups={MANY_GROUPS.slice(0, 3)} />)

    expect(screen.queryByRole('searchbox', { name: 'Search groups' })).not.toBeInTheDocument()
  })
})
