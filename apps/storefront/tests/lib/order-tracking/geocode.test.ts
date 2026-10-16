import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const upsert = vi.fn()
vi.mock('@/lib/prisma', () => ({
  default: { geocodedPlace: { findUnique: (...args: unknown[]) => findUnique(...args), upsert: (...args: unknown[]) => upsert(...args) } },
}))

import { geocode } from '@/lib/order-tracking/geocode'

function nominatim(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

describe('geocode', () => {
  beforeEach(() => {
    findUnique.mockReset()
    upsert.mockReset()
    upsert.mockResolvedValue({})
  })
  afterEach(() => vi.unstubAllGlobals())

  it('answers from the cache without calling the geocoder', async () => {
    findUnique.mockResolvedValue({ query: 'Columbus, OH', lat: 39.96, lng: -83 })
    const fetchMock = nominatim([])
    vi.stubGlobal('fetch', fetchMock)

    await expect(geocode('Columbus,  OH ')).resolves.toEqual({ lat: 39.96, lng: -83 })
    expect(findUnique).toHaveBeenCalledWith({ where: { query: 'Columbus, OH' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a cached miss as unknown without asking again', async () => {
    findUnique.mockResolvedValue({ query: 'Nowhere', lat: null, lng: null })
    const fetchMock = nominatim([])
    vi.stubGlobal('fetch', fetchMock)

    await expect(geocode('Nowhere')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks Nominatim once and caches the answer', async () => {
    findUnique.mockResolvedValue(null)
    const fetchMock = nominatim([{ lat: '41.88', lon: '-87.63' }])
    vi.stubGlobal('fetch', fetchMock)

    await expect(geocode('Chicago, IL 60601, US')).resolves.toEqual({ lat: 41.88, lng: -87.63 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Chicago%2C%20IL%2060601%2C%20US'
    )
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('josemadridsalsa.com')
    expect(upsert).toHaveBeenCalledWith({
      where: { query: 'Chicago, IL 60601, US' },
      create: { query: 'Chicago, IL 60601, US', lat: 41.88, lng: -87.63 },
      update: {},
    })
  })

  it('caches a definite no-match', async () => {
    findUnique.mockResolvedValue(null)
    vi.stubGlobal('fetch', nominatim([]))

    await expect(geocode('Nowhere, ZZ')).resolves.toBeNull()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { query: 'Nowhere, ZZ', lat: null, lng: null } })
    )
  })

  it('does not cache a geocoder failure, so it is retried later', async () => {
    findUnique.mockResolvedValue(null)
    vi.stubGlobal('fetch', nominatim({ error: 'busy' }, 503))

    await expect(geocode('Columbus, OH')).resolves.toBeNull()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('gives up quietly when the cache table has not been migrated', async () => {
    findUnique.mockRejectedValue(
      new Error('The table `public.geocoded_places` does not exist in the current database.')
    )
    const fetchMock = nominatim([{ lat: '1', lon: '1' }])
    vi.stubGlobal('fetch', fetchMock)

    await expect(geocode('Columbus, OH')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
