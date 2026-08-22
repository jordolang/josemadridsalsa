import { describe, expect, it } from 'vitest'
import {
  fromGoogleDate,
  fromGoogleEvent,
  toGoogleDate,
  toGoogleEvent,
  type PushableEvent,
} from '@/lib/events/google-event-mapping'

/** All-day events sit on UTC midnight of the calendar date. */
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const utc = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min))

const pushable = (overrides: Partial<PushableEvent> = {}): PushableEvent => ({
  title: 'Zanesville Festival',
  description: null,
  location: 'Riverside Park',
  startDate: day(2026, 8, 29),
  endDate: null,
  isAllDay: true,
  bookingStatus: 'CONFIRMED',
  ...overrides,
})

describe('date helpers', () => {
  it('formats a UTC-midnight instant as a bare calendar date', () => {
    expect(toGoogleDate(day(2026, 8, 29))).toBe('2026-08-29')
  })

  it('pads single-digit months and days', () => {
    expect(toGoogleDate(day(2026, 1, 5))).toBe('2026-01-05')
  })

  it('round-trips a bare date back to UTC midnight', () => {
    expect(fromGoogleDate('2026-08-29').toISOString()).toBe('2026-08-29T00:00:00.000Z')
  })
})

describe('toGoogleEvent — all-day', () => {
  it('sends a bare date with an exclusive end one day later', () => {
    expect(toGoogleEvent(pushable())).toMatchObject({
      start: { date: '2026-08-29' },
      end: { date: '2026-08-30' },
    })
  })

  it('spans a multi-day show through the day after its last', () => {
    expect(toGoogleEvent(pushable({ endDate: day(2026, 8, 31) }))).toMatchObject({
      start: { date: '2026-08-29' },
      end: { date: '2026-09-01' },
    })
  })

  it('ignores an end that precedes the start', () => {
    expect(toGoogleEvent(pushable({ endDate: day(2026, 8, 1) })).end).toEqual({
      date: '2026-08-30',
    })
  })
})

describe('toGoogleEvent — timed', () => {
  const timed = (o: Partial<PushableEvent> = {}) =>
    pushable({ isAllDay: false, startDate: utc(2026, 8, 29, 14), ...o })

  it('sends ISO instants', () => {
    expect(toGoogleEvent(timed({ endDate: utc(2026, 8, 29, 22) }))).toMatchObject({
      start: { dateTime: '2026-08-29T14:00:00.000Z' },
      end: { dateTime: '2026-08-29T22:00:00.000Z' },
    })
  })

  it('invents a one-hour end when none is recorded, since Google requires one', () => {
    expect(toGoogleEvent(timed({ endDate: null })).end).toEqual({
      dateTime: '2026-08-29T15:00:00.000Z',
    })
  })

  it('does the same when the stored end is not after the start', () => {
    expect(toGoogleEvent(timed({ endDate: utc(2026, 8, 29, 14) })).end).toEqual({
      dateTime: '2026-08-29T15:00:00.000Z',
    })
  })
})

describe('toGoogleEvent — fields and status', () => {
  it('marks a booked show confirmed', () => {
    expect(toGoogleEvent(pushable({ bookingStatus: 'CONFIRMED' })).status).toBe('confirmed')
    expect(toGoogleEvent(pushable({ bookingStatus: 'ACCEPTED' })).status).toBe('confirmed')
  })

  it('marks anything short of booked tentative', () => {
    expect(toGoogleEvent(pushable({ bookingStatus: 'APPLIED' })).status).toBe('tentative')
    expect(toGoogleEvent(pushable({ bookingStatus: 'WAITLISTED' })).status).toBe('tentative')
  })

  it('omits empty optional fields rather than sending empty strings', () => {
    const body = toGoogleEvent(pushable({ description: null, location: null }))
    expect(body).not.toHaveProperty('description')
    expect(body).not.toHaveProperty('location')
  })

  it('includes them when present', () => {
    const body = toGoogleEvent(pushable({ description: 'Bring the big tent' }))
    expect(body.description).toBe('Bring the big tent')
    expect(body.location).toBe('Riverside Park')
  })
})

