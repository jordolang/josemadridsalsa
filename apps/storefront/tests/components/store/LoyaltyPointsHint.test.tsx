import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const session = { status: 'unauthenticated' }
vi.mock('next-auth/react', () => ({ useSession: () => session }))

const { LoyaltyPointsHint } = await import('@/components/store/LoyaltyPointsHint')

describe('LoyaltyPointsHint', () => {
  beforeEach(() => {
    session.status = 'unauthenticated'
  })

  it('shows signed-in customers the points the amount earns', () => {
    session.status = 'authenticated'
    render(<LoyaltyPointsHint amount={8.99} callbackUrl="/cart" subject="this order" />)

    expect(screen.getByText(/Earn/)).toHaveTextContent('Earn 89 points with this order.')
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
  })

  it('asks guests to sign in, returning them to the same page', () => {
    render(<LoyaltyPointsHint amount={10} callbackUrl="/products/mild salsa" subject="every jar" />)

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth/signin?callbackUrl=%2Fproducts%2Fmild%20salsa',
    )
    expect(screen.getByRole('link', { name: 'How rewards work' })).toHaveAttribute('href', '/rewards')
  })

  it('renders nothing when the amount earns no points', () => {
    const { container } = render(<LoyaltyPointsHint amount={0} callbackUrl="/cart" subject="this order" />)

    expect(container).toBeEmptyDOMElement()
  })
})
