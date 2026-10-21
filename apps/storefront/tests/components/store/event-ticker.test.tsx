// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import { EventTicker } from '@/components/store/event-ticker'

const EVENT = {
  id: 'evt-1',
  title: 'Zanesville Farmers Market',
  location: 'Zanesville, OH',
  start: '2026-10-24T09:00:00-04:00',
  isAllDay: false,
}

describe('EventTicker', () => {
  it('renders the bar in the server HTML so it does not shift the page after hydration', () => {
    const html = renderToString(<EventTicker initialEvents={[EVENT]} />)

    expect(html).toContain('Find Us')
    expect(html).toContain('height:44px')
  })

  it('fills in the event text once mounted', () => {
    const { container } = render(<EventTicker initialEvents={[EVENT]} />)

    expect(container.textContent).toContain('ZANESVILLE FARMERS MARKET')
  })

  it('renders nothing when no event has a place and time', () => {
    expect(renderToString(<EventTicker initialEvents={[{ ...EVENT, location: '' }]} />)).toBe('')
  })
})
