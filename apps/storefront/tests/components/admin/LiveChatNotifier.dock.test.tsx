import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveChatNotifier } from '@/components/admin/LiveChatNotifier'
import {
  DEFAULT_DOCK_POSITION,
  DOCK_STORAGE_KEY,
  DOCK_TOP_INSET,
  readDockPosition,
} from '@/lib/admin/live-chat-dock'

const VIEWPORT = { width: 390, height: 800 }
const TAB_HEIGHT = 120

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

function setViewport({ width, height }: { width: number; height: number }) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: /max-width:\s*767px/.test(query) && width < 768,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }))
}

/** jsdom lays nothing out, so the tab reports a height the geometry can use. */
function stubTabHeight() {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return this.getAttribute('aria-label') === 'Open live chat queue' ? TAB_HEIGHT : 0
    },
  })
}

async function renderTab() {
  render(<LiveChatNotifier />)
  const tab = await screen.findByRole('button', { name: 'Open live chat queue' })
  // Wait for the post-mount effects (stored position, viewport measurement).
  await waitFor(() => expect(tab.style.top).not.toBe(''))
  return tab
}

function drag(tab: HTMLElement, to: { x: number; y: number }) {
  fireEvent.pointerDown(tab, { button: 0, pointerId: 1, clientX: 380, clientY: 400 })
  fireEvent.pointerMove(tab, { pointerId: 1, clientX: to.x, clientY: to.y })
  fireEvent.pointerUp(tab, { pointerId: 1, clientX: to.x, clientY: to.y })
}

describe('LiveChatNotifier dock', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setViewport(VIEWPORT)
    stubTabHeight()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ waiting: [], active: [] }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('starts on the right edge, vertically centred', async () => {
    const tab = await renderTab()
    expect(tab.dataset.dockSide).toBe('right')
    expect(tab.style.right).toBe('0px')
    expect(tab.style.left).toBe('auto')
    // Centre of a 800 - 8 - 72 - 120 = 600px track.
    expect(tab.style.top).toBe(`${DOCK_TOP_INSET + 300}px`)
  })

  it('restores the position saved by a previous session', async () => {
    window.localStorage.setItem(DOCK_STORAGE_KEY, '{"side":"left","offset":0}')
    const tab = await renderTab()
    expect(tab.dataset.dockSide).toBe('left')
    expect(tab.style.left).toBe('0px')
    expect(tab.style.right).toBe('auto')
    expect(tab.style.top).toBe(`${DOCK_TOP_INSET}px`)
  })

  it('drags to a new spot on the same edge and persists it', async () => {
    const tab = await renderTab()
    // Pointer at 248 puts the tab's top edge at 188, i.e. 180px into the track.
    drag(tab, { x: 380, y: 248 })
    expect(tab.style.top).toBe(`${DOCK_TOP_INSET + 180}px`)
    expect(readDockPosition(window.localStorage)).toEqual({ side: 'right', offset: 0.3 })
  })

  it('drags across the midpoint to the opposite edge', async () => {
    const tab = await renderTab()
    drag(tab, { x: 20, y: 400 })
    expect(tab.dataset.dockSide).toBe('left')
    expect(tab.style.left).toBe('0px')
    expect(readDockPosition(window.localStorage).side).toBe('left')
  })

  it('clamps a drag past the bottom of the track', async () => {
    const tab = await renderTab()
    drag(tab, { x: 380, y: 5000 })
    expect(readDockPosition(window.localStorage).offset).toBe(1)
  })

  it('does not open the queue when the press was a drag', async () => {
    const tab = await renderTab()
    drag(tab, { x: 380, y: 120 })
    fireEvent.click(tab)
    expect(screen.queryByText('Live chat queue')).not.toBeInTheDocument()
  })

  it('still opens the queue on a plain tap', async () => {
    const tab = await renderTab()
    fireEvent.pointerDown(tab, { button: 0, pointerId: 1, clientX: 380, clientY: 400 })
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 380, clientY: 400 })
    fireEvent.click(tab)
    expect(await screen.findByText('Live chat queue')).toBeInTheDocument()
  })

  it('treats sub-threshold jitter as a tap, not a drag', async () => {
    const tab = await renderTab()
    const topBefore = tab.style.top
    fireEvent.pointerDown(tab, { button: 0, pointerId: 1, clientX: 380, clientY: 400 })
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 382, clientY: 402 })
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 382, clientY: 402 })
    expect(tab.style.top).toBe(topBefore)
    fireEvent.click(tab)
    expect(await screen.findByText('Live chat queue')).toBeInTheDocument()
  })

  it('opens again on the tap after a drag', async () => {
    const tab = await renderTab()
    drag(tab, { x: 380, y: 120 })
    fireEvent.click(tab)
    fireEvent.pointerDown(tab, { button: 0, pointerId: 2, clientX: 380, clientY: 120 })
    fireEvent.pointerUp(tab, { pointerId: 2, clientX: 380, clientY: 120 })
    fireEvent.click(tab)
    expect(await screen.findByText('Live chat queue')).toBeInTheDocument()
  })

  it('moves with the arrow keys for keyboard and screen-reader users', async () => {
    const tab = await renderTab()
    fireEvent.keyDown(tab, { key: 'ArrowUp' })
    expect(readDockPosition(window.localStorage)).toEqual({ side: 'right', offset: 0.4 })
    fireEvent.keyDown(tab, { key: 'ArrowLeft' })
    expect(readDockPosition(window.localStorage).side).toBe('left')
    fireEvent.keyDown(tab, { key: 'ArrowRight' })
    expect(readDockPosition(window.localStorage).side).toBe('right')
  })

  it('reopens at the default spot after a reset', async () => {
    window.localStorage.setItem(DOCK_STORAGE_KEY, '{"side":"left","offset":0}')
    const tab = await renderTab()
    fireEvent.click(tab)
    fireEvent.click(await screen.findByRole('button', { name: /reset tab position/i }))
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBeNull()
    expect(tab.dataset.dockSide).toBe(DEFAULT_DOCK_POSITION.side)
  })

  it('leaves the desktop pill alone', async () => {
    setViewport({ width: 1280, height: 900 })
    render(<LiveChatNotifier />)
    const tab = await screen.findByRole('button', { name: 'Open live chat queue' })
    await waitFor(() => expect(tab).toBeInTheDocument())
    expect(tab.style.top).toBe('')
    expect(tab.style.left).toBe('')
    fireEvent.pointerDown(tab, { button: 0, pointerId: 1, clientX: 1200, clientY: 800 })
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 100, clientY: 100 })
    expect(tab.style.top).toBe('')
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBeNull()
  })
})
