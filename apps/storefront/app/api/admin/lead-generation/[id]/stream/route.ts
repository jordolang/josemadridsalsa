import { eventBus, type ScraperEvent } from '@/lib/scraper/event-bus'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"connection","message":"Connected to scraper stream"}\n\n'))

      const unsubscribe = eventBus.subscribe(campaignId, (event: ScraperEvent) => {
        try {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {
          // Stream closed
        }
      })

      const keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          clearInterval(keepaliveInterval)
          unsubscribe()
        }
      }, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
