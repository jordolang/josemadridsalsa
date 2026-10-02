import type { SocialMediaPlatform } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from './platforms'

type PublishResult = {
  success: boolean
  externalPostId?: string
  externalUrl?: string
  error?: string
}

/**
 * Ask Facebook to re-read a URL's Open Graph tags, discarding what it cached.
 *
 * A Page feed post that carries a `link` renders its preview card purely from
 * Facebook's own cached scrape of that URL — since Graph API v2.9 the `picture`,
 * `name` and `description` overrides are gone, so the post request cannot say
 * what the card should show. Facebook keeps that cache for weeks and populates
 * it from whoever scraped the URL first, which is routinely a render made before
 * the article had its cover image. The result is a card stuck on the site's
 * default og:image no matter how often the article is re-shared.
 *
 * Scraping immediately before the post refreshes that cache, so the card is
 * built from the page's current og:image — the article's own cover.
 *
 * Best effort: a refusal here only risks a stale card, so the post still goes.
 */
async function refreshLinkPreview(accessToken: string, linkUrl: string): Promise<void> {
  try {
    const response = await fetch('https://graph.facebook.com/v21.0/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: linkUrl, scrape: 'true', access_token: accessToken }),
    })
    const data = await response.json()
    if (data?.error) {
      console.warn(
        `[social/publisher] could not refresh Facebook's link preview for ${linkUrl}, so the card may show a previously cached image: ${data.error.message}`,
      )
    }
  } catch (error) {
    console.warn(
      `[social/publisher] could not refresh Facebook's link preview for ${linkUrl}, so the card may show a previously cached image:`,
      error,
    )
  }
}

/**
 * Publish a post to Facebook Page via Graph API
 */
