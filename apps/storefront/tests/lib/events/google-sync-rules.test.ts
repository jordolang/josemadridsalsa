import { describe, expect, it } from 'vitest'
import {
  decideSyncAction,
  isLocalDirty,
  isRemoteDirty,
  pairEvents,
  resolveConflict,
  type LocalSide,
  type RemoteSide,
} from '@/lib/events/google-sync-rules'

const T0 = new Date('2026-08-20T10:00:00Z')
const T1 = new Date('2026-08-20T11:00:00Z')

const local = (overrides: Partial<LocalSide> = {}): LocalSide => ({
  isWhereIsJose: true,
  updatedAt: T0,
  pushedAt: T0,
  googleEventId: 'g1',
  googleEtag: 'etag-1',
  ...overrides,
})

const remote = (overrides: Partial<RemoteSide> = {}): RemoteSide => ({
  id: 'g1',
  etag: 'etag-1',
  cancelled: false,
  ...overrides,
})

describe('isLocalDirty', () => {
  it('is clean when nothing changed since the last agreed state', () => {
    expect(isLocalDirty(local())).toBe(false)
  })

  it('is dirty when the record was edited after the last sync', () => {
    expect(isLocalDirty(local({ updatedAt: T1 }))).toBe(true)
  })

  it('treats a never-synced event as dirty', () => {
    expect(isLocalDirty(local({ pushedAt: null }))).toBe(true)
  })

  it('is clean when the timestamps match exactly', () => {
    expect(isLocalDirty(local({ updatedAt: T0, pushedAt: T0 }))).toBe(false)
  })
})

describe('isRemoteDirty', () => {
  it('is clean while the etag matches the one we stored', () => {
    expect(isRemoteDirty(local(), remote())).toBe(false)
  })

  it('is dirty once Google changes the etag', () => {
    expect(isRemoteDirty(local(), remote({ etag: 'etag-2' }))).toBe(true)
  })

  it('is dirty when we never recorded an etag', () => {
    expect(isRemoteDirty(local({ googleEtag: null }), remote())).toBe(true)
  })
})

describe('resolveConflict', () => {
  it('sends ours up under LOCAL_WINS', () => {
    expect(resolveConflict('LOCAL_WINS')).toBe('push_update')
  })

  it('takes theirs under GOOGLE_WINS', () => {
    expect(resolveConflict('GOOGLE_WINS')).toBe('pull_update')
  })

  it('defers to a human under ASK', () => {
    expect(resolveConflict('ASK')).toBe('conflict')
  })
})

describe('decideSyncAction — only one side exists', () => {
  it('creates on Google for a new "Where is Jose?" event', () => {
    const pair = { local: local({ googleEventId: null, googleEtag: null, pushedAt: null }), remote: null }
    expect(decideSyncAction(pair, 'ASK')).toBe('push_create')
  })

  it('leaves an unflagged local event alone rather than publishing the pipeline', () => {
    const pair = {
      local: local({ isWhereIsJose: false, googleEventId: null, googleEtag: null, pushedAt: null }),
      remote: null,
    }
    expect(decideSyncAction(pair, 'ASK')).toBe('none')
  })

  it('pulls in a calendar entry we have never seen', () => {
    expect(decideSyncAction({ local: null, remote: remote() }, 'ASK')).toBe('pull_create')
  })

  it('ignores a cancelled entry we have never seen', () => {
    expect(decideSyncAction({ local: null, remote: remote({ cancelled: true }) }, 'ASK')).toBe(
      'none'
    )
  })

  it('unlinks — never deletes — when Google drops a linked event', () => {
    expect(decideSyncAction({ local: local(), remote: null }, 'ASK')).toBe('unlink')
  })

  it('treats a cancelled remote as a deletion, and still only unlinks', () => {
    expect(decideSyncAction({ local: local(), remote: remote({ cancelled: true }) }, 'ASK')).toBe(
      'unlink'
    )
  })
})

describe('decideSyncAction — linked on both sides', () => {
  it('does nothing when neither side moved', () => {
    expect(decideSyncAction({ local: local(), remote: remote() }, 'ASK')).toBe('none')
  })

  it('pushes when only we changed', () => {
    expect(decideSyncAction({ local: local({ updatedAt: T1 }), remote: remote() }, 'ASK')).toBe(
      'push_update'
    )
  })

  it('pulls when only Google changed', () => {
    expect(
      decideSyncAction({ local: local(), remote: remote({ etag: 'etag-2' }) }, 'ASK')
    ).toBe('pull_update')
  })

  it('flags a conflict when both moved and the policy is ASK', () => {
    expect(
      decideSyncAction(
        { local: local({ updatedAt: T1 }), remote: remote({ etag: 'etag-2' }) },
        'ASK'
      )
    ).toBe('conflict')
  })

  it('settles a two-sided edit our way under LOCAL_WINS', () => {
    expect(
      decideSyncAction(
        { local: local({ updatedAt: T1 }), remote: remote({ etag: 'etag-2' }) },
        'LOCAL_WINS'
      )
    ).toBe('push_update')
  })

  it('settles a two-sided edit their way under GOOGLE_WINS', () => {
    expect(
      decideSyncAction(
        { local: local({ updatedAt: T1 }), remote: remote({ etag: 'etag-2' }) },
        'GOOGLE_WINS'
      )
    ).toBe('pull_update')
  })

  it('retracts from the public calendar when the flag is taken off', () => {
    expect(
      decideSyncAction({ local: local({ isWhereIsJose: false }), remote: remote() }, 'ASK')
    ).toBe('push_delete')
  })

  it('retracts a demoted event even when Google also changed it', () => {
    // The demotion is the instruction that matters: it must come off the
    // public calendar regardless of what was edited there.
    expect(
      decideSyncAction(
        { local: local({ isWhereIsJose: false, updatedAt: T1 }), remote: remote({ etag: 'x' }) },
        'ASK'
      )
    ).toBe('push_delete')
  })
})

describe('pairEvents', () => {
  it('matches a local event to its Google counterpart', () => {
    const pairs = pairEvents([{ googleEventId: 'g1' }], [{ id: 'g1' }])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].local).toEqual({ googleEventId: 'g1' })
    expect(pairs[0].remote).toEqual({ id: 'g1' })
  })

  it('leaves an unlinked local event with no remote', () => {
    const pairs = pairEvents([{ googleEventId: null }], [{ id: 'g1' }])
    expect(pairs[0]).toEqual({ local: { googleEventId: null }, remote: null })
  })

  it('reports a Google event nothing local claims', () => {
    const pairs = pairEvents([], [{ id: 'g9' }])
    expect(pairs).toEqual([{ local: null, remote: { id: 'g9' } }])
  })

  it('does not double-report a claimed remote', () => {
    const pairs = pairEvents([{ googleEventId: 'g1' }], [{ id: 'g1' }, { id: 'g2' }])
    expect(pairs).toHaveLength(2)
    expect(pairs.filter((p) => p.remote?.id === 'g1')).toHaveLength(1)
  })

  it('handles a stale link whose Google event is gone', () => {
    const pairs = pairEvents([{ googleEventId: 'gone' }], [])
    expect(pairs).toEqual([{ local: { googleEventId: 'gone' }, remote: null }])
  })

  it('covers every event from both sides exactly once', () => {
    const pairs = pairEvents(
      [{ googleEventId: 'g1' }, { googleEventId: null }, { googleEventId: 'stale' }],
      [{ id: 'g1' }, { id: 'g2' }]
    )
    expect(pairs).toHaveLength(4)
  })
})
