'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, X } from 'lucide-react'
import type { Category } from '@prisma/client'

interface CategoryFormProps {
  category?: Category
  onSuccess?: () => void
  onCancel?: () => void
}

export default function CategoryForm({ category, onSuccess, onCancel }: CategoryFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(category?.name || '')
  const [slug, setSlug] = useState(category?.slug || '')
  const [description, setDescription] = useState(category?.description || '')
  const [image, setImage] = useState(category?.image || '')
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(category?.sortOrder.toString() || '0')
  const [metaTitle, setMetaTitle] = useState(category?.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(category?.metaDescription || '')
  const [ogImage, setOgImage] = useState(category?.ogImage || '')

  const isEditing = !!category

  const handleNameChange = (value: string) => {
    setName(value)
    if (!isEditing) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        name,
        slug,
        description: description || null,
        image: image || null,
        isActive,
        sortOrder: parseInt(sortOrder),
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
      }

      const url = isEditing ? `/api/admin/categories/${category.id}` : '/api/admin/categories'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save category')
      }

      router.refresh()
      onSuccess?.()
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
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
            <p className="text-sm text-slate-500">Show this category on the storefront</p>
          </div>
          <Switch checked={isActive} onCheckedChange={(checked: boolean) => setIsActive(checked)} />
        </div>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />{isEditing ? 'Update' : 'Create'}</>}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
      </div>
    </form>
  )
}