async function publishToFacebook(
  accessToken: string,
  pageId: string,
  content: string,
  mediaUrls: string[],
  linkUrl?: string | null,
): Promise<PublishResult> {
  try {
    const url = `https://graph.facebook.com/v21.0/${pageId}/feed`

    const body: Record<string, string> = {
      message: content,
      access_token: accessToken,
    }

    if (linkUrl) {
      body.link = linkUrl
      // Refresh the cached Open Graph data first so the preview card is built
      // from the page as it stands now, not from an earlier scrape of it.
      await refreshLinkPreview(accessToken, linkUrl)
    }

    // If we have images, post as photos
    if (mediaUrls.length > 0 && !linkUrl) {
      // For single photo
      if (mediaUrls.length === 1) {
        const photoUrl = `https://graph.facebook.com/v21.0/${pageId}/photos`
        const photoResponse = await fetch(photoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: mediaUrls[0],
            message: content,
            access_token: accessToken,
          }),
        })
        const photoData = await photoResponse.json()
        if (photoData.error) {
          return { success: false, error: photoData.error.message }
        }
        return {
          success: true,
          externalPostId: photoData.id,
          externalUrl: `https://facebook.com/${photoData.id}`,
        }
      }

      // For multiple photos, upload unpublished then create multi-photo post
      const photoIds: string[] = []
      for (const mediaUrl of mediaUrls) {
        const photoRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: mediaUrl,
            published: false,
            access_token: accessToken,
          }),
        })
        const photoData = await photoRes.json()
        if (photoData.id) {
          photoIds.push(photoData.id)
        }
      }

      const attachedMedia = photoIds.reduce<Record<string, string>>((acc, id, i) => {
        acc[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
        return acc
      }, {})

      const feedResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          access_token: accessToken,
          ...attachedMedia,
        }),
      })
      const feedData = await feedResponse.json()
      if (feedData.error) {
        return { success: false, error: feedData.error.message }
      }
      return {
        success: true,
        externalPostId: feedData.id,
        externalUrl: `https://facebook.com/${feedData.id}`,
      }
    }

    // Text-only or link post
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    return {
      success: true,
      externalPostId: data.id,
      externalUrl: `https://facebook.com/${data.id}`,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Publish a tweet to X/Twitter via API v2
 */
async function publishToTwitter(
  accessToken: string,
  content: string,
  mediaUrls: string[],
): Promise<PublishResult> {
  try {
    // Upload media first. The v1.1 endpoint refuses OAuth 2.0 user tokens, so this uses
    // v2's one-shot upload (needs the `media.write` scope). A failed upload stops the post:
    // going out text-only would publish something other than what was approved.
    const mediaIds: string[] = []
    for (const mediaUrl of mediaUrls) {
      const mediaRes = await fetch(mediaUrl)
      if (!mediaRes.ok) {
        return { success: false, error: `Could not download image for X (HTTP ${mediaRes.status}): ${mediaUrl}` }
      }
      const formData = new FormData()
      formData.append('media', await mediaRes.blob())
      formData.append('media_category', 'tweet_image')

      const uploadRes = await fetch('https://api.x.com/2/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })
      const upload = z.object({
        data: z.object({ id: z.string().min(1) }).optional(),
        detail: z.string().optional(),
        title: z.string().optional(),
        errors: z.array(z.object({ message: z.string().optional() })).optional(),
      }).safeParse(await uploadRes.json().catch(() => null))
      const uploadData = upload.success ? upload.data : undefined
      if (!uploadRes.ok || !uploadData?.data?.id) {
        const detail = uploadData?.detail || uploadData?.errors?.[0]?.message || uploadData?.title
        return {
          success: false,
          error: `X/Twitter image upload failed (HTTP ${uploadRes.status}): ${detail || 'no media id returned'}. Reconnect X if the account predates the media.write permission.`,
        }
      }
      mediaIds.push(uploadData.data.id)
    }

    const tweetBody: Record<string, unknown> = { text: content }
    if (mediaIds.length > 0) {
      tweetBody.media = { media_ids: mediaIds }
    }

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    })
    const parsed = z.object({
      data: z.object({ id: z.string().min(1) }).optional(),
      detail: z.string().optional(),
      title: z.string().optional(),
      errors: z.array(z.object({ message: z.string().optional() })).optional(),
    }).safeParse(await response.json().catch(() => null))
    const data = parsed.success ? parsed.data : undefined

    if (!response.ok || !data?.data?.id || data.errors?.length) {
      const detail = data?.detail || data?.errors?.[0]?.message || data?.title
      return {
        success: false,
        error: `X/Twitter publish failed (HTTP ${response.status}): ${detail || 'Empty or invalid API response. Check the post on X before retrying.'}`,
      }
    }

    return {
      success: true,
      externalPostId: data.data?.id,
      externalUrl: `https://x.com/i/status/${data.data?.id}`,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

type MediaItem = { url: string; mimeType: string }

/**
 * Publish content to TikTok via the Content Posting API.
 *
 * Photos and videos use different endpoints: photos go to `content/init` as a
 * PHOTO post (up to 35 images), a video goes to `video/init`. Both pull media by
 * URL, so the media host's domain must be verified in the TikTok developer app.
 *
 * TikTok wraps every response in an `error` object; success is `error.code === "ok"`,
 * so the mere presence of `error.code` is not a failure.
 */
async function publishToTikTok(
  accessToken: string,
  content: string,
  media: MediaItem[],
): Promise<PublishResult> {
  try {
    if (media.length === 0) {
      return { success: false, error: 'TikTok requires at least one video or image' }
    }

    const video = media.find((m) => m.mimeType.startsWith('video/'))
    const images = media.filter((m) => m.mimeType.startsWith('image/'))
    if (!video && images.length === 0) {
      return { success: false, error: 'TikTok needs a video or image attachment' }
    }

    const [endpoint, body] = video
      ? [
          'https://open.tiktokapis.com/v2/post/publish/video/init/',
          {
            post_info: { title: content.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' },
            source_info: { source: 'PULL_FROM_URL', video_url: video.url },
          },
        ]
      : [
          'https://open.tiktokapis.com/v2/post/publish/content/init/',
          {
            media_type: 'PHOTO',
            post_mode: 'DIRECT_POST',
            post_info: {
              title: content.slice(0, 90),
              description: content.slice(0, 4000),
              privacy_level: 'PUBLIC_TO_EVERYONE',
            },
            source_info: {
              source: 'PULL_FROM_URL',
              photo_cover_index: 0,
              photo_images: images.slice(0, 35).map((m) => m.url),
            },
          },
        ]

    const initRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
    })

    const parsed = z.object({
      data: z.object({ publish_id: z.string().optional() }).optional(),
      error: z.object({ code: z.string().optional(), message: z.string().optional() }).optional(),
    }).safeParse(await initRes.json().catch(() => null))
    const initData = parsed.success ? parsed.data : undefined
    const publishId = initData?.data?.publish_id

    if (!initRes.ok || initData?.error?.code !== 'ok' || !publishId) {
      return {
        success: false,
        error: `TikTok publish failed (HTTP ${initRes.status}): ${initData?.error?.message || initData?.error?.code || 'Empty or invalid API response'}`,
      }
    }

    return {
      success: true,
      externalPostId: publishId,
      externalUrl: undefined, // TikTok doesn't return URL immediately
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Publish content to Instagram via Instagram Graph API (requires Facebook Page + IG Business account)
 * Uses the Content Publishing API: create container -> publish container
 */
async function publishToInstagram(
  accessToken: string,
  igUserId: string,
  content: string,
  mediaUrls: string[],
): Promise<PublishResult> {
  try {
    if (mediaUrls.length === 0) {
      return { success: false, error: 'Instagram requires at least one image or video to publish.' }
    }

    const apiBase = `https://graph.facebook.com/v21.0/${igUserId}`

    if (mediaUrls.length === 1) {
      // Single image/video post
      const isVideo = /\.(mp4|mov|avi|wmv|webm)$/i.test(mediaUrls[0])

      const containerRes = await fetch(`${apiBase}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isVideo
            ? { media_type: 'VIDEO', video_url: mediaUrls[0] }
            : { image_url: mediaUrls[0] }),
          caption: content,
          access_token: accessToken,
        }),
      })
      const containerData = await containerRes.json()
      if (containerData.error) {
        return { success: false, error: containerData.error.message }
      }

      // For videos, poll until container is ready
      if (isVideo) {
        let ready = false
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const statusRes = await fetch(
            `https://graph.facebook.com/v21.0/${containerData.id}?fields=status_code&access_token=${accessToken}`,
          )
          const statusData = await statusRes.json()
          if (statusData.status_code === 'FINISHED') {
            ready = true
            break
          }
          if (statusData.status_code === 'ERROR') {
            return { success: false, error: 'Instagram video processing failed.' }
          }
        }
        if (!ready) {
          return { success: false, error: 'Instagram video processing timed out.' }
        }
      }

      // Publish the container
      const publishRes = await fetch(`${apiBase}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      })
      const publishData = await publishRes.json()
      if (publishData.error) {
        return { success: false, error: publishData.error.message }
      }

      return {
        success: true,
        externalPostId: publishData.id,
        externalUrl: `https://www.instagram.com/p/${publishData.id}/`,
      }
    }

    // Carousel post (multiple images/videos, up to 10)
    const childContainerIds: string[] = []
    for (const url of mediaUrls.slice(0, 10)) {
      const isVideo = /\.(mp4|mov|avi|wmv|webm)$/i.test(url)
      const childRes = await fetch(`${apiBase}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isVideo
            ? { media_type: 'VIDEO', video_url: url }
            : { image_url: url }),
          is_carousel_item: true,
          access_token: accessToken,
        }),
      })
      const childData = await childRes.json()
      if (childData.error) {
        return { success: false, error: `Carousel item failed: ${childData.error.message}` }
      }

      // Poll video items until ready
      if (isVideo) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const statusRes = await fetch(
            `https://graph.facebook.com/v21.0/${childData.id}?fields=status_code&access_token=${accessToken}`,
          )
          const statusData = await statusRes.json()
          if (statusData.status_code === 'FINISHED') break
          if (statusData.status_code === 'ERROR') {
            return { success: false, error: 'Instagram carousel video processing failed.' }
          }
        }
      }

      childContainerIds.push(childData.id)
    }

    // Create carousel container
    const carouselRes = await fetch(`${apiBase}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childContainerIds.join(','),
        caption: content,
        access_token: accessToken,
      }),
    })
    const carouselData = await carouselRes.json()
    if (carouselData.error) {
      return { success: false, error: carouselData.error.message }
    }

    // Publish carousel
    const publishRes = await fetch(`${apiBase}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: accessToken,
      }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) {
      return { success: false, error: publishData.error.message }
    }

    return {
      success: true,
      externalPostId: publishData.id,
      externalUrl: `https://www.instagram.com/p/${publishData.id}/`,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Publish a local post to a Google Business Profile location via the
 * Business Profile API. The account's `accountId` holds the location resource
 * name ("accounts/{id}/locations/{id}") captured at connect time.
 */
async function publishToGoogleMyBusiness(
  accessToken: string,
  locationName: string,
  content: string,
  mediaUrls: string[],
  linkUrl?: string | null,
): Promise<PublishResult> {
  try {
    const body: Record<string, unknown> = {
      languageCode: 'en-US',
      summary: content,
      topicType: 'STANDARD',
    }

    if (linkUrl) {
      body.callToAction = { actionType: 'LEARN_MORE', url: linkUrl }
    }

    if (mediaUrls.length > 0) {
      body.media = [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrls[0] }]
    }

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    const data = await res.json()

    if (data.error) {
      return { success: false, error: data.error.message || 'Google Business API error' }
    }

    return {
      success: true,
      externalPostId: data.name,
      externalUrl: data.searchUrl ?? undefined,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Publish a post to a single platform account
 */
export async function publishToAccount(
  postId: string,
  accountId: string,
): Promise<PublishResult> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || !account.isActive) {
    return { success: false, error: 'Account not found or inactive' }
  }

  const post = await prisma.socialMediaPost.findUnique({
    where: { id: postId },
    include: {
      media: {
        include: { media: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!post) {
    return { success: false, error: 'Post not found' }
  }

  const accessToken = await getValidAccessToken(accountId)
  if (!accessToken) {
    return { success: false, error: 'Could not retrieve access token' }
  }

  const mediaUrls = post.media.map((m) => m.media.url)

  // Use platform-specific content if available, otherwise fall back to main content
  let content = post.content
  switch (account.platform) {
    case 'FACEBOOK':
      content = post.facebookContent || post.content
      break
    case 'TWITTER':
      content = post.twitterContent || post.content
      break
    case 'TIKTOK':
      content = post.tiktokContent || post.content
      break
    case 'INSTAGRAM':
      content = post.instagramContent || post.content
      break
  }

  // Add hashtags
  if (post.hashtags.length > 0) {
    content = content + '\n\n' + post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  }

  // Idempotency guard: if this (post, account) pair already published, don't
  // post again. Protects against overlapping scheduler runs double-posting.
  const existing = await prisma.socialPostPublish.findUnique({
    where: { postId_accountId: { postId, accountId } },
  })
  if (existing?.status === 'PUBLISHED') {
    return {
      success: true,
      externalPostId: existing.externalPostId ?? undefined,
      externalUrl: existing.externalUrl ?? undefined,
    }
  }

  // Mark as publishing
  await prisma.socialPostPublish.upsert({
    where: { postId_accountId: { postId, accountId } },
    create: {
      postId,
      accountId,
      platform: account.platform,
      status: 'PUBLISHING',
    },
    update: {
      status: 'PUBLISHING',
      errorMessage: null,
    },
  })

  let result: PublishResult

  switch (account.platform) {
    case 'FACEBOOK':
      result = await publishToFacebook(accessToken, account.accountId, content, mediaUrls, post.linkUrl)
      break
    case 'TWITTER':
      // Blog covers are attached for Google Business; X uses the article link.
      result = await publishToTwitter(accessToken, content, post.blogPostId ? [] : mediaUrls)
      break
    case 'INSTAGRAM':
      result = await publishToInstagram(accessToken, account.accountId, content, mediaUrls)
      break
    case 'TIKTOK':
      result = await publishToTikTok(
        accessToken,
        content,
        post.media.map((m) => ({ url: m.media.url, mimeType: m.media.mimeType })),
      )
      break
    case 'GOOGLE_MY_BUSINESS':
      result = await publishToGoogleMyBusiness(accessToken, account.accountId, content, mediaUrls, post.linkUrl)
      break
    default:
      result = { success: false, error: `Publishing not yet supported for ${account.platform}` }
  }

  // Update publish record
  await prisma.socialPostPublish.update({
    where: { postId_accountId: { postId, accountId } },
    data: {
      status: result.success ? 'PUBLISHED' : 'FAILED',
      externalPostId: result.externalPostId ?? null,
      externalUrl: result.externalUrl ?? null,
      errorMessage: result.error ?? null,
      publishedAt: result.success ? new Date() : null,
    },
  })

  return result
}

/**
 * Publish a post to all selected platform accounts
 */
export async function publishPost(postId: string): Promise<{
  results: Array<{ platform: SocialMediaPlatform; accountId: string; result: PublishResult }>
}> {
  const post = await prisma.socialMediaPost.findUnique({
    where: { id: postId },
  })

  if (!post) throw new Error('Post not found')

  // Get accounts for the selected platforms
  const accounts = await prisma.socialAccount.findMany({
    where: {
      platform: { in: post.platforms },
      isActive: true,
    },
  })

  const results: Array<{ platform: SocialMediaPlatform; accountId: string; result: PublishResult }> = []

  for (const account of accounts) {
    const result = await publishToAccount(postId, account.id)
    results.push({ platform: account.platform, accountId: account.id, result })
  }

  // Update overall post status. Per-platform failures are tracked on each
  // SocialPostPublish record; an empty results array means no connected
  // account matched the post's platforms, which is a failure.
  const anySucceeded = results.some((r) => r.result.success)

  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: {
      status: anySucceeded ? 'PUBLISHED' : 'FAILED',
      publishedAt: anySucceeded ? new Date() : null,
    },
  })

  return { results }
}
