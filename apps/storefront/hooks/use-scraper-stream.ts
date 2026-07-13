'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ScraperEvent } from '@/lib/scraper/event-bus'

interface UseScrapeStreamOptions {
  campaignId: string
  onEvent?: (event: ScraperEvent) => void
  onError?: (error: Error) => void
  onConnectionChange?: (connected: boolean) => void
  autoReconnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

interface UseScraperStreamState {
  connected: boolean
  events: ScraperEvent[]
  error: Error | null
}

/**
 * Custom hook for managing EventSource connection to scraper stream
 * Handles auto-reconnect, error recovery, and event collection
 */
export function useScraperStream({
  campaignId,
  onEvent,
  onError,
  onConnectionChange,
  autoReconnect = true,
  reconnectAttempts = 5,
  reconnectDelay = 3000,
}: UseScrapeStreamOptions): UseScraperStreamState {
  const [state, setState] = useState<UseScraperStreamState>({
    connected: false,
    events: [],
    error: null,
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const handleError = useCallback(
    (error: Error) => {
      setState((prev) => ({ ...prev, error }))
      onError?.(error)

      if (autoReconnect && reconnectCountRef.current < reconnectAttempts) {
        reconnectCountRef.current += 1
        reconnectTimeoutRef.current = setTimeout(() => {
          // Trigger reconnection by re-running the effect
          setState((prev) => ({ ...prev, connected: false }))
        }, reconnectDelay * reconnectCountRef.current) // Exponential backoff
      }
    },
    [autoReconnect, reconnectAttempts, reconnectDelay, onError]
  )

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return
    }

    try {
      const eventSource = new EventSource(
        `/api/admin/lead-generation/${campaignId}/stream`
      )

      eventSource.addEventListener('open', () => {
        setState((prev) => ({ ...prev, connected: true, error: null }))
        onConnectionChange?.(true)
        reconnectCountRef.current = 0
      })

      eventSource.addEventListener('error', (event) => {
        // EventSource fires 'error' when connection fails
        if (eventSource.readyState === EventSource.CLOSED) {
          setState((prev) => ({ ...prev, connected: false }))
          onConnectionChange?.(false)

          handleError(new Error('EventSource connection closed'))
        }
      })

      eventSource.addEventListener('message', (event) => {
        try {
          const parsedEvent = JSON.parse(event.data) as ScraperEvent

          // Skip keepalive messages
          if ((parsedEvent as any).type === 'connection' || event.data === ': keepalive') {
            return
          }

          setState((prev) => ({
            ...prev,
            events: [...prev.events, parsedEvent],
          }))

          onEvent?.(parsedEvent)
        } catch (err) {
          console.error('[useScraperStream] Failed to parse event:', event.data, err)
        }
      })

      eventSourceRef.current = eventSource
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      handleError(error)
    }
  }, [campaignId, onEvent, onConnectionChange, handleError])

  useEffect(() => {
    connect()

    return () => {
      cleanup()
    }
  }, [connect, cleanup])

  return state
}
