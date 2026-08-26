import { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { SubscribersTable } from './components/SubscribersTable'

export const metadata: Metadata = {
  title: 'Mailing List Subscribers - Admin',
}

/**
 * Lists built from the customer database run to tens of thousands of contacts,
 * so the table is paged server-side. Loading every subscriber put the whole
 * list in the RSC payload — and in the response of every server action on this
 * page, since each one calls `revalidatePath` and re-renders it — which overran
 * the serverless function before the page reached the browser.
 */
const PAGE_SIZE = 100

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function ListSubscribersPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { page: pageParam } = await searchParams
  const user = await getCurrentUser()
  const canManageLists = await hasPermission(user, 'content:write')
  
  if (!user || !canManageLists) {
    redirect('/admin/communications')
  }

  const list = await prisma.mailingList.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  })

  if (!list) {
    notFound()
  }

  const parsedPage = Number(pageParam)
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const [subscribers, total] = await Promise.all([
    prisma.mailingListSubscriber.findMany({
      where: { listId: id },
      // `email` breaks ties so rows can't reshuffle between pages: a CSV import
      // stamps thousands of subscribers with the same `createdAt`.
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // `customFields` is deliberately absent: the importer parks every
      // unmapped CSV column there, and the table never reads it.
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.mailingListSubscriber.count({ where: { listId: id } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const buildPageHref = (targetPage: number) =>
    `/admin/communications/lists/${id}?page=${targetPage}`

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

      {/* Keyed by page so the page-scoped row selection resets when you turn it. */}
      <SubscribersTable
        key={page}
        listId={list.id}
        listName={list.name}
        subscribers={subscribers}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
      />

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={buildPageHref(page - 1)} />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={buildPageHref(page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
