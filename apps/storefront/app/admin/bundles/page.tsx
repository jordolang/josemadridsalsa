'use client'

import { useState, useEffect } from 'react'
import type { Bundle } from '@prisma/client'
import Image from 'next/image'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import BundleForm from '@/components/admin/BundleForm'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** A bundle as the list endpoint returns it: the model plus its product count. */
type BundleListItem = Bundle & { _count: { products: number } }

const PAGE_SIZE = 100

const money = (value: Bundle['price']) =>
  `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BundlesPage() {
  const [bundles, setBundles] = useState<BundleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editing, setEditing] = useState<BundleListItem | null>(null)
  const [deleting, setDeleting] = useState<BundleListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchBundles = async () => {
    try {
      const all: BundleListItem[] = []
      const seen = new Set<string>()
      const addUnique = (batch: BundleListItem[]) => {
        for (const b of batch) {
          if (!seen.has(b.id)) {
            seen.add(b.id)
            all.push(b)
          }
        }
      }

      // Fetch page 1, derive a fixed page count from the reported total, then fetch the rest — a
      // deterministic bound (no runaway loop) sized to the data (nothing silently hidden).
      const first = await fetch(`/api/admin/bundles?page=1&limit=${PAGE_SIZE}`)
      if (!first.ok) {
        setLoadError(true)
        return
      }
      const firstData = await first.json()
      addUnique(firstData.bundles || [])
      const total = typeof firstData.total === 'number' ? firstData.total : all.length
      const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

      for (let page = 2; page <= pageCount; page++) {
        const res = await fetch(`/api/admin/bundles?page=${page}&limit=${PAGE_SIZE}`)
        if (!res.ok) {
          setLoadError(true)
          return
        }
        const data = await res.json()
        addUnique(data.bundles || [])
      }

      setBundles(all)
      setLoadError(false)
    } catch (error) {
      console.error('Failed to fetch bundles:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBundles()
  }, [])

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/bundles/${deleting.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        toast.error('Failed to delete', { description: error.error || 'Unknown error' })
        return
      }
      toast.success('Bundle deleted', { description: `${deleting.name} has been removed.` })
      setDeleting(null)
      fetchBundles()
    } catch (error) {
      toast.error('Failed to delete bundle', {
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
        <h1 className="text-2xl font-bold tracking-tight">Bundles</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">Couldn&apos;t load bundles.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setLoading(true)
                setLoadError(false)
                fetchBundles()
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
          <h1 className="text-2xl font-bold tracking-tight">Bundles</h1>
          <p className="text-sm text-muted-foreground">
            Sell a fixed set of products together at one set price
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 size-4" />
          Add Bundle
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bundles.map((bundle) => (
          <Card key={bundle.id}>
            {bundle.image && (
              <div className="relative mx-6 mt-6 h-32 overflow-hidden rounded">
                <Image
                  src={bundle.image}
                  alt={bundle.name}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{bundle.name}</CardTitle>
                <Badge variant={bundle.isActive ? 'default' : 'outline'}>
                  {bundle.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              {bundle.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{bundle.description}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{money(bundle.price)}</span>
                <span className="text-muted-foreground">{bundle._count.products} products</span>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditing(bundle)}
              >
                <Edit className="mr-1 size-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDeleting(bundle)}
                className="text-destructive hover:text-destructive"
                aria-label={`Delete ${bundle.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {bundles.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground">No bundles yet</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 size-4" />
                Create Your First Bundle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Bundle</DialogTitle>
          </DialogHeader>
          <BundleForm onSuccess={() => { setShowCreateDialog(false); fetchBundles() }} onCancel={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bundle</DialogTitle>
          </DialogHeader>
          {editing && (
            <BundleForm
              bundle={editing}
              onSuccess={() => { setEditing(null); fetchBundles() }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleting?.name}&quot;? This removes the bundle
              only — the {deleting?._count?.products ?? 0} products in it are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
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
