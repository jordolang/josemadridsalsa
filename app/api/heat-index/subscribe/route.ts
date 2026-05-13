import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { blogSubscribeSchema } from '@/lib/blog/schemas'
import { getOrCreateMailingList } from '@/lib/blog/publish'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GLOBAL_LIST_NAME = 'Heat Index'

/**
 * POST /api/heat-index/subscribe
 * Public — subscribe an email to the Heat Index global list, plus the per-series
 * list if a seriesSlug is provided. Idempotent on (listId, email).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = blogSubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const { email, firstName, seriesSlug, source } = parsed.data
    const normalizedEmail = email.toLowerCase()

    // Resolve the series (if provided) and prepare list names.
    const listNames = [GLOBAL_LIST_NAME]
    if (seriesSlug) {
      const series = await prisma.blogSeries.findUnique({
        where: { slug: seriesSlug },
        select: { name: true },
      })
      if (series) listNames.push(`${GLOBAL_LIST_NAME} · ${series.name}`)
    }

    const listIds = await Promise.all(listNames.map(getOrCreateMailingList))

    await Promise.all(
      listIds.map((listId) =>
        prisma.mailingListSubscriber.upsert({
          where: { listId_email: { listId, email: normalizedEmail } },
          update: {
            firstName: firstName ?? undefined,
            status: 'SUBSCRIBED',
            source: source ?? undefined,
            unsubscribedAt: null,
          },
          create: {
            listId,
            email: normalizedEmail,
            firstName: firstName ?? null,
            status: 'SUBSCRIBED',
            source: source ?? 'heat-index',
          },
        })
      )
    )

    return ok({ subscribed: true })
  } catch (error: unknown) {
    return serverError('Failed to subscribe', error)
  }
}
