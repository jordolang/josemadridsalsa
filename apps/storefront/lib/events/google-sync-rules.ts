/**
 * What to do with one event that exists here, on Google, or on both.
 *
 * Kept free of Prisma and of `fetch` so the rules can be tested directly —
 * this is where a two-way sync goes wrong, and the failure mode is silent
 * data loss rather than an error anyone sees.
 *
 * Two invariants the rest of the sync depends on:
 *
 *  1. **Only "Where is Jose?" events go up.** The target calendar is the public
 *     one the storefront reads, and `FeaturedEvent` holds the booking pipeline —
 *     shows we have merely applied to, been waitlisted for, or been rejected
 *     from, along with booth fees. Pushing all of it would publish that.
 *  2. **Google never deletes a local record.** A FeaturedEvent owns its staff,
 *     contacts, product manifest and show financials. A deletion on the
 *     calendar unlinks the pair; it does not cascade into any of that.
 */

export type GoogleConflictPolicy = 'LOCAL_WINS' | 'GOOGLE_WINS' | 'ASK'

export type SyncAction =
  /** Already agreed, or deliberately out of scope. */
  | 'none'
  /** Create it on Google. */
  | 'push_create'
  /** Overwrite the Google copy from ours. */
  | 'push_update'
  /** Remove it from Google — demoted out of "Where is Jose?", or deleted here. */
  | 'push_delete'
  /** Create a local record from a calendar entry we have never seen. */
  | 'pull_create'
  /** Overwrite our copy from Google's. */
  | 'pull_update'
  /** Forget the Google link; the local record itself is left alone. */
  | 'unlink'
  /** Both sides moved and the policy says a human decides. */
  | 'conflict'

export interface LocalSide {
  isWhereIsJose: boolean
  /** Prisma's @updatedAt. Bumps on our own sync writes too — see `pushedAt`. */
  updatedAt: Date
  /**
   * When the two sides were last agreed. Every sync write sets this alongside
   * `googleEtag`, so "changed since we last synced" is `updatedAt > pushedAt`
   * rather than a comparison against the clock.
   */
  pushedAt: Date | null
  googleEventId: string | null
  googleEtag: string | null
}

export interface RemoteSide {
  id: string
  /** Changes whenever anything about the Google event changes. */
  etag: string
  /** Google keeps cancelled events in the list; they are tombstones. */
  cancelled: boolean
}

export interface SyncPair {
  local: LocalSide | null
  remote: RemoteSide | null
}

/** True when someone edited the event here since the last agreed state. */
export function isLocalDirty(local: LocalSide): boolean {
  if (!local.pushedAt) return true
  return local.updatedAt.getTime() > local.pushedAt.getTime()
}

/** True when the Google copy moved since the last agreed state. */
export function isRemoteDirty(local: LocalSide, remote: RemoteSide): boolean {
  return local.googleEtag !== remote.etag
}

/** How a policy settles a two-sided edit. `ASK` defers to a human. */
export function resolveConflict(policy: GoogleConflictPolicy): SyncAction {
  switch (policy) {
    case 'LOCAL_WINS':
      return 'push_update'
    case 'GOOGLE_WINS':
      return 'pull_update'
    case 'ASK':
      return 'conflict'
  }
}

export function decideSyncAction(pair: SyncPair, policy: GoogleConflictPolicy): SyncAction {
  const { local, remote } = pair

  // Only on Google: a show someone added on their phone.
  if (!local) {
    if (!remote || remote.cancelled) return 'none'
    return 'pull_create'
  }

  // Only here. Never linked, so there is nothing on Google to reconcile with.
  if (!remote || remote.cancelled) {
    if (local.googleEventId) {
      // It was on Google and has been deleted there. Drop the link and keep
      // the record — it may carry a manifest and a season of financials.
      return 'unlink'
    }
    return local.isWhereIsJose ? 'push_create' : 'none'
  }

  // Linked on both sides. A demotion is a retraction: take it off the public
  // calendar, but leave everything about the local record intact.
  if (!local.isWhereIsJose) return 'push_delete'

  const localDirty = isLocalDirty(local)
  const remoteDirty = isRemoteDirty(local, remote)

  if (localDirty && remoteDirty) return resolveConflict(policy)
  if (localDirty) return 'push_update'
  if (remoteDirty) return 'pull_update'
  return 'none'
}

/**
 * Pairs local events with Google's by `googleEventId`, so the caller can walk
 * one list. Events present on only one side come back with the other null.
 */
export function pairEvents<L extends { googleEventId: string | null }, R extends { id: string }>(
  locals: L[],
  remotes: R[]
): Array<{ local: L | null; remote: R | null }> {
  const remoteById = new Map(remotes.map((r) => [r.id, r]))
  const pairs: Array<{ local: L | null; remote: R | null }> = []
  const claimed = new Set<string>()

  for (const local of locals) {
    const remote = local.googleEventId ? (remoteById.get(local.googleEventId) ?? null) : null
    if (remote) claimed.add(remote.id)
    pairs.push({ local, remote })
  }

  for (const remote of remotes) {
    if (!claimed.has(remote.id)) pairs.push({ local: null, remote })
  }

  return pairs
}
