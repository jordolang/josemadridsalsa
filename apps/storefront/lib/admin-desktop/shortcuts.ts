/**
 * Matching the inspector's shortcut labels against real key events.
 *
 * A label is written the way the design draws it — `⌘E`, `F2`, `⌘⇧E` — so the
 * same string is both what the operator reads and what the shell binds; there
 * is no second table to keep in step. `⌘` accepts Ctrl too, because the Windows
 * window sends Ctrl where the macOS one sends Command.
 */

/** The subset of `KeyboardEvent` this needs, so the matcher is testable. */
export interface ShortcutEvent {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** Combinations the shell itself owns. An action may not quietly steal one. */
const RESERVED = new Set(['⌘K', ...Array.from({ length: 9 }, (_, index) => `⌘${index + 1}`)])

/** Glyphs the design uses for keys that `KeyboardEvent.key` spells out. */
const NAMED: Record<string, string> = {
  '⏎': 'enter',
  '⌫': 'backspace',
  '⎋': 'escape',
}

const MODIFIERS = '⌘⇧⌥'

interface ParsedShortcut {
  accel: boolean
  shift: boolean
  alt: boolean
  key: string
}

function parse(label: string): ParsedShortcut | null {
  let rest = label.trim()
  if (!rest) return null

  let accel = false
  let shift = false
  let alt = false

  while (rest.length > 1 && MODIFIERS.includes(rest[0])) {
    if (rest[0] === '⌘') accel = true
    else if (rest[0] === '⇧') shift = true
    else alt = true
    rest = rest.slice(1)
  }

  const key = NAMED[rest] ?? rest.toLowerCase()
  if (!key) return null

  // A bare letter or digit belongs to the table's type-ahead, so only modified
  // combinations and function keys are bindable.
  if (!accel && !alt && !/^f\d{1,2}$/.test(key)) return null

  return { accel, shift, alt, key }
}

export function isBindableShortcut(label: string): boolean {
  return !RESERVED.has(label) && parse(label) !== null
}

export function matchesShortcut(label: string, event: ShortcutEvent): boolean {
  if (RESERVED.has(label)) return false

  const wanted = parse(label)
  if (!wanted) return false

  return (
    wanted.accel === (event.metaKey || event.ctrlKey) &&
    wanted.shift === event.shiftKey &&
    wanted.alt === event.altKey &&
    wanted.key === event.key.toLowerCase()
  )
}
