import { describe, it, expect } from 'vitest'
import { getFallbackImage, getLocationImageUrl } from '@/lib/utils/image'

describe('getLocationImageUrl', () => {
  it('never returns a Places API (New) photo or the old proxy', () => {
    const url =
      'https://places.googleapis.com/v1/places/ChIJtest/photos/abc123/media?key=k&maxWidthPx=1200'

    expect(getLocationImageUrl(url)).toBe(getFallbackImage())
  })

  it('never returns a legacy Places photo', () => {
    const url =
      'https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=abc&key=k'

    expect(getLocationImageUrl(url)).toBe(getFallbackImage())
  })

  it('keeps non-Google image URLs as they are', () => {
    const url = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/locations/store-front.webp'

    expect(getLocationImageUrl(url)).toBe(url)
  })

  it('uses the placeholder when there is no URL', () => {
    expect(getLocationImageUrl(null)).toBe(getFallbackImage())
    expect(getLocationImageUrl(undefined)).toBe(getFallbackImage())
  })
})
