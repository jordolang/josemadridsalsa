import Link from 'next/link'
import type { Metadata } from 'next'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma as db } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SignupActions } from './_components/signup-actions'
import { TeamActions } from './_components/team-actions'

export const metadata: Metadata = {
  title: 'Fundraiser Battle Signups — Admin',
  description:
    'Approve or reject FundraiserSignupRequest rows and rotate API keys on active FundraiserTeam rows.',
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export default async function FundraiserSignupsAdminPage() {
  await requireAdminSession()

  const [pending, reviewed, teams] = await Promise.all([
    db.fundraiserSignupRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    }),
    db.fundraiserSignupRequest.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    db.fundraiserTeam.findMany({
      orderBy: [{ status: 'asc' }, { salesCount: 'desc' }],
      take: 50,
      select: {
        id: true,
        slug: true,
        name: true,
        school: true,
        activePeriod: true,
        status: true,
        goalAmount: true,
        salesCount: true,
        hpCurrent: true,
        createdAt: true,
        apiKeyIssuedAt: true,
        apiKeyRotatedAt: true,
      },
    }),
  ])

  const period = currentPeriod()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Battle Arena Signups
          </h1>
          <p className="text-muted-foreground">
            Approve fundraiser team requests, mint API keys, and rotate
            existing keys.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/fundraisers">Back to Fundraisers</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">
            Pending ({pending.length})
          </h2>
          <span className="text-xs text-muted-foreground">
            Approvals default to period {period}
          </span>
        </div>
        {pending.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No signups waiting for review.
          </Card>
        ) : (
          <div className="grid gap-3">
            {pending.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {s.teamName}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {s.schoolName}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {s.contactName} ·{' '}
                      <a
                        href={`mailto:${s.contactEmail}`}
                        className="hover:underline"
                      >
                        {s.contactEmail}
                      </a>
                      {s.contactPhone ? ` · ${s.contactPhone}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Goal ${s.goalAmount.toLocaleString()} · submitted{' '}
                      {s.createdAt.toLocaleDateString()}
                    </div>
                    {s.message && (
                      <p className="mt-1 max-w-2xl whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                        {s.message}
                      </p>
                    )}
                  </div>
                  <SignupActions
                    signupId={s.id}
                    defaultPeriod={period}
                    requestedFulfillment={s.requestedFulfillment}
                    requestedBrochure={s.requestedBrochure}
                    requestedResaleNumber={s.resaleNumber}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Active Teams ({teams.length})
        </h2>
        {teams.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No FundraiserTeam rows yet.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Team</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Sales</th>
                  <th className="p-3 text-right">HP / Goal</th>
                  <th className="p-3">API Key</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="p-3">
                      <Link
                        href={`/fundraise/${t.slug}`}
                        className="font-semibold hover:underline"
                      >
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {t.school}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{t.activePeriod}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          t.status === 'ACTIVE'
                            ? 'default'
                            : t.status === 'PENDING'
                              ? 'outline'
                              : t.status === 'SUSPENDED'
                                ? 'destructive'
                                : 'secondary'
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {t.salesCount}
                    </td>
                    <td className="p-3 text-right font-mono text-xs tabular-nums">
                      {t.hpCurrent}/{t.goalAmount}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {t.apiKeyIssuedAt
                        ? `issued ${t.apiKeyIssuedAt.toLocaleDateString()}`
                        : '—'}
                      {t.apiKeyRotatedAt && (
                        <div>
                          rotated {t.apiKeyRotatedAt.toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <TeamActions teamId={t.id} teamName={t.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Recently reviewed ({reviewed.length})
          </h2>
          <div className="grid gap-2">
            {reviewed.map((s) => (
              <Card key={s.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <span className="font-semibold">{s.teamName}</span>
                  <span className="ml-2 text-muted-foreground">
                    {s.schoolName}
                  </span>
                  {s.reviewNotes && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.reviewNotes}
                    </div>
                  )}
                </div>
                <Badge
                  variant={
                    s.status === 'APPROVED' ? 'default' : 'destructive'
                  }
                >
                  {s.status}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
