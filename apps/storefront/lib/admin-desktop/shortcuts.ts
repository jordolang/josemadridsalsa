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

/**
 * Combinations an inspector action may not take.
 *
 * Two groups, and the second is the one that bites. The shell owns `⌘K` and the
 * section digits, so binding those here would be dead code. But the packaged
 * windows put a native menu in front of the page: Electron's menu and SwiftUI's
 * `CommandGroup` both handle their accelerators *before* the web view sees a
 * `keydown`, so an action on `⌘R` would reload the window rather than run, and
 * would do it while the button still advertised the key. Those are listed from
 * `apps/windows-admin/src/main/menu.ts` and `JoseMadridAdminApp.swift`, plus the
 * macOS system-wide ones no application menu can take back.
 */
const RESERVED = new Set([
  // The shell's own.
  '⌘K',
  ...Array.from({ length: 9 }, (_, index) => `⌘${index + 1}`),
  // Both native menus.
  '⌘R', // Reload
  '⌘⇧R', // Force reload
  '⌘P', // Print
  '⌘,', // Settings
  '⌘Z', // Undo
  '⌘⇧Z', // Redo
  '⌘X', // Cut
  '⌘C', // Copy
  '⌘V', // Paste
  '⌘A', // Select all
  '⌘M', // Minimise
  '⌘W', // Close window
  '⌘Q', // Quit
  '⌘0', // Reset zoom
  // macOS only, but reserved on both so one label works in both windows.
  '⌘H', // Hide application
  '⌘[', // Back
  '⌘]', // Forward
])

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
