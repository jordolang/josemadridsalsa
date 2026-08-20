import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { pollUpdateSchema } from '@/lib/polls/schemas'
import { describeWriteError, generateAccessCode, savePollQuestions } from '@/lib/polls/admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const detailInclude = {
  questions: {
    orderBy: { sortOrder: 'asc' as const },
    include: { options: { orderBy: { sortOrder: 'asc' as const } } },
  },
  _count: { select: { responses: true } },
}

/** GET /api/admin/cms/polls/[id] — one poll with its full question tree. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requirePermission('content:read')
    const { id } = await ctx.params
    const poll = await prisma.poll.findUnique({ where: { id }, include: detailInclude })
    if (!poll) return fail('Not found', 404)
    return ok({ poll })
  } catch (error) {
    const { message, status } = describeWriteError(error)
    return fail(message, status)
  }
}

/**
 * PATCH /api/admin/cms/polls/[id] — update the poll and, when the editor sends
 * one, its question tree.
 *
 * Switching a poll to invite-only mints its share code; switching back to
 * public clears it, so a stale invite link stops working rather than quietly
 * continuing to grant access to something now listed publicly anyway.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await ctx.params
    const { questions, ...fields } = pollUpdateSchema.parse(await req.json())

    const current = await prisma.poll.findUnique({
      where: { id },
      select: { visibility: true, accessCode: true, _count: { select: { questions: true } } },
    })
    if (!current) return fail('Not found', 404)

    // A published poll with no questions collects nothing but names, and still
    // counts each visitor as a participant.
    const goingLive = fields.status === 'PUBLISHED' || fields.status === 'SCHEDULED'
    const questionCount = questions ? questions.length : current._count.questions
    if (goingLive && questionCount === 0) {
      return fail('Add at least one question before publishing this poll', 422)
    }

    let accessCode = current.accessCode
    if (fields.visibility === 'INVITE_ONLY' && !current.accessCode) {
      accessCode = generateAccessCode()
    } else if (fields.visibility === 'PUBLIC') {
      accessCode = null
    }

    // The poll's own fields and its question tree go in together: a question
    // write that fails must not leave the settings half-saved. The access code
    // is written whenever visibility is part of the payload, so two overlapping
    // visibility changes cannot leave a public poll holding a live share code.
    await prisma.$transaction(async (tx) => {
      await tx.poll.update({
        where: { id },
        data: { ...fields, ...(fields.visibility !== undefined ? { accessCode } : {}) },
      })
      if (questions) {
        await savePollQuestions(id, questions, tx)
      }
    })

    await logAudit({
      userId: user.id,
      action: 'cms.poll.update',
      entityType: 'cms.poll',
      entityId: id,
      changes: { ...fields, ...(questions ? { questionCount: questions.length } : {}) },
    })

    const poll = await prisma.poll.findUnique({ where: { id }, include: detailInclude })
    return ok({ poll })
  } catch (error) {
    const { message, status } = describeWriteError(error)
    return fail(message, status)
  }
}

/** DELETE /api/admin/cms/polls/[id] — removes the poll and every response to it. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await ctx.params
    await prisma.poll.delete({ where: { id } })
    await logAudit({
      userId: user.id,
      action: 'cms.poll.delete',
      entityType: 'cms.poll',
      entityId: id,
    })
    return ok({ success: true })
  } catch (error) {
    const { message, status } = describeWriteError(error)
    return fail(message, status)
  }
}