describe('fromGoogleEvent — all-day', () => {
  it('reads a bare date as UTC midnight', () => {
    const parsed = fromGoogleEvent({
      id: 'g1',
      summary: 'Zanesville Festival',
      start: { date: '2026-08-29' },
      end: { date: '2026-08-30' },
    })
    expect(parsed?.isAllDay).toBe(true)
    expect(parsed?.startDate.toISOString()).toBe('2026-08-29T00:00:00.000Z')
  })

  it('converts the exclusive end back to an inclusive last day', () => {
    const parsed = fromGoogleEvent({
      id: 'g1',
      start: { date: '2026-08-29' },
      end: { date: '2026-09-01' },
    })
    expect(parsed?.endDate?.toISOString()).toBe('2026-08-31T00:00:00.000Z')
  })

  it('leaves a one-day event with no end rather than repeating the start', () => {
    const parsed = fromGoogleEvent({
      id: 'g1',
      start: { date: '2026-08-29' },
      end: { date: '2026-08-30' },
    })
    expect(parsed?.endDate).toBeNull()
  })

  it('survives a missing end block', () => {
    const parsed = fromGoogleEvent({ id: 'g1', start: { date: '2026-08-29' } })
    expect(parsed?.endDate).toBeNull()
  })

  it('round-trips through toGoogleEvent unchanged', () => {
    const original = pushable({ endDate: day(2026, 8, 31) })
    const body = toGoogleEvent(original)
    const back = fromGoogleEvent({ id: 'g1', summary: original.title, ...body })
    expect(back?.startDate.toISOString()).toBe(original.startDate.toISOString())
    expect(back?.endDate?.toISOString()).toBe(original.endDate!.toISOString())
    expect(back?.isAllDay).toBe(true)
  })
})

describe('fromGoogleEvent — timed', () => {
  it('reads ISO instants', () => {
    const parsed = fromGoogleEvent({
      id: 'g1',
      start: { dateTime: '2026-08-29T14:00:00Z' },
      end: { dateTime: '2026-08-29T22:00:00Z' },
    })
    expect(parsed?.isAllDay).toBe(false)
    expect(parsed?.startDate.toISOString()).toBe('2026-08-29T14:00:00.000Z')
    expect(parsed?.endDate?.toISOString()).toBe('2026-08-29T22:00:00.000Z')
  })

  it('honours a zone offset rather than reading the clock face', () => {
    const parsed = fromGoogleEvent({
      id: 'g1',
      start: { dateTime: '2026-08-29T10:00:00-04:00' },
    })
    expect(parsed?.startDate.toISOString()).toBe('2026-08-29T14:00:00.000Z')
  })

  it('drops an end that is not after the start', () => {
    const parsed = fromGoogleEvent({
      id: 'g1',
      start: { dateTime: '2026-08-29T14:00:00Z' },
      end: { dateTime: '2026-08-29T14:00:00Z' },
    })
    expect(parsed?.endDate).toBeNull()
  })
})

describe('fromGoogleEvent — bad input', () => {
  it('returns null when there is no start at all', () => {
    expect(fromGoogleEvent({ id: 'g1', summary: 'No when' })).toBeNull()
  })

  it('returns null for an unparseable date', () => {
    expect(fromGoogleEvent({ id: 'g1', start: { date: 'not-a-date' } })).toBeNull()
  })

  it('returns null for an unparseable dateTime', () => {
    expect(fromGoogleEvent({ id: 'g1', start: { dateTime: 'nope' } })).toBeNull()
  })

  it('names an untitled event rather than storing an empty string', () => {
    expect(fromGoogleEvent({ id: 'g1', start: { date: '2026-08-29' } })?.title).toBe(
      'Untitled Event'
    )
    expect(
      fromGoogleEvent({ id: 'g1', summary: '   ', start: { date: '2026-08-29' } })?.title
    ).toBe('Untitled Event')
  })
})
