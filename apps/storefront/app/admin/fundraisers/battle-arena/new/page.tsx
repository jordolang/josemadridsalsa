import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminSession } from '@/lib/admin-auth'
import { Button } from '@/components/ui/button'
import { SeasonForm } from '../_components/season-form'

export const metadata: Metadata = {
  title: 'New Battle Arena Season — Admin',
  description: 'Create a new FundraiserSeason row.',
}

export default async function NewBattleArenaSeasonPage() {
  await requireAdminSession()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New season</h1>
          <p className="text-muted-foreground">
            Drafts don&apos;t affect live teams until you activate them.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/fundraisers/battle-arena">Cancel</Link>
        </Button>
      </div>
      <SeasonForm />
    </div>
  )
}
