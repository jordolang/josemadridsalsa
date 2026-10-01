import { describe, it, expect } from 'vitest'
import { bulkActions } from '@/lib/admin-desktop/bulk'
import type { InspectorAction, Row } from '@/lib/admin-desktop/types'

function row(id: string, actions: InspectorAction[]): Row {
  return { id, search: id, buckets: [0], cells: [], inspector: { title: id, groups: [], actions } }
}

const markPaid = (id: string): InspectorAction => ({
  label: 'Mark paid',
  command: { kind: 'write', op: 'order.markPaid', recordId: id, confirm: 'Sure?' },
})
const cancel = (id: string): InspectorAction => ({
  label: 'Cancel order',
  danger: true,
  command: { kind: 'write', op: 'order.cancel', recordId: id },
})
const edit = (id: string): InspectorAction => ({
  label: 'Edit order…',
  command: { kind: 'form', form: 'order.status', recordId: id },
})

describe('bulkActions', () => {
  it('offers only the writes every marked row has, each with its own record', () => {
    const actions = bulkActions([row('a', [edit('a'), markPaid('a'), cancel('a')]), row('b', [cancel('b')])])

    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ label: 'Cancel order', danger: true })
    expect(actions[0].commands.map((command) => command.recordId)).toEqual(['a', 'b'])
  })

  it('never offers a sheet', () => {
    expect(bulkActions([row('a', [edit('a')]), row('b', [edit('b')])])).toEqual([])
  })

  it('offers nothing for nothing marked', () => {
    expect(bulkActions([])).toEqual([])
  })
})
