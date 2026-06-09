import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileOrdersList } from '@/components/admin/mobile/MobileOrdersList'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/orders',
  useSearchParams: () => new URLSearchParams(),
}))

const buildOrder = (
  overrides: Partial<{
    id: string
    orderNumber: string
    status: string
    total: number | string
    customerName: string
  }> = {},
) => ({
  id: overrides.id ?? '1',
  orderNumber: overrides.orderNumber ?? 'ON-0001',
  status: overrides.status ?? 'PENDING',
  total: overrides.total ?? '12.50',
  createdAt: new Date('2026-05-12T12:00:00Z').toISOString(),
  customerName: overrides.customerName ?? 'Acme Corp',
  itemCount: 1,
})

describe('MobileOrdersList', () => {
  it('renders an order card per row', () => {
    render(
      <MobileOrdersList
        orders={[buildOrder({ orderNumber: 'ON-1' }), buildOrder({ id: '2', orderNumber: 'ON-2' })]}
        total={2}
        page={1}
        totalPages={1}
      />,
    )
    expect(screen.getByText('ON-1')).toBeInTheDocument()
    expect(screen.getByText('ON-2')).toBeInTheDocument()
  })

  it('shows empty state when there are no orders', () => {
    render(
      <MobileOrdersList orders={[]} total={0} page={1} totalPages={1} />,
    )
    expect(screen.getByText(/no orders match/i)).toBeInTheDocument()
  })

  it('renders the load-more button when more pages remain', () => {
    render(
      <MobileOrdersList
        orders={[buildOrder()]}
        total={120}
        page={1}
        totalPages={3}
      />,
    )
    expect(
      screen.getByRole('button', { name: /load more/i }),
    ).toBeInTheDocument()
  })

  it('hides the load-more button on the final page', () => {
    render(
      <MobileOrdersList
        orders={[buildOrder()]}
        total={1}
        page={1}
        totalPages={1}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /load more/i }),
    ).not.toBeInTheDocument()
  })

  it('renders all status filter chips', () => {
    render(
      <MobileOrdersList orders={[]} total={0} page={1} totalPages={1} />,
    )
    expect(
      screen.getByRole('button', { name: 'All' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pending' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Shipped' }),
    ).toBeInTheDocument()
  })
})
