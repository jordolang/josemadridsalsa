import { describe, it, expect } from 'vitest'
import {
  DEFAULT_DOCK_POSITION,
  DOCK_BOTTOM_INSET,
  DOCK_STORAGE_KEY,
  DOCK_TOP_INSET,
  clampOffset,
  clearDockPosition,
  offsetForClientY,
  parseDockPosition,
  readDockPosition,
  sideForClientX,
  topForOffset,
  writeDockPosition,
} from '@/lib/admin/live-chat-dock'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  }
}

const throwingStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('SecurityError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

// A 800px-tall phone with a 120px tab leaves 800 - 8 - 72 - 120 = 600px of track.
const track = { viewportHeight: 800, tabHeight: 120 }

describe('clampOffset', () => {
  it('keeps values inside the track', () => {
    expect(clampOffset(-2)).toBe(0)
    expect(clampOffset(0.25)).toBe(0.25)
    expect(clampOffset(4)).toBe(1)
  })

  it('falls back to the default for non-finite input', () => {
    expect(clampOffset(Number.NaN)).toBe(DEFAULT_DOCK_POSITION.offset)
    expect(clampOffset(Number.POSITIVE_INFINITY)).toBe(DEFAULT_DOCK_POSITION.offset)
  })
})

describe('sideForClientX', () => {
  it('docks to whichever half of the screen the pointer is in', () => {
    expect(sideForClientX(10, 400)).toBe('left')
    expect(sideForClientX(199, 400)).toBe('left')
    expect(sideForClientX(200, 400)).toBe('right')
    expect(sideForClientX(390, 400)).toBe('right')
  })
})

describe('offsetForClientY', () => {
  it('centres the tab on the pointer', () => {
    // Pointer at 368 => top edge at 308 => 300px into a 600px track.
    expect(offsetForClientY(368, track)).toBeCloseTo(0.5)
  })

  it('clamps a pointer dragged past either end of the track', () => {
    expect(offsetForClientY(-500, track)).toBe(0)
    expect(offsetForClientY(5000, track)).toBe(1)
  })

  it('returns 0 when the tab is taller than the available track', () => {
    expect(offsetForClientY(300, { viewportHeight: 200, tabHeight: 400 })).toBe(0)
  })
})

describe('topForOffset', () => {
  it('maps the ends of the track to the insets', () => {
    expect(topForOffset(0, track)).toBe(DOCK_TOP_INSET)
    expect(topForOffset(1, track)).toBe(800 - DOCK_BOTTOM_INSET - 120)
  })

  it('round-trips with offsetForClientY', () => {
    const offset = offsetForClientY(500, track)
    // The stored offset puts the tab's top edge half a tab above the pointer.
    expect(topForOffset(offset, track) + track.tabHeight / 2).toBeCloseTo(500)
  })

  it('honours custom insets', () => {
    expect(topForOffset(0, { ...track, topInset: 40 })).toBe(40)
  })
})

describe('parseDockPosition', () => {
  it('accepts a well-formed value', () => {
    expect(parseDockPosition('{"side":"left","offset":0.2}')).toEqual({ side: 'left', offset: 0.2 })
  })

  it('clamps an out-of-range offset rather than rejecting it', () => {
    expect(parseDockPosition('{"side":"right","offset":9}')).toEqual({ side: 'right', offset: 1 })
  })

  it.each([
    ['empty', ''],
    ['not json', 'not json'],
    ['null', 'null'],
    ['a bare number', '5'],
    ['an unknown side', '{"side":"top","offset":0.5}'],
    ['a missing offset', '{"side":"left"}'],
    ['a non-numeric offset', '{"side":"left","offset":"0.5"}'],
  ])('rejects %s', (_label, raw) => {
    expect(parseDockPosition(raw)).toBeNull()
  })
})

describe('readDockPosition', () => {
  it('reads a stored position', () => {
    const storage = memoryStorage({ [DOCK_STORAGE_KEY]: '{"side":"left","offset":0.1}' })
    expect(readDockPosition(storage)).toEqual({ side: 'left', offset: 0.1 })
  })

  it('falls back to the default when nothing is stored or the value is junk', () => {
    expect(readDockPosition(memoryStorage())).toEqual(DEFAULT_DOCK_POSITION)
    expect(readDockPosition(memoryStorage({ [DOCK_STORAGE_KEY]: '{{' }))).toEqual(
      DEFAULT_DOCK_POSITION,
    )
    expect(readDockPosition(null)).toEqual(DEFAULT_DOCK_POSITION)
  })

  it('survives storage that throws, as in Safari private mode', () => {
    expect(readDockPosition(throwingStorage)).toEqual(DEFAULT_DOCK_POSITION)
  })
})

describe('writeDockPosition', () => {
  it('persists a clamped position', () => {
    const storage = memoryStorage()
    writeDockPosition(storage, { side: 'left', offset: 2 })
    expect(JSON.parse(storage.map.get(DOCK_STORAGE_KEY)!)).toEqual({ side: 'left', offset: 1 })
  })

  it('is a no-op when storage is missing or throws', () => {
    expect(() => writeDockPosition(null, DEFAULT_DOCK_POSITION)).not.toThrow()
    expect(() => writeDockPosition(throwingStorage, DEFAULT_DOCK_POSITION)).not.toThrow()
  })
})

describe('clearDockPosition', () => {
  it('removes the stored position', () => {
    const storage = memoryStorage({ [DOCK_STORAGE_KEY]: '{"side":"left","offset":0.1}' })
    clearDockPosition(storage)
    expect(storage.map.has(DOCK_STORAGE_KEY)).toBe(false)
    expect(readDockPosition(storage)).toEqual(DEFAULT_DOCK_POSITION)
  })

  it('is a no-op when storage is missing or throws', () => {
    expect(() => clearDockPosition(null)).not.toThrow()
    expect(() => clearDockPosition(throwingStorage)).not.toThrow()
  })
})
