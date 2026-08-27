'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DEFAULT_DOCK_POSITION,
  DOCK_DRAG_THRESHOLD,
  DOCK_KEYBOARD_STEP,
  clampOffset,
  clearDockPosition,
  offsetForClientY,
  readDockPosition,
  sideForClientX,
  topForOffset,
  writeDockPosition,
  type DockPosition,
} from '@/lib/admin/live-chat-dock'

interface Viewport {
  width: number
  height: number
}

/**
 * Reading `window.localStorage` throws SecurityError where the browser denies
 * storage (sandboxed or opaque origins, privacy modes that disable it), so the
 * property access itself has to be guarded — the persistence helpers' own
 * try/catch is too late, the throw happens while evaluating their argument.
 */
function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface LiveChatDock {
  ref: (node: HTMLElement | null) => void
  position: DockPosition
  dragging: boolean
  /** Geometry overrides; empty until the stored position has been read. */
  style: CSSProperties
  /** True while a drag is in flight or has just ended — the click is not a tap. */
  consumeDrag: () => boolean
  reset: () => void
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
}

/**
 * Makes the floating live-chat tab draggable along either screen edge and
 * remembers where it was left. Pass `enabled: false` (desktop) to leave the
 * element entirely under its stylesheet positioning.
 */
export function useLiveChatDock(enabled: boolean): LiveChatDock {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<DockPosition>(DEFAULT_DOCK_POSITION)
  const [hydrated, setHydrated] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 })
  const [tabHeight, setTabHeight] = useState(0)

  const originRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  const draggedRef = useRef(false)
  const positionRef = useRef<DockPosition>(DEFAULT_DOCK_POSITION)

  positionRef.current = position

  // Read the saved spot after mount so server and client render identically.
  useEffect(() => {
    setPosition(readDockPosition(safeLocalStorage()))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [])

  useEffect(() => {
    if (!node) return
    const measureTab = () => setTabHeight(node.offsetHeight)
    measureTab()
    // The waiting-count badge appears and disappears with the queue poll, which
    // changes the pill's height without any of this effect's deps changing.
    // Observe the element so the reserved bottom gap stays accurate.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measureTab)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, enabled, viewport.height])

  const commit = useCallback((next: DockPosition) => {
    setPosition(next)
    writeDockPosition(safeLocalStorage(), next)
  }, [])

  const reset = useCallback(() => {
    setPosition(DEFAULT_DOCK_POSITION)
    clearDockPosition(safeLocalStorage())
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return
      originRef.current = { x: event.clientX, y: event.clientY }
      movedRef.current = false
      // A drag that ends off the element may never fire a click, so clear the
      // suppression flag here instead — every fresh press starts as a tap.
      draggedRef.current = false
      const target = event.currentTarget
      // jsdom and older Safari lack pointer capture; dragging still works via
      // the listeners below, it just ends early if the pointer leaves the tab.
      if (typeof target.setPointerCapture === 'function') {
        try {
          target.setPointerCapture(event.pointerId)
        } catch {
          // capture is an optimisation, not a requirement
        }
      }
    },
    [enabled],
  )

  // Move/up live on the element rather than in React props so a drag that
  // starts on the tab keeps tracking after the pointer slides off it.
  useEffect(() => {
    if (!enabled || !node) return

    const handleMove = (event: PointerEvent) => {
      const origin = originRef.current
      if (!origin) return
      if (!movedRef.current) {
        const travelled = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
        if (travelled < DOCK_DRAG_THRESHOLD) return
        movedRef.current = true
        draggedRef.current = true
        setDragging(true)
      }
      event.preventDefault()
      const height = node.offsetHeight
      setPosition({
        side: sideForClientX(event.clientX, window.innerWidth),
        offset: offsetForClientY(event.clientY, {
          viewportHeight: window.innerHeight,
          tabHeight: height,
        }),
      })
    }

    const handleEnd = (event: PointerEvent) => {
      if (!originRef.current) return
      originRef.current = null
      if (typeof node.releasePointerCapture === 'function' && node.hasPointerCapture?.(event.pointerId)) {
        try {
          node.releasePointerCapture(event.pointerId)
        } catch {
          // already released
        }
      }
      if (!movedRef.current) return
      movedRef.current = false
      setDragging(false)
      writeDockPosition(window.localStorage, positionRef.current)
    }

    node.addEventListener('pointermove', handleMove)
    node.addEventListener('pointerup', handleEnd)
    node.addEventListener('pointercancel', handleEnd)
    return () => {
      node.removeEventListener('pointermove', handleMove)
      node.removeEventListener('pointerup', handleEnd)
      node.removeEventListener('pointercancel', handleEnd)
    }
  }, [enabled, node])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled) return
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          commit({ ...position, offset: clampOffset(position.offset - DOCK_KEYBOARD_STEP) })
          break
        case 'ArrowDown':
          event.preventDefault()
          commit({ ...position, offset: clampOffset(position.offset + DOCK_KEYBOARD_STEP) })
          break
        case 'ArrowLeft':
          event.preventDefault()
          commit({ ...position, side: 'left' })
          break
        case 'ArrowRight':
          event.preventDefault()
          commit({ ...position, side: 'right' })
          break
        default:
          break
      }
    },
    [commit, enabled, position],
  )

  const consumeDrag = useCallback(() => {
    const dragged = draggedRef.current
    draggedRef.current = false
    return dragged
  }, [])

  // Before hydration (and on desktop) the stylesheet owns the geometry, so the
  // tab renders in its default spot with no server/client mismatch.
  const style: CSSProperties =
    enabled && hydrated && viewport.height > 0
      ? {
          top: topForOffset(position.offset, {
            viewportHeight: viewport.height,
            tabHeight,
          }),
          bottom: 'auto',
          left: position.side === 'left' ? 0 : 'auto',
          right: position.side === 'right' ? 0 : 'auto',
          translate: 'none',
        }
      : {}

  return {
    ref: setNode,
    position,
    dragging,
    style,
    consumeDrag,
    reset,
    onPointerDown,
    onKeyDown,
  }
}
