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
import { Loader2, Save, X, MapPin } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PhotoGalleryInput } from './PhotoGalleryInput'

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

const locationSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be 2 letters'),
  zipCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  photoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  googlePlacesId: z.string().optional().nullable(),
  latitude: z.string().optional().or(z.literal('')),
  longitude: z.string().optional().or(z.literal('')),
  county: z.string().optional().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
  photoGallery: z.array(z.object({
    url: z.string().url('Must be a valid URL'),
    caption: z.string().optional().nullable(),
  })).optional(),
})

type LocationFormData = z.infer<typeof locationSchema>

interface LocationFormProps {
  location?: any // RetailLocation with photos
}

export default function LocationForm({ location }: LocationFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!location

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      businessName: location?.businessName || '',
      address: location?.address || '',
      city: location?.city || '',
      state: location?.state || '',
      zipCode: location?.zipCode || '',
      phone: location?.phone || '',
      website: location?.website || '',
      photoUrl: location?.photoUrl || '',
      googlePlacesId: location?.googlePlacesId || '',
      latitude: location?.latitude?.toString() || '',
      longitude: location?.longitude?.toString() || '',
      county: location?.county || '',
      isActive: location?.isActive ?? true,
      sortOrder: location?.sortOrder || 0,
      photoGallery: location?.photos?.map((p: any) => ({
        url: p.url,
        caption: p.caption,
      })) || [],
    },
  })

  const onSubmit = async (data: LocationFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Clean up empty strings to null
      const payload = {
        ...data,
        zipCode: data.zipCode || null,
        phone: data.phone || null,
        website: data.website || null,
        photoUrl: data.photoUrl || null,
        googlePlacesId: data.googlePlacesId || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        county: data.county || null,
      }

      const url = isEditing
        ? `/api/admin/locations/${location.id}`
        : '/api/admin/locations'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save location')
      }

      toast({
        title: isEditing ? 'Location updated' : 'Location created',
        description: `${data.businessName} has been saved successfully.`,
      })

      // Redirect to locations list
      router.push('/admin/locations')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  const handleGeocode = async () => {
    const address = watch('address')
    const city = watch('city')
    const state = watch('state')
    const zipCode = watch('zipCode')

    if (!address) {
      toast({
        title: 'Address required',
        description: 'Please enter an address before geocoding.',
        variant: 'destructive',
      })
      return
    }

    setIsGeocoding(true)

    try {
      const response = await fetch('/api/admin/locations/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, city, state, zipCode }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Geocoding failed')
      }

      setValue('latitude', result.latitude.toString())
      setValue('longitude', result.longitude.toString())

      toast({
        title: 'Geocoding successful',
        description: `Coordinates: ${result.latitude}, ${result.longitude}`,
      })
    } catch (err: any) {
      toast({
        title: 'Geocoding failed',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsGeocoding(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Basic Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="businessName">
              Business Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="businessName"
              {...register('businessName')}
              placeholder="Campbell's Foodland"
            />
            {errors.businessName && (
              <p className="text-sm text-red-600">{errors.businessName.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">
              Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="3 S Maysville Ave"
            />
            {errors.address && (
              <p className="text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">
              City <span className="text-red-500">*</span>
            </Label>
            <Input
              id="city"
              {...register('city')}
              placeholder="Zanesville"
            />
            {errors.city && (
              <p className="text-sm text-red-600">{errors.city.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">
              State <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch('state')}
              onValueChange={(value) => setValue('state', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && (
              <p className="text-sm text-red-600">{errors.state.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              {...register('zipCode')}
              placeholder="43701"
            />
            {errors.zipCode && (
              <p className="text-sm text-red-600">{errors.zipCode.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="county">County</Label>
            <Input
              id="county"
              {...register('county')}
              placeholder="Muskingum"
            />
            {errors.county && (
              <p className="text-sm text-red-600">{errors.county.message}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Contact Information */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Contact Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="(740) 453-3675"
            />
            {errors.phone && (
              <p className="text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              {...register('website')}
              placeholder="https://example.com"
            />
            {errors.website && (
              <p className="text-sm text-red-600">{errors.website.message}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Geolocation */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Geolocation</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGeocode}
            disabled={isGeocoding}
          >
            {isGeocoding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Geocoding...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Geocode Address
              </>
            )}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              {...register('latitude')}
              placeholder="39.9403"
            />
            {errors.latitude && (
              <p className="text-sm text-red-600">{errors.latitude.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              {...register('longitude')}
              placeholder="-82.0132"
            />
            {errors.longitude && (
              <p className="text-sm text-red-600">{errors.longitude.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="googlePlacesId">Google Places ID</Label>
            <Input
              id="googlePlacesId"
              {...register('googlePlacesId')}
              placeholder="ChIJ..."
            />
            <p className="text-sm text-slate-500">
              Used for fetching photos and additional data from Google Places API
            </p>
            {errors.googlePlacesId && (
              <p className="text-sm text-red-600">{errors.googlePlacesId.message}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Photos */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Photos</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photoUrl">Primary Photo URL</Label>
            <Input
              id="photoUrl"
              {...register('photoUrl')}
              placeholder="https://example.com/photo.jpg"
            />
            <p className="text-sm text-slate-500">
              Main photo displayed in search results
            </p>
            {errors.photoUrl && (
              <p className="text-sm text-red-600">{errors.photoUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Photo Gallery</Label>
            <PhotoGalleryInput
              photos={watch('photoGallery') || []}
              onChange={(photos) => setValue('photoGallery', photos)}
            />
            <p className="text-sm text-slate-500">
              Additional photos for the location detail page
            </p>
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-sm text-slate-500">
                Show this location on the public Find Us page
              </p>
            </div>
            <Switch
              checked={watch('isActive')}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              {...register('sortOrder', { valueAsNumber: true })}
            />
            <p className="text-sm text-slate-500">
              Lower numbers appear first in the list
            </p>
            {errors.sortOrder && (
              <p className="text-sm text-red-600">{errors.sortOrder.message}</p>
            )}
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
              {isEditing ? 'Update Location' : 'Create Location'}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/locations')}
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}
