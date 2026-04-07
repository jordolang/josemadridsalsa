import { NextRequest } from 'next/server';
import {
  getScraperLogs,
  subscribeToScraperEvents,
  type ScraperLogEntry,
} from '@/lib/scraper/scraper-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(entry: ScraperLogEntry) {
        try {
          const data = JSON.stringify(entry);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      }

      // Send existing log history first
      const history = getScraperLogs(campaignId);
      for (const entry of history) {
        send(entry);
      }

      // Subscribe to new events
      const unsubscribe = subscribeToScraperEvents(campaignId, send);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
