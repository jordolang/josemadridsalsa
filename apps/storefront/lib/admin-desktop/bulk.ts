/**
 * What the shell can do to several marked rows at once.
 *
 * Nothing new is written for this: a bulk action is an inspector button every
 * marked row already has, run once per row with that row's own command. So it
 * goes through the same write route, permission check and audit row as pressing
 * the button on each record in turn — only the clicking is saved. Buttons that
 * open a sheet are left out; a form filled once cannot mean the same thing for
 * thirty records.
 */

import type { DesktopCommand, Row } from './types'

type WriteCommand = Extract<DesktopCommand, { kind: 'write' }>

export interface BulkAction {
  key: string
  label: string
  danger: boolean
  /** One per marked row, in row order. */
  commands: WriteCommand[]
}

/** The write buttons every one of `rows` offers, in the order the first row shows them. */
export function bulkActions(rows: Row[]): BulkAction[] {
  if (rows.length === 0) return []

  const byKey = new Map<string, BulkAction>()
  rows.forEach((row, index) => {
    const seen = new Set<string>()
    for (const action of row.inspector.actions ?? []) {
      const { command } = action
      if (command.kind !== 'write') continue
      const key = `${command.op}\u0000${action.label}`
      if (seen.has(key)) continue
      seen.add(key)

      const existing = byKey.get(key)
      if (existing) {
        existing.commands.push(command)
        existing.danger ||= Boolean(action.danger || command.danger)
      } else if (index === 0) {
        byKey.set(key, {
          key,
          label: action.label,
          danger: Boolean(action.danger || command.danger),
          commands: [command],
        })
      }
    }
  })

  return [...byKey.values()].filter((action) => action.commands.length === rows.length)
}
