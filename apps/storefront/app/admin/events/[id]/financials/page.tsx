import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import FinancialsEditor from '../../_components/FinancialsEditor'

export const metadata: Metadata = createMetadata({
  title: 'Show Financials - Jose Madrid Salsa Admin',
  description: 'Costs, sales and break-even for an event.',
  pathname: '/admin/events/financials',
})

export default async function EventFinancialsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  // This is an editor, not a report: saving needs events:write, so gate the page on the same
  // permission rather than letting a read-only user open a form every save will reject.
  if (!user || !(await hasPermission(user, 'events:write'))) {
    redirect('/admin')
  }

  const event = await prisma.featuredEvent.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!event) {
    notFound()
  }

  return <FinancialsEditor eventId={id} />
}
