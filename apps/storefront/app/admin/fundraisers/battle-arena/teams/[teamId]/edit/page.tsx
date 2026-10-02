import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { TeamEditForm } from './_components/team-edit-form'

interface Props {
  params: Promise<{ teamId: string }>
}

export default async function EditTeamPage({ params }: Props) {
  try {
    await requireAdminSession()
  } catch {
    redirect('/auth/signin?callbackUrl=/admin')
  }

  const { teamId } = await params
  const team = await db.fundraiserTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      slug: true,
      name: true,
      school: true,
      activePeriod: true,
      logoUrl: true,
      heroImageUrl: true,
      heroVideoUrl: true,
      campaignTitle: true,
      tagline: true,
      storyHtml: true,
      fundraiserId: true,
    },
  })
  if (!team) notFound()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/fundraisers/battle-arena"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Battle Arena seasons
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit team</h1>
        <p className="text-muted-foreground">
          {team.name} <span className="font-mono text-xs">· {team.slug}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {team.school} · {team.activePeriod}
        </p>
      </div>
      <TeamEditForm team={team} />
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground">Products &amp; pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This team sells its campaign&apos;s catalogue, at the campaign&apos;s price per jar
          and its split. There is one shelf, so the arena shop can never quote a price the
          campaign disagrees with.
        </p>
        <Link
          href={`/admin/fundraisers/${team.fundraiserId}/manage`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Edit the campaign store
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
