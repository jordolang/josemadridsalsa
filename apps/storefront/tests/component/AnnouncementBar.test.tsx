import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnnouncementBarClient } from '@/components/store/announcement-bar-client'
import type { LiveAnnouncement } from '@/lib/cms/queries'

/**
 * The bar picks its announcement from `usePathname()` rather than from the
 * `x-pathname` request header. That is not a style preference: the bar sits in
 * the `(public)` layout, and a `headers()` call there opts every public route
 * out of static rendering, which silently disabled ISR site-wide. These tests
 * pin the path-targeting behaviour that move had to preserve.
 */

const { pathname } = vi.hoisted(() => ({ pathname: { current: '/' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

function announcement(overrides: Partial<LiveAnnouncement> = {}): LiveAnnouncement {
  return {
    id: 'a1',
    message: 'Free shipping over $50',
    variant: 'INFO',
    ctaText: null,
    ctaHref: null,
    dismissible: false,
    targetPaths: [],
    ...overrides,
  }
}

describe('AnnouncementBarClient', () => {
  beforeEach(() => {
    pathname.current = '/'
    window.localStorage.clear()
  })

  it('shows an untargeted announcement everywhere', () => {
    pathname.current = '/products/chipotle'
    render(<AnnouncementBarClient announcements={[announcement()]} />)
    expect(screen.getByText('Free shipping over $50')).toBeInTheDocument()
  })

  it('shows an announcement targeted at the current path', () => {
    pathname.current = '/products/chipotle'
    render(
      <AnnouncementBarClient
        announcements={[announcement({ targetPaths: ['/products'] })]}
      />,
    )
    expect(screen.getByText('Free shipping over $50')).toBeInTheDocument()
  })

  it('renders nothing when no announcement targets the current path', () => {
    pathname.current = '/about'
    const { container } = render(
      <AnnouncementBarClient
        announcements={[announcement({ targetPaths: ['/products'] })]}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('takes the first match, so the highest-priority announcement wins', () => {
    pathname.current = '/products'
    render(
      <AnnouncementBarClient
        announcements={[
          announcement({ id: 'high', message: 'Top priority', targetPaths: ['/products'] }),
          announcement({ id: 'low', message: 'Lower priority', targetPaths: [] }),
        ]}
      />,
    )
    expect(screen.getByText('Top priority')).toBeInTheDocument()
    expect(screen.queryByText('Lower priority')).not.toBeInTheDocument()
  })

  it('hides a dismissible announcement that was already dismissed', () => {
    window.localStorage.setItem('jms-announcement-dismissed:a1', '1')
    const { container } = render(
      <AnnouncementBarClient announcements={[announcement({ dismissible: true })]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the call to action when one is configured', () => {
    render(
      <AnnouncementBarClient
        announcements={[announcement({ ctaText: 'Shop now', ctaHref: '/products' })]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/products')
  })
})
