/**
 * Geometry and persistence for the floating "Live chats" tab in the admin panel.
 *
 * On phones the tab is a vertical pill pinned to a screen edge, so wherever it
 * sits it covers whatever is underneath it — on a table it lands squarely on the
 * row action buttons. These helpers let the tab be dragged along either edge and
 * remember where the admin put it.
 *
 * `offset` is stored as a fraction of the usable vertical track rather than a
 * pixel value so the tab keeps its relative spot across rotation and across
 * devices sharing a login.
 */

export type DockSide = 'left' | 'right'

export interface DockPosition {
  side: DockSide
  /** 0 = top of the track, 1 = bottom of the track. */
  offset: number
}

export interface DockTrack {
  viewportHeight: number
  tabHeight: number
  /** Space kept clear at the top (status bar / safe area). */
  topInset?: number
  /** Space kept clear at the bottom, mainly the mobile tab bar. */
  bottomInset?: number
}

export const DOCK_STORAGE_KEY = 'jms.admin.live-chat-dock.v1'

/** Matches the pre-drag CSS default: right edge, vertically centred. */
export const DEFAULT_DOCK_POSITION: DockPosition = { side: 'right', offset: 0.5 }

/** Roughly the height of MobileTabBar plus its safe-area padding. */
export const DOCK_BOTTOM_INSET = 72

/** Keeps the tab clear of the notch / status bar. */
export const DOCK_TOP_INSET = 8

/** Pointer travel, in px, before a press turns into a drag instead of a tap. */
export const DOCK_DRAG_THRESHOLD = 6

/** How far one arrow-key press nudges the tab, as a fraction of the track. */
export const DOCK_KEYBOARD_STEP = 0.1

export function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DOCK_POSITION.offset
  return Math.min(1, Math.max(0, value))
}

function trackLength({
  viewportHeight,
  tabHeight,
  topInset = DOCK_TOP_INSET,
  bottomInset = DOCK_BOTTOM_INSET,
}: DockTrack): number {
  return Math.max(0, viewportHeight - topInset - bottomInset - tabHeight)
}

/** Which edge a pointer at `clientX` should dock to. */
export function sideForClientX(clientX: number, viewportWidth: number): DockSide {
  return clientX < viewportWidth / 2 ? 'left' : 'right'
}

/** Turns a pointer's y coordinate into a stored offset, centring the tab on it. */
export function offsetForClientY(clientY: number, track: DockTrack): number {
  const length = trackLength(track)
  if (length <= 0) return 0
  const topInset = track.topInset ?? DOCK_TOP_INSET
  return clampOffset((clientY - track.tabHeight / 2 - topInset) / length)
}

/** Turns a stored offset back into a `top` value in px. */
export function topForOffset(offset: number, track: DockTrack): number {
  const topInset = track.topInset ?? DOCK_TOP_INSET
  return topInset + clampOffset(offset) * trackLength(track)
}

export function isDockPosition(value: unknown): value is DockPosition {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { side?: unknown; offset?: unknown }
  if (candidate.side !== 'left' && candidate.side !== 'right') return false
  return typeof candidate.offset === 'number' && Number.isFinite(candidate.offset)
}

export function parseDockPosition(raw: string | null | undefined): DockPosition | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isDockPosition(parsed)) return null
    return { side: parsed.side, offset: clampOffset(parsed.offset) }
  } catch {
    return null
  }
}

/**
 * Storage access is best-effort throughout: Safari private mode throws on both
 * read and write, and a corrupt value should fall back to the default rather
 * than strand the tab.
 */
export function readDockPosition(storage?: Pick<Storage, 'getItem'> | null): DockPosition {
  if (!storage) return DEFAULT_DOCK_POSITION
  try {
    return parseDockPosition(storage.getItem(DOCK_STORAGE_KEY)) ?? DEFAULT_DOCK_POSITION
  } catch {
    return DEFAULT_DOCK_POSITION
  }
}

export function writeDockPosition(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  position: DockPosition,
): void {
  if (!storage) return
  try {
    storage.setItem(
      DOCK_STORAGE_KEY,
      JSON.stringify({ side: position.side, offset: clampOffset(position.offset) }),
    )
  } catch {
    // position just won't survive a reload
  }
}

export function clearDockPosition(storage?: Pick<Storage, 'removeItem'> | null): void {
  if (!storage) return
  try {
    storage.removeItem(DOCK_STORAGE_KEY)
  } catch {
    // nothing to clean up
  }
}
