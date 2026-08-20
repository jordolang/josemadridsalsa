import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { requirePermission } from '@/lib/rbac'
import { PollEditor, type EditorQuestion } from '@/components/admin/polls/poll-editor'

export const metadata: Metadata = createMetadata({
  title: 'Edit poll - Jose Madrid Salsa Admin',
  description: 'Edit a poll, its questions and its answers.',
  pathname: '/admin/content/polls',
})

export const dynamic = 'force-dynamic'

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('content:write')
  const { id } = await params

  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  })

  if (!poll) notFound()

  const questions: EditorQuestion[] = poll.questions.map((question) => ({
    id: question.id,
    key: question.id,
    type: question.type,
    prompt: question.prompt,
    helpText: question.helpText ?? '',
    imageUrl: question.imageUrl ?? '',
    imageAlt: question.imageAlt ?? '',
    isRequired: question.isRequired,
    maxLength: question.maxLength,
    placeholder: question.placeholder ?? '',
    minSelections: question.minSelections?.toString() ?? '',
    maxSelections: question.maxSelections?.toString() ?? '',
    allowOther: question.allowOther,
    ratingMax: question.ratingMax,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description ?? '',
      imageUrl: option.imageUrl ?? '',
      emoji: option.emoji ?? '',
    })),
  }))

  return (
    <PollEditor
      poll={{
        id: poll.id,
        slug: poll.slug,
        title: poll.title,
        subtitle: poll.subtitle ?? '',
        description: poll.description ?? '',
        imageUrl: poll.imageUrl ?? '',
        imageAlt: poll.imageAlt ?? '',
        accentColor: poll.accentColor ?? 'salsa',
        status: poll.status,
        visibility: poll.visibility,
        accessCode: poll.accessCode,
        featured: poll.featured,
        sortOrder: poll.sortOrder,
        publishedAt: poll.publishedAt?.toISOString() ?? '',
        startsAt: poll.startsAt?.toISOString() ?? '',
        endsAt: poll.endsAt?.toISOString() ?? '',
        resultsVisibility: poll.resultsVisibility,
        allowMultipleSubmissions: poll.allowMultipleSubmissions,
        collectEmail: poll.collectEmail,
        consentNotice: poll.consentNotice ?? '',
        thankYouMessage: poll.thankYouMessage ?? '',
        closedMessage: poll.closedMessage ?? '',
        seoTitle: poll.seoTitle ?? '',
        seoDescription: poll.seoDescription ?? '',
        noIndex: poll.noIndex,
        responseCount: poll.responseCount,
      }}
      questions={questions}
    />
  )
}
