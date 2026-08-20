import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { requirePermission } from '@/lib/rbac'
import { isMissingTableError } from '@/lib/prisma-errors'
import { PollList, type AdminPollRow } from '@/components/admin/polls/poll-list'

export const metadata: Metadata = createMetadata({
  title: 'Polls - Jose Madrid Salsa Admin',
  description: 'Create and manage the polls visitors answer on the website.',
  pathname: '/admin/content/polls',
})

export const dynamic = 'force-dynamic'

async function loadPolls(): Promise<AdminPollRow[]> {
  try {
    const polls = await prisma.poll.findMany({
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { questions: true, responses: true } } },
    })
    return polls.map((poll) => ({
      id: poll.id,
      slug: poll.slug,
      title: poll.title,
      status: poll.status,
      visibility: poll.visibility,
      featured: poll.featured,
      responseCount: poll._count.responses,
      questionCount: poll._count.questions,
      updatedAt: poll.updatedAt.toISOString(),
    }))
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[polls] failed to load polls for admin:', error)
    }
    return []
  }
}

export default async function AdminPollsPage() {
  await requirePermission('content:read')
  const polls = await loadPolls()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Polls</h1>
        <p className="text-muted-foreground">
          Ask visitors anything. Polls appear on the site at /polls, which is linked from the footer
          of every page.
        </p>
      </div>
      <PollList polls={polls} />
    </div>
  )
}
