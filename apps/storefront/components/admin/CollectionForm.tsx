'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Save, X } from 'lucide-react'
import type { Collection } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import { slugify } from '@/lib/collections'

interface ProductOption {
  id: string
  name: string
  sku: string
}

interface CollectionFormProps {
  collection?: Collection
  onSuccess?: () => void
  onCancel?: () => void
}

export default function CollectionForm({ collection, onSuccess, onCancel }: CollectionFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(collection?.name || '')
  const [slug, setSlug] = useState(collection?.slug || '')
  const [description, setDescription] = useState(collection?.description || '')
  const [image, setImage] = useState(collection?.image || '')
  const [isActive, setIsActive] = useState(collection?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(collection?.sortOrder.toString() || '0')
  const [metaTitle, setMetaTitle] = useState(collection?.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(collection?.metaDescription || '')
  const [ogImage, setOgImage] = useState(collection?.ogImage || '')

  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [productFilter, setProductFilter] = useState('')

  const isEditing = !!collection
  // When editing, the current membership loads asynchronously. Until it has, submitting would send
  // an empty productIds and the PATCH would wipe the collection — so submit is blocked until it
  // loads, and a load failure surfaces rather than silently emptying the set. Creating has nothing
  // to load, so it starts ready.
  const [membershipLoaded, setMembershipLoaded] = useState(!collection)
  const [membershipError, setMembershipError] = useState(false)

  // Load the whole catalogue for the picker (the admin products API caps `limit` at 100, so page
  // through it) and, when editing, this collection's current members in their saved order.
  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      const all: ProductOption[] = []
      const pageSize = 100
      for (let page = 1; page <= 50; page += 1) {
        const res = await fetch(`/api/admin/products?limit=${pageSize}&page=${page}`)
        if (!res.ok) break
        const data = await res.json()
        const batch: ProductOption[] = (data.products || []).map((p: ProductOption) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
        }))
        all.push(...batch)
        const total = typeof data.totalCount === 'number' ? data.totalCount : all.length
        if (batch.length === 0 || all.length >= total) break
      }
      if (!cancelled) setProducts(all)
    }

    loadProducts().catch(() => {
      if (!cancelled) setProducts([])
    })

    if (collection) {
      fetch(`/api/admin/collections/${collection.id}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('Failed to load collection members')
          return r.json()
        })
        .then((d) => {
          if (cancelled) return
          const rows = d.collection?.products || []
          setSelectedIds(rows.map((row: { product: { id: string } }) => row.product.id))
          setMembershipLoaded(true)
        })
        .catch(() => {
          if (!cancelled) setMembershipError(true)
        })
    }

    return () => {
      cancelled = true
    }
  }, [collection])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!isEditing) setSlug(slugify(value))
  }

  const toggleProduct = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)))
  }

  const filtered = products.filter((p) => {
    const q = productFilter.trim().toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Never submit an edit whose current membership has not loaded — that would replace the set
    // with whatever is (not) selected and wipe the collection.
    if (isEditing && !membershipLoaded) {
      setError(
        membershipError
          ? "Couldn't load this collection's products, so it can't be saved without risking its contents. Reopen the editor to try again."
          : "Still loading this collection's products — please wait a moment and try again."
      )
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        name,
        slug,
        description: description || null,
        image: image || null,
        isActive,
        sortOrder: sortOrder.trim() ? parseInt(sortOrder, 10) : 0,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
        productIds: selectedIds,
      }

      const url = isEditing ? `/api/admin/collections/${collection.id}` : '/api/admin/collections'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save collection')

      router.refresh()
      onSuccess?.()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isEditing && membershipError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 text-sm text-foreground dark:bg-amber-950/20">
          Couldn&apos;t load this collection&apos;s current products, so saving is disabled to avoid
          emptying it. Close and reopen the editor to try again.
        </div>
      )}

      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Basic Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Image URL</Label>
            <Input id="image" value={image} onChange={(e) => setImage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input id="sortOrder" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Products</h2>
          <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
        </div>
        <Input
          placeholder="Filter by name or SKU…"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="mb-3"
        />
        <ScrollArea className="h-56 rounded-md border">
          <div className="p-2">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No products match.</p>
            ) : (
              filtered.map((product) => (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedIds.includes(product.id)}
                    onCheckedChange={(checked) => toggleProduct(product.id, checked === true)}
                  />
                  <span className="text-sm text-foreground">{product.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{product.sku}</span>
                </label>
              ))
            )}
          </div>
        </ScrollArea>
        <p className="mt-2 text-xs text-muted-foreground">
          Products appear in the collection in the order you select them.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">SEO</h2>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea id="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ogImage">OG Image URL</Label>
            <Input id="ogImage" value={ogImage} onChange={(e) => setOgImage(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Settings</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Active</Label>
            <p className="text-sm text-muted-foreground">Show this collection on the storefront</p>
          </div>
          <Switch checked={isActive} onCheckedChange={(checked: boolean) => setIsActive(checked)} />
        </div>
      </Card>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={isSubmitting || (isEditing && (!membershipLoaded || membershipError))}
        >
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />{isEditing ? 'Update' : 'Create'}</>}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
      </div>
    </form>
  )
}
