import { describe, expect, it } from 'vitest'
import { resolvePunchCorrection } from '@/lib/timeclock-admin'

const now = new Date('2026-10-23T12:00:00Z')
const stored = {
  clockInAt: new Date('2026-10-09T13:45:50Z'),
  clockOutAt: new Date('2026-10-09T18:00:05Z'),
}
const base = {
  clockInAt: '2026-10-09T09:45',
  clockOutAt: '2026-10-09T14:00',
  notes: 'Labeled salsa and packed for Sauerkraut Festival',
  reason: 'Forgot to clock out',
}

describe('resolvePunchCorrection', () => {
  it('converts Zanesville wall times to instants', () => {
    const result = resolvePunchCorrection(base, stored, now)
    expect(result).toEqual({
      ok: true,
      clockInAt: new Date('2026-10-09T13:45:00Z'),
      clockOutAt: new Date('2026-10-09T18:00:00Z'),
      notes: base.notes,
      reason: base.reason,
    })
  })

  it('stores empty notes as null', () => {
    const result = resolvePunchCorrection({ ...base, notes: '' }, stored, now)
    expect(result.ok && result.notes).toBeNull()
  })

  it('rejects a clock-out before the clock-in', () => {
    expect(resolvePunchCorrection({ ...base, clockOutAt: '2026-10-09T09:00' }, stored, now)).toEqual({
      ok: false,
      error: 'Clock-out must be after clock-in',
    })
  })

  it('rejects a clock-out in the future', () => {
    expect(resolvePunchCorrection({ ...base, clockOutAt: '2026-10-24T09:00' }, stored, now).ok).toBe(false)
  })

  it('rejects a shift longer than 24 hours', () => {
    expect(resolvePunchCorrection({ ...base, clockOutAt: '2026-10-10T10:00' }, stored, now).ok).toBe(false)
  })

  it('keeps the stored instants, seconds included, for omitted times', () => {
    const result = resolvePunchCorrection(
      { notes: 'Labeled salsa', reason: 'Add duties' },
      stored,
      now
    )
    expect(result).toMatchObject({ ok: true, ...stored })
  })

  it('requires a clock-out when the punch is still open', () => {
    expect(
      resolvePunchCorrection({ notes: '', reason: 'Fix' }, { ...stored, clockOutAt: null }, now)
    ).toEqual({ ok: false, error: 'Set a clock-out time' })
  })

  it('rejects unparseable times', () => {
    expect(resolvePunchCorrection({ ...base, clockInAt: 'yesterday' }, stored, now).ok).toBe(false)
  })
})
