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
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, X } from 'lucide-react'
import type { Fundraiser } from '@prisma/client'

const fundraiserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  organizationName: z.string().min(1, 'Organization name is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  goal: z.string().optional(),
  commissionRate: z.string().min(1, 'Commission rate is required'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']),
  isActive: z.boolean(),
  subdomain: z.string().optional(),
  missionStatement: z.string().optional(),
  bio: z.string().optional(),
})

type FundraiserFormData = z.infer<typeof fundraiserSchema>

interface FundraiserFormProps {
  fundraiser?: Fundraiser & {
    subdomain?: string | null
    missionStatement?: string | null
    bio?: string | null
  }
}

export default function FundraiserForm({ fundraiser }: FundraiserFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!fundraiser

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FundraiserFormData>({
    resolver: zodResolver(fundraiserSchema),
    defaultValues: {
      name: fundraiser?.name || '',
      slug: fundraiser?.slug || '',
      description: fundraiser?.description || '',
      organizationName: fundraiser?.organizationName || '',
      contactEmail: fundraiser?.contactEmail || '',
      contactPhone: fundraiser?.contactPhone || '',
      startDate: fundraiser?.startDate ? new Date(fundraiser.startDate).toISOString().split('T')[0] : '',
      endDate: fundraiser?.endDate ? new Date(fundraiser.endDate).toISOString().split('T')[0] : '',
      goal: fundraiser?.goal?.toString() || '',
      commissionRate: fundraiser?.commissionRate.toString() || '20',
      status: fundraiser?.status || 'DRAFT',
      isActive: fundraiser?.isActive ?? false,
      subdomain: fundraiser?.subdomain || '',
      missionStatement: fundraiser?.missionStatement || '',
      bio: fundraiser?.bio || '',
    },
  })

  const watchName = watch('name')
  const watchStatus = watch('status')
  const watchIsActive = watch('isActive')

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (!isEditing) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      setValue('slug', slug)
    }
  }

  const onSubmit = async (data: FundraiserFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditing
        ? `/api/fundraisers/${fundraiser.id}`
        : '/api/fundraisers'

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          organizationName: data.organizationName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone || null,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          goal: data.goal ? parseFloat(data.goal) : null,
          commissionRate: parseFloat(data.commissionRate),
          status: data.status,
          isActive: data.isActive,
          subdomain: data.subdomain || null,
          missionStatement: data.missionStatement || null,
          bio: data.bio || null,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to save fundraiser')
      }

      const result = await response.json()
      router.push(`/admin/fundraisers/${result.id}/edit`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-900">{error}</p>
        </Card>
      )}

      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Fundraiser Name *</Label>
            <Input
              id="name"
              {...register('name')}
              onChange={(e) => {
                register('name').onChange(e)
                handleNameChange(e)
              }}
              className="mt-1.5"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="slug">URL Slug *</Label>
            <Input
              id="slug"
              {...register('slug')}
              className="mt-1.5"
              placeholder="e.g., spring-2026-campaign"
            />
            {errors.slug && (
              <p className="text-sm text-red-600 mt-1">{errors.slug.message}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              URL: /fundraisers/{watch('slug') || 'slug'}
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              rows={3}
              className="mt-1.5"
              placeholder="Brief description of the fundraiser campaign"
            />
          </div>
        </div>
      </Card>

      {/* Organization Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Organization Details</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="organizationName">Organization Name *</Label>
            <Input
              id="organizationName"
              {...register('organizationName')}
              className="mt-1.5"
              placeholder="e.g., Lincoln Elementary School"
            />
            {errors.organizationName && (
              <p className="text-sm text-red-600 mt-1">{errors.organizationName.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="contactEmail">Contact Email *</Label>
            <Input
              id="contactEmail"
              type="email"
              {...register('contactEmail')}
              className="mt-1.5"
              placeholder="coordinator@example.com"
            />
            {errors.contactEmail && (
              <p className="text-sm text-red-600 mt-1">{errors.contactEmail.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              type="tel"
              {...register('contactPhone')}
              className="mt-1.5"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </Card>

      {/* Portal & Profile */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Portal & Profile</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="subdomain">Page URL Subdomain</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm text-slate-500">josemadrid.net/f/</span>
              <Input
                id="subdomain"
                {...register('subdomain')}
                placeholder="your-fundraiser"
                className="max-w-xs"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Lowercase letters, numbers, and hyphens only. This is the public-facing link.
            </p>
          </div>

          <div>
            <Label htmlFor="missionStatement">Mission Statement</Label>
            <Textarea
              id="missionStatement"
              {...register('missionStatement')}
              rows={3}
              className="mt-1.5"
              placeholder="Describe the organization's mission and what they're raising funds for"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio / About</Label>
            <Textarea
              id="bio"
              {...register('bio')}
              rows={3}
              className="mt-1.5"
              placeholder="Additional information about the organization"
            />
          </div>
        </div>
      </Card>

      {/* Campaign Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Campaign Settings</h2>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
                className="mt-1.5"
              />
              {errors.startDate && (
                <p className="text-sm text-red-600 mt-1">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
                className="mt-1.5"
              />
              {errors.endDate && (
                <p className="text-sm text-red-600 mt-1">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="goal">Fundraising Goal (USD)</Label>
            <Input
              id="goal"
              type="number"
              step="0.01"
              min="0"
              {...register('goal')}
              className="mt-1.5"
              placeholder="e.g., 5000.00"
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional revenue target for the campaign
            </p>
          </div>

          <div>
            <Label htmlFor="commissionRate">Commission Rate (%) *</Label>
            <Input
              id="commissionRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register('commissionRate')}
              className="mt-1.5"
              placeholder="e.g., 20"
            />
            {errors.commissionRate && (
              <p className="text-sm text-red-600 mt-1">{errors.commissionRate.message}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Percentage of revenue that goes to the organization
            </p>
          </div>
        </div>
      </Card>

      {/* Status */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Status</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="status">Campaign Status</Label>
            <Select
              value={watchStatus}
              onValueChange={(value) => setValue('status', value as any)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ENDED">Ended</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isActive">Active</Label>
              <p className="text-sm text-slate-600">
                Show on public fundraiser listings
              </p>
            </div>
            <Switch
              id="isActive"
              checked={watchIsActive}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Update Fundraiser' : 'Create Fundraiser'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
