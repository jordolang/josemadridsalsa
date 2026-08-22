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
import type { Bundle } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import { slugify } from '@/lib/bundles'

interface ProductOption {
  id: string
  name: string
  sku: string
}

interface BundleFormProps {
  bundle?: Bundle
  onSuccess?: () => void
  onCancel?: () => void
}

export default function BundleForm({ bundle, onSuccess, onCancel }: BundleFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(bundle?.name || '')
  const [slug, setSlug] = useState(bundle?.slug || '')
  const [description, setDescription] = useState(bundle?.description || '')
  const [image, setImage] = useState(bundle?.image || '')
  const [price, setPrice] = useState(bundle ? String(bundle.price) : '')
  const [isActive, setIsActive] = useState(bundle?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(bundle?.sortOrder.toString() || '0')
  const [metaTitle, setMetaTitle] = useState(bundle?.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(bundle?.metaDescription || '')
  const [ogImage, setOgImage] = useState(bundle?.ogImage || '')

  const [products, setProducts] = useState<ProductOption[]>([])
  // productId → quantity in the bundle. Selection and per-product count in one place.
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [productFilter, setProductFilter] = useState('')

  const isEditing = !!bundle
  // As with collections, editing loads the current components asynchronously; submitting before
  // that lands would wipe them, so submit stays blocked until it loads (or a load error surfaces).
  const [componentsLoaded, setComponentsLoaded] = useState(!bundle)
  const [componentsError, setComponentsError] = useState(false)

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

    if (bundle) {
      fetch(`/api/admin/bundles/${bundle.id}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('Failed to load bundle components')
          return r.json()
        })
        .then((d) => {
          if (cancelled) return
          const rows = d.bundle?.products || []
          const map: Record<string, number> = {}
          for (const row of rows as Array<{ product: { id: string }; quantity: number }>) {
            map[row.product.id] = row.quantity
          }
          setSelected(map)
          setComponentsLoaded(true)
        })
        .catch(() => {
          if (!cancelled) setComponentsError(true)
        })
    }

    return () => {
      cancelled = true
    }
  }, [bundle])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!isEditing) setSlug(slugify(value))
  }

  const toggleProduct = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (checked) next[id] = next[id] ?? 1
      else delete next[id]
      return next
    })
  }

  const setQuantity = (id: string, value: string) => {
    const n = parseInt(value, 10)
    setSelected((prev) => ({ ...prev, [id]: Number.isInteger(n) && n > 0 ? n : 1 }))
  }

  const filtered = products.filter((p) => {
    const q = productFilter.trim().toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  const selectedCount = Object.keys(selected).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditing && !componentsLoaded) {
      setError(
        componentsError
          ? "Couldn't load this bundle's products, so it can't be saved without risking its contents. Reopen the editor to try again."
          : "Still loading this bundle's products — please wait a moment and try again."
      )
      return
    }

    const priceValue = parseFloat(price)
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError('Enter a valid bundle price.')
      return
    }
    const components = Object.entries(selected).map(([productId, quantity]) => ({ productId, quantity }))
    if (components.length === 0) {
      setError('A bundle needs at least one product.')
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
        price: priceValue,
        isActive,
        sortOrder: sortOrder.trim() ? parseInt(sortOrder, 10) : 0,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
        components,
      }

      const url = isEditing ? `/api/admin/bundles/${bundle.id}` : '/api/admin/bundles'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save bundle')

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

      {isEditing && componentsError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 text-sm text-foreground dark:bg-amber-950/20">
          Couldn&apos;t load this bundle&apos;s current products, so saving is disabled to avoid
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
          <div className="space-y-2">
            <Label htmlFor="price">Bundle price ($) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input id="sortOrder" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="image">Image URL</Label>
            <Input id="image" value={image} onChange={(e) => setImage(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Products</h2>
          <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
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
              filtered.map((product) => {
                const isSelected = product.id in selected
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleProduct(product.id, checked === true)}
                      aria-label={`Include ${product.name}`}
                    />
                    <span className="text-sm text-foreground">{product.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{product.sku}</span>
                    {isSelected && (
                      <Input
                        type="number"
                        min="1"
                        value={selected[product.id]}
                        onChange={(e) => setQuantity(product.id, e.target.value)}
                        aria-label={`Quantity of ${product.name}`}
                        className="h-8 w-16"
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
        <p className="mt-2 text-xs text-muted-foreground">
          Set how many of each product the bundle contains. The bundle price is split across them at
          checkout, weighted by each product&apos;s price.
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
            <p className="text-sm text-muted-foreground">Show this bundle on the storefront</p>
          </div>
          <Switch checked={isActive} onCheckedChange={(checked: boolean) => setIsActive(checked)} />
        </div>
      </Card>

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={isSubmitting || (isEditing && (!componentsLoaded || componentsError))}
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
