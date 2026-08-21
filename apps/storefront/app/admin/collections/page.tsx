'use client'

import { useState, useEffect } from 'react'
import type { Collection } from '@prisma/client'
import Image from 'next/image'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import CollectionForm from '@/components/admin/CollectionForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** A collection as the list endpoint returns it: the model plus its product count. */
type CollectionListItem = Collection & { _count: { products: number } }

// The list API caps each page at 100; walk pages until we have them all so a shop with more than
// 100 collections doesn't silently lose the tail from the admin grid.
const PAGE_SIZE = 100

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editing, setEditing] = useState<CollectionListItem | null>(null)
  const [deleting, setDeleting] = useState<CollectionListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCollections = async () => {
    try {
      const all: CollectionListItem[] = []
      const seen = new Set<string>()
      // Walk pages until the last one — a short page, or once we've collected the API's reported
      // total. `total` (always returned by the endpoint) bounds the loop, so there is no arbitrary
      // page cap that could silently hide the tail. Offset paging over a set that changes between
      // requests could repeat a row shifted across a page boundary, so de-dupe by id.
      let total = Infinity
      for (let page = 1; all.length < total; page++) {
        const response = await fetch(`/api/admin/collections?page=${page}&limit=${PAGE_SIZE}`)
        if (!response.ok) {
          setLoadError(true)
          return
        }
        const data = await response.json()
        const batch: CollectionListItem[] = data.collections || []
        for (const c of batch) {
          if (!seen.has(c.id)) {
            seen.add(c.id)
            all.push(c)
          }
        }
        if (typeof data.total === 'number') total = data.total
        // A short page is the last page — stop even if a concurrent insert bumped `total`.
        if (batch.length < PAGE_SIZE) break
      }
      setCollections(all)
      setLoadError(false)
    } catch (error) {
      console.error('Failed to fetch collections:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/collections/${deleting.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        toast.error('Failed to delete', { description: error.error || 'Unknown error' })
        return
      }
      toast.success('Collection deleted', { description: `${deleting.name} has been removed.` })
      // Only dismiss the confirmation on success, so a failed delete can be retried without
      // reopening the dialog.
      setDeleting(null)
      fetchCollections()
    } catch (error) {
      toast.error('Failed to delete collection', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">Couldn&apos;t load collections.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setLoading(true)
                setLoadError(false)
                fetchCollections()
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Curate marketing groups of products, like Gift Sets or Staff Picks
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 size-4" />
          Add Collection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection) => (
          <Card key={collection.id}>
            {collection.image && (
              <div className="relative mx-6 mt-6 h-32 overflow-hidden rounded">
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  // Admins may paste an image URL from any host; `unoptimized` skips the Next image
                  // optimizer (and its remotePatterns allowlist) so an off-allowlist host renders
                  // instead of throwing and breaking the page.
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{collection.name}</CardTitle>
                <Badge variant={collection.isActive ? 'default' : 'outline'}>
                  {collection.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              {collection.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {collection.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {collection._count.products} products
                </span>
                <span className="text-muted-foreground">Sort: {collection.sortOrder}</span>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditing(collection)}
              >
                <Edit className="mr-1 size-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDeleting(collection)}
                className="text-destructive hover:text-destructive"
                aria-label={`Delete ${collection.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {collections.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground">No collections yet</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 size-4" />
                Create Your First Collection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
          </DialogHeader>
          <CollectionForm onSuccess={() => { setShowCreateDialog(false); fetchCollections() }} onCancel={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          {editing && (
            <CollectionForm
              collection={editing}
              onSuccess={() => { setEditing(null); fetchCollections() }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleting?.name}&quot;? This removes the
              collection only — the {deleting?._count?.products ?? 0} products in it are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              // preventDefault stops Radix from auto-closing the dialog on click; handleDelete then
              // closes it (via setDeleting(null)) only on success, so a failed delete stays open.
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
