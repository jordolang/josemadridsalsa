import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Tag as TagIcon } from 'lucide-react'
import Link from 'next/link'
import TagActions from '@/components/admin/TagActions'

export const metadata = {
  title: 'Tags | Admin',
  description: 'Manage tags for products, recipes, media, and events',
}

type SearchParams = {
  type?: string
}

async function getTags(searchParams: SearchParams) {
  const where: any = {}

  // Filter by tag type
  if (searchParams.type && searchParams.type !== 'all') {
    where.type = searchParams.type
  }

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          productTags: true,
          recipeTags: true,
          mediaTags: true,
          eventTags: true,
        },
      },
    },
  })

  return tags
}

const tagTypeColors = {
  PRODUCT: 'bg-blue-100 text-blue-800',
  RECIPE: 'bg-green-100 text-green-800',
  MEDIA: 'bg-purple-100 text-purple-800',
  EVENT: 'bg-orange-100 text-orange-800',
  GENERAL: 'bg-slate-100 text-slate-800',
}

const tagTypeLabels = {
  PRODUCT: 'Product',
  RECIPE: 'Recipe',
  MEDIA: 'Media',
  EVENT: 'Event',
  GENERAL: 'General',
}

export default async function TagsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const tags = await getTags(searchParams)

  // Calculate total usage for each tag
  const tagsWithUsage = tags.map((tag) => ({
    ...tag,
    totalUsage:
      tag._count.productTags +
      tag._count.recipeTags +
      tag._count.mediaTags +
      tag._count.eventTags,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-slate-600">
            Organize content with universal tagging
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tags/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </Link>
        </Button>
      </div>

      {/* Filter Tabs */}
      <Card className="p-4">
        <div className="flex gap-2 overflow-x-auto">
          <Link href="/admin/tags?type=all">
            <Button
              variant={!searchParams.type || searchParams.type === 'all' ? 'default' : 'outline'}
              size="sm"
            >
              All Tags ({tags.length})
            </Button>
          </Link>
          {Object.entries(tagTypeLabels).map(([type, label]) => {
            const count = tags.filter((t) => t.type === type).length
            return (
              <Link key={type} href={`/admin/tags?type=${type}`}>
                <Button
                  variant={searchParams.type === type ? 'default' : 'outline'}
                  size="sm"
                >
                  {label} ({count})
                </Button>
              </Link>
            )
          })}
        </div>
      </Card>

      {/* Tags Grid */}
      {tagsWithUsage.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <TagIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No tags found</p>
            <p className="mt-1 text-sm">
              Create your first tag to organize your content
            </p>
            <Button className="mt-4" asChild>
              <Link href="/admin/tags/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Tag
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tagsWithUsage.map((tag) => (
            <Card key={tag.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-slate-400" />
                    <h3 className="font-semibold">{tag.name}</h3>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      className={tagTypeColors[tag.type as keyof typeof tagTypeColors]}
                    >
                      {tagTypeLabels[tag.type as keyof typeof tagTypeLabels]}
                    </Badge>
                    {tag.totalUsage > 0 && (
                      <span className="text-xs text-slate-500">
                        Used {tag.totalUsage} {tag.totalUsage === 1 ? 'time' : 'times'}
                      </span>
                    )}
                  </div>
                  {tag.totalUsage > 0 && (
                    <div className="mt-2 flex gap-2 text-xs text-slate-500">
                      {tag._count.productTags > 0 && (
                        <span>{tag._count.productTags} product{tag._count.productTags !== 1 ? 's' : ''}</span>
                      )}
                      {tag._count.recipeTags > 0 && (
                        <span>{tag._count.recipeTags} recipe{tag._count.recipeTags !== 1 ? 's' : ''}</span>
                      )}
                      {tag._count.mediaTags > 0 && (
                        <span>{tag._count.mediaTags} media</span>
                      )}
                      {tag._count.eventTags > 0 && (
                        <span>{tag._count.eventTags} event{tag._count.eventTags !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  )}
                </div>
                <TagActions tag={tag} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
