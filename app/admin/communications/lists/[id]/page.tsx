import { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { SubscribersTable } from './components/SubscribersTable'

export const metadata: Metadata = {
  title: 'Mailing List Subscribers - Admin',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ListSubscribersPage({ params }: PageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const canManageLists = await hasPermission(user, 'content:write')
  
  if (!user || !canManageLists) {
    redirect('/admin/communications')
  }

  const list = await prisma.mailingList.findUnique({
    where: { id },
    include: {
      subscribers: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!list) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/communications/lists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{list.name}</h1>
          <p className="text-muted-foreground">{list.description || 'No description provided.'}</p>
        </div>
      </div>

      <SubscribersTable listId={list.id} subscribers={list.subscribers} />
    </div>
  )
}
