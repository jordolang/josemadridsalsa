import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { pollCreateSchema, pollQuestionInputSchema } from '@/lib/polls/schemas'
import { describeWriteError, generateAccessCode, savePollQuestions } from '@/lib/polls/admin'

export const dynamic = 'force-dynamic'

const createSchema = pollCreateSchema.extend({
  questions: z.array(pollQuestionInputSchema).default([]),
})

/** GET /api/admin/cms/polls — every poll, featured first, with its counts. */
export async function GET() {
  try {
    await requirePermission('content:read')
    const polls = await prisma.poll.findMany({
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { questions: true, responses: true } } },
    })
    return ok({ polls })
  } catch (error) {
    const { message, status } = describeWriteError(error)
    return fail(message, status)
  }
}

/** POST /api/admin/cms/polls — create a poll, optionally with its questions. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')
    const { questions, ...pollFields } = createSchema.parse(await req.json())

    // One transaction, so a failed question write cannot leave a half-built poll.
    const poll = await prisma.$transaction(async (tx) => {
      const created = await tx.poll.create({
        data: {
          ...pollFields,
          accessCode: pollFields.visibility === 'INVITE_ONLY' ? generateAccessCode() : null,
        },
      })
      if (questions.length > 0) {
        await savePollQuestions(created.id, questions, tx)
      }
      return created
    })

    await logAudit({
      userId: user.id,
      action: 'cms.poll.create',
      entityType: 'cms.poll',
      entityId: poll.id,
      changes: { slug: poll.slug, title: poll.title },
    })

    const created = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: {
        questions: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } },
      },
    })
    return ok({ poll: created }, 201)
  } catch (error) {
    const { message, status } = describeWriteError(error)
    return fail(message, status)
  }
}
