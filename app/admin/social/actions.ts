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
      .max(2000, 'Keep social posts under 2,000 characters.'),
    platforms: z
      .array(z.nativeEnum(SocialMediaPlatform))
      .min(1, 'Select at least one platform to post to.'),
    scheduledAt: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) {
          return null
        }
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? null : date
      }),
    intent: z.enum(['draft', 'schedule', 'publish']).default('draft'),
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
      const now = Date.now()
      if (data.scheduledAt.getTime() <= now) {
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
  })

  if (!parsed.success) {
    type FieldErrorMap = NonNullable<SocialComposerState['fieldErrors']>
    const fieldErrors: FieldErrorMap = {}
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0]
      if (!field) {
        return
      }
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
    return {
      status: 'error',
      message: 'You need scheduling permissions to queue posts.',
    }
  }

  if (data.intent === 'publish' && !canPublish) {
    return {
      status: 'error',
      message: 'You need publishing permissions to mark posts as live.',
    }
  }

  const content = data.content.trim()
  const platforms = data.platforms

  const createPayload: Parameters<typeof prisma.socialMediaPost.create>[0]['data'] = {
    content,
    platforms,
    status: 'DRAFT',
  }

  if (data.intent === 'schedule' && data.scheduledAt && canSchedule) {
    createPayload.status = 'SCHEDULED'
    createPayload.scheduledAt = data.scheduledAt
  } else if (data.intent === 'publish' && canPublish) {
    createPayload.status = 'PUBLISHED'
    createPayload.publishedAt = new Date()
  }

  const post = await prisma.socialMediaPost.create({
    data: createPayload,
  })

  await logAudit({
    userId: user.id,
    action: 'social_post.create',
    entityType: 'SocialMediaPost',
    entityId: post.id,
    changes: {
      status: createPayload.status,
      platforms,
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
    message: `Post ${statusLabel} for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}.`,
  }
}
