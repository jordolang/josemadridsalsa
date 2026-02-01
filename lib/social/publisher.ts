import type { SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAccountAccessToken } from './platforms'

type PublishResult = {
  success: boolean
  externalPostId?: string
  externalUrl?: string
  error?: string
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
    // Upload media first if any
    const mediaIds: string[] = []
    for (const mediaUrl of mediaUrls) {
      // Download media then upload to Twitter
      const mediaRes = await fetch(mediaUrl)
      const mediaBlob = await mediaRes.blob()
      const formData = new FormData()
      formData.append('media', mediaBlob)

      const uploadRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (uploadData.media_id_string) {
        mediaIds.push(uploadData.media_id_string)
      }
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
    const data = await response.json()

    if (data.errors) {
      return { success: false, error: data.errors[0]?.message || 'Twitter API error' }
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

/**
 * Publish content to TikTok via Content Posting API
 */
async function publishToTikTok(
  accessToken: string,
  content: string,
  mediaUrls: string[],
): Promise<PublishResult> {
  try {
    // TikTok requires video upload via their Content Posting API
    if (mediaUrls.length === 0) {
      return { success: false, error: 'TikTok requires at least one video or image' }
    }

    // Initialize video upload
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: content.slice(0, 150),
          privacy_level: 'PUBLIC_TO_EVERYONE',
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrls[0],
        },
      }),
    })

    const initData = await initRes.json()

    if (initData.error?.code) {
      return { success: false, error: initData.error.message || 'TikTok API error' }
    }

    return {
      success: true,
      externalPostId: initData.data?.publish_id,
      externalUrl: undefined, // TikTok doesn't return URL immediately
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

  const accessToken = await getAccountAccessToken(accountId)
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
      result = await publishToTwitter(accessToken, content, mediaUrls)
      break
    case 'TIKTOK':
      result = await publishToTikTok(accessToken, content, mediaUrls)
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

  // Update overall post status
  const allSucceeded = results.every((r) => r.result.success)
  const anySucceeded = results.some((r) => r.result.success)

  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: {
      status: allSucceeded ? 'PUBLISHED' : anySucceeded ? 'PUBLISHED' : 'FAILED',
      publishedAt: anySucceeded ? new Date() : null,
    },
  })

  return { results }
}
