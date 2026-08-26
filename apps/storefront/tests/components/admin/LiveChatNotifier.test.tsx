import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { LiveChatNotifier } from '@/components/admin/LiveChatNotifier'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

const TAB_POSITION_KEY = 'admin:live-chat-tab-position'

function mockViewport(width: number, height: number) {
  window.innerWidth = width
  window.innerHeight = height
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: width <= 767 && query.includes('767px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })) as unknown as typeof window.matchMedia
}

async function renderNotifier() {
  await act(async () => {
    render(<LiveChatNotifier />)
  })
  return screen.getByRole('button', { name: 'Open live chat queue' })
}

function drag(tab: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: from.x, clientY: from.y })
  fireEvent.pointerMove(tab, { pointerId: 1, clientX: to.x, clientY: to.y })
  fireEvent.pointerUp(tab, { pointerId: 1, clientX: to.x, clientY: to.y })
}

describe('LiveChatNotifier tab position', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockViewport(400, 800)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ waiting: [], active: [] }),
      }),
    )
    // jsdom does not implement pointer capture
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllTimers()
  })

  it('starts pinned to the right edge at mid-height', async () => {
    const tab = await renderNotifier()
    expect(tab.dataset.side).toBe('right')
    expect(tab.style.getPropertyValue('--live-chat-top')).toBe('50%')
  })

  it('moves along the edge on drag and persists the position', async () => {
    const tab = await renderNotifier()

    await act(async () => {
      drag(tab, { x: 390, y: 400 }, { x: 390, y: 200 })
    })

    expect(tab.dataset.side).toBe('right')
    expect(tab.style.getPropertyValue('--live-chat-top')).toBe('25%')
    expect(JSON.parse(window.localStorage.getItem(TAB_POSITION_KEY) ?? '{}')).toEqual({
      side: 'right',
      topPct: 25,
    })
  })

  it('snaps to the left edge when dragged across the midpoint', async () => {
    const tab = await renderNotifier()

    await act(async () => {
      drag(tab, { x: 390, y: 400 }, { x: 20, y: 600 })
    })

    expect(tab.dataset.side).toBe('left')
    expect(tab.style.getPropertyValue('--live-chat-top')).toBe('75%')
  })

  it('does not open the queue panel when the tap was a drag', async () => {
    const tab = await renderNotifier()

    await act(async () => {
      drag(tab, { x: 390, y: 400 }, { x: 390, y: 240 })
      fireEvent.click(tab)
    })

    expect(screen.queryByText('Live chat queue')).not.toBeInTheDocument()
  })

  it('still opens the queue panel on a plain tap', async () => {
    const tab = await renderNotifier()

    await act(async () => {
      fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 390, clientY: 400 })
      fireEvent.pointerUp(tab, { pointerId: 1, clientX: 390, clientY: 400 })
      fireEvent.click(tab)
    })

    expect(screen.getByText('Live chat queue')).toBeInTheDocument()
  })

  it('restores a stored position on mount', async () => {
    window.localStorage.setItem(TAB_POSITION_KEY, JSON.stringify({ side: 'left', topPct: 80 }))
    const tab = await renderNotifier()

    expect(tab.dataset.side).toBe('left')
    expect(tab.style.getPropertyValue('--live-chat-top')).toBe('80%')
  })

  it('ignores an unusable stored position', async () => {
    window.localStorage.setItem(TAB_POSITION_KEY, 'not-json')
    const tab = await renderNotifier()

    expect(tab.dataset.side).toBe('right')
    expect(tab.style.getPropertyValue('--live-chat-top')).toBe('50%')
  })

  it('leaves the tab where it is on desktop widths', async () => {
    mockViewport(1280, 900)
    const tab = await renderNotifier()

    await act(async () => {
      drag(tab, { x: 1200, y: 800 }, { x: 200, y: 200 })
    })

    expect(tab.dataset.side).toBe('right')
    expect(tab.style.getPropertyValue('--live-chat-top')).toBe('50%')
  })
})
