import { eventBus, type ScraperEvent } from '@/lib/scraper/event-bus'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-Sent Events endpoint for real-time scraper updates
 * Streams lead:found, lead:contact_parsed, and campaign events to connected clients
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>
  }
) {
  const { id: campaignId } = await params

  if (!campaignId) {
    return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue('data: {"type":"connection","message":"Connected to scraper stream"}\n\n')

      // Setup event listener
      const unsubscribe = eventBus.subscribe(campaignId, (event: ScraperEvent) => {
        try {
          // Format as Server-Sent Event
          const data = JSON.stringify(event)
          controller.enqueue(`data: ${data}\n\n`)
        } catch (error) {
          console.error('[SSE] Error encoding event:', error)
        }
      })

      // Keepalive ping every 30 seconds to prevent connection timeout
      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(': keepalive\n\n')
        } catch (error) {
          // Connection closed, clean up
          clearInterval(keepaliveInterval)
          unsubscribe()
        }
      }, 30000)

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval)
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering
    },
  })
}
