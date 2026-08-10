import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The scheduled social publisher.
 *
 * "Schedule" used to save a row and never post; this cron is what makes the button mean
 * something. The properties worth holding are that it only picks up posts whose time has
 * actually arrived, that one platform rejection does not strand the rest of the queue, and that
 * a failure is marked rather than retried forever — a post that keeps failing would otherwise be
 * re-attempted every five minutes indefinitely, invisibly.
 */

const postFindMany = vi.fn()
const postUpdate = vi.fn()
const publishPost = vi.fn()
const isAuthorizedCronRequest = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { socialMediaPost: { findMany: postFindMany, update: postUpdate } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/social/publisher', () => ({ publishPost }))
vi.mock('@/lib/cron/auth', () => ({ isAuthorizedCronRequest }))

const { GET } = await import('@/app/api/cron/social-publish/route')

const NOW = new Date('2026-08-10T12:00:00Z')

function cronRequest() {
  return new Request('http://localhost:3000/api/cron/social-publish')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  isAuthorizedCronRequest.mockReturnValue(true)
  postFindMany.mockResolvedValue([])
  postUpdate.mockResolvedValue({})
  publishPost.mockResolvedValue(undefined)
})

describe('GET /api/cron/social-publish', () => {
  it('refuses an unauthorised caller before publishing anything', async () => {
    isAuthorizedCronRequest.mockReturnValue(false)

    const response = await GET(cronRequest())

    // This route posts to the company's public accounts. An unguarded one is a stranger's
    // publish button.
    expect(response.status).toBe(401)
    expect(postFindMany).not.toHaveBeenCalled()
    expect(publishPost).not.toHaveBeenCalled()
  })

  it('claims only posts that are scheduled and due', async () => {
    await GET(cronRequest())

    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SCHEDULED', scheduledAt: { lte: NOW } },
        orderBy: { scheduledAt: 'asc' },
      })
    )
  })

  it('publishes each due post, oldest first', async () => {
    postFindMany.mockResolvedValue([{ id: 'post_1' }, { id: 'post_2' }])

    const response = await GET(cronRequest())

    expect(publishPost).toHaveBeenNthCalledWith(1, 'post_1')
    expect(publishPost).toHaveBeenNthCalledWith(2, 'post_2')
    await expect(response.json()).resolves.toMatchObject({
      processed: 2,
      published: 2,
      failed: 0,
    })
  })

  it('marks a rejected post FAILED instead of retrying it forever', async () => {
    postFindMany.mockResolvedValue([{ id: 'post_1' }])
    publishPost.mockRejectedValue(new Error('Instagram rejected the media'))

    const response = await GET(cronRequest())

    expect(postUpdate).toHaveBeenCalledWith({
      where: { id: 'post_1' },
      data: { status: 'FAILED' },
    })
    await expect(response.json()).resolves.toMatchObject({
      failed: 1,
      errors: [{ postId: 'post_1', error: 'Instagram rejected the media' }],
    })
  })

  it('carries on through the queue after one post fails', async () => {
    postFindMany.mockResolvedValue([{ id: 'post_1' }, { id: 'post_2' }])
    publishPost.mockRejectedValueOnce(new Error('token expired')).mockResolvedValueOnce(undefined)

    const response = await GET(cronRequest())

    expect(publishPost).toHaveBeenCalledTimes(2)
    await expect(response.json()).resolves.toMatchObject({ published: 1, failed: 1 })
  })

  it('still reports the failure when marking the post FAILED also fails', async () => {
    postFindMany.mockResolvedValue([{ id: 'post_1' }])
    publishPost.mockRejectedValue(new Error('token expired'))
    postUpdate.mockRejectedValue(new Error('database unavailable'))

    const response = await GET(cronRequest())

    // The status write is best-effort; losing it must not turn a reported failure into an
    // unhandled error that hides the whole run's result.
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ failed: 1 })
  })

  it('reports an empty run rather than failing when nothing is due', async () => {
    const response = await GET(cronRequest())

    await expect(response.json()).resolves.toEqual({
      processed: 0,
      published: 0,
      failed: 0,
      errors: [],
    })
  })
})
