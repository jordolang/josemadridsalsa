import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Upload, Search, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import MediaGrid from '@/components/admin/MediaGrid'
import MediaUploadDialog from '@/components/admin/MediaUploadDialog'

export const metadata = {
  title: 'Media Library | Admin',
  description: 'Manage images and media assets',
}

type SearchParams = {
  search?: string
  page?: string
}

async function getMedia(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 24
  const skip = (page - 1) * limit

  const where: any = {}

  // Search filter
  if (searchParams.search) {
    where.OR = [
      { filename: { contains: searchParams.search, mode: 'insensitive' } },
      { alt: { contains: searchParams.search, mode: 'insensitive' } },
      { caption: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            mediaTags: true,
          },
        },
      },
    }),
    prisma.media.count({ where }),
  ])

  return {
    media,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const { media, total, page, totalPages } = await getMedia(searchParams)

  // Calculate storage stats
  const totalSize = media.reduce((acc, m) => acc + m.fileSize, 0)
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-slate-600">
            Manage images and media assets
          </p>
        </div>
        <MediaUploadDialog />
      </div>

      {/* Stats & Search */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-slate-600">Total Files:</span>{' '}
              <span className="font-semibold">{total}</span>
            </div>
            <div>
              <span className="text-slate-600">Storage:</span>{' '}
              <span className="font-semibold">{totalSizeMB} MB</span>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search media..."
              defaultValue={searchParams.search}
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {/* Media Grid */}
      {media.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <ImageIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No media found</p>
            <p className="mt-1 text-sm">
              {searchParams.search
                ? 'Try a different search term'
                : 'Upload your first image to get started'}
            </p>
            <MediaUploadDialog>
              <Button className="mt-4">
                <Upload className="mr-2 h-4 w-4" />
                Upload Media
              </Button>
            </MediaUploadDialog>
          </div>
        </Card>
      ) : (
        <>
          <MediaGrid media={media} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <Link href={`/admin/media?page=${page - 1}${searchParams.search ? `&search=${searchParams.search}` : ''}`}>
                    Previous
                  </Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <Link href={`/admin/media?page=${page + 1}${searchParams.search ? `&search=${searchParams.search}` : ''}`}>
                    Next
                  </Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
