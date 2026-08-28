import { describe, it, expect } from 'vitest'
import { isBindableShortcut, matchesShortcut, type ShortcutEvent } from '@/lib/admin-desktop/shortcuts'

function press(key: string, modifiers: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers }
}

describe('matchesShortcut', () => {
  it('accepts Command on macOS and Control on Windows for the same label', () => {
    expect(matchesShortcut('⌘E', press('e', { metaKey: true }))).toBe(true)
    expect(matchesShortcut('⌘E', press('e', { ctrlKey: true }))).toBe(true)
  })

  it('ignores the case the browser reports the key in', () => {
    expect(matchesShortcut('⌘E', press('E', { metaKey: true }))).toBe(true)
  })

  it('refuses the same letter without its modifier', () => {
    // A bare letter belongs to the table's type-ahead.
    expect(matchesShortcut('⌘E', press('e'))).toBe(false)
  })

  it('spells out the glyphs the design draws', () => {
    expect(matchesShortcut('⌘⏎', press('Enter', { metaKey: true }))).toBe(true)
    expect(matchesShortcut('⌘⌫', press('Backspace', { metaKey: true }))).toBe(true)
  })

  it('binds function keys with no modifier at all', () => {
    expect(matchesShortcut('F2', press('F2'))).toBe(true)
    expect(matchesShortcut('F2', press('F2', { metaKey: true }))).toBe(false)
  })

  it('treats shift as part of the combination rather than noise', () => {
    expect(matchesShortcut('⌘⇧E', press('e', { metaKey: true, shiftKey: true }))).toBe(true)
    expect(matchesShortcut('⌘⇧E', press('e', { metaKey: true }))).toBe(false)
    expect(matchesShortcut('⌘E', press('e', { metaKey: true, shiftKey: true }))).toBe(false)
  })

  it('never lets an action take a combination the shell already owns', () => {
    // ⌘K opens the palette and ⌘1–⌘9 switch sections; an action bound to one of
    // them would be dead, and worse, would look bound.
    expect(matchesShortcut('⌘K', press('k', { metaKey: true }))).toBe(false)
    expect(matchesShortcut('⌘3', press('3', { metaKey: true }))).toBe(false)
    expect(isBindableShortcut('⌘K')).toBe(false)
    expect(isBindableShortcut('⌘3')).toBe(false)
  })
})

describe('isBindableShortcut', () => {
  it('accepts the forms the loaders actually emit', () => {
    for (const label of ['⌘E', '⌘⏎', '⌘O', '⌘⇧E', 'F2', 'F12']) {
      expect(isBindableShortcut(label)).toBe(true)
    }
  })

  it('rejects a bare key, which the type-ahead would swallow', () => {
    expect(isBindableShortcut('N')).toBe(false)
    expect(isBindableShortcut('7')).toBe(false)
    expect(isBindableShortcut('')).toBe(false)
  })
})
