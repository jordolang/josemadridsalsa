'use server'

import { revalidatePath } from 'next/cache'
import { SocialMediaPlatform } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import type { SocialComposerState } from '@/types/social'

const composeSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(8, 'Write at least 8 characters for your post.')
      .max(63206, 'Content is too long.'),
    platforms: z
      .array(z.nativeEnum(SocialMediaPlatform))
      .min(1, 'Select at least one platform to post to.'),
    scheduledAt: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) return null
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? null : date
      }),
    intent: z.enum(['draft', 'schedule', 'publish']).default('draft'),
    hashtags: z.string().optional().default(''),
    linkUrl: z.string().url().optional().or(z.literal('')),
    facebookContent: z.string().optional().default(''),
    twitterContent: z.string().optional().default(''),
    tiktokContent: z.string().optional().default(''),
    instagramContent: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.intent === 'schedule' && !data.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a future time to schedule this post.',
        path: ['scheduledAt'],
      })
    }

    if (data.intent === 'schedule' && data.scheduledAt) {
      if (data.scheduledAt.getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Scheduled posts must be in the future.',
          path: ['scheduledAt'],
        })
      }
    }
  })

export async function createSocialPost(
  _prevState: SocialComposerState,
  formData: FormData,
): Promise<SocialComposerState> {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    return {
      status: 'error',
      message: 'You do not have permission to compose social posts.',
    }
  }

  const rawPlatforms = formData.getAll('platforms').map(String)
  const socialPlatformValues = Object.values(SocialMediaPlatform) as SocialMediaPlatform[]
  const isSocialPlatform = (value: string): value is SocialMediaPlatform =>
    socialPlatformValues.includes(value as SocialMediaPlatform)
  const uniquePlatforms = Array.from(new Set(rawPlatforms)).filter(isSocialPlatform)

  const parsed = composeSchema.safeParse({
    content: typeof formData.get('content') === 'string' ? formData.get('content') : '',
    platforms: uniquePlatforms,
    scheduledAt: typeof formData.get('scheduledAt') === 'string' ? formData.get('scheduledAt') : undefined,
    intent: typeof formData.get('intent') === 'string' ? (formData.get('intent') as string) : 'draft',
    hashtags: typeof formData.get('hashtags') === 'string' ? formData.get('hashtags') : '',
    linkUrl: typeof formData.get('linkUrl') === 'string' ? formData.get('linkUrl') : '',
    facebookContent: typeof formData.get('facebookContent') === 'string' ? formData.get('facebookContent') : '',
    twitterContent: typeof formData.get('twitterContent') === 'string' ? formData.get('twitterContent') : '',
    tiktokContent: typeof formData.get('tiktokContent') === 'string' ? formData.get('tiktokContent') : '',
    instagramContent: typeof formData.get('instagramContent') === 'string' ? formData.get('instagramContent') : '',
  })

  if (!parsed.success) {
    type FieldErrorMap = NonNullable<SocialComposerState['fieldErrors']>
    const fieldErrors: FieldErrorMap = {}
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0]
      if (!field) return
      const key = field as keyof FieldErrorMap
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    })

    return {
      status: 'error',
      message: 'Please fix the errors below.',
      fieldErrors,
    }
  }

  const data = parsed.data

  const canSchedule = await hasPermission(user, 'social_media:schedule')
  const canPublish = await hasPermission(user, 'social_media:publish')

  if (data.intent === 'schedule' && !canSchedule) {
    return { status: 'error', message: 'You need scheduling permissions to queue posts.' }
  }

  if (data.intent === 'publish' && !canPublish) {
    return { status: 'error', message: 'You need publishing permissions to mark posts as live.' }
  }

  const hashtags = data.hashtags
    ? data.hashtags.split(',').map((h) => h.trim()).filter(Boolean)
    : []

  const createPayload: Parameters<typeof prisma.socialMediaPost.create>[0]['data'] = {
    content: data.content.trim(),
    platforms: data.platforms,
    status: 'DRAFT',
    hashtags,
    linkUrl: data.linkUrl || null,
    facebookContent: data.facebookContent || null,
    twitterContent: data.twitterContent || null,
    tiktokContent: data.tiktokContent || null,
    instagramContent: data.instagramContent || null,
    createdById: user.id,
  }

  if (data.intent === 'schedule' && data.scheduledAt && canSchedule) {
    createPayload.status = 'SCHEDULED'
    createPayload.scheduledAt = data.scheduledAt
  } else if (data.intent === 'publish' && canPublish) {
    createPayload.status = 'PUBLISHED'
    createPayload.publishedAt = new Date()
  }

  const post = await prisma.socialMediaPost.create({ data: createPayload })

  // If publishing, trigger actual platform publishing
  if (data.intent === 'publish' && canPublish) {
    try {
      const { publishPost } = await import('@/lib/social/publisher')
      await publishPost(post.id)
    } catch (error) {
      console.error('[SOCIAL_PUBLISH_ERROR]', error)
      // Post is saved, publishing failed - mark as failed
      await prisma.socialMediaPost.update({
        where: { id: post.id },
        data: { status: 'FAILED' },
      })
    }
  }

  await logAudit({
    userId: user.id,
    action: 'social_post.create',
    entityType: 'SocialMediaPost',
    entityId: post.id,
    changes: {
      status: createPayload.status,
      platforms: data.platforms,
    },
  })

  revalidatePath('/admin/social')

  const statusLabel =
    createPayload.status === 'SCHEDULED'
      ? 'scheduled'
      : createPayload.status === 'PUBLISHED'
        ? 'published'
        : 'saved as draft'

  return {
    status: 'success',
    message: `Post ${statusLabel} for ${data.platforms.length} platform${data.platforms.length > 1 ? 's' : ''}.`,
  }
}
