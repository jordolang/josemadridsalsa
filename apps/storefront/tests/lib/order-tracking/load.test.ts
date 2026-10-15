import { describe, expect, it } from 'vitest'
import { statusFromChanges } from '@/lib/order-tracking/load'

describe('statusFromChanges', () => {
  it('reads the new status from an admin status-change audit entry', () => {
    expect(statusFromChanges({ status: { from: 'PENDING', to: 'PROCESSING' }, adminNote: 'private' })).toBe(
      'PROCESSING'
    )
  })

  it('ignores audit entries that did not change the status', () => {
    expect(statusFromChanges({ trackingNumber: '9400' })).toBeNull()
    expect(statusFromChanges(null)).toBeNull()
    expect(statusFromChanges('string')).toBeNull()
  })
})
