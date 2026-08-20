import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { toCsv } from '@/lib/csv'
import { describeWriteError } from '@/lib/polls/admin'
import { displayName } from '@/lib/polls/queries'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const MAX_ROWS = 2000

/**
 * Stop a spreadsheet treating a respondent's answer as a formula.
 *
 * The cells here are public input, and Excel and Sheets both execute a cell
 * that opens with `=`, `+`, `-`, `@`, or a control character. Quoting alone —
 * all `toCsv` does — does not prevent that, so prefix a single quote.
 */
function defuseFormula(cell: string): string {
  return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell
}

/**
 * GET /api/admin/cms/polls/[id]/responses — the answers behind a poll.
 *
 * `?format=csv` downloads the same data as a spreadsheet, one row per
 * response and one column per question. The stored name is included: staff
 * need it to follow up, and the `anonymous` column carries the respondent's
 * request forward so whoever writes the promotional copy can see it.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requirePermission('content:read')
    const { id } = await ctx.params

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })
    if (!poll) return fail('Not found', 404)

    const responses = await prisma.pollResponse.findMany({
      where: { pollId: id },
      orderBy: { submittedAt: 'desc' },
      take: MAX_ROWS,
      include: { answers: true },
    })

    const optionLabels = new Map(
      poll.questions.flatMap((question) =>
        question.options.map((option) => [option.id, option.label] as const)
      )
    )

    const formatAnswer = (answer: (typeof responses)[number]['answers'][number]): string => {
      // An option the editor has since deleted has no label left; say so rather
      // than printing a raw id nobody can interpret.
      const parts = answer.optionIds.map(
        (optionId) => optionLabels.get(optionId) ?? '(removed option)'
      )
      if (answer.rating != null) parts.push(String(answer.rating))
      if (answer.textValue) parts.push(answer.textValue)
      if (answer.otherText) parts.push(`Other: ${answer.otherText}`)
      return parts.join(' | ')
    }

    if (req.nextUrl.searchParams.get('format') === 'csv') {
      const headers = [
        'Submitted',
        'First name',
        'Last name',
        'Email',
        'Anonymous requested',
        'Credited as',
        ...poll.questions.map((question) => question.prompt),
      ]
      const rows = responses.map((response) => {
        const byQuestion = new Map(response.answers.map((answer) => [answer.questionId, answer]))
        return [
          response.submittedAt.toISOString(),
          response.firstName,
          response.lastName ?? '',
          response.email ?? '',
          response.anonymousRequested ? 'yes' : 'no',
          displayName(response),
          ...poll.questions.map((question) => {
            const answer = byQuestion.get(question.id)
            return answer ? formatAnswer(answer) : ''
          }),
        ]
      })

      return new NextResponse(
        toCsv(headers.map(defuseFormula), rows.map((row) => row.map(defuseFormula))),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="poll-${poll.slug}-responses.csv"`,
          },
        }
      )
    }

    return ok({
      poll: { id: poll.id, slug: poll.slug, title: poll.title },
      questions: poll.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        type: question.type,
      })),
      responses: responses.map((response) => ({
        id: response.id,
        submittedAt: response.submittedAt,
        firstName: response.firstName,
        lastName: response.lastName,
        email: response.email,
        anonymousRequested: response.anonymousRequested,
        creditedAs: displayName(response),
        answers: response.answers.map((answer) => ({
          questionId: answer.questionId,
          summary: formatAnswer(answer),
        })),
      })),
      truncated: responses.length === MAX_ROWS,
    })
  } catch (error) {
    const { message, status } = describeWriteError(error)
    return fail(message, status)
  }
}
