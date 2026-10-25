import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const { SimplePanel, NAV_GROUPS } = await import('@/components/store/navigation')

describe('SimplePanel', () => {
  it('draws the featured link first, so desktop users can reach it', () => {
    render(
      <SimplePanel
        pathname="/"
        group={{
          id: 'fundraising',
          title: 'Fundraising',
          featured: { href: 'https://fund.example/start', label: 'Start a Fundraiser', hint: 'Earn 50%' },
          items: [{ name: 'Fundraising Home', href: 'https://fund.example/', description: 'Home' }],
        }}
      />,
    )

    const links = screen.getAllByRole('menuitem')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Start a Fundraiser')
    expect(links[0]).toHaveAttribute('href', 'https://fund.example/start')
    expect(links[1]).toHaveTextContent('Fundraising Home')
  })

  it('sends Fundraiser Login to the portal dashboard, not the bare /fundraiser-portal 404', () => {
    const login = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.name === 'Fundraiser Login')
    expect(login?.href).toMatch(/\/fundraiser-portal\/dashboard$/)
  })
})
