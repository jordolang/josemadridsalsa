import { describe, expect, it } from 'vitest'
import { canViewPoll, displayName, isPollPublished, pollWindowState } from '@/lib/polls/queries'

const published = { status: 'PUBLISHED' as const, visibility: 'PUBLIC' as const, accessCode: null }

describe('canViewPoll', () => {
  it('lets anyone see a published public poll', () => {
    expect(canViewPoll(published)).toBe(true)
  })

  it('opens a scheduled poll once its publication time has passed', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    const scheduled = { ...published, status: 'SCHEDULED' as const }
    expect(canViewPoll({ ...scheduled, publishedAt: new Date('2026-06-01T00:00:00Z') }, null, now)).toBe(
      true
    )
    expect(canViewPoll({ ...scheduled, publishedAt: new Date('2026-07-01T00:00:00Z') }, null, now)).toBe(
      false
    )
    expect(canViewPoll({ ...scheduled, publishedAt: null }, null, now)).toBe(false)
  })

  it('hides a draft or archived poll', () => {
    expect(canViewPoll({ ...published, status: 'DRAFT' })).toBe(false)
    expect(canViewPoll({ ...published, status: 'ARCHIVED' })).toBe(false)
  })

  it('opens an invite-only poll only to the matching code', () => {
    const invite = { status: 'PUBLISHED' as const, visibility: 'INVITE_ONLY' as const, accessCode: 'abc123' }
    expect(canViewPoll(invite, 'abc123')).toBe(true)
    expect(canViewPoll(invite, 'wrong')).toBe(false)
    expect(canViewPoll(invite)).toBe(false)
  })

  it('refuses an invite-only poll that has no code yet', () => {
    expect(
      canViewPoll({ status: 'PUBLISHED', visibility: 'INVITE_ONLY', accessCode: null }, 'anything')
    ).toBe(false)
  })
})

describe('pollWindowState', () => {
  const at = (iso: string) => new Date(iso)
  const now = at('2026-06-15T12:00:00Z')

  it('is open with no window set', () => {
    expect(pollWindowState({ status: 'PUBLISHED', startsAt: null, endsAt: null }, now)).toBe('OPEN')
  })

  it('is not started before it opens', () => {
    expect(
      pollWindowState({ status: 'PUBLISHED', startsAt: at('2026-07-01T00:00:00Z'), endsAt: null }, now)
    ).toBe('NOT_STARTED')
  })

  it('is closed once the end has passed', () => {
    expect(
      pollWindowState({ status: 'PUBLISHED', startsAt: null, endsAt: at('2026-06-01T00:00:00Z') }, now)
    ).toBe('CLOSED')
  })

  it('closes exactly at the end time rather than a moment after', () => {
    expect(
      pollWindowState({ status: 'PUBLISHED', startsAt: null, endsAt: at('2026-06-15T12:00:00Z') }, now)
    ).toBe('CLOSED')
  })

  it('reports an unpublished poll as unpublished, window or not', () => {
    expect(pollWindowState({ status: 'DRAFT', startsAt: null, endsAt: null }, now)).toBe('UNPUBLISHED')
  })
})

describe('isPollPublished', () => {
  const now = new Date('2026-06-15T12:00:00Z')

  it('accepts a published poll whatever its publication date', () => {
    expect(isPollPublished({ status: 'PUBLISHED', publishedAt: null }, now)).toBe(true)
  })

  it('holds a scheduled poll until its time comes', () => {
    expect(
      isPollPublished({ status: 'SCHEDULED', publishedAt: new Date('2026-06-16T00:00:00Z') }, now)
    ).toBe(false)
    expect(
      isPollPublished({ status: 'SCHEDULED', publishedAt: new Date('2026-06-14T00:00:00Z') }, now)
    ).toBe(true)
  })

  it('never accepts a draft or archived poll', () => {
    expect(isPollPublished({ status: 'DRAFT', publishedAt: new Date('2020-01-01') }, now)).toBe(false)
    expect(isPollPublished({ status: 'ARCHIVED', publishedAt: new Date('2020-01-01') }, now)).toBe(
      false
    )
  })
})

describe('displayName', () => {
  it('honours an anonymity request above everything else', () => {
    expect(
      displayName({ firstName: 'Ada', lastName: 'Lovelace', anonymousRequested: true })
    ).toBe('Anonymous')
  })

  it('shortens a surname to an initial', () => {
    expect(
      displayName({ firstName: 'Ada', lastName: 'Lovelace', anonymousRequested: false })
    ).toBe('Ada L.')
  })

  it('uses the first name alone when no surname was given', () => {
    expect(displayName({ firstName: 'Ada', lastName: null, anonymousRequested: false })).toBe('Ada')
    expect(displayName({ firstName: 'Ada', lastName: '  ', anonymousRequested: false })).toBe('Ada')
  })
})
