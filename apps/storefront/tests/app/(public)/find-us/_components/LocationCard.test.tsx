import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { RetailLocationRecord } from '@/lib/locations/shared'
import { getFallbackImage } from '@/lib/utils/image'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const { LocationCard } = await import('@/app/(public)/find-us/_components/LocationCard')

const GOOGLE_PHOTO = 'https://places.googleapis.com/v1/places/ChIJtest/photos/abc/media?maxWidthPx=1200'
const BLOB_PHOTO = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/locations/store-front.webp'

const location = (overrides: Partial<RetailLocationRecord>): RetailLocationRecord => ({
  id: 'store-1',
  businessName: 'Test Market',
  address: '1 Main St',
  city: 'Zanesville',
  state: 'OH',
  zipCode: '43701',
  phone: null,
  website: null,
  photoUrl: null,
  photoGallery: [],
  latitude: null,
  longitude: null,
  googlePlaceId: 'ChIJtest',
  googleMapsUrl: null,
  directionsUrl: null,
  ...overrides,
})

const imageSrc = () => screen.getByRole('img').getAttribute('src')

describe('LocationCard', () => {
  it('shows the first non-Google gallery photo when a Google photo comes first', () => {
    render(<LocationCard location={location({ photoGallery: [GOOGLE_PHOTO, BLOB_PHOTO] })} />)

    expect(imageSrc()).toBe(BLOB_PHOTO)
  })

  it('shows the placeholder, not a Google photo, when only Google photos exist', () => {
    render(<LocationCard location={location({ photoUrl: GOOGLE_PHOTO, photoGallery: [GOOGLE_PHOTO] })} />)

    expect(imageSrc()).toBe(getFallbackImage())
  })

  it('describes the placeholder in the alt text instead of calling it a storefront', () => {
    render(<LocationCard location={location({ photoUrl: GOOGLE_PHOTO, photoGallery: [GOOGLE_PHOTO] })} />)

    expect(screen.getByRole('img').getAttribute('alt')).toBe('Test Market photo not available')
  })

  it('keeps the storefront alt text for a real store photo', () => {
    render(<LocationCard location={location({ photoGallery: [BLOB_PHOTO] })} />)

    expect(screen.getByRole('img').getAttribute('alt')).toBe('Test Market storefront')
  })
})
