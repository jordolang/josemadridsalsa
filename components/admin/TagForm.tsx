'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Loader2, Save, X } from 'lucide-react'
import type { Tag } from '@prisma/client'

const tagSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  type: z.enum(['PRODUCT', 'RECIPE', 'MEDIA', 'EVENT', 'GENERAL']),
})

type TagFormData = z.infer<typeof tagSchema>

interface TagFormProps {
  tag?: Tag
}

export default function TagForm({ tag }: TagFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!tag

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: tag?.name || '',
      slug: tag?.slug || '',
      type: tag?.type || 'GENERAL',
    },
  })

  const onSubmit = async (data: TagFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditing
        ? `/api/admin/tags/${tag.id}`
        : '/api/admin/tags'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save tag')
      }

      // Redirect to tags list
      router.push('/admin/tags')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (!isEditing) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setValue('slug', slug)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">
              Tag Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              onChange={(e) => {
                register('name').onChange(e)
                handleNameChange(e)
              }}
              placeholder="Spicy"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input id="slug" {...register('slug')} placeholder="spicy" />
            {errors.slug && (
              <p className="text-sm text-red-600">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">
              Tag Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch('type')}
              onValueChange={(value: any) => setValue('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">General</SelectItem>
                <SelectItem value="PRODUCT">Product</SelectItem>
                <SelectItem value="RECIPE">Recipe</SelectItem>
                <SelectItem value="MEDIA">Media</SelectItem>
                <SelectItem value="EVENT">Event</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              Tag type determines where this tag can be used
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Update Tag' : 'Create Tag'}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/tags')}
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}
