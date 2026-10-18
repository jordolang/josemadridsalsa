import { describe, expect, it } from 'vitest'
import {
  addressesMatch,
  isBlobPhotoUrl,
  locationPhotoPathname,
  pickBestPlacePhoto,
} from '@/lib/locations/photo-cache'

describe('locationPhotoPathname', () => {
  it('stores each location under its id', () => {
    expect(locationPhotoPathname('abc123')).toBe('site/images/locations/abc123.webp')
  })
})

describe('isBlobPhotoUrl', () => {
  it('accepts our public Blob store', () => {
    expect(isBlobPhotoUrl('https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/locations/a.webp')).toBe(true)
  })

  it('rejects Google Places, placeholders and junk', () => {
    expect(isBlobPhotoUrl('https://places.googleapis.com/v1/places/x/photos/y/media')).toBe(false)
    expect(isBlobPhotoUrl('/images/store-placeholder.png')).toBe(false)
    expect(isBlobPhotoUrl(null)).toBe(false)
  })
})

describe('pickBestPlacePhoto', () => {
  it('prefers a landscape photo over a larger portrait one', () => {
    const best = pickBestPlacePhoto([
      { name: 'portrait', widthPx: 3000, heightPx: 4000 },
      { name: 'landscape', widthPx: 1200, heightPx: 800 },
    ])
    expect(best?.name).toBe('landscape')
  })

  it('keeps Google order when sizes tie past the cap', () => {
    const best = pickBestPlacePhoto([
      { name: 'first', widthPx: 4000, heightPx: 3000 },
      { name: 'second', widthPx: 4800, heightPx: 3200 },
    ])
    expect(best?.name).toBe('first')
  })

  it('returns null without usable photos', () => {
    expect(pickBestPlacePhoto([])).toBeNull()
    expect(pickBestPlacePhoto(undefined)).toBeNull()
    expect(pickBestPlacePhoto([{ name: 'nosize' }])).toBeNull()
  })
})

describe('addressesMatch', () => {
  it('matches the same street written differently', () => {
    expect(addressesMatch('4990 Houston Road', '4990 Houston Rd, Florence, KY 41042, USA')).toBe(true)
  })

  it('flags a different house number', () => {
    expect(addressesMatch('2507 Chester Blvd', '1500 Chester Blvd, Richmond, IN 47374, USA')).toBe(false)
  })

  it('flags a different street', () => {
    expect(addressesMatch('100 Main St', '100 Oak Ave, Zanesville, OH, USA')).toBe(false)
  })

  it('flags a missing Google address', () => {
    expect(addressesMatch('100 Main St', null)).toBe(false)
  })
})
