'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NormalizedLocationFilters, RetailLocationRecord } from '@/lib/locations/shared'

const responseCache = new Map<string, RetailLocationRecord[]>()

const serializeFilters = (filters: NormalizedLocationFilters) => {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.state) params.set('state', filters.state)
  if (filters.city) params.set('city', filters.city)
  params.set('sort', filters.sort)
  if (typeof filters.lat === 'number') params.set('lat', filters.lat.toString())
  if (typeof filters.lng === 'number') params.set('lng', filters.lng.toString())
  if (filters.hasWebsite) params.set('hasWebsite', 'true')
  if (filters.hasPhone) params.set('hasPhone', 'true')
  return `/api/locations?${params.toString()}`
}

export type LocationsMeta = {
  total: number
  appliedFilters: NormalizedLocationFilters
}

export type UseLocationsOptions = {
  initialData?: RetailLocationRecord[]
  initialMeta?: LocationsMeta
}

export type UseLocationsResult = {
  locations: RetailLocationRecord[]
  isLoading: boolean
  isRefetching: boolean
  error: Error | null
  meta?: LocationsMeta
  refetch: () => Promise<void>
}

export function useLocations(filters: NormalizedLocationFilters, options?: UseLocationsOptions): UseLocationsResult {
  const key = useMemo(() => serializeFilters(filters), [filters])
  const [data, setData] = useState<RetailLocationRecord[] | undefined>(() => {
    if (options?.initialData) {
      responseCache.set(key, options.initialData)
      return options.initialData
    }
    return responseCache.get(key)
  })
  const [isLoading, setIsLoading] = useState(!responseCache.has(key))
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [meta, setMeta] = useState<LocationsMeta | undefined>(() => options?.initialMeta)
  const latestKeyRef = useRef(key)

  useEffect(() => {
    let isSubscribed = true
    const controller = new AbortController()
    const fetchData = async () => {
      const cached = responseCache.get(key)
      if (cached) {
        setData(cached)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(key, { signal: controller.signal, next: { revalidate: 0 } })
        if (!response.ok) {
          throw new Error('Failed to load locations')
        }
        const payload = await response.json()
        const parsed = Array.isArray(payload.data) ? (payload.data as RetailLocationRecord[]) : []
        if (!isSubscribed) return
        responseCache.set(key, parsed)
        setData(parsed)
        if (payload.meta) {
          setMeta(payload.meta as LocationsMeta)
        }
      } catch (err) {
        if (!isSubscribed || (err instanceof DOMException && err.name === 'AbortError')) {
          return
        }
        const message = err instanceof Error ? err.message : 'Unable to load locations'
        setError(new Error(message))
      } finally {
        if (isSubscribed) {
          setIsLoading(false)
        }
      }
    }

    latestKeyRef.current = key
    fetchData()

    return () => {
      isSubscribed = false
      controller.abort()
    }
  }, [key])

  const refetch = useCallback(async () => {
    setIsRefetching(true)
    setError(null)
    const controller = new AbortController()

    try {
      const response = await fetch(latestKeyRef.current, { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to refresh locations')
      }
      const payload = await response.json()
      const parsed = Array.isArray(payload.data) ? (payload.data as RetailLocationRecord[]) : []
      responseCache.set(latestKeyRef.current, parsed)
      setData(parsed)
      if (payload.meta) {
        setMeta(payload.meta as LocationsMeta)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Unable to refresh locations'
      setError(new Error(message))
    } finally {
      setIsRefetching(false)
    }
  }, [])

  return {
    locations: data ?? [],
    isLoading,
    isRefetching,
    error,
    refetch,
    meta,
  }
}
