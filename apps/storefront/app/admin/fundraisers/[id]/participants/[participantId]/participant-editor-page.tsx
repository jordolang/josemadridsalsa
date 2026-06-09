import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { ParticipantForm } from '@/components/fundraising/participant-form'

export const metadata: Metadata = createMetadata({
  title: 'Edit Participant - Jose Madrid Salsa Admin',
  description: 'Edit participant details.',
  pathname: '/admin/fundraisers',
})

async function getParticipant(participantId: string, fundraiserId: string) {
  const participant = await prisma.fundraiserParticipant.findUnique({
    where: {
      id: participantId,
      fundraiserId,
    },
    include: {
      fundraiser: {
        select: {
          id: true,
          name: true,
          organizationName: true,
        },
      },
    },
  })

  if (!participant) {
    notFound()
  }

  return participant
}

export default async function ParticipantEditorPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>
}) {
  const { id, participantId } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:write'))) {
    redirect(`/admin/fundraisers/${id}/participants`)
  }

  const participant = await getParticipant(participantId, id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Participant</h1>
        <p className="text-muted-foreground">
          Update participant details for {participant.fundraiser.name}
        </p>
      </div>

      <ParticipantForm participant={participant} fundraiserId={id} />
    </div>
  )
}
